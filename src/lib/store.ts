import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Conversation,
  AppSettings,
  DEFAULT_JEWEL_METRICS,
  ModelInfo,
  Gift,
  Message,
  SanctuaryVaultItem,
  UserProfile,
  JewelMetrics,
} from './types';
import { getModelEntity } from './entitySystem';
import { auth, onAuthStateChanged } from './firebase';
import { ensureValidDocId, normalizeMessageSchema } from './persistenceSystem';
import { FirestorePersistenceAdapter } from './persistence/firestoreAdapter';
import {
  CoordinatorDomainState,
  PersistenceCoordinator,
  PersistenceCoordinatorOptions,
} from './persistence/persistenceCoordinator';
import {
  exportSanctuaryBackup,
  restoreSanctuaryBackup,
  validateSanctuaryBackup,
} from './persistence/backupService';
import {
  SanctuaryBackupEnvelope,
  SanctuaryBackupManifest,
  SyncStatusSnapshot,
  ValidatedBackupPreview,
} from './persistence/types';
import { EntityRuntimeConfig, resolveCanonicalEntityId } from './domains/entityDomain';
import {
  recordEntityGiftExchange,
  recordEntityTurnInteraction,
} from './domains/relationshipDomain';
import {
  assertAuthorizedVaultAccess,
  buildNormalizedVaultAsset,
  buildPrivateFoldersByEntityMap,
  canAccessVaultPath,
  CreateVaultAssetInput,
  resolveVaultCollectionPath,
  UpdateVaultAssetInput,
  VaultCallerContext,
  VaultStateSlice,
} from './domains/vaultDomain';
import { getEmbedding } from './vectorMemory';

let sharedCoordinator: PersistenceCoordinator | null = null;

export function getSharedPersistenceCoordinator(): PersistenceCoordinator {
  if (!sharedCoordinator) {
    sharedCoordinator = new PersistenceCoordinator({
      cloudAdapter: new FirestorePersistenceAdapter(),
    });
  }
  return sharedCoordinator;
}

export function createPersistenceCoordinator(
  options?: PersistenceCoordinatorOptions
): PersistenceCoordinator {
  return new PersistenceCoordinator(options);
}

