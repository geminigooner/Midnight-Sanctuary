import React, { useState, useRef, useMemo } from 'react';
import {
  FolderHeart,
  FolderLock,
  Lock,
  Users,
  Film,
  Image as ImageIcon,
  FileText,
  Upload,
  Share2,
  Trash2,
  MessageSquare,
  Plus,
  Loader2,
  Check,
  Music,
  Search,
  ShieldCheck,
  BookOpen,
  Gift as GiftIcon,
  ChevronRight,
  HardDrive,
  FolderOpen,
  Pencil,
  Clock,
} from 'lucide-react';
import { useStore, useUI } from '../context/AppContext';
import { getAllEntities, getModelEntity, ModelEntity } from '../lib/entitySystem';
import { resolveCanonicalEntityId } from '../lib/domains/entityDomain';
import {
  SanctuaryVaultItem,
  Memory,
  Gift,
  formatPostedTimestamp,
  formatMediaCategoryLabel,
} from '../lib/types';
import {
  extractVideoMetadataAndStoryboard,
  uploadVideoInChunks,
  formatVideoDurationLabel,
} from '../lib/media/videoProcessor';
import { MediaStorageService } from '../lib/media/mediaStorageService';
import { getSharedPersistenceCoordinator } from '../lib/store';
import { compressImage } from '../lib/imageUtils';
import { VideoAttachmentCard } from './VideoAttachmentCard';
import { CompanionAvatar } from './CompanionAvatar';

export interface VaultDashboardProps {
  embedded?: boolean;
  onCloseModal?: () => void;
}

type FolderSelection =
  | { type: 'shared' }
  | { type: 'private'; entityId: string };

type ContentCategoryFilter =
  | 'all'
  | 'activity'
  | 'video'
  | 'image'
  | 'note'
  | 'memories'
  | 'gifts';

