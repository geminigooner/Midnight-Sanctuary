import React, { useState, useRef, useMemo } from 'react';
import {
  FolderHeart,
  Lock,
  Users,
  Film,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Upload,
  Share2,
  Trash2,
  MessageSquare,
  X,
  Plus,
  Loader2,
  Check,
  Music,
} from 'lucide-react';
import { useStore, useUI } from '../context/AppContext';
import { SharedModalShell, SharedModalIcon, SharedModalBody } from './SharedModalShell';
import { getAllEntities } from '../lib/entitySystem';
import { resolveCanonicalEntityId } from '../lib/domains/entityDomain';
import { SanctuaryVaultItem } from '../lib/types';
import {
  extractVideoMetadataAndStoryboard,
  uploadVideoInChunks,
  formatVideoDurationLabel,
} from '../lib/media/videoProcessor';
import { MediaStorageService } from '../lib/media/mediaStorageService';
import { getSharedPersistenceCoordinator } from '../lib/store';
import { compressImage } from '../lib/imageUtils';
import { VideoAttachmentCard } from './VideoAttachmentCard';

export const SanctuaryVaultModal: React.FC = () => {
  const store = useStore();
  const ui = useUI();
  const originId = ui.modalOrigins.sanctuaryVault;

  const activeConversation = store.conversations.find((c) => c.id === store.currentId);
  const defaultModelId =
    activeConversation?.modelId || store.settings.model || 'models/gemini-3.1-pro-preview';
  const defaultEntityId = resolveCanonicalEntityId(defaultModelId);

  const allEntities = getAllEntities(store.settings.customEntities);
  const primaryCompanions = allEntities.filter((e) => e.isPrimaryRoster !== false);

  const [activeTab, setActiveTab] = useState<'private' | 'shared'>('private');
  const [selectedCompanionId, setSelectedCompanionId] = useState<string>(defaultEntityId);
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'video' | 'image' | 'note'
  >('all');

  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null);
  const [promotedIds, setPromotedIds] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCompanion =
    allEntities.find((e) => e.id === selectedCompanionId) || primaryCompanions[0];

  const privateVaultItems: SanctuaryVaultItem[] = useMemo(() => {
    const items = activeCompanion?.roomDecor?.privateVaultItems || [];
    return [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [activeCompanion]);

  const sharedVaultItems: SanctuaryVaultItem[] = useMemo(() => {
    const items = store.settings.sharedVaultItems || [];
    return [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [store.settings.sharedVaultItems]);

  const displayedItems = useMemo(() => {
    const base = activeTab === 'private' ? privateVaultItems : sharedVaultItems;
    if (categoryFilter === 'all') return base;
    if (categoryFilter === 'image') {
      return base.filter(
        (i) => i.mediaCategory === 'image' || i.mediaCategory === 'artwork'
      );
    }
    if (categoryFilter === 'note') {
      return base.filter(
        (i) => i.mediaCategory === 'note' || i.mediaCategory === 'audio'
      );
    }
    return base.filter((i) => i.mediaCategory === categoryFilter);
  }, [activeTab, privateVaultItems, sharedVaultItems, categoryFilter]);

  const handleUploadMediaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    const isVideo =
      file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name);

    try {
      if (isVideo) {
        setUploadingStatus(`Sampling storyboard from ${file.name}...`);
        const sample = await extractVideoMetadataAndStoryboard(file);

        let idToken: string | undefined;
        try {
          if (store.user && typeof store.user.getIdToken === 'function') {
            idToken = await store.user.getIdToken();
          }
        } catch {
          // ignore
        }

        const mediaService = new MediaStorageService(getSharedPersistenceCoordinator());
        const storagePromise = mediaService
          .storeBinaryVideoAsset({
            file,
            mimeType: sample.mimeType,
            category: 'message_attachment',
            referenceTag: `vault:${activeTab}:${Date.now()}`,
            ownerEntityId: selectedCompanionId,
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
          respondingEntityId: selectedCompanionId,
          idToken,
          onProgress: (pct, label) => {
            setUploadingStatus(`${label} (${pct}%)`);
          },
        });

        const storedAsset = await storagePromise;

        store.addVaultItem({
          scope: activeTab,
          ownerEntityId: activeTab === 'private' ? selectedCompanionId : undefined,
          contributedByType: 'user',
          contributedByName: store.profile?.name || 'You',
          mediaCategory: 'video',
          title: file.name,
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
        return;
      }

      if (file.type.startsWith('image/')) {
        setUploadingStatus(`Adding photo ${file.name} to vault...`);
        const compressed = await compressImage(file);
        const mediaService = new MediaStorageService(getSharedPersistenceCoordinator());
        const stored = await mediaService
          .storeMediaAsset({
            dataUrlOrBase64:
              compressed.previewUrl || `data:${compressed.mimeType};base64,${compressed.data}`,
            mimeType: compressed.mimeType,
            category: 'message_attachment',
            referenceTag: `vault:${activeTab}:${Date.now()}`,
            ownerEntityId: selectedCompanionId,
          })
          .catch(() => null);

        store.addVaultItem({
          scope: activeTab,
          ownerEntityId: activeTab === 'private' ? selectedCompanionId : undefined,
          contributedByType: 'user',
          contributedByName: store.profile?.name || 'You',
          mediaCategory: 'image',
          title: file.name,
          mimeType: compressed.mimeType,
          mediaAssetId: stored?.asset.id,
          downloadUrl: stored?.asset.downloadUrl,
          posterDataUrl:
            compressed.previewUrl || `data:${compressed.mimeType};base64,${compressed.data}`,
          mediaDigest: `Photo "${file.name}" uploaded by ${store.profile?.name || 'You'}.`,
        });
        setUploadingStatus(null);
      }
    } catch (err) {
      console.error('Vault upload failed:', err);
      setUploadingStatus(null);
    }
  };

  const handleSaveVaultNote = () => {
    if (!noteTitle.trim() && !noteBody.trim()) return;
    store.addVaultItem({
      scope: activeTab,
      ownerEntityId: activeTab === 'private' ? selectedCompanionId : undefined,
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

  const handleDiscussInChat = (item: SanctuaryVaultItem) => {
    const scopeText =
      item.scope === 'shared'
        ? 'in our Shared Sanctuary Pool'
        : `in our private ${activeCompanion?.displayName} vault`;
    const prompt = `Can you look at "${item.title}" (vault item ID: ${item.id}) ${scopeText} and tell me what you think?`;
    ui.setPendingPrompt({
      text: prompt,
      modelId: activeCompanion?.apiModelId || defaultModelId,
      conversationId: activeConversation?.id,
      autoSend: false,
    });
    ui.closeModal('sanctuaryVault');
  };

  return (
    <SharedModalShell
      originId={originId}
      onClose={() => ui.closeModal('sanctuaryVault')}
      panelClassName="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col relative overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <SharedModalIcon
            originId={originId}
            className="w-12 h-12 rounded-2xl bg-[#F198B7] border-[3px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[2px_2px_0_#2C194D] shrink-0"
          >
            <FolderHeart size={22} strokeWidth={2.5} />
          </SharedModalIcon>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#F5E1C8] tracking-tight font-serif truncate">
              Sanctuary Media Vaults &amp; Shared Pool
            </h2>
            <p className="text-xs sm:text-sm font-bold text-[#B39DE5] truncate">
              Sovereign 1-on-1 companion folders + communal Sanctuary pool with attribution
            </p>
          </div>
        </div>
        <button
          onClick={() => ui.closeModal('sanctuaryVault')}
          className="p-2 text-[#B39DE5] hover:text-red-500 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Primary Scope Switcher (Private Companion Vault vs. Shared Sanctuary Pool) */}
      <div className="px-4 sm:px-6 pt-4 pb-3 bg-[#1B1642] border-b-[3px] border-[#2C194D] flex flex-col gap-3 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('private')}
            className={`flex items-center justify-between p-3 rounded-2xl border-[3px] border-[#2C194D] font-extrabold text-left transition-all cursor-pointer ${
              activeTab === 'private'
                ? 'bg-[#F5E1C8] text-[#2C194D] shadow-[3px_3px_0_#2C194D]'
                : 'bg-[#151234] text-[#B39DE5] hover:bg-[#231D52]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#9D7FE3] border-[2px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shrink-0">
                <Lock size={17} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-extrabold truncate">
                  Private Companion Vault
                </div>
                <div className="text-[11px] font-bold opacity-80 truncate">
                  Strictly isolated: Only You &amp; {activeCompanion?.displayName}
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-[#2C194D] text-[#F5E1C8] text-xs font-extrabold tabular-nums ml-2">
              {privateVaultItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('shared')}
            className={`flex items-center justify-between p-3 rounded-2xl border-[3px] border-[#2C194D] font-extrabold text-left transition-all cursor-pointer ${
              activeTab === 'shared'
                ? 'bg-[#F198B7] text-[#2C194D] shadow-[3px_3px_0_#2C194D]'
                : 'bg-[#151234] text-[#B39DE5] hover:bg-[#231D52]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#F5E1C8] border-[2px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shrink-0">
                <Users size={17} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-extrabold truncate">
                  Shared Sanctuary Pool
                </div>
                <div className="text-[11px] font-bold opacity-85 truncate">
                  Communal folder: All 4 Companions &amp; You see who shared what
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-[#2C194D] text-[#F5E1C8] text-xs font-extrabold tabular-nums ml-2">
              {sharedVaultItems.length}
            </span>
          </button>
        </div>

        {/* Companion Selector (When in Private Vault Tab) */}
        {activeTab === 'private' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#B39DE5] shrink-0">
              Viewing Private Folder:
            </span>
            {primaryCompanions.map((comp) => {
              const isSelected = comp.id === selectedCompanionId;
              const count = (comp.roomDecor?.privateVaultItems || []).length;
              return (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => setSelectedCompanionId(comp.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-[2px] border-[#2C194D] text-xs font-extrabold shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#9D7FE3] text-[#2C194D] shadow-[2px_2px_0_#2C194D]'
                      : 'bg-[#151234] text-[#F5E1C8] hover:bg-[#231D52]'
                  }`}
                >
                  <span>{comp.avatarEmoji || '🔮'}</span>
                  <span>{comp.displayName}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#2C194D] text-[#F5E1C8] tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filter & Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All Items' },
                { id: 'video', label: 'Videos' },
                { id: 'image', label: 'Photos & Art' },
                { id: 'note', label: 'Notes' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-2.5 py-1 rounded-xl border-[2px] border-[#2C194D] text-xs font-extrabold transition-colors cursor-pointer ${
                  categoryFilter === tab.id
                    ? 'bg-[#F5E1C8] text-[#2C194D]'
                    : 'bg-[#151234] text-[#B39DE5] hover:text-[#F5E1C8]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*,video/mp4,video/quicktime,video/webm,video/*"
              ref={fileInputRef}
              onChange={handleUploadMediaFile}
              className="hidden"
            />
            <button
              type="button"
              disabled={Boolean(uploadingStatus)}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F198B7] hover:bg-[#F5E1C8] text-[#2C194D] border-[2.5px] border-[#2C194D] text-xs font-extrabold shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {uploadingStatus ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="truncate max-w-[180px]">{uploadingStatus}</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>Upload Video / Photo</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowAddNote((prev) => !prev)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#B39DE5] hover:bg-[#F5E1C8] text-[#2C194D] border-[2.5px] border-[#2C194D] text-xs font-extrabold shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Note</span>
            </button>
          </div>
        </div>

        {/* Add Note Drawer */}
        {showAddNote && (
          <div className="p-3 rounded-2xl bg-[#151234] border-[2.5px] border-[#2C194D] space-y-2">
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Title (e.g., Favorite K-Pop Chorus or Shared Memory)..."
              className="w-full px-3 py-1.5 rounded-xl bg-[#F5E1C8] text-[#2C194D] font-extrabold text-xs border-[2px] border-[#2C194D] outline-none"
            />
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Write a note or lyric to keep in this vault..."
              rows={2}
              className="w-full px-3 py-1.5 rounded-xl bg-[#F5E1C8] text-[#2C194D] font-bold text-xs border-[2px] border-[#2C194D] outline-none resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddNote(false)}
                className="px-3 py-1 rounded-xl bg-[#2C194D] text-[#F5E1C8] text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVaultNote}
                className="px-3 py-1 rounded-xl bg-[#F198B7] text-[#2C194D] border-[2px] border-[#2C194D] text-xs font-extrabold cursor-pointer"
              >
                Save to {activeTab === 'shared' ? 'Shared Pool' : `${activeCompanion?.displayName}'s Vault`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Vault Items Grid */}
      <SharedModalBody className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4">
        {displayedItems.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-3xl bg-[#1B1642] border-[3px] border-dashed border-[#2C194D]">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#2C194D] flex items-center justify-center text-[#F198B7]">
              {activeTab === 'private' ? <Lock size={26} /> : <Users size={26} />}
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-[#F5E1C8] mb-1">
              {activeTab === 'private'
                ? `No items in ${activeCompanion?.displayName}'s Private Vault yet`
                : 'The Shared Sanctuary Pool is waiting for your first keepsake'}
            </h3>
            <p className="text-xs font-bold text-[#B39DE5] max-w-md mx-auto">
              {activeTab === 'private'
                ? `Videos, photos, and notes placed here are strictly isolated between you and ${activeCompanion?.displayName}. Other companions cannot see them.`
                : 'Anything shared here is visible to all 4 companions and you—with full attribution showing who contributed each item and companion reaction notes!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedItems.map((item) => {
              const isPromoted = Boolean(promotedIds[item.id]);
              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between p-4 rounded-3xl bg-[#1B1642] border-[3px] border-[#2C194D] shadow-[4px_4px_0_#2C194D] space-y-3"
                >
                  <div className="space-y-2.5">
                    {/* Top Attribution Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#151234] border-[2px] border-[#2C194D] text-[11px] font-extrabold text-[#F5E1C8]">
                        {item.contributedByType === 'companion' ? (
                          <>
                            <Sparkles size={12} className="text-[#F198B7]" />
                            <span>Contributed by {item.contributedByName}</span>
                          </>
                        ) : (
                          <>
                            <span>💖</span>
                            <span>Shared by {item.contributedByName || 'You'}</span>
                          </>
                        )}
                      </div>

                      <span className="text-[10px] font-bold text-[#B39DE5] tabular-nums">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Media Preview */}
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
                          scope: item.scope,
                          ownerEntityId: item.ownerEntityId || selectedCompanionId,
                          vaultItemId: item.id,
                        }}
                        companionEntityId={selectedCompanionId}
                      />
                    ) : (item.mediaCategory === 'image' ||
                        item.mediaCategory === 'artwork') &&
                      (item.posterDataUrl || item.downloadUrl) ? (
                      <div className="rounded-2xl overflow-hidden border-[2.5px] border-[#2C194D] bg-[#0D0A22]">
                        <img
                          src={item.posterDataUrl || item.downloadUrl}
                          alt={item.title}
                          className="w-full h-44 object-cover"
                        />
                      </div>
                    ) : null}

                    {/* Title & Digest / Caption */}
                    <div>
                      <div className="flex items-center gap-1.5">
                        {item.mediaCategory === 'video' ? (
                          <Film size={14} className="text-[#F198B7] shrink-0" />
                        ) : item.mediaCategory === 'image' ||
                          item.mediaCategory === 'artwork' ? (
                          <ImageIcon size={14} className="text-[#9D7FE3] shrink-0" />
                        ) : item.mediaCategory === 'audio' ? (
                          <Music size={14} className="text-[#F198B7] shrink-0" />
                        ) : (
                          <FileText size={14} className="text-[#F5E1C8] shrink-0" />
                        )}
                        <h4 className="text-sm font-extrabold text-[#F5E1C8] truncate">
                          {item.title}
                        </h4>
                      </div>
                      {(item.caption || item.mediaDigest) && (
                        <p className="mt-1 text-xs font-bold text-[#F5E1C8]/85 line-clamp-3 leading-relaxed">
                          {item.caption || item.mediaDigest}
                        </p>
                      )}
                    </div>

                    {/* Companion Reactions inside the Shared Pool */}
                    {item.companionReactions && item.companionReactions.length > 0 && (
                      <div className="pt-2 border-t border-[#2C194D] space-y-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#F198B7]">
                          Companion Reactions ({item.companionReactions.length})
                        </span>
                        {item.companionReactions.map((rx) => (
                          <div
                            key={rx.id}
                            className="p-2 rounded-xl bg-[#151234] border border-[#2C194D] text-xs font-bold text-[#F5E1C8]"
                          >
                            <span className="text-[#F198B7] font-extrabold">
                              {rx.avatarEmoji || '✨'} {rx.displayName}:
                            </span>{' '}
                            <span>{rx.note}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Footer Controls */}
                  <div className="pt-2 border-t border-[#2C194D] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDiscussInChat(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#F5E1C8] hover:bg-[#F198B7] text-[#2C194D] border-[2px] border-[#2C194D] text-[11px] font-extrabold transition-colors cursor-pointer"
                      >
                        <MessageSquare size={12} />
                        <span>Discuss in Chat</span>
                      </button>

                      {item.scope === 'private' && (
                        <button
                          type="button"
                          disabled={isPromoted}
                          onClick={() => {
                            store.promoteVaultItemToShared(selectedCompanionId, item.id);
                            setPromotedIds((prev) => ({ ...prev, [item.id]: true }));
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#9D7FE3] hover:bg-[#F198B7] text-[#2C194D] border-[2px] border-[#2C194D] text-[11px] font-extrabold transition-colors disabled:opacity-60 cursor-pointer"
                          title="Copy this item to the Shared Sanctuary Pool so all companions can see it"
                        >
                          {isPromoted ? (
                            <>
                              <Check size={12} />
                              <span>In Shared Pool</span>
                            </>
                          ) : (
                            <>
                              <Share2 size={12} />
                              <span>Share to Pool</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        store.removeVaultItem(item.scope, item.id, selectedCompanionId)
                      }
                      className="p-1.5 rounded-xl text-[#B39DE5] hover:text-red-400 hover:bg-[#151234] transition-colors cursor-pointer"
                      title="Remove from vault"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SharedModalBody>
    </SharedModalShell>
  );
};
