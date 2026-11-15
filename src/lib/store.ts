import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Conversation,
  AppSettings,
  DEFAULT_JEWEL_METRICS,
  ModelInfo,
  Gift,
  Message,
  UserProfile,
  JewelMetrics,
} from './types';
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
      lockReason?: string
    ) => {
      void coordinator.addMemory({
        content: memoryContent,
        origin,
        author,
        modelId,
        caption,
        isLocked,
        lockReason,
      });
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
        wallArtUrl?: string;
        avatarUrl?: string;
        avatarEmoji?: string;
        displayName?: string;
        roleTitle?: string;
      }
    ) => {
      void coordinator.mutateCompanion(modelKey, (currentEntity) => ({
        ...currentEntity,
        displayName:
          updates.displayName !== undefined ? updates.displayName : currentEntity.displayName,
        roleTitle: updates.roleTitle !== undefined ? updates.roleTitle : currentEntity.roleTitle,
        avatarEmoji:
          updates.avatarEmoji !== undefined ? updates.avatarEmoji : currentEntity.avatarEmoji,
        avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : currentEntity.avatarUrl,
        themeColor:
          updates.themeColor !== undefined ? updates.themeColor : currentEntity.themeColor,
        bio: updates.bio !== undefined ? updates.bio : currentEntity.bio,
        moodStatus:
          updates.moodStatus !== undefined ? updates.moodStatus : currentEntity.moodStatus,
        currentActivity:
          updates.currentActivity !== undefined
            ? updates.currentActivity
            : currentEntity.currentActivity,
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
          wallArtUrl:
            updates.wallArtUrl !== undefined
              ? updates.wallArtUrl
              : currentEntity.roomDecor?.wallArtUrl,
        },
      }));
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
    (description: string) => {
      void coordinator.updateSettings((prev) => {
        const newEvent = {
          id: uuidv4(),
          description,
          timestamp: Date.now(),
        };
        return {
          ...prev,
          eventLog: [newEvent, ...(prev.eventLog || [])].slice(0, 10),
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
    (conversationId: string, messageId: string, updates: Partial<Message>) => {
      void coordinator.updateMessage(conversationId, messageId, updates);
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
    (note: string) => {
      void coordinator.updateProfile((prev) => {
        const newNote = { id: uuidv4(), text: note, timestamp: Date.now() };
        if (prev) {
          return {
            ...prev,
            id: prev.id || user?.uid || 'default-profile',
            gemmaNotes: [newNote, ...(prev.gemmaNotes || [])],
            updatedAt: Date.now(),
          };
        }
        return {
          id: user?.uid || 'default-profile',
          name: 'User',
          gemmaNotes: [newNote],
          updatedAt: Date.now(),
        };
      });
    },
    [coordinator, user?.uid]
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
    profile,
    updateProfile,
    addGemmaNote,
  };
}