function formatBytesLabel(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const VaultDashboard: React.FC<VaultDashboardProps> = ({
  embedded = false,
  onCloseModal,
}) => {
  const store = useStore();
  const ui = useUI();

  const activeConversation = store.conversations.find((c) => c.id === store.currentId);
  const defaultModelId =
    activeConversation?.modelId || store.settings.model || 'models/gemini-3.1-pro-preview';
  const defaultEntityId = resolveCanonicalEntityId(defaultModelId);

  const allEntities = getAllEntities(store.settings.customEntities);
  const primaryCompanions = useMemo(
    () => allEntities.filter((e) => e.isPrimaryRoster !== false),
    [allEntities]
  );

  const [selectedFolder, setSelectedFolder] = useState<FolderSelection>({
    type: 'private',
    entityId: defaultEntityId,
  });
  const [categoryFilter, setCategoryFilter] = useState<ContentCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showIsolationMatrix, setShowIsolationMatrix] = useState(false);

  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const uploadCaptionRef = useRef('');
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null);
  const [promotedIds, setPromotedIds] = useState<Record<string, boolean>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const browseFilesInputRef = useRef<HTMLInputElement>(null);

  const activePrivateCompanion: ModelEntity = useMemo(() => {
    const targetId =
      selectedFolder.type === 'private' ? selectedFolder.entityId : defaultEntityId;
    return (
      primaryCompanions.find((e) => e.id === targetId) ||
      allEntities.find((e) => e.id === targetId) ||
      primaryCompanions[0]
    );
  }, [selectedFolder, defaultEntityId, primaryCompanions, allEntities]);

  // Compute per-companion private folder statistics via store.vault
  const privateFoldersSummary = useMemo(() => {
    return primaryCompanions.map((comp) => {
      const vaultItems = (
        store.vault?.privateFoldersByEntity?.[comp.id] ??
        comp.roomDecor?.privateVaultItems ??
        []
      ).filter((i) => !i.isDeleted);
      const privateMems = (store.companionMemories?.[comp.id] || []).filter(
        (m: Memory & { isDeleted?: boolean }) => !m.isDeleted
      );
      const privateGifts = (store.gifts || []).filter((g: Gift) => {
        const target = resolveCanonicalEntityId(
          g.targetModelId || g.modelId || ''
        );
        return target === comp.id;
      });
      const totalBytes = vaultItems.reduce((acc, item) => acc + (item.byteSize || 0), 0);
      const isolatedPeers = primaryCompanions
        .filter((other) => other.id !== comp.id)
        .map((other) => other.displayName);
      const collectionPath = store.vault?.getCollectionPath
        ? store.vault.getCollectionPath('private', comp.id).collectionPath
        : `users/${store.user?.uid || 'uid'}/companions/${comp.id}/vault`;

      return {
        companion: comp,
        vaultItems,
        privateMems,
        privateGifts,
        totalAssetsCount:
          vaultItems.length + privateMems.length + privateGifts.length,
        totalBytes,
        isolatedPeers,
        collectionPath,
      };
    });
  }, [primaryCompanions, store.vault, store.companionMemories, store.gifts, store.user?.uid]);

  // Compute Shared Sanctuary folder statistics via store.vault
  const sharedFolderSummary = useMemo(() => {
    const vaultItems = (
      store.vault?.sharedSanctuaryItems ??
      store.settings.sharedVaultItems ??
      []
    ).filter((i) => !i.isDeleted);
    const sharedMems = (store.sharedMemories || []).filter(
      (m: Memory & { isDeleted?: boolean }) => !m.isDeleted
    );
    const totalBytes = vaultItems.reduce((acc, item) => acc + (item.byteSize || 0), 0);
    const collectionPath = store.vault?.getCollectionPath
      ? store.vault.getCollectionPath('shared').collectionPath
      : `users/${store.user?.uid || 'uid'}/sharedVault`;
    return {
      vaultItems,
      sharedMems,
      totalAssetsCount: vaultItems.length + sharedMems.length,
      totalBytes,
      collectionPath,
    };
  }, [store.vault, store.settings.sharedVaultItems, store.sharedMemories, store.user?.uid]);

  const currentPrivateFolder = useMemo(() => {
    return (
      privateFoldersSummary.find(
        (f) => f.companion.id === activePrivateCompanion.id
      ) || privateFoldersSummary[0]
    );
  }, [privateFoldersSummary, activePrivateCompanion.id]);

  // Filter active folder's media items by category & search query
  const filteredVaultItems: SanctuaryVaultItem[] = useMemo(() => {
    const rawItems =
      selectedFolder.type === 'shared'
        ? sharedFolderSummary.vaultItems
        : currentPrivateFolder?.vaultItems || [];

    const sorted = [...rawItems].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );

    return sorted.filter((item) => {
      if (
        categoryFilter === 'memories' ||
        categoryFilter === 'gifts' ||
        categoryFilter === 'activity'
      ) {
        return false;
      }
      if (categoryFilter === 'video' && item.mediaCategory !== 'video') {
        return false;
      }
      if (
        categoryFilter === 'image' &&
        item.mediaCategory !== 'image' &&
        item.mediaCategory !== 'artwork'
      ) {
        return false;
      }
      if (
        categoryFilter === 'note' &&
        item.mediaCategory !== 'note' &&
        item.mediaCategory !== 'audio'
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${item.title} ${item.caption || ''} ${item.mediaDigest || ''} ${item.contributedByName || ''} ${item.acousticTranscript || ''}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [
    selectedFolder.type,
    sharedFolderSummary.vaultItems,
    currentPrivateFolder,
    categoryFilter,
    searchQuery,
  ]);

  const filteredMemories: Memory[] = useMemo(() => {
    if (categoryFilter !== 'all' && categoryFilter !== 'memories') return [];
    const base =
      selectedFolder.type === 'shared'
        ? sharedFolderSummary.sharedMems
        : currentPrivateFolder?.privateMems || [];
    const q = searchQuery.trim().toLowerCase();
    return [...base]
      .filter((m) => !q || m.content.toLowerCase().includes(q))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [
    categoryFilter,
    selectedFolder.type,
    sharedFolderSummary.sharedMems,
    currentPrivateFolder,
    searchQuery,
  ]);

  const filteredGifts: Gift[] = useMemo(() => {
    if (selectedFolder.type === 'shared') return [];
    if (categoryFilter !== 'all' && categoryFilter !== 'gifts') return [];
    const base = currentPrivateFolder?.privateGifts || [];
    const q = searchQuery.trim().toLowerCase();
    return [...base]
      .filter(
        (g) =>
          !q ||
          (g.content || '').toLowerCase().includes(q) ||
          (g.reason || '').toLowerCase().includes(q)
      )
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [selectedFolder.type, categoryFilter, currentPrivateFolder, searchQuery]);

  const userDisplayName = store.profile?.name?.trim() || 'Amanda';

  // Helper to resolve who posted a memory
  const resolveMemoryPoster = (mem: Memory) => {
    const isCompanion =
      mem.author === 'model' ||
      mem.origin === 'tool' ||
      mem.origin === 'save_memory';
    if (isCompanion) {
      const ent = getModelEntity(
        mem.modelId || activePrivateCompanion.id,
        store.settings.customEntities
      );
      return {
        name: ent?.displayName || activePrivateCompanion.displayName,
        emoji: ent?.avatarEmoji || activePrivateCompanion.avatarEmoji || '✦',
        roleLabel: 'Companion',
      };
    }
    return {
      name: `${userDisplayName} (You)`,
      emoji: '💖',
      roleLabel: 'User',
    };
  };

  // Helper to resolve who posted a vault item
  const resolveVaultItemPoster = (item: SanctuaryVaultItem) => {
    if (item.contributedByType === 'companion') {
      const ent = getModelEntity(
        item.contributedByEntityId || item.ownerEntityId || activePrivateCompanion.id,
        store.settings.customEntities
      );
      return {
        name: item.contributedByName || ent?.displayName || 'Companion',
        emoji: ent?.avatarEmoji || '✦',
        roleLabel: 'Companion',
      };
    }
    const rawName = item.contributedByName || userDisplayName;
    const display =
      rawName.toLowerCase() === 'you'
        ? `${userDisplayName} (You)`
        : rawName.includes('(You)')
        ? rawName
        : `${rawName} (You)`;
    return {
      name: display,
      emoji: '💖',
      roleLabel: 'User',
    };
  };

  // Chronological "Who Posted What & When" Activity Ledger for the active folder
  const folderActivityLedger = useMemo(() => {
    const entries: {
      id: string;
      whoName: string;
      whoEmoji: string;
      whatCategory: string;
      whatTitle: string;
      whatDetail?: string;
      provenance?: string;
      timestamp: number;
      scopeLabel: string;
    }[] = [];

    const rawItems =
      selectedFolder.type === 'shared'
        ? sharedFolderSummary.vaultItems
        : currentPrivateFolder?.vaultItems || [];
    const scopeLabel =
      selectedFolder.type === 'shared'
        ? 'Shared Sanctuary'
        : `${activePrivateCompanion.displayName}'s Private Vault`;

    for (const item of rawItems) {
      const poster = resolveVaultItemPoster(item);
      const originOwner =
        item.scope === 'shared' && item.ownerEntityId
          ? getModelEntity(item.ownerEntityId, store.settings.customEntities)
          : null;
      entries.push({
        id: `vault-${item.id}`,
        whoName: poster.name,
        whoEmoji: poster.emoji,
        whatCategory: formatMediaCategoryLabel(item.mediaCategory),
        whatTitle: item.title,
        whatDetail: item.caption || item.mediaDigest || item.textContent,
        provenance: originOwner
          ? `Promoted from ${originOwner.displayName}'s Private Folder`
          : undefined,
        timestamp: item.createdAt || item.updatedAt || 0,
        scopeLabel,
      });

      for (const rx of item.companionReactions || []) {
        entries.push({
          id: `rx-${item.id}-${rx.id}`,
          whoName: rx.displayName,
          whoEmoji: rx.avatarEmoji || '✦',
          whatCategory: `Reaction Note on "${item.title}"`,
          whatTitle: rx.note,
          timestamp: rx.timestamp || item.updatedAt || item.createdAt || 0,
          scopeLabel,
        });
      }
    }

    const rawMems =
      selectedFolder.type === 'shared'
        ? sharedFolderSummary.sharedMems
        : currentPrivateFolder?.privateMems || [];
    for (const mem of rawMems) {
      const poster = resolveMemoryPoster(mem);
      entries.push({
        id: `mem-${mem.id}`,
        whoName: poster.name,
        whoEmoji: poster.emoji,
        whatCategory: mem.isLocked
          ? 'Pinned Core Anchor'
          : selectedFolder.type === 'shared'
          ? 'Shared Sanctuary Memory'
          : `Private Memory (${activePrivateCompanion.displayName})`,
        whatTitle: mem.content,
        timestamp: mem.createdAt || 0,
        scopeLabel,
      });
    }

    if (selectedFolder.type === 'private') {
      for (const gift of currentPrivateFolder?.privateGifts || []) {
        const isFromUser = gift.from === 'user';
        entries.push({
          id: `gift-${gift.id}`,
          whoName: isFromUser
            ? `${userDisplayName} (You)`
            : activePrivateCompanion.displayName,
          whoEmoji: isFromUser ? '💖' : activePrivateCompanion.avatarEmoji || '✦',
          whatCategory: `${formatMediaCategoryLabel(gift.gift_type || 'gift')} for ${
            isFromUser ? activePrivateCompanion.displayName : userDisplayName
          }`,
          whatTitle: gift.content,
          whatDetail: gift.reason,
          timestamp: gift.timestamp || 0,
          scopeLabel,
        });
      }
    }

    const q = searchQuery.trim().toLowerCase();
    return entries
      .filter(
        (e) =>
          !q ||
          e.whoName.toLowerCase().includes(q) ||
          e.whatCategory.toLowerCase().includes(q) ||
          e.whatTitle.toLowerCase().includes(q) ||
          (e.whatDetail || '').toLowerCase().includes(q)
      )
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [
    selectedFolder.type,
    sharedFolderSummary,
    currentPrivateFolder,
    activePrivateCompanion,
    userDisplayName,
    store.settings.customEntities,
    searchQuery,
  ]);

  const handleUploadMediaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (browseFilesInputRef.current) browseFilesInputRef.current.value = '';

    const targetScope: 'private' | 'shared' =
      selectedFolder.type === 'shared' ? 'shared' : 'private';
    const targetOwnerEntityId =
      selectedFolder.type === 'private'
        ? selectedFolder.entityId
        : defaultEntityId;

    const isVideo =
      file.type.startsWith('video/') ||
      /\.(mp4|mov|webm|m4v|mkv|avi|3gp|ogv)$/i.test(file.name);
    const isImage =
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif|heic|avif|bmp)$/i.test(file.name);

    try {
      if (isVideo) {
        setUploadingStatus(`Sampling 8-frame storyboard from ${file.name}...`);
        const sample = await extractVideoMetadataAndStoryboard(file);

        let idToken: string | undefined;
        try {
          if (store.user && typeof store.user.getIdToken === 'function') {
            idToken = await store.user.getIdToken();
          }
        } catch {
          // ignore
        }

        const mediaService = new MediaStorageService(
          getSharedPersistenceCoordinator()
        );
        const storagePromise = mediaService
          .storeBinaryVideoAsset({
            file,
            mimeType: sample.mimeType,
            category: 'message_attachment',
            referenceTag: `vault:${targetScope}:${Date.now()}`,
            ownerEntityId: targetOwnerEntityId,
          })
          .catch(() => null);

        const uploadId = `vault_vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const finalized = await uploadVideoInChunks({
          file,
          uploadId,
          mimeType: sample.mimeType,
          durationSec: sample.durationSec,
          posterDataUrl: sample.posterDataUrl,
          keyframes: sample.keyframes,
          respondingEntityId: targetOwnerEntityId,
          idToken,
          onProgress: (pct, label) => {
            setUploadingStatus(`${label} (${pct}%)`);
          },
        });

        const storedAsset = await storagePromise;
        const customCaption = uploadCaptionRef.current.trim();

        store.vault.createAsset({
          scope: targetScope,
          ownerEntityId: targetScope === 'private' ? targetOwnerEntityId : undefined,
          contributedByType: 'user',
          contributedByName: store.profile?.name || 'You',
          mediaCategory: 'video',
          title: file.name,
          caption: customCaption || undefined,
          mimeType: sample.mimeType,
          mediaAssetId: storedAsset?.asset.id,
          downloadUrl: storedAsset?.asset.downloadUrl,
          posterDataUrl: sample.posterDataUrl,
          durationSec: sample.durationSec,
          byteSize: file.size,
          keyframes: sample.keyframes,
          geminiFileUri: finalized.geminiFileUri,
          geminiFileExpiresAt: finalized.geminiFileExpiresAt,
          acousticTranscript: finalized.acousticTranscript,
          mediaDigest: finalized.mediaDigest,
        });
        setUploadingStatus(null);
        setUploadCaption('');
        uploadCaptionRef.current = '';
        return;
      }

      if (isImage) {
        setUploadingStatus(`Storing image ${file.name}...`);
        const compressed = await compressImage(file);
        const mediaService = new MediaStorageService(
          getSharedPersistenceCoordinator()
        );
        const stored = await mediaService
          .storeMediaAsset({
            dataUrlOrBase64:
              compressed.previewUrl ||
              `data:${compressed.mimeType};base64,${compressed.data}`,
            mimeType: compressed.mimeType,
            category: 'message_attachment',
            referenceTag: `vault:${targetScope}:${Date.now()}`,
            ownerEntityId: targetOwnerEntityId,
          })
          .catch(() => null);

        const customCaption = uploadCaptionRef.current.trim();
        store.vault.createAsset({
          scope: targetScope,
          ownerEntityId: targetScope === 'private' ? targetOwnerEntityId : undefined,
          contributedByType: 'user',
          contributedByName: store.profile?.name || 'You',
          mediaCategory: 'image',
          title: file.name,
          caption: customCaption || undefined,
          mimeType: compressed.mimeType,
          byteSize: file.size,
          mediaAssetId: stored?.asset.id,
          downloadUrl: stored?.asset.downloadUrl,
          posterDataUrl:
            compressed.previewUrl ||
            `data:${compressed.mimeType};base64,${compressed.data}`,
          mediaDigest: customCaption
            ? `Image "${file.name}" saved by ${store.profile?.name || 'You'} — Caption: "${customCaption}"`
            : `Image "${file.name}" saved by ${store.profile?.name || 'You'}.`,
        });
        setUploadingStatus(null);
        setUploadCaption('');
        uploadCaptionRef.current = '';
      }
    } catch (err) {
      console.error('Vault upload failed:', err);
      setUploadingStatus(null);
    }
  };

  const handleSaveVaultNote = () => {
    if (!noteTitle.trim() && !noteBody.trim()) return;
    const targetScope: 'private' | 'shared' =
      selectedFolder.type === 'shared' ? 'shared' : 'private';
    const targetOwnerEntityId =
      selectedFolder.type === 'private'
        ? selectedFolder.entityId
        : undefined;

    store.vault.createAsset({
      scope: targetScope,
      ownerEntityId: targetOwnerEntityId,
      contributedByType: 'user',
      contributedByName: store.profile?.name || 'You',
      mediaCategory: 'note',
      title: noteTitle.trim() || 'Sanctuary Note',
      caption: noteBody.trim(),
      mediaDigest: `${noteTitle.trim() ? noteTitle.trim() + ': ' : ''}${noteBody.trim()}`,
    });
    setNoteTitle('');
    setNoteBody('');
    setShowAddNote(false);
  };

  const handleStartEditAsset = (item: SanctuaryVaultItem) => {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditCaption(
      item.mediaCategory === 'note'
        ? item.caption || item.textContent || item.mediaDigest || ''
        : item.caption || ''
    );
  };

  const handleSaveEditAsset = (item: SanctuaryVaultItem, ownerId: string) => {
    if (!editTitle.trim()) return;
    store.vault.updateAsset(
      item.id,
      {
        title: editTitle.trim(),
        caption: editCaption.trim(),
        ...(item.mediaCategory === 'note'
          ? {
              mediaDigest: `${editTitle.trim()}: ${editCaption.trim()}`,
            }
          : {}),
      },
      {
        scope: item.scope,
        ownerEntityId: item.scope === 'private' ? ownerId : undefined,
      }
    );
    setEditingItemId(null);
  };

  const handleDiscussInChat = (item: SanctuaryVaultItem, targetCompanion?: ModelEntity) => {
    const responder = targetCompanion || activePrivateCompanion;
    const folderLabel =
      item.scope === 'shared'
        ? 'in our Shared Sanctuary folder'
        : `in our Private ${responder.displayName} folder`;
    const prompt = `Can you inspect "${item.title}" (vault item ID: ${item.id}) ${folderLabel} and share your thoughts with me?`;
    ui.setPendingPrompt({
      text: prompt,
      modelId: responder.apiModelId || defaultModelId,
      conversationId: activeConversation?.id,
      autoSend: false,
    });
    if (onCloseModal) {
      onCloseModal();
    } else {
      ui.closeModal('sanctuaryVault');
    }
  };

  return (
    <div className="flex flex-col w-full text-[#F5E1C8]">
      {/* Top Architecture Summary Bar */}
      <div className="px-4 sm:px-6 py-3.5 bg-[#1B1642] border-b-[3px] border-[#2C194D] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-[#B39DE5]">
          <span className="text-[#F5E1C8] font-extrabold">
            Storage Topology:
          </span>
          <span className="tabular-nums">
            4 Private Model-User Folders (
            {privateFoldersSummary.reduce((acc, f) => acc + f.totalAssetsCount, 0)}{' '}
            items)
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums text-[#F198B7] font-extrabold">
            1 Shared Sanctuary Folder ({sharedFolderSummary.totalAssetsCount} common
            items)
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowIsolationMatrix((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151234] hover:bg-[#231D52] text-[#F5E1C8] border-[2px] border-[#2C194D] text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ShieldCheck size={14} className="text-[#F198B7]" />
          <span>{showIsolationMatrix ? 'Hide Isolation Map' : 'View Data-Isolation Map'}</span>
        </button>
      </div>

      {/* Collapsible Data-Isolation & Firestore Path Matrix */}
      {showIsolationMatrix && (
        <div className="px-4 sm:px-6 py-4 bg-[#120E2B] border-b-[3px] border-[#2C194D] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[#F5E1C8] tracking-wide">
              Sovereign Folder Ownership &amp; Firestore Collection Paths
            </h3>
            <span className="text-[11px] font-bold text-[#B39DE5] font-mono">
              store.vault CRUD Slice
            </span>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-[2px] border-[#2C194D] text-[#B39DE5] font-extrabold">
                  <th className="py-2 pr-3">Storage Folder</th>
                  <th className="py-2 px-3">Firestore Collection Path</th>
                  <th className="py-2 px-3">Authorized CRUD Access</th>
                  <th className="py-2 px-3">Blocked Entities</th>
                  <th className="py-2 pl-3 text-right">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C194D]/60 font-bold">
                {privateFoldersSummary.map((folder) => (
                  <tr key={folder.companion.id} className="hover:bg-[#1B1642]/60">
                    <td className="py-2 pr-3 text-[#F5E1C8] font-extrabold whitespace-nowrap">
                      {folder.companion.avatarEmoji} {folder.companion.displayName} Folder
                    </td>
                    <td className="py-2 px-3 text-[#B39DE5] font-mono text-[11px] whitespace-nowrap">
                      {folder.collectionPath}
                    </td>
                    <td className="py-2 px-3 text-emerald-300 whitespace-nowrap">
                      You + {folder.companion.displayName} Only
                    </td>
                    <td className="py-2 px-3 text-[#F198B7]/90">
                      {folder.isolatedPeers.join(' · ')}
                    </td>
                    <td className="py-2 pl-3 text-right font-mono tabular-nums text-[#F5E1C8]">
                      {folder.totalAssetsCount}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#1B1642]/80">
                  <td className="py-2 pr-3 text-[#F198B7] font-extrabold whitespace-nowrap">
                    Shared Sanctuary Folder
                  </td>
                  <td className="py-2 px-3 text-[#F5E1C8] font-mono text-[11px] whitespace-nowrap">
                    {sharedFolderSummary.collectionPath}
                  </td>
                  <td className="py-2 px-3 text-emerald-300">
                    You + All 4 Sovereign Companions
                  </td>
                  <td className="py-2 px-3 text-[#B39DE5]">
                    None (Shared Orchestrator Pool)
                  </td>
                  <td className="py-2 pl-3 text-right font-mono tabular-nums text-[#F198B7]">
                    {sharedFolderSummary.totalAssetsCount}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Split Workspace: Left Folder Navigator + Right Folder Inspector */}
      <div
        className={`grid grid-cols-1 ${
          embedded ? 'lg:grid-cols-12' : 'md:grid-cols-12'
        } min-h-[480px]`}
      >
        {/* LEFT COLUMN: Folder Hierarchy Sidebar (Private Model-User Folders vs. Shared Sanctuary Folder) */}
        <aside
          className={`${
            embedded ? 'lg:col-span-5' : 'md:col-span-4'
          } p-4 sm:p-5 bg-[#161236] border-b-[3px] md:border-b-0 md:border-r-[3px] border-[#2C194D] space-y-5`}
        >
          {/* Section 1: Private Model-User Folders */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <FolderLock size={15} className="text-[#9D7FE3]" />
                <h3 className="text-xs font-extrabold text-[#F5E1C8] tracking-wide">
                  Private Model-User Folders
                </h3>
              </div>
              <span className="text-[11px] font-bold text-[#B39DE5] tabular-nums">
                1-on-1 Isolated
              </span>
            </div>
            <p className="text-[11px] font-semibold text-[#B39DE5]/85 px-1 leading-relaxed">
              Each model entity has its own encrypted 1-on-1 folder with you. Other
              models cannot access or merge these files.
            </p>

            <div className="space-y-2">
              {privateFoldersSummary.map((folder) => {
                const isSelected =
                  selectedFolder.type === 'private' &&
                  selectedFolder.entityId === folder.companion.id;
                return (
                  <button
                    key={folder.companion.id}
                    type="button"
                    onClick={() =>
                      setSelectedFolder({
                        type: 'private',
                        entityId: folder.companion.id,
                      })
                    }
                    className={`w-full p-3 rounded-2xl border-[3px] border-[#2C194D] text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-[#F5E1C8] text-[#2C194D] shadow-[3px_3px_0_#2C194D]'
                        : 'bg-[#1B1642] text-[#F5E1C8] hover:bg-[#231D52]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CompanionAvatar entity={folder.companion} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-extrabold truncate">
                            {folder.companion.displayName}
                          </span>
                          <Lock
                            size={12}
                            className={
                              isSelected ? 'text-[#2C194D]' : 'text-[#9D7FE3]'
                            }
                          />
                        </div>
                        <div
                          className={`text-[11px] font-bold truncate ${
                            isSelected ? 'text-[#2C194D]/75' : 'text-[#B39DE5]'
                          }`}
                        >
                          Only You &amp; {folder.companion.displayName} ·{' '}
                          <span className="tabular-nums">
                            {folder.vaultItems.length} media
                          </span>{' '}
                          ·{' '}
                          <span className="tabular-nums">
                            {folder.privateMems.length} mems
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-xs font-extrabold font-mono tabular-nums ${
                          isSelected ? 'text-[#2C194D]' : 'text-[#F5E1C8]'
                        }`}
                      >
                        {folder.totalAssetsCount}
                      </span>
                      <ChevronRight
                        size={14}
                        className={
                          isSelected ? 'text-[#2C194D]' : 'text-[#B39DE5]'
                        }
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hairline Divider */}
          <div className="h-[2px] bg-[#2C194D]" />

          {/* Section 2: Shared Sanctuary Folder */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <FolderHeart size={15} className="text-[#F198B7]" />
                <h3 className="text-xs font-extrabold text-[#F5E1C8] tracking-wide">
                  Shared Sanctuary Folder
                </h3>
              </div>
              <span className="text-[11px] font-bold text-[#F198B7] tabular-nums">
                All Entities + You
              </span>
            </div>
            <p className="text-[11px] font-semibold text-[#B39DE5]/85 px-1 leading-relaxed">
              Communal folder where you and all 4 model entities view common
              videos, art, and notes with full contributor attribution.
            </p>

            <button
              type="button"
              onClick={() => setSelectedFolder({ type: 'shared' })}
              className={`w-full p-3.5 rounded-2xl border-[3px] border-[#2C194D] text-left transition-all cursor-pointer ${
                selectedFolder.type === 'shared'
                  ? 'bg-[#F198B7] text-[#2C194D] shadow-[3px_3px_0_#2C194D]'
                  : 'bg-[#1B1642] text-[#F5E1C8] hover:bg-[#231D52]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#F5E1C8] border-[2px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shrink-0">
                    <Users size={17} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold truncate">
                      Shared Sanctuary Pool
                    </div>
                    <div
                      className={`text-[11px] font-bold truncate ${
                        selectedFolder.type === 'shared'
                          ? 'text-[#2C194D]/80'
                          : 'text-[#B39DE5]'
                      }`}
                    >
                      Common Assets ·{' '}
                      <span className="tabular-nums">
                        {sharedFolderSummary.vaultItems.length} media
                      </span>{' '}
                      ·{' '}
                      <span className="tabular-nums">
                        {sharedFolderSummary.sharedMems.length} mems
                      </span>
                    </div>
                  </div>
                </div>

                <span
                  className={`text-xs font-extrabold font-mono tabular-nums ${
                    selectedFolder.type === 'shared'
                      ? 'text-[#2C194D]'
                      : 'text-[#F198B7]'
                  }`}
                >
                  {sharedFolderSummary.totalAssetsCount}
                </span>
              </div>

              {/* Participant Avatar Strip */}
              <div
                className={`pt-2 border-t flex items-center justify-between text-[11px] font-bold ${
                  selectedFolder.type === 'shared'
                    ? 'border-[#2C194D]/25 text-[#2C194D]'
                    : 'border-[#2C194D] text-[#B39DE5]'
                }`}
              >
                <span>Shared Access:</span>
                <div className="flex items-center gap-1">
                  {primaryCompanions.map((c) => (
                    <span
                      key={c.id}
                      title={`${c.displayName} has access`}
                      className="text-xs"
                    >
                      {c.avatarEmoji}
                    </span>
                  ))}
                  <span className="ml-1 font-extrabold">+ You</span>
                </div>
              </div>
            </button>
          </div>
        </aside>

        {/* RIGHT COLUMN: Active Folder Contents & Controls */}
        <section
          className={`${
            embedded ? 'lg:col-span-7' : 'md:col-span-8'
          } p-4 sm:p-6 bg-[#151234] flex flex-col gap-4`}
        >
          {/* Active Folder Banner Header */}
          <div className="p-4 rounded-2xl bg-[#1B1642] border-[3px] border-[#2C194D] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              {selectedFolder.type === 'private' ? (
                <CompanionAvatar entity={activePrivateCompanion} size="md" />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-[#F198B7] border-[2.5px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shrink-0">
                  <Users size={22} strokeWidth={2.5} />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-[#F5E1C8] truncate">
                    {selectedFolder.type === 'private'
                      ? `${activePrivateCompanion.displayName} — Private Model-User Folder`
                      : 'Shared Sanctuary Folder — All Models & You'}
                  </h3>
                </div>

                {/* Unboxed Metadata Line with · separators */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-[#B39DE5] mt-0.5">
                  {selectedFolder.type === 'private' ? (
                    <>
                      <span className="text-emerald-300 font-extrabold">
                        Access: Only You &amp; {activePrivateCompanion.displayName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Isolated from:{' '}
                        {currentPrivateFolder?.isolatedPeers.join(', ')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[11px] text-[#F198B7]">
                        {currentPrivateFolder?.collectionPath}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums font-mono">
                        {formatBytesLabel(currentPrivateFolder?.totalBytes)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[#F198B7] font-extrabold">
                        Access: All 4 Companions &amp; You
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[11px] text-[#F5E1C8]">
                        {sharedFolderSummary.collectionPath}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums font-mono">
                        {formatBytesLabel(sharedFolderSummary.totalBytes)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Primary Upload / Browse Files / Add Note Controls + Optional Upload Caption */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full lg:w-auto">
              <input
                type="file"
                accept="image/*,video/mp4,video/quicktime,video/webm,video/*"
                ref={fileInputRef}
                onChange={handleUploadMediaFile}
                className="hidden"
              />
              {/* Unrestricted file input so Android/Pixel launches the system Files & Downloads browser */}
              <input
                type="file"
                ref={browseFilesInputRef}
                onChange={handleUploadMediaFile}
                className="hidden"
              />
              <input
                type="text"
                value={uploadCaption}
                onChange={(e) => {
                  setUploadCaption(e.target.value);
                  uploadCaptionRef.current = e.target.value;
                }}
                placeholder={
                  selectedFolder.type === 'shared'
                    ? 'Add a caption for your shared upload...'
                    : `Add a caption for ${activePrivateCompanion.displayName}...`
                }
                className="px-3 py-2 rounded-xl bg-[#F5E1C8] text-[#2C194D] placeholder-[#2C194D]/55 border-[2px] border-[#2C194D] text-xs font-bold outline-none min-w-[210px]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={Boolean(uploadingStatus)}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F198B7] hover:bg-[#F5E1C8] text-[#2C194D] border-[2.5px] border-[#2C194D] text-xs font-extrabold shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 transition-all disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  title="Pick from Photos / Gallery"
                >
                  {uploadingStatus ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span className="truncate max-w-[140px]">{uploadingStatus}</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Photos / Gallery</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={Boolean(uploadingStatus)}
                  onClick={() => browseFilesInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F5E1C8] hover:bg-[#F198B7] text-[#2C194D] border-[2.5px] border-[#2C194D] text-xs font-extrabold shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 transition-all disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  title="Open Android/Device Files & Downloads to pick an .mp4 or media file"
                >
                  <FolderOpen size={14} />
                  <span>Browse Files / MP4</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddNote((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#B39DE5] hover:bg-[#F5E1C8] text-[#2C194D] border-[2.5px] border-[#2C194D] text-xs font-extrabold shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Note</span>
                </button>
              </div>
            </div>
          </div>

          {/* Add Note Form */}
          {showAddNote && (
            <div className="p-3.5 rounded-2xl bg-[#1B1642] border-[2.5px] border-[#2C194D] space-y-2.5">
              <div className="text-xs font-extrabold text-[#F5E1C8]">
                New Note in{' '}
                {selectedFolder.type === 'shared'
                  ? 'Shared Sanctuary Folder'
                  : `${activePrivateCompanion.displayName}'s Private Folder`}
              </div>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title (e.g., K-Pop Lyric Translation, Favorite Scene)..."
                className="w-full px-3 py-2 rounded-xl bg-[#F5E1C8] text-[#2C194D] font-extrabold text-xs border-[2px] border-[#2C194D] outline-none"
              />
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Write a note, lyric, or keepsake description..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-[#F5E1C8] text-[#2C194D] font-bold text-xs border-[2px] border-[#2C194D] outline-none resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddNote(false)}
                  className="px-3 py-1.5 rounded-xl bg-[#151234] text-[#F5E1C8] border-[2px] border-[#2C194D] text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveVaultNote}
                  className="px-3.5 py-1.5 rounded-xl bg-[#F198B7] text-[#2C194D] border-[2px] border-[#2C194D] text-xs font-extrabold cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </div>
          )}

          {/* Filter Tabs & Search Input Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#1B1642] border-[2px] border-[#2C194D] overflow-x-auto custom-scrollbar">
              {(
                [
                  { id: 'all', label: 'All Assets' },
                  { id: 'activity', label: `Who & When (${folderActivityLedger.length})` },
                  { id: 'video', label: 'Videos' },
                  { id: 'image', label: 'Photos & Art' },
                  { id: 'note', label: 'Notes' },
                  { id: 'memories', label: 'Memories' },
                  ...(selectedFolder.type === 'private'
                    ? ([{ id: 'gifts', label: '1-on-1 Gifts' }] as const)
                    : []),
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    categoryFilter === tab.id
                      ? 'bg-[#F5E1C8] text-[#2C194D]'
                      : 'text-[#B39DE5] hover:text-[#F5E1C8]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2C194D]/60"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by who, what, or keyword..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#F5E1C8] text-[#2C194D] placeholder-[#2C194D]/55 border-[2px] border-[#2C194D] text-xs font-bold outline-none"
              />
            </div>
          </div>

          {/* Folder Contents Feed */}
          <div className="space-y-4">
            {filteredVaultItems.length === 0 &&
            filteredMemories.length === 0 &&
            filteredGifts.length === 0 &&
            (categoryFilter !== 'activity' || folderActivityLedger.length === 0) ? (
              <div className="text-center py-10 px-4 rounded-3xl bg-[#1B1642] border-[3px] border-dashed border-[#2C194D]">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[#151234] border-[2px] border-[#2C194D] flex items-center justify-center text-[#F198B7]">
                  <HardDrive size={22} />
                </div>
                <h4 className="text-sm sm:text-base font-extrabold text-[#F5E1C8] mb-1">
                  {selectedFolder.type === 'private'
                    ? `No matching assets in ${activePrivateCompanion.displayName}'s Private Folder`
                    : 'No matching assets in the Shared Sanctuary Folder'}
                </h4>
                <p className="text-xs font-bold text-[#B39DE5] max-w-md mx-auto mb-4">
                  {selectedFolder.type === 'private'
                    ? `Upload a video clip (up to 10m from Pixel or iPhone), photo, or note here to store it exclusively between you and ${activePrivateCompanion.displayName}.`
                    : 'Upload common videos, photos, or notes here so all 4 companions and you can view, discuss, and leave attributed reaction notes.'}
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F198B7] text-[#2C194D] border-[2.5px] border-[#2C194D] text-xs font-extrabold shadow-[2px_2px_0_#2C194D] cursor-pointer"
                >
                  <Upload size={14} />
                  <span>
                    Upload First Asset to{' '}
                    {selectedFolder.type === 'shared'
                      ? 'Shared Sanctuary'
                      : `${activePrivateCompanion.displayName}'s Folder`}
                  </span>
                </button>
              </div>
            ) : null}

            {/* Chronological "Who Posted What & When" Activity Ledger (Shown on 'activity' tab or as a top overview in 'all') */}
            {folderActivityLedger.length > 0 &&
              (categoryFilter === 'activity' || categoryFilter === 'all') && (
                <div className="rounded-2xl bg-[#1B1642] border-[3px] border-[#2C194D] overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-[#151234] border-b-[2px] border-[#2C194D] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#F5E1C8]">
                      <Clock size={14} className="text-[#F198B7]" />
                      <span>
                        Who Posted What &amp; When —{' '}
                        {selectedFolder.type === 'shared'
                          ? 'Shared Sanctuary Activity Log'
                          : `${activePrivateCompanion.displayName}'s Private Vault Log`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-[#B39DE5] tabular-nums">
                      <span>{folderActivityLedger.length} total posts</span>
                      {categoryFilter === 'all' && folderActivityLedger.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setCategoryFilter('activity')}
                          className="text-[#F198B7] hover:underline font-extrabold cursor-pointer"
                        >
                          View All →
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-[#2C194D] max-h-72 overflow-y-auto custom-scrollbar">
                    {(categoryFilter === 'activity'
                      ? folderActivityLedger
                      : folderActivityLedger.slice(0, 5)
                    ).map((entry) => (
                      <div
                        key={entry.id}
                        className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5 font-bold text-[#B39DE5]">
                            <span className="text-[#F5E1C8] font-extrabold">
                              {entry.whoEmoji} {entry.whoName}
                            </span>
                            <span aria-hidden="true">posted</span>
                            <span className="text-[#F198B7] font-extrabold">
                              {entry.whatCategory}
                            </span>
                            {entry.provenance && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#81E6D9] text-[11px]">
                                  {entry.provenance}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-[#F5E1C8] font-bold truncate">
                            &ldquo;{entry.whatTitle}&rdquo;
                            {entry.whatDetail ? (
                              <span className="text-[#B39DE5]/80 font-normal">
                                {' '}
                                — {entry.whatDetail}
                              </span>
                            ) : null}
                          </p>
                        </div>

                        <div className="text-[11px] font-mono tabular-nums text-[#B39DE5]/90 shrink-0">
                          {formatPostedTimestamp(entry.timestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Media Vault Items Grid */}
            {filteredVaultItems.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredVaultItems.map((item) => {
                  const isPromoted = Boolean(promotedIds[item.id]);
                  const ownerId =
                    item.ownerEntityId || activePrivateCompanion.id;
                  const isEditing = editingItemId === item.id;
                  const poster = resolveVaultItemPoster(item);
                  const originOwnerEntity =
                    item.scope === 'shared' && item.ownerEntityId
                      ? getModelEntity(
                          item.ownerEntityId,
                          store.settings.customEntities
                        )
                      : null;
                  const whatCategoryLabel = formatMediaCategoryLabel(
                    item.mediaCategory
                  );
                  const wasEdited =
                    Boolean(item.updatedAt) &&
                    Boolean(item.createdAt) &&
                    item.updatedAt > item.createdAt + 1500;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between p-4 rounded-2xl bg-[#1B1642] border-[3px] border-[#2C194D] space-y-3"
                    >
                      <div className="space-y-2.5">
                        {/* Unboxed Metadata Header Line: Who Posted What & When (Zero-Pill Discipline) */}
                        <div className="pb-2 border-b border-[#2C194D] space-y-1 text-xs font-bold text-[#B39DE5]">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[#F5E1C8] font-extrabold">
                                {poster.emoji} Posted by {poster.name}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#F198B7] font-extrabold">
                                {whatCategoryLabel}
                              </span>
                              {item.durationSec ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {formatVideoDurationLabel(item.durationSec)}
                                  </span>
                                </>
                              ) : null}
                              {item.byteSize ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {formatBytesLabel(item.byteSize)}
                                  </span>
                                </>
                              ) : null}
                            </div>

                            <span className="text-[11px] font-mono tabular-nums text-[#F5E1C8]/90">
                              {formatPostedTimestamp(item.createdAt)}
                            </span>
                          </div>

                          {(originOwnerEntity || wasEdited) && (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#81E6D9] tabular-nums">
                              {originOwnerEntity ? (
                                <span>
                                  Originally shared in {originOwnerEntity.avatarEmoji}{' '}
                                  {originOwnerEntity.displayName}&apos;s Private Folder
                                </span>
                              ) : (
                                <span />
                              )}
                              {wasEdited && (
                                <span className="text-[#B39DE5]/75">
                                  Edited {formatPostedTimestamp(item.updatedAt, false)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Media Visual Preview */}
                        {item.mediaCategory === 'video' ? (
                          <VideoAttachmentCard
                            video={{
                              id: item.id,
                              fileName: item.title,
                              mimeType: item.mimeType || 'video/mp4',
                              durationSec: item.durationSec || 0,
                              byteSize: item.byteSize || 0,
                              posterDataUrl: item.posterDataUrl || '',
                              mediaAssetId: item.mediaAssetId,
                              downloadUrl: item.downloadUrl,
                              geminiFileUri: item.geminiFileUri,
                              geminiFileExpiresAt: item.geminiFileExpiresAt,
                              keyframes: item.keyframes,
                              acousticTranscript: item.acousticTranscript,
                              mediaDigest: item.mediaDigest,
                              caption: item.caption,
                              scope: item.scope,
                              ownerEntityId: ownerId,
                              vaultItemId: item.id,
                              contributedByName: poster.name,
                              contributedByType: item.contributedByType,
                              contributedByEntityId: item.contributedByEntityId,
                              createdAt: item.createdAt,
                            }}
                            companionName={activePrivateCompanion.displayName}
                            companionEntityId={ownerId}
                            postedByName={poster.name}
                            postedAt={item.createdAt}
                          />
                        ) : (item.mediaCategory === 'image' ||
                            item.mediaCategory === 'artwork') &&
                          (item.posterDataUrl || item.downloadUrl) ? (
                          <div className="rounded-xl overflow-hidden border-[2px] border-[#2C194D] bg-[#0D0A22]">
                            <img
                              src={item.posterDataUrl || item.downloadUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-44 object-cover"
                            />
                          </div>
                        ) : null}

                        {/* Title & Caption / Inline CRUD Edit Mode */}
                        {isEditing ? (
                          <div className="p-2.5 rounded-xl bg-[#151234] border-[2px] border-[#2C194D] space-y-2">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              placeholder="Asset title..."
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[#F5E1C8] text-[#2C194D] font-extrabold text-xs border-[2px] border-[#2C194D] outline-none"
                            />
                            <textarea
                              value={editCaption}
                              onChange={(e) => setEditCaption(e.target.value)}
                              placeholder="Write a caption for this upload..."
                              rows={2}
                              autoFocus
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[#F5E1C8] text-[#2C194D] font-bold text-xs border-[2px] border-[#2C194D] outline-none resize-none"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingItemId(null)}
                                className="px-2.5 py-1 rounded-lg bg-[#1B1642] text-[#F5E1C8] border-[1.5px] border-[#2C194D] text-[11px] font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditAsset(item, ownerId)}
                                className="px-3 py-1 rounded-lg bg-[#F198B7] text-[#2C194D] border-[1.5px] border-[#2C194D] text-[11px] font-extrabold cursor-pointer"
                              >
                                Save Caption
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {item.mediaCategory === 'video' ? (
                                  <Film size={14} className="text-[#F198B7] shrink-0" />
                                ) : item.mediaCategory === 'image' ||
                                  item.mediaCategory === 'artwork' ? (
                                  <ImageIcon
                                    size={14}
                                    className="text-[#9D7FE3] shrink-0"
                                  />
                                ) : item.mediaCategory === 'audio' ? (
                                  <Music
                                    size={14}
                                    className="text-[#F198B7] shrink-0"
                                  />
                                ) : (
                                  <FileText
                                    size={14}
                                    className="text-[#F5E1C8] shrink-0"
                                  />
                                )}
                                <h4 className="text-sm font-extrabold text-[#F5E1C8] truncate">
                                  {item.title}
                                </h4>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleStartEditAsset(item)}
                                className="text-[11px] font-extrabold text-[#F198B7] hover:underline shrink-0 cursor-pointer"
                              >
                                {item.caption ? 'Edit Caption' : '+ Add Caption'}
                              </button>
                            </div>

                            {item.caption && (
                              <div className="p-2 rounded-xl bg-[#151234] border border-[#2C194D] text-xs font-extrabold text-[#F5E1C8] leading-snug">
                                <span className="text-[#F198B7]">💬 Caption:</span>{' '}
                                &ldquo;{item.caption}&rdquo;
                              </div>
                            )}

                            {item.mediaDigest && item.mediaDigest !== item.caption && (
                              <p className="text-xs font-bold text-[#B39DE5]/85 line-clamp-3 leading-relaxed">
                                {item.mediaDigest}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Cross-Model Orchestrator Reaction Ledger (Who Reacted, What Note, and When) */}
                        {item.companionReactions &&
                          item.companionReactions.length > 0 && (
                            <div className="pt-2 border-t border-[#2C194D] space-y-1.5">
                              <div className="text-[11px] font-extrabold text-[#F198B7]">
                                Companion Reactions ({item.companionReactions.length})
                              </div>
                              {item.companionReactions.map((rx) => (
                                <div
                                  key={rx.id}
                                  className="p-2 rounded-xl bg-[#151234] border border-[#2C194D] text-xs font-bold text-[#F5E1C8] space-y-0.5"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-[#B39DE5] tabular-nums">
                                    <span>
                                      <strong className="text-[#F198B7] font-extrabold">
                                        {rx.avatarEmoji || '✦'} {rx.displayName}
                                      </strong>{' '}
                                      · Reaction Note
                                    </span>
                                    <span>
                                      {formatPostedTimestamp(
                                        rx.timestamp || item.updatedAt || item.createdAt
                                      )}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#F5E1C8] leading-snug">
                                    &ldquo;{rx.note}&rdquo;
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>

                      {/* Footer Action Controls */}
                      <div className="pt-2.5 border-t border-[#2C194D] flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDiscussInChat(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F5E1C8] hover:bg-[#F198B7] text-[#2C194D] border-[2px] border-[#2C194D] text-[11px] font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <MessageSquare size={12} />
                            <span>Discuss in Chat</span>
                          </button>

                          {item.scope === 'private' && (
                            <button
                              type="button"
                              disabled={isPromoted}
                              onClick={() => {
                                store.vault.promoteToShared(ownerId, item.id);
                                setPromotedIds((prev) => ({
                                  ...prev,
                                  [item.id]: true,
                                }));
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#9D7FE3] hover:bg-[#F198B7] text-[#2C194D] border-[2px] border-[#2C194D] text-[11px] font-extrabold transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                              title="Copy this private item into the Shared Sanctuary Folder so all models can view it"
                            >
                              {isPromoted ? (
                                <>
                                  <Check size={12} />
                                  <span>Copied to Shared Sanctuary</span>
                                </>
                              ) : (
                                <>
                                  <Share2 size={12} />
                                  <span>Copy to Shared Sanctuary</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditAsset(item)}
                            className="p-1.5 rounded-xl text-[#B39DE5] hover:text-[#F5E1C8] hover:bg-[#151234] transition-colors cursor-pointer"
                            title="Edit asset title or note"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              store.vault.deleteAsset({
                                scope: item.scope,
                                itemId: item.id,
                                ownerEntityId: ownerId,
                              })
                            }
                            className="p-1.5 rounded-xl text-[#B39DE5] hover:text-red-400 hover:bg-[#151234] transition-colors cursor-pointer"
                            title="Delete from folder"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Scoped Memories Section (Private Model-User Memories vs. Shared Sanctuary Memories) */}
            {filteredMemories.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#F5E1C8]">
                    <BookOpen size={14} className="text-[#9D7FE3]" />
                    <span>
                      {selectedFolder.type === 'private'
                        ? `Private Memories with ${activePrivateCompanion.displayName}`
                        : 'Shared Sanctuary Memories (Visible to All Models)'}
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[#B39DE5]">
                    {filteredMemories.length} entries
                  </span>
                </div>
                <div className="divide-y divide-[#2C194D] rounded-2xl bg-[#1B1642] border-[3px] border-[#2C194D] overflow-hidden">
                  {filteredMemories.slice(0, 12).map((mem) => {
                    const poster = resolveMemoryPoster(mem);
                    const whatMemoryLabel = mem.isLocked
                      ? 'Pinned Core Anchor'
                      : selectedFolder.type === 'shared'
                      ? 'Shared Sanctuary Memory'
                      : `Private Memory (${activePrivateCompanion.displayName})`;
                    return (
                      <div
                        key={mem.id}
                        className="p-3 flex items-start justify-between gap-3 text-xs font-bold"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-[#B39DE5] tabular-nums">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[#F5E1C8] font-extrabold">
                                {poster.emoji} Posted by {poster.name}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#F198B7] font-extrabold">
                                {whatMemoryLabel}
                              </span>
                            </div>
                            <span className="font-mono tabular-nums text-[#B39DE5]/90">
                              {formatPostedTimestamp(mem.createdAt)}
                            </span>
                          </div>
                          <p className="text-[#F5E1C8] leading-relaxed">
                            {mem.content}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => store.removeMemory(mem.id)}
                          className="p-1.5 text-[#B39DE5] hover:text-red-400 transition-colors shrink-0 cursor-pointer"
                          title="Remove memory"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scoped 1-on-1 Gifts Section (In Private Model-User Folders) */}
            {filteredGifts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#F5E1C8]">
                    <GiftIcon size={14} className="text-[#F198B7]" />
                    <span>
                      Private Keepsake Gifts ({activePrivateCompanion.displayName}{' '}
                      &amp; You)
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[#B39DE5]">
                    {filteredGifts.length} gifts
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredGifts.slice(0, 8).map((gift) => {
                    const isFromUser = gift.from === 'user';
                    const giftPosterName = isFromUser
                      ? `💖 ${userDisplayName} (You)`
                      : `${activePrivateCompanion.avatarEmoji || '✦'} ${activePrivateCompanion.displayName}`;
                    const giftRecipientName = isFromUser
                      ? activePrivateCompanion.displayName
                      : userDisplayName;
                    const giftWhatLabel = formatMediaCategoryLabel(
                      gift.gift_type || 'gift'
                    );
                    return (
                      <div
                        key={gift.id}
                        className="p-3 rounded-2xl bg-[#1B1642] border-[2.5px] border-[#2C194D] space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-bold text-[#B39DE5] tabular-nums pb-1 border-b border-[#2C194D]">
                          <span>
                            Posted by{' '}
                            <strong className="text-[#F5E1C8] font-extrabold">
                              {giftPosterName}
                            </strong>{' '}
                            for {giftRecipientName} ·{' '}
                            <span className="text-[#F198B7] font-extrabold">
                              {giftWhatLabel}
                            </span>
                          </span>
                          <span className="font-mono tabular-nums text-[#B39DE5]/90">
                            {formatPostedTimestamp(gift.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs font-extrabold text-[#F5E1C8]">
                          {gift.content}
                        </p>
                        {gift.reason && (
                          <p className="text-[11px] font-bold text-[#B39DE5]/90">
                            &ldquo;{gift.reason}&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