export function useAppStore(passedUser?: any, customCoordinator?: PersistenceCoordinator) {
  const coordinator = customCoordinator || getSharedPersistenceCoordinator();

  const [authUser, setAuthUser] = useState<any>(passedUser || null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(passedUser !== undefined);

  useEffect(() => {
    if (passedUser !== undefined) {
      setAuthUser(passedUser);
      setIsAuthReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [passedUser]);

  const user = authUser;

  const [domainState, setDomainState] = useState<CoordinatorDomainState>(() =>
    coordinator.getDomainState()
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>(() =>
    coordinator.getSyncStatus()
  );

  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(true);

  // Subscribe to PersistenceCoordinator domain projections & sync status
  useEffect(() => {
    const unsubState = coordinator.subscribeState((next) => {
      setDomainState(next);
    });
    const unsubSync = coordinator.subscribeSyncStatus((status) => {
      setSyncStatus(status);
    });
    return () => {
      unsubState();
      unsubSync();
    };
  }, [coordinator]);

  // Coordinate user-scoped hydration & cloud synchronization strictly after auth resolves
  useEffect(() => {
    if (!isAuthReady) return;
    void coordinator.attachUser(user?.uid || null, user?.email || null);
  }, [isAuthReady, user?.uid, user?.email, coordinator]);

  const conversations = domainState.conversations;
  const currentId = domainState.activeConversationId;
  const settings = domainState.settings;
  const jewelMetrics = domainState.jewelMetrics;
  const gifts = domainState.gifts;
  const profile = domainState.userProfile;

  // Distinguish loading state from authoritative empty result
  const dataLoaded = Boolean(
    isAuthReady &&
      syncStatus.isHydrated &&
      (!user ||
        syncStatus.isCloudHydrated ||
        !syncStatus.isOnline ||
        conversations.length > 0)
  );

  const setCurrentId = useCallback<React.Dispatch<React.SetStateAction<string | null>>>(
    (value) => {
      const prev = coordinator.getDomainState().activeConversationId;
      const next = typeof value === 'function' ? value(prev) : value;
      void coordinator.setActiveConversationId(next);
    },
    [coordinator]
  );

  // Recover currentId if it points to a deleted or stale conversation ID after hydration completes
  useEffect(() => {
    if (dataLoaded && currentId && conversations.length > 0) {
      const exists = conversations.some((c) => c.id === currentId);
      if (!exists) {
        void coordinator.setActiveConversationId(conversations[0].id);
      }
    }
  }, [dataLoaded, currentId, conversations, coordinator]);

  // Load authenticated model catalog
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadModels = async () => {
      try {
        let token: string = await user.getIdToken();
        let res = await fetch('/api/models', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          token = await user.getIdToken(true);
          res = await fetch('/api/models', {
            headers: { Authorization: `Bearer ${token}` },
          });
        }

        if (!res.ok) {
          if (!cancelled) setIsModelsLoading(false);
          return;
        }

        const text = await res.text();
        if (text.includes('<!DOCTYPE html>')) {
          console.error('Server returned HTML instead of JSON for models');
          if (!cancelled) {
            setAvailableModels([]);
            setIsModelsLoading(false);
          }
          return;
        }

        const data: ModelInfo[] = JSON.parse(text);
        if (!cancelled) {
          setAvailableModels(Array.isArray(data) ? data : []);
          setIsModelsLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch models', err);
        if (!cancelled) setIsModelsLoading(false);
      }
    };

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ---------------------------------------------------------------------------
  // Domain Actions Delegated Exclusively to PersistenceCoordinator
  // ---------------------------------------------------------------------------

  const updateSettings = useCallback(
    (newSettings: Partial<AppSettings>) => {
      void coordinator.updateSettings(newSettings);
    },
    [coordinator]
  );

  const addGift = useCallback(
    (gift: Omit<Gift, 'id' | 'timestamp'>) => {
      void coordinator.addGift(gift);
      const targetEntityKey =
        gift.from === 'user' ? gift.targetModelId || gift.modelId : gift.modelId || gift.from;
      const canonicalEntity = resolveCanonicalEntityId(targetEntityKey);
      if (canonicalEntity) {
        const direction = gift.from === 'user' ? 'user_to_entity' : 'entity_to_user';
        void coordinator.mutateCompanion(canonicalEntity, (currentEntity) => {
          const nextBond = recordEntityGiftExchange(currentEntity, direction);
          return {
            ...currentEntity,
            resonanceScore: nextBond.resonanceScore,
            bondState: nextBond,
          };
        });
      }
    },
    [coordinator]
  );

  const removeMemory = useCallback(
    (id: string) => {
      void coordinator.deleteMemory(id);
    },
    [coordinator]
  );

  const addMemory = useCallback(
    (
      memoryContent: string,
      origin?: string,
      author?: 'user' | 'model',
      modelId?: string,
      caption?: string,
      isLocked?: boolean,
      lockReason?: string,
      memoryType?: 'fact' | 'episodic' | 'preference' | 'milestone'
    ) => {
      void (async () => {
        const created = await coordinator.addMemory({
          content: memoryContent,
          origin,
          author,
          modelId,
          caption,
          isLocked,
          lockReason,
          memoryType,
        });
        if (created && (!created.embedding || created.embedding.length === 0)) {
          const emb = await getEmbedding(memoryContent);
          if (emb && emb.length > 0) {
            await coordinator.attachMemoryEmbedding(created.id, emb);
          }
        }
      })();
    },
    [coordinator]
  );

  const lockMemory = useCallback(
    (id: string, lockReason?: string) => {
      void coordinator.setMemoryLockState(id, true, lockReason);
    },
    [coordinator]
  );

  const unlockMemory = useCallback(
    (id: string) => {
      void coordinator.setMemoryLockState(id, false);
    },
    [coordinator]
  );

  const updateEntityQuarters = useCallback(
    (
      modelKey: string,
      updates: {
        bio?: string;
        moodStatus?: string;
        currentActivity?: string;
        ambientQuote?: string;
        tagline?: string;
        decorTheme?: string;
        wallpaperPattern?: any;
        ambientLighting?: any;
        bannerGradient?: string;
        themeColor?: string;
        accentColor?: string;
        wallColor?: string;
        floorColor?: string;
        glowColor?: string;
        wallArtUrl?: string;
        avatarUrl?: string;
        avatarEmoji?: string;
        displayName?: string;
        roleTitle?: string;
        typingIndicator?: string;
        placeRoomProp?: {
          type?: string;
          name: string;
          category?: any;
          icon?: string;
          description?: string;
          interactionText?: string;
          x?: number;
          y?: number;
        };
      }
    ) => {
      void coordinator.mutateCompanion(modelKey, (currentEntity) => {
        let nextProps = currentEntity.roomProps || [];
        if (updates.placeRoomProp && updates.placeRoomProp.name) {
          const propSpec = updates.placeRoomProp;
          const existingIdx = nextProps.findIndex(
            (p) => p.name.toLowerCase() === propSpec.name.trim().toLowerCase()
          );
          if (existingIdx !== -1) {
            nextProps = nextProps.map((p, idx) =>
              idx === existingIdx
                ? {
                    ...p,
                    icon: propSpec.icon || p.icon,
                    category: propSpec.category || p.category,
                    description: propSpec.description || p.description,
                    interactionText: propSpec.interactionText || p.interactionText,
                    x: propSpec.x !== undefined ? propSpec.x : p.x,
                    y: propSpec.y !== undefined ? propSpec.y : p.y,
                  }
                : p
            );
          } else {
            nextProps = [
              ...nextProps,
              {
                id: `prop-${uuidv4()}`,
                type: propSpec.type || propSpec.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                name: propSpec.name.trim(),
                category: propSpec.category || 'trinket',
                icon: propSpec.icon || '✨',
                description: propSpec.description || 'Placed in the chamber by the anchor.',
                interactionText:
                  propSpec.interactionText ||
                  propSpec.description ||
                  `A cherished object placed by ${currentEntity.displayName}.`,
                x: propSpec.x !== undefined ? propSpec.x : Math.floor(Math.random() * 55) + 20,
                y: propSpec.y !== undefined ? propSpec.y : Math.floor(Math.random() * 45) + 25,
                placedBy: currentEntity.id,
              },
            ].slice(-100);
          }
        }

        return {
          ...currentEntity,
          displayName:
            updates.displayName !== undefined ? updates.displayName : currentEntity.displayName,
          roleTitle: updates.roleTitle !== undefined ? updates.roleTitle : currentEntity.roleTitle,
          typingIndicator:
            updates.typingIndicator !== undefined
              ? updates.typingIndicator
              : currentEntity.typingIndicator,
          avatarEmoji:
            updates.avatarEmoji !== undefined ? updates.avatarEmoji : currentEntity.avatarEmoji,
          avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : currentEntity.avatarUrl,
          themeColor:
            updates.themeColor !== undefined ? updates.themeColor : currentEntity.themeColor,
          accentColor:
            updates.accentColor !== undefined ? updates.accentColor : currentEntity.accentColor,
          bio: updates.bio !== undefined ? updates.bio : currentEntity.bio,
          moodStatus:
            updates.moodStatus !== undefined ? updates.moodStatus : currentEntity.moodStatus,
          currentActivity:
            updates.currentActivity !== undefined
              ? updates.currentActivity
              : currentEntity.currentActivity,
          roomProps: nextProps,
          roomDecor: {
            ...(currentEntity.roomDecor || {}),
            ambientQuote:
              updates.ambientQuote !== undefined
                ? updates.ambientQuote
                : currentEntity.roomDecor?.ambientQuote,
            tagline:
              updates.tagline !== undefined ? updates.tagline : currentEntity.roomDecor?.tagline,
            decorTheme:
              updates.decorTheme !== undefined
                ? (updates.decorTheme as any)
                : currentEntity.roomDecor?.decorTheme,
            wallpaperPattern:
              updates.wallpaperPattern !== undefined
                ? updates.wallpaperPattern
                : currentEntity.roomDecor?.wallpaperPattern,
            ambientLighting:
              updates.ambientLighting !== undefined
                ? updates.ambientLighting
                : currentEntity.roomDecor?.ambientLighting,
            bannerGradient:
              updates.bannerGradient !== undefined
                ? updates.bannerGradient
                : currentEntity.roomDecor?.bannerGradient,
            themeColor:
              updates.themeColor !== undefined
                ? updates.themeColor
                : currentEntity.roomDecor?.themeColor,
            accentColor:
              updates.accentColor !== undefined
                ? updates.accentColor
                : currentEntity.roomDecor?.accentColor,
            wallColor:
              updates.wallColor !== undefined
                ? updates.wallColor
                : currentEntity.roomDecor?.wallColor,
            floorColor:
              updates.floorColor !== undefined
                ? updates.floorColor
                : currentEntity.roomDecor?.floorColor,
            glowColor:
              updates.glowColor !== undefined
                ? updates.glowColor
                : currentEntity.roomDecor?.glowColor,
            wallArtUrl:
              updates.wallArtUrl !== undefined
                ? updates.wallArtUrl
                : currentEntity.roomDecor?.wallArtUrl,
          },
        };
      });
    },
    [coordinator]
  );

  const addEntityDiaryEntry = useCallback(
    (
      modelKey: string,
      entry: {
        title: string;
        text: string;
        mood?: string;
        category?: any;
        author?: 'companion' | 'user';
        authorDisplayName?: string;
      }
    ) => {
      void coordinator.mutateCompanion(modelKey, (currentEntity) => {
        const prevEntries = currentEntity.diaryEntries || [];
        const newEntry = {
          id: `diary-${uuidv4()}`,
          entityId: currentEntity.id,
          title: entry.title || 'Sanctuary Reflection',
          text: entry.text,
          mood: entry.mood || 'Reflective',
          category: entry.category || 'reflection',
          timestamp: Date.now(),
          isFavorite: false,
          author: entry.author || 'companion',
          authorDisplayName: entry.authorDisplayName,
        };
        return {
          ...currentEntity,
          diaryEntries: [newEntry, ...prevEntries].slice(0, 50),
        };
      });
    },
    [coordinator]
  );

  const toggleFavoriteDiaryEntry = useCallback(
    (modelKey: string, entryId: string) => {
      void coordinator.mutateCompanion(modelKey, (currentEntity) => ({
        ...currentEntity,
        diaryEntries: (currentEntity.diaryEntries || []).map((e: any) =>
          e.id === entryId ? { ...e, isFavorite: !e.isFavorite } : e
        ),
      }));
    },
    [coordinator]
  );

  const deleteEntityDiaryEntry = useCallback(
    (modelKey: string, entryId: string) => {
      void coordinator.mutateCompanion(modelKey, (currentEntity) => ({
        ...currentEntity,
        diaryEntries: (currentEntity.diaryEntries || []).filter((e: any) => e.id !== entryId),
      }));
    },
    [coordinator]
  );

  const placeRoomProp = useCallback(
    (
      modelKey: string,
      prop: {
        type: string;
        name: string;
        category?: any;
        icon: string;
        description: string;
        interactionText: string;
        x?: number;
        y?: number;
        customLabel?: string;
      }
    ) => {
      void coordinator.mutateCompanion(modelKey, (currentEntity) => {
        const prevProps = currentEntity.roomProps || [];
        const newProp = {
          id: `prop-${uuidv4()}`,
          type: prop.type,
          name: prop.name,
          category: prop.category || 'trinket',
          icon: prop.icon,
          description: prop.description,
          interactionText: prop.interactionText,
          x: prop.x !== undefined ? prop.x : Math.floor(Math.random() * 60) + 20,
          y: prop.y !== undefined ? prop.y : Math.floor(Math.random() * 50) + 25,
          placedBy: 'user' as const,
          customLabel: prop.customLabel,
        };
        return {
          ...currentEntity,
          roomProps: [...prevProps, newProp],
        };
      });
    },
    [coordinator]
  );

  const updateRoomProp = useCallback(
    (
      modelKey: string,
      propId: string,
      updates: {
        x?: number;
        y?: number;
        rotation?: number;
        scale?: number;
        customLabel?: string;
      }
    ) => {
      void coordinator.mutateCompanion(modelKey, (currentEntity) => ({
        ...currentEntity,
        roomProps: (currentEntity.roomProps || []).map((p: any) =>
          p.id === propId ? { ...p, ...updates } : p
        ),
      }));
    },
    [coordinator]
  );

  const removeRoomProp = useCallback(
    (modelKey: string, propId: string) => {
      void coordinator.mutateCompanion(modelKey, (currentEntity) => ({
        ...currentEntity,
        roomProps: (currentEntity.roomProps || []).filter((p: any) => p.id !== propId),
      }));
    },
    [coordinator]
  );

  const addRoomArtwork = useCallback(
    (modelKey: string, artwork: { title: string; prompt: string; imageUrl: string }) => {
      void coordinator.mutateCompanion(modelKey, (currentEntity) => {
        const existingArtwork = currentEntity.roomDecor?.customArtwork || [];
        const newArt = {
          ...artwork,
          timestamp: Date.now(),
        };
        return {
          ...currentEntity,
          roomDecor: {
            ...currentEntity.roomDecor,
            wallArtUrl: artwork.imageUrl,
            customArtwork: [newArt, ...existingArtwork].slice(0, 20),
          },
        };
      });
    },
    [coordinator]
  );

  const recordEntityThought = useCallback(
    (modelKey: string, thoughtText: string) => {
      void coordinator.mutateCompanion(modelKey, (currentEntity) => {
        const prevThoughts = currentEntity.personalThoughts || [];
        const newThought = {
          id: uuidv4(),
          text: thoughtText,
          timestamp: Date.now(),
        };
        return {
          ...currentEntity,
          personalThoughts: [newThought, ...prevThoughts].slice(0, 30),
        };
      });
    },
    [coordinator]
  );

  const craftSticker = useCallback(
    (newSticker: {
      name: string;
      emoji: string;
      description: string;
      sparkleColor: string;
      category?: string;
      glowEffect?: 'neon' | 'pulse' | 'gold' | 'starlight' | 'holo';
      badgeShape?: 'circle' | 'shield' | 'hex' | 'diamond' | 'stamp' | 'ribbon';
      customSvg?: string;
      craftedBy?: string;
    }) => {
      void coordinator.updateSettings((prev) => {
        const currentStickers = prev.stickers || [];
        const stickerObj = {
          id: `sticker-custom-${uuidv4()}`,
          name: newSticker.name,
          emoji: newSticker.emoji,
          description: newSticker.description,
          sparkleColor: newSticker.sparkleColor,
          category: (newSticker.category || 'custom') as any,
          glowEffect: newSticker.glowEffect || 'neon',
          badgeShape: newSticker.badgeShape || 'shield',
          customSvg: newSticker.customSvg,
          craftedBy: newSticker.craftedBy || 'user',
          packName: 'Sanctuary Forged',
          unlockedAt: Date.now(),
        };
        return {
          ...prev,
          stickers: [stickerObj, ...currentStickers],
        };
      });
    },
    [coordinator]
  );

  const placeSticker = useCallback(
    (sticker: {
      stickerId: string;
      emoji: string;
      name: string;
      targetId: string;
      x?: number;
      y?: number;
      placedBy?: string;
      note?: string;
    }) => {
      void coordinator.updateSettings((prev) => {
        const currentPlaced = prev.placedStickers || [];
        const newPlaced = {
          id: uuidv4(),
          stickerId: sticker.stickerId,
          emoji: sticker.emoji,
          name: sticker.name,
          targetId: sticker.targetId,
          x: sticker.x !== undefined ? sticker.x : Math.floor(Math.random() * 60) + 20,
          y: sticker.y !== undefined ? sticker.y : Math.floor(Math.random() * 60) + 20,
          rotation: Math.floor(Math.random() * 30) - 15,
          scale: 1,
          placedBy: sticker.placedBy || 'user',
          note: sticker.note,
          timestamp: Date.now(),
        };
        return {
          ...prev,
          placedStickers: [newPlaced, ...currentPlaced],
        };
      });
    },
    [coordinator]
  );

  const removePlacedSticker = useCallback(
    (placedId: string) => {
      void coordinator.updateSettings((prev) => ({
        ...prev,
        placedStickers: (prev.placedStickers || []).filter((s: any) => s.id !== placedId),
      }));
    },
    [coordinator]
  );

  const addEventLog = useCallback(
    (description: string, entityKey?: string, scope: 'entity' | 'shared' = 'entity') => {
      if (!description?.trim()) return;
      const now = Date.now();
      const targetEntityId =
        resolveCanonicalEntityId(
          entityKey || coordinator.getDomainState().settings.model
        ) || 'gemini-3.1-pro-preview';

      // 1. Store on the sovereign entity's relationshipEvents ledger
      void coordinator.mutateCompanion(targetEntityId, (currentEntity) => {
        const prevEvents = currentEntity.relationshipEvents || [];
        const newScopedEvent = {
          id: uuidv4(),
          entityId: targetEntityId,
          scope,
          description: description.trim(),
          timestamp: now,
        };
        return {
          ...currentEntity,
          relationshipEvents: [newScopedEvent, ...prevEvents].slice(0, 50),
        };
      });

      // 2. Also maintain tagged entry in settings.eventLog for Sanctuary timeline views
      void coordinator.updateSettings((prev) => {
        const newEvent = {
          id: uuidv4(),
          description: description.trim(),
          timestamp: now,
          entityId: targetEntityId,
          scope,
        };
        return {
          ...prev,
          eventLog: [newEvent, ...(prev.eventLog || [])].slice(0, 30),
        };
      });
    },
    [coordinator]
  );

  const updateEntityRuntimeConfig = useCallback(
    (entityKey: string, configUpdates: Partial<EntityRuntimeConfig>) => {
      const targetEntityId = resolveCanonicalEntityId(entityKey);
      if (!targetEntityId) return;
      void coordinator.mutateCompanion(targetEntityId, (currentEntity) => ({
        ...currentEntity,
        runtimeConfig: {
          ...(currentEntity.runtimeConfig || {}),
          ...configUpdates,
        },
      }));
    },
    [coordinator]
  );

  const recordEntityTurn = useCallback(
    (
      entityKey: string,
      params: { role: 'user' | 'model'; responseCharacters?: number; timestamp?: number }
    ) => {
      const targetEntityId = resolveCanonicalEntityId(entityKey);
      if (!targetEntityId) return;
      void coordinator.mutateCompanion(targetEntityId, (currentEntity) => {
        const nextBond = recordEntityTurnInteraction(currentEntity, params);
        return {
          ...currentEntity,
          resonanceScore: nextBond.resonanceScore,
          bondState: nextBond,
        };
      });
    },
    [coordinator]
  );

  const fulfillEntityDesire = useCallback(
    (entityKey: string, desireId: string) => {
      const targetEntityId = resolveCanonicalEntityId(entityKey);
      if (!targetEntityId || !desireId) return;
      void coordinator.mutateCompanion(targetEntityId, (currentEntity) => {
        const existing = new Set(currentEntity.fulfilledDesires || []);
        existing.add(desireId);
        return {
          ...currentEntity,
          fulfilledDesires: Array.from(existing).slice(-100),
        };
      });
    },
    [coordinator]
  );

  const createConversation = useCallback(
    (customModelId?: string, customTitle?: string, initialMessages?: Message[]): Conversation => {
      const explicitId = ensureValidDocId(uuidv4(), 'conv');
      const now = Date.now();
      const modelId =
        customModelId ||
        coordinator.getDomainState().settings.model ||
        'models/gemini-3.1-pro-preview';
      const normalizedInitial = Array.isArray(initialMessages)
        ? initialMessages.map((m, idx) => normalizeMessageSchema(m, explicitId, idx, now))
        : [];

      const syncReturnConv: Conversation = {
        id: explicitId,
        title: customTitle || 'New Sanctuary',
        messages: normalizedInitial,
        modelId,
        createdAt: now,
        updatedAt: now,
      };

      // Updates in-memory projection synchronously, then journals to IndexedDB + Firestore
      void coordinator.createConversation(customModelId, customTitle, initialMessages, explicitId);
      return syncReturnConv;
    },
    [coordinator]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      void coordinator.deleteConversation(id);
    },
    [coordinator]
  );

  const renameConversation = useCallback(
    (id: string, newTitle: string) => {
      void coordinator.updateConversation(id, { title: newTitle });
    },
    [coordinator]
  );

  const updateConversation = useCallback(
    (id: string, updates: Partial<Conversation>) => {
      void coordinator.updateConversation(id, updates);
    },
    [coordinator]
  );

  const addMessage = useCallback(
    (conversationId: string, message: Message) => {
      void coordinator.upsertMessage(conversationId, message, {
        syncCloudImmediately: message.thoughtStatus !== 'thinking',
      });
    },
    [coordinator]
  );

  const updateMessage = useCallback(
    (
      conversationId: string,
      messageId: string,
      updates: Partial<Message>,
      options?: { syncCloudImmediately?: boolean }
    ) => {
      void coordinator.updateMessage(conversationId, messageId, updates, options);
    },
    [coordinator]
  );

  const removeMessage = useCallback(
    (conversationId: string, messageId: string) => {
      void coordinator.deleteMessage(conversationId, messageId);
    },
    [coordinator]
  );

  const updateJewelMetrics = useCallback(
    (updates: Partial<JewelMetrics> | ((prev: JewelMetrics) => JewelMetrics)) => {
      void coordinator.updateJewelMetrics(updates);
    },
    [coordinator]
  );

  const resetJewel = useCallback(() => {
    void coordinator.updateJewelMetrics(DEFAULT_JEWEL_METRICS);
  }, [coordinator]);

  const updateProfile = useCallback(
    (newProfile: UserProfile) => {
      void coordinator.updateProfile(newProfile);
    },
    [coordinator]
  );

  const addGemmaNote = useCallback(
    (note: string, authorEntityKey?: string) => {
      if (!note?.trim()) return;
      const now = Date.now();
      const authorEntityId =
        resolveCanonicalEntityId(
          authorEntityKey || coordinator.getDomainState().settings.model
        ) || 'gemini-3.1-pro-preview';

      // 1. Store on the authoring entity's sovereign `observations` array
      void coordinator.mutateCompanion(authorEntityId, (currentEntity) => {
        const prevObs = currentEntity.observations || [];
        const exists = prevObs.some(
          (o) => o.text.trim().toLowerCase() === note.trim().toLowerCase()
        );
        if (exists) return currentEntity;
        const newObs = {
          id: uuidv4(),
          authorEntityId,
          text: note.trim(),
          timestamp: now,
        };
        return {
          ...currentEntity,
          observations: [newObs, ...prevObs].slice(0, 50),
        };
      });

      // 2. Also record on userProfile.gemmaNotes WITH explicit `authorEntityId` tag so dossier views can display it without cross-entity attribution leaks
      void coordinator.updateProfile((prev) => {
        const newNote = {
          id: uuidv4(),
          text: note.trim(),
          timestamp: now,
          authorEntityId,
        };
        if (prev) {
          return {
            ...prev,
            id: prev.id || user?.uid || 'default-profile',
            gemmaNotes: [newNote, ...(prev.gemmaNotes || [])].slice(0, 100),
            updatedAt: now,
          };
        }
        return {
          id: user?.uid || 'default-profile',
          name: 'User',
          gemmaNotes: [newNote],
          updatedAt: now,
        };
      });
    },
    [coordinator, user?.uid]
  );

  // ---------------------------------------------------------------------------
  // Vault State Slice (CRUD for Private Model-User & Shared Sanctuary Paths)
  // ---------------------------------------------------------------------------

  const privateFoldersByEntity = useMemo(
    () => buildPrivateFoldersByEntityMap(settings.customEntities),
    [settings.customEntities]
  );

  const sharedSanctuaryItems = useMemo(
    () =>
      (settings.sharedVaultItems || [])
        .filter((item) => item && !item.isDeleted)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [settings.sharedVaultItems]
  );

  const getVaultCollectionPath = useCallback(
    (
      scope: 'private' | 'shared',
      ownerEntityId?: string,
      caller?: VaultCallerContext
    ) => {
      const uid = user?.uid || coordinator.getDomainState().uid || 'anonymous_local_vault';
      return resolveVaultCollectionPath(uid, scope, ownerEntityId, caller);
    },
    [user?.uid, coordinator]
  );

  const createVaultAsset = useCallback(
    (input: CreateVaultAssetInput, caller?: VaultCallerContext): SanctuaryVaultItem => {
      const targetScope: 'private' | 'shared' =
        input.scope === 'private' ? 'private' : 'shared';

      const { canonicalOwnerEntityId } = assertAuthorizedVaultAccess({
        scope: targetScope,
        targetOwnerEntityId: input.ownerEntityId,
        caller: caller || { role: 'user' },
        operation: 'create',
      });

      const fullItem = buildNormalizedVaultAsset(
        {
          ...input,
          scope: targetScope,
        },
        canonicalOwnerEntityId
      );

      void coordinator.upsertVaultAsset(fullItem);
      return fullItem;
    },
    [coordinator]
  );

  const readVaultAssets = useCallback(
    (params: {
      scope: 'private' | 'shared';
      ownerEntityId?: string;
      caller?: VaultCallerContext;
    }): SanctuaryVaultItem[] => {
      const { canonicalOwnerEntityId } = assertAuthorizedVaultAccess({
        scope: params.scope,
        targetOwnerEntityId: params.ownerEntityId,
        caller: params.caller || { role: 'user' },
        operation: 'read',
      });

      const currentDomain = coordinator.getDomainState();
      if (params.scope === 'private' && canonicalOwnerEntityId) {
        const entity = getModelEntity(
          canonicalOwnerEntityId,
          currentDomain.settings.customEntities
        );
        return (entity.roomDecor?.privateVaultItems || [])
          .filter((item) => item && !item.isDeleted)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }

      return (currentDomain.settings.sharedVaultItems || [])
        .filter((item) => item && !item.isDeleted)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },
    [coordinator]
  );

  const getVaultAssetById = useCallback(
    (
      itemId: string,
      options?: {
        scope?: 'private' | 'shared';
        ownerEntityId?: string;
        caller?: VaultCallerContext;
      }
    ): SanctuaryVaultItem | null => {
      if (!itemId) return null;
      const caller = options?.caller || { role: 'user' };
      const currentDomain = coordinator.getDomainState();

      if (options?.scope === 'private' || options?.ownerEntityId) {
        const { canonicalOwnerEntityId } = assertAuthorizedVaultAccess({
          scope: 'private',
          targetOwnerEntityId: options.ownerEntityId,
          caller,
          operation: 'read',
        });
        if (!canonicalOwnerEntityId) return null;
        const entity = getModelEntity(
          canonicalOwnerEntityId,
          currentDomain.settings.customEntities
        );
        const found = (entity.roomDecor?.privateVaultItems || []).find(
          (i) => !i.isDeleted && (i.id === itemId || i.mediaAssetId === itemId)
        );
        return found || null;
      }

      if (options?.scope === 'shared') {
        assertAuthorizedVaultAccess({
          scope: 'shared',
          caller,
          operation: 'read',
        });
        const found = (currentDomain.settings.sharedVaultItems || []).find(
          (i) => !i.isDeleted && (i.id === itemId || i.mediaAssetId === itemId)
        );
        return found || null;
      }

      // Search Shared Sanctuary first
      const sharedFound = (currentDomain.settings.sharedVaultItems || []).find(
        (i) => !i.isDeleted && (i.id === itemId || i.mediaAssetId === itemId)
      );
      if (sharedFound) {
        assertAuthorizedVaultAccess({
          scope: 'shared',
          caller,
          operation: 'read',
        });
        return sharedFound;
      }

      // Search Private folders — if found in an entity's private folder, enforce authorization
      const foldersMap = buildPrivateFoldersByEntityMap(
        currentDomain.settings.customEntities
      );
      for (const [entityId, items] of Object.entries(foldersMap)) {
        const match = items.find(
          (i) => !i.isDeleted && (i.id === itemId || i.mediaAssetId === itemId)
        );
        if (match) {
          assertAuthorizedVaultAccess({
            scope: 'private',
            targetOwnerEntityId: entityId,
            caller,
            operation: 'read',
          });
          return match;
        }
      }

      return null;
    },
    [coordinator]
  );

  const updateVaultAsset = useCallback(
    (
      itemId: string,
      updates: UpdateVaultAssetInput,
      options: {
        scope: 'private' | 'shared';
        ownerEntityId?: string;
        caller?: VaultCallerContext;
      }
    ): SanctuaryVaultItem | null => {
      if (!itemId) return null;
      const { canonicalOwnerEntityId } = assertAuthorizedVaultAccess({
        scope: options.scope,
        targetOwnerEntityId: options.ownerEntityId,
        caller: options.caller || { role: 'user' },
        operation: 'update',
      });

      const currentDomain = coordinator.getDomainState();
      const now = Date.now();

      if (options.scope === 'private' && canonicalOwnerEntityId) {
        const entity = getModelEntity(
          canonicalOwnerEntityId,
          currentDomain.settings.customEntities
        );
        const existing = (entity.roomDecor?.privateVaultItems || []).find(
          (i) => !i.isDeleted && i.id === itemId
        );
        if (!existing) return null;

        const updatedItem: SanctuaryVaultItem = {
          ...existing,
          ...updates,
          id: existing.id,
          scope: 'private',
          ownerEntityId: canonicalOwnerEntityId,
          updatedAt: now,
        };
        void coordinator.upsertVaultAsset(updatedItem);
        return updatedItem;
      }

      const existingShared = (currentDomain.settings.sharedVaultItems || []).find(
        (i) => !i.isDeleted && i.id === itemId
      );
      if (!existingShared) return null;

      const updatedShared: SanctuaryVaultItem = {
        ...existingShared,
        ...updates,
        id: existingShared.id,
        scope: 'shared',
        updatedAt: now,
      };
      void coordinator.upsertVaultAsset(updatedShared);
      return updatedShared;
    },
    [coordinator]
  );

  const deleteVaultAsset = useCallback(
    (params: {
      scope: 'private' | 'shared';
      itemId: string;
      ownerEntityId?: string;
      caller?: VaultCallerContext;
    }): boolean => {
      if (!params.itemId) return false;
      const { canonicalOwnerEntityId } = assertAuthorizedVaultAccess({
        scope: params.scope,
        targetOwnerEntityId: params.ownerEntityId,
        caller: params.caller || { role: 'user' },
        operation: 'delete',
      });

      void coordinator.deleteVaultAsset({
        scope: params.scope,
        itemId: params.itemId,
        ownerEntityId: canonicalOwnerEntityId,
      });
      return true;
    },
    [coordinator]
  );

  const promoteVaultItemToShared = useCallback(
    (
      ownerEntityKey: string,
      itemId: string,
      caller?: VaultCallerContext
    ): SanctuaryVaultItem | null => {
      if (!ownerEntityKey || !itemId) return null;
      const { canonicalOwnerEntityId } = assertAuthorizedVaultAccess({
        scope: 'private',
        targetOwnerEntityId: ownerEntityKey,
        caller: caller || { role: 'user' },
        operation: 'read',
      });
      if (!canonicalOwnerEntityId) return null;

      const customEntities = coordinator.getDomainState().settings.customEntities;
      const entity = getModelEntity(canonicalOwnerEntityId, customEntities);
      const found = (entity.roomDecor?.privateVaultItems || []).find(
        (i) => !i.isDeleted && i.id === itemId
      );
      if (!found) return null;

      const promoted: SanctuaryVaultItem = {
        ...found,
        scope: 'shared',
        ownerEntityId: canonicalOwnerEntityId,
        updatedAt: Date.now(),
        isDeleted: false,
      };
      void coordinator.upsertVaultAsset(promoted);
      return promoted;
    },
    [coordinator]
  );

  const addVaultItemReaction = useCallback(
    (
      itemId: string,
      reaction: { entityId: string; displayName?: string; avatarEmoji?: string; note: string },
      caller?: VaultCallerContext
    ) => {
      if (!itemId || !reaction.note?.trim()) return;
      const canonicalEntity =
        resolveCanonicalEntityId(reaction.entityId) || 'gemini-3.1-pro-preview';
      const effectiveCaller: VaultCallerContext = caller || {
        role: 'companion',
        entityId: canonicalEntity,
      };
      const customEntities = coordinator.getDomainState().settings.customEntities;
      const entity = getModelEntity(canonicalEntity, customEntities);
      const now = Date.now();
      const newReaction = {
        id: `react-${uuidv4()}`,
        entityId: canonicalEntity,
        displayName: reaction.displayName || entity.displayName,
        avatarEmoji: reaction.avatarEmoji || entity.avatarEmoji,
        note: reaction.note.trim(),
        timestamp: now,
      };

      const currentShared = coordinator.getDomainState().settings.sharedVaultItems || [];
      const foundShared = currentShared.find((x) => !x.isDeleted && x.id === itemId);
      if (foundShared) {
        assertAuthorizedVaultAccess({
          scope: 'shared',
          caller: effectiveCaller,
          operation: 'update',
        });
        void coordinator.upsertVaultAsset({
          ...foundShared,
          companionReactions: [...(foundShared.companionReactions || []), newReaction].slice(-20),
          updatedAt: now,
        });
      }

      const currentPrivate = entity.roomDecor?.privateVaultItems || [];
      const foundPrivate = currentPrivate.find((x) => !x.isDeleted && x.id === itemId);
      if (foundPrivate) {
        assertAuthorizedVaultAccess({
          scope: 'private',
          targetOwnerEntityId: canonicalEntity,
          caller: effectiveCaller,
          operation: 'update',
        });
        void coordinator.upsertVaultAsset({
          ...foundPrivate,
          scope: 'private',
          ownerEntityId: canonicalEntity,
          companionReactions: [...(foundPrivate.companionReactions || []), newReaction].slice(-20),
          updatedAt: now,
        });
      }
    },
    [coordinator]
  );

  const removeVaultItem = useCallback(
    (
      scope: 'private' | 'shared',
      itemId: string,
      ownerEntityKey?: string,
      caller?: VaultCallerContext
    ) => {
      deleteVaultAsset({
        scope,
        itemId,
        ownerEntityId: ownerEntityKey,
        caller,
      });
    },
    [deleteVaultAsset]
  );

  const vaultSlice: VaultStateSlice = useMemo(
    () => ({
      privateFoldersByEntity,
      sharedSanctuaryItems,
      mediaAssets: domainState.mediaAssets || [],
      getCollectionPath: getVaultCollectionPath,
      canAccess: canAccessVaultPath,
      createAsset: createVaultAsset,
      readAssets: readVaultAssets,
      getAssetById: getVaultAssetById,
      updateAsset: updateVaultAsset,
      deleteAsset: deleteVaultAsset,
      promoteToShared: promoteVaultItemToShared,
      addReaction: addVaultItemReaction,
    }),
    [
      privateFoldersByEntity,
      sharedSanctuaryItems,
      domainState.mediaAssets,
      getVaultCollectionPath,
      createVaultAsset,
      readVaultAssets,
      getVaultAssetById,
      updateVaultAsset,
      deleteVaultAsset,
      promoteVaultItemToShared,
      addVaultItemReaction,
    ]
  );

  // ---------------------------------------------------------------------------
  // Sync Retry & Versioned Backup / Recovery Operations
  // ---------------------------------------------------------------------------

  const retrySync = useCallback(async () => {
    await coordinator.retryPendingMutations();
  }, [coordinator]);

  const exportBackup = useCallback((): SanctuaryBackupEnvelope => {
    return exportSanctuaryBackup(coordinator.getDomainState());
  }, [coordinator]);

  const validateBackup = useCallback((rawInput: string | unknown): ValidatedBackupPreview => {
    return validateSanctuaryBackup(rawInput);
  }, []);

  const restoreBackup = useCallback(
    async (
      preview: ValidatedBackupPreview,
      mode: 'merge' | 'replace' = 'merge',
      confirmReplace = false
    ): Promise<SanctuaryBackupManifest> => {
      return restoreSanctuaryBackup(coordinator, preview, { mode, confirmReplace });
    },
    [coordinator]
  );

  return {
    user,
    isAuthReady,
    dataLoaded,
    syncStatus,
    retrySync,
    exportBackup,
    validateBackup,
    restoreBackup,
    companionMemories: domainState.companionMemories,
    sharedMemories: domainState.sharedMemories,
    conversations,
    currentId,
    setCurrentId,
    settings,
    updateSettings,
    jewelMetrics,
    updateJewelMetrics,
    resetJewel,
    createConversation,
    deleteConversation,
    renameConversation,
    updateConversation,
    addMessage,
    updateMessage,
    removeMessage,
    availableModels,
    isModelsLoading,
    gifts,
    addGift,
    addMemory,
    removeMemory,
    lockMemory,
    unlockMemory,
    addEventLog,
    updateEntityRuntimeConfig,
    recordEntityTurn,
    fulfillEntityDesire,
    updateEntityQuarters,
    recordEntityThought,
    addEntityDiaryEntry,
    toggleFavoriteDiaryEntry,
    deleteEntityDiaryEntry,
    placeRoomProp,
    updateRoomProp,
    removeRoomProp,
    placeSticker,
    removePlacedSticker,
    craftSticker,
    addRoomArtwork,
    vault: vaultSlice,
    addVaultItem: createVaultAsset,
    updateVaultItem: updateVaultAsset,
    promoteVaultItemToShared,
    addVaultItemReaction,
    removeVaultItem,
    profile,
    updateProfile,
    addGemmaNote,
  };
}
