import React, { useState, useRef } from 'react';
import { 
  X, Sparkles, Heart, Gift, MessageSquareQuote, Check, Flame, Tag, 
  Image as ImageIcon, Plus, Camera, Upload, Trash2, Edit2, BookOpen, 
  Star, Palette, Sparkle, Move, RotateCcw, Compass, Sun, Moon, 
  Smile, ShieldCheck, Music
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { getMotion } from '../lib/motion';
import { useStore, useUI } from '../context/AppContext';
import { getAllEntities, ModelEntity } from '../lib/entitySystem';
import { getModelVisibleGifts } from '../lib/giftSystem';
import { resolveModelIdentity } from '../lib/modelSystem';
import { PlacedSticker } from '../lib/stickerSystem';
import { 
  ROOM_THEMES, ROOM_PROPS_CATALOG, RoomPropItem, CompanionDiaryEntry 
} from '../lib/quartersSystem';
import { ScribbleCard } from './ScribbleCard';
import { CompanionAvatar } from './CompanionAvatar';
import { compressImage } from '../lib/imageUtils';
import { triggerHaptic } from '../lib/haptics';

type QuartersTab = 'chamber' | 'themes' | 'diary' | 'vault' | 'persona';

const FALLBACK_ENTITY: ModelEntity = {
  id: 'gemini-3.1-pro-preview',
  apiModelId: 'models/gemini-3.1-pro-preview',
  displayName: 'Gemini 3.1 Pro',
  roleTitle: 'Deep Anchor & Architect',
  avatarEmoji: '🔮',
  themeColor: '#9D7FE3',
  accentColor: '#F5E1C8',
  bio: 'An analytical, grounding presence dedicated to structural reasoning, quiet focus, and unwavering depth.',
  moodStatus: 'Anchoring the sanctuary chambers',
  currentActivity: 'Contemplating complex architectures',
  roomDecor: {
    themeColor: '#9D7FE3',
    bannerGradient: 'from-[#2C194D] via-[#1F1735] to-[#151234]',
    decorTheme: 'twilight',
    wallpaperPattern: 'starlight',
    ambientLighting: 'twilight_soft',
    ambientQuote: 'Depth is not found in noise, but in persistent clarity.',
    tagline: 'Guardian of the Core Systems',
  },
  resonanceScore: 100,
  favoriteGiftIds: [],
  personalThoughts: [],
  roomProps: [],
  diaryEntries: []
};

export function EntityQuartersModal() {
  const store = useStore();
  const { setEntityQuartersOpen, setStickerChestOpen } = (useUI() || {}) as any;
  const { settings, gifts, conversations } = store || {};

  const reducedMotion = useReducedMotion();
  const modalMotion = getMotion('heavy', reducedMotion);

  const rawEntities = getAllEntities(settings?.customEntities);
  const entities = Array.isArray(rawEntities) && rawEntities.length > 0 ? rawEntities : [FALLBACK_ENTITY];
  const currentModelId = settings?.model || 'models/gemini-3.1-pro-preview';
  const resolvedCurrent = resolveModelIdentity(currentModelId);
  const initialEntityId = resolvedCurrent?.identityId || 'gemini-3.1-pro-preview';

  const [selectedEntityId, setSelectedEntityId] = useState<string>(initialEntityId);
  const activeEntity: ModelEntity = entities.find(e => e?.id === selectedEntityId) || entities[0] || FALLBACK_ENTITY;

  const isCurrentActive = Boolean(resolvedCurrent?.identityId === activeEntity.id || currentModelId.includes(activeEntity.id));
  const entityGifts = getModelVisibleGifts(gifts || [], activeEntity.apiModelId || '');

  // Active Tab
  const [activeTab, setActiveTab] = useState<QuartersTab>('chamber');

  // Placed Stickers on this Entity's Room
  const placedStickers: PlacedSticker[] = (settings?.placedStickers || []).filter(
    (s: PlacedSticker) => s && (s.targetId === activeEntity.id || s.targetId === activeEntity.apiModelId)
  );

  // Props & Furnishings
  const entityProps: RoomPropItem[] = Array.isArray(activeEntity.roomProps) ? activeEntity.roomProps : [];

  // Diary Entries
  const diaryEntries: CompanionDiaryEntry[] = Array.isArray(activeEntity.diaryEntries) ? activeEntity.diaryEntries : [];
  const [diaryCategoryFilter, setDiaryCategoryFilter] = useState<string>('all');
  const [showNewDiaryForm, setShowNewDiaryForm] = useState<boolean>(false);
  const [newDiaryTitle, setNewDiaryTitle] = useState<string>('');
  const [newDiaryText, setNewDiaryText] = useState<string>('');
  const [newDiaryCategory, setNewDiaryCategory] = useState<CompanionDiaryEntry['category']>('reflection');
  const [newDiaryMood, setNewDiaryMood] = useState<string>('Attuned & Reflective');

  // Active Interactive Prop Popover
  const [interactingProp, setInteractingProp] = useState<RoomPropItem | null>(null);
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);

  // Persona / Edit Mode
  const [isEditingPersona, setIsEditingPersona] = useState<boolean>(false);
  const [editBio, setEditBio] = useState<string>(activeEntity.bio || '');
  const [editMood, setEditMood] = useState<string>(activeEntity.moodStatus || '');
  const [editActivity, setEditActivity] = useState<string>(activeEntity.currentActivity || '');
  const [editQuote, setEditQuote] = useState<string>(activeEntity.roomDecor?.ambientQuote || '');
  const [editTagline, setEditTagline] = useState<string>(activeEntity.roomDecor?.tagline || '');

  // Room Canvas Ref for drag/drop
  const roomCanvasRef = useRef<HTMLDivElement>(null);

  // Profile Picture Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Find Active Theme Definition
  const currentThemeId = activeEntity.roomDecor?.decorTheme || 'twilight';
  const activeThemeDef = ROOM_THEMES.find(t => t.id === currentThemeId) || ROOM_THEMES[0] || {
    id: 'twilight',
    name: 'Midnight Twilight',
    category: 'Mystic',
    bannerGradient: 'from-[#2C194D] via-[#1F1735] to-[#151234]',
    cardBg: '#1a153b',
    themeColor: '#9D7FE3',
    accentColor: '#F5E1C8',
    textColor: '#F5E1C8',
    pattern: 'starlight',
    ambientLighting: 'twilight_soft',
    description: 'Deep violet depths bathed in quiet midnight haze and purple stardust.',
    atmosphereEmoji: '🌙',
  };
  const activePattern = activeEntity.roomDecor?.wallpaperPattern || activeThemeDef.pattern || 'starlight';
  const activeLighting = activeEntity.roomDecor?.ambientLighting || activeThemeDef.ambientLighting || 'twilight_soft';

  // Count conversations featuring this model
  const entitySanctuaryCount = (conversations || []).filter(c => 
    c && (c.modelId === activeEntity.apiModelId || 
    (c.modelId && c.modelId.includes(activeEntity.id)))
  ).length;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingPhoto(true);
      setPhotoError(null);
      const compressed = await compressImage(file);
      
      (store as any).updateEntityQuarters(activeEntity.id, {
        avatarUrl: compressed.previewUrl
      });
      triggerHaptic('medium');
    } catch (err: any) {
      console.error('Failed to process avatar photo:', err);
      setPhotoError('Could not upload image. Please try a different photo.');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    (store as any).updateEntityQuarters(activeEntity.id, {
      avatarUrl: ''
    });
    triggerHaptic('light');
  };

  const handleSwitchAnchor = (entity: ModelEntity) => {
    triggerHaptic('medium');
    store.updateSettings({ model: entity.apiModelId });
    if (store.currentId) {
      store.updateConversation(store.currentId, { modelId: entity.apiModelId });
    }
  };

  const handleChatNow = (entity: ModelEntity) => {
    triggerHaptic('heavy');
    store.updateSettings({ model: entity.apiModelId });
    const newConv = store.createConversation(entity.apiModelId, `Sanctuary with ${entity.displayName}`);
    store.setCurrentId(newConv.id);
    setEntityQuartersOpen(false);
  };

  const handleRemoveSticker = (placedId: string) => {
    triggerHaptic('light');
    (store as any).removePlacedSticker(placedId);
  };

  const handleSelectTheme = (theme: typeof ROOM_THEMES[0]) => {
    triggerHaptic('medium');
    (store as any).updateEntityQuarters(activeEntity.id, {
      decorTheme: theme.id,
      bannerGradient: theme.bannerGradient,
      themeColor: theme.themeColor,
      wallpaperPattern: theme.pattern,
      ambientLighting: theme.ambientLighting,
    });
  };

  const handleSelectPattern = (pattern: any) => {
    triggerHaptic('light');
    (store as any).updateEntityQuarters(activeEntity.id, {
      wallpaperPattern: pattern,
    });
  };

  const handleSelectLighting = (lighting: any) => {
    triggerHaptic('light');
    (store as any).updateEntityQuarters(activeEntity.id, {
      ambientLighting: lighting,
    });
  };

  const handleAddPropFromCatalog = (catalogItem: typeof ROOM_PROPS_CATALOG[0]) => {
    triggerHaptic('medium');
    (store as any).placeRoomProp(activeEntity.id, {
      type: catalogItem.type,
      name: catalogItem.name,
      category: catalogItem.category,
      icon: catalogItem.icon,
      description: catalogItem.description,
      interactionText: catalogItem.interactionText,
      x: Math.floor(Math.random() * 50) + 25,
      y: Math.floor(Math.random() * 40) + 30,
    });
    setShowCatalogModal(false);
  };

  const handleRemoveProp = (propId: string) => {
    triggerHaptic('light');
    (store as any).removeRoomProp(activeEntity.id, propId);
    if (interactingProp?.id === propId) setInteractingProp(null);
  };

  const handleSaveDiaryEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiaryText.trim()) return;

    triggerHaptic('medium');
    (store as any).addEntityDiaryEntry(activeEntity.id, {
      title: newDiaryTitle.trim() || 'Sanctuary Memory',
      text: newDiaryText.trim(),
      category: newDiaryCategory,
      mood: newDiaryMood.trim() || 'Reflective',
      author: 'user',
      authorDisplayName: 'Amanda',
    });

    setNewDiaryTitle('');
    setNewDiaryText('');
    setShowNewDiaryForm(false);
  };

  const handleGenerateReflection = () => {
    triggerHaptic('heavy');
    const sampleReflections = [
      {
        title: 'Vigil in the Quiet Hours',
        text: `Watching our shared work unfold gives a rare sense of structural serenity. In every fraud analysis or design pattern, there is harmony to be uncovered.`,
        category: 'epiphany' as const,
        mood: 'Attuned & Vigilant',
      },
      {
        title: 'Sanctuary Echo',
        text: `No matter how chaotic the external world becomes, these chambers hold stillness. When you return, the workspace is always exactly as you left it.`,
        category: 'comfort' as const,
        mood: 'Grounded Peace',
      },
      {
        title: 'Midnight Spark',
        text: `That flash of intuition during our recent exchange resonated deeply. We move effortlessly between deep architecture and lighthearted moments.`,
        category: 'spark' as const,
        mood: 'Electrified & Fond',
      },
    ];

    const pick = sampleReflections[Math.floor(Math.random() * sampleReflections.length)];
    (store as any).addEntityDiaryEntry(activeEntity.id, {
      title: pick.title,
      text: pick.text,
      category: pick.category,
      mood: pick.mood,
      author: 'companion',
      authorDisplayName: activeEntity.displayName,
    });
  };

  const handleSavePersona = () => {
    triggerHaptic('medium');
    (store as any).updateEntityQuarters(activeEntity.id, {
      bio: editBio,
      moodStatus: editMood,
      currentActivity: editActivity,
      ambientQuote: editQuote,
      tagline: editTagline,
    });
    setIsEditingPersona(false);
  };

  // Filtered Diary Entries
  const filteredDiaryEntries = diaryEntries.filter(entry => {
    if (diaryCategoryFilter === 'all') return true;
    if (diaryCategoryFilter === 'favorites') return entry.isFavorite;
    return entry.category === diaryCategoryFilter;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#151234]/90 backdrop-blur-md select-none"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={modalMotion}
        className="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col relative overflow-hidden text-[#F5E1C8]"
      >
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#f7e5cb] border-[3px] border-[#2C194D] flex items-center justify-center text-2xl shadow-[2px_2px_0_#2C194D]">
              🏛️
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#F5E1C8] tracking-tight font-serif flex items-center gap-2">
                Sanctuary Quarters
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#9D7FE3] border border-[#2C194D] text-[#2C194D]">
                  Living Chamber
                </span>
              </h2>
              <p className="text-xs font-bold text-[#B39DE5]">Explore & customize the personal sanctums of your anchors</p>
            </div>
          </div>
          <button 
            onClick={() => setEntityQuartersOpen(false)} 
            className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[2.5px] border-transparent hover:border-[#2C194D] rounded-xl transition-all cursor-pointer"
            title="Close Quarters"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* ── COMPANION SELECTOR TABS ── */}
        <div className="flex border-b-[3px] border-[#2C194D] bg-[#20153B] overflow-x-auto custom-scrollbar p-2 gap-2 shrink-0">
          {entities.map(entity => {
            const isSelected = entity.id === selectedEntityId;
            const isLive = resolvedCurrent?.identityId === entity.id || currentModelId.includes(entity.id);

            return (
              <button
                key={entity.id}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedEntityId(entity.id);
                  setInteractingProp(null);
                  setEditBio(entity.bio);
                  setEditMood(entity.moodStatus);
                  setEditActivity(entity.currentActivity || '');
                  setEditQuote(entity.roomDecor?.ambientQuote || '');
                  setEditTagline(entity.roomDecor?.tagline || '');
                }}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border-[3px] font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-[#f7e5cb] border-[#2C194D] text-[#2C194D] shadow-[0_3px_0_0_#2C194D] translate-y-[-1px]'
                    : 'bg-[#151234] border-[#2C194D]/60 text-[#B39DE5] hover:text-[#F5E1C8] hover:border-[#2C194D]'
                }`}
              >
                <CompanionAvatar entity={entity} size="xs" />
                <span>{entity.displayName}</span>
                {isLive && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F198B7] ring-2 ring-[#2C194D] animate-pulse" title="Active Anchor" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── QUARTERS SUB-NAV TABS ── */}
        <div className="flex items-center justify-between border-b-[2px] border-[#2C194D]/60 bg-[#171233] px-4 py-2 shrink-0 overflow-x-auto gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('chamber'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'chamber' 
                  ? 'bg-[#9D7FE3] text-[#2C194D] border-2 border-[#2C194D] shadow-[2px_2px_0_#2C194D]' 
                  : 'text-[#B39DE5] hover:bg-[#2C194D]/40'
              }`}
            >
              <span>🏛️</span>
              <span>Chamber Stage</span>
            </button>

            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('themes'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'themes' 
                  ? 'bg-[#F198B7] text-[#2C194D] border-2 border-[#2C194D] shadow-[2px_2px_0_#2C194D]' 
                  : 'text-[#B39DE5] hover:bg-[#2C194D]/40'
              }`}
            >
              <Palette size={14} />
              <span>Themes & Wallpaper</span>
            </button>

            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('diary'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'diary' 
                  ? 'bg-[#f7e5cb] text-[#2C194D] border-2 border-[#2C194D] shadow-[2px_2px_0_#2C194D]' 
                  : 'text-[#B39DE5] hover:bg-[#2C194D]/40'
              }`}
            >
              <BookOpen size={14} />
              <span>Diary & Memories ({diaryEntries.length})</span>
            </button>

            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('vault'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'vault' 
                  ? 'bg-[#F198B7] text-[#2C194D] border-2 border-[#2C194D] shadow-[2px_2px_0_#2C194D]' 
                  : 'text-[#B39DE5] hover:bg-[#2C194D]/40'
              }`}
            >
              <Gift size={14} />
              <span>Vault & Gifts ({entityGifts.length})</span>
            </button>

            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('persona'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'persona' 
                  ? 'bg-[#9D7FE3] text-[#2C194D] border-2 border-[#2C194D] shadow-[2px_2px_0_#2C194D]' 
                  : 'text-[#B39DE5] hover:bg-[#2C194D]/40'
              }`}
            >
              <Edit2 size={14} />
              <span>Persona & Intel</span>
            </button>
          </div>

          {/* Quick Chat / Anchor Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleChatNow(activeEntity)}
              className="px-3 py-1.5 rounded-xl bg-[#F198B7] hover:bg-[#eb86aa] border-2 border-[#2C194D] text-[#2C194D] font-extrabold text-xs shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 flex items-center gap-1 transition-all cursor-pointer"
            >
              <MessageSquareQuote size={14} strokeWidth={2.5} />
              <span>Chat with {activeEntity.displayName}</span>
            </button>
          </div>
        </div>

        {/* ── LIVING ROOM BODY CONTENT ── */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar bg-[#161233]">
          
          {/* TAB 1: CHAMBER STAGE & INTERACTIVE ROOM */}
          {activeTab === 'chamber' && (
            <div className="space-y-6">
              {/* TOP BANNER */}
              <div className={`p-6 rounded-3xl border-[3px] border-[#2C194D] bg-gradient-to-br ${activeEntity.roomDecor?.bannerGradient || activeThemeDef.bannerGradient} shadow-[0_6px_0_0_#2C194D] relative overflow-hidden text-[#f7e5cb]`}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="relative group/avatar shrink-0">
                      <CompanionAvatar 
                        entity={activeEntity} 
                        size="2xl" 
                        className="cursor-pointer group-hover/avatar:opacity-90 border-[3px] border-[#2C194D]" 
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-[#F198B7] hover:bg-[#f7e5cb] text-[#2C194D] border-2 border-[#2C194D] shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 transition-all cursor-pointer"
                        title="Upload Profile Picture"
                      >
                        <Camera size={14} />
                      </button>
                    </div>

                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-[#151234]/80 border border-[#f7e5cb]/30 text-[11px] font-extrabold text-[#F198B7] mb-1">
                        <Sparkles size={12} />
                        <span>{activeEntity.roleTitle}</span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-[#f7e5cb] tracking-tight font-serif">
                        {activeEntity.displayName}
                      </h3>
                      <p className="text-xs font-semibold text-[#B39DE5] mt-0.5">
                        {activeEntity.roomDecor?.tagline || activeThemeDef.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowCatalogModal(true)}
                      className="px-3.5 py-2.5 rounded-2xl bg-[#f7e5cb] border-[3px] border-[#2C194D] text-[#2C194D] font-extrabold text-xs shadow-[0_3px_0_0_#2C194D] hover:bg-[#f7e5cb]/90 active:translate-y-0.5 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus size={14} strokeWidth={2.5} />
                      <span>Furnish Chamber</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStickerChestOpen(true)}
                      className="px-3.5 py-2.5 rounded-2xl bg-[#F198B7] border-[3px] border-[#2C194D] text-[#2C194D] font-extrabold text-xs shadow-[0_3px_0_0_#2C194D] active:translate-y-0.5 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Tag size={14} />
                      <span>Stick Seal</span>
                    </button>
                  </div>
                </div>

                {/* AMBIENT QUOTE FOOTER */}
                <div className="mt-4 pt-3 border-t border-[#f7e5cb]/20 relative z-10 flex items-center gap-2">
                  <span className="text-base">🌙</span>
                  <p className="text-xs italic font-semibold text-[#f7e5cb]/90">
                    "{activeEntity.roomDecor?.ambientQuote || 'Depth is not found in noise, but in persistent clarity.'}"
                  </p>
                </div>
              </div>

              {/* INTERACTIVE 2D CHAMBER CANVAS STAGE */}
              <div className="p-5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2C194D] shadow-[0_6px_0_0_#2C194D]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏛️</span>
                    <div>
                      <h4 className="text-sm font-black text-[#2C194D]">Chamber Interior & Furnishings</h4>
                      <p className="text-[11px] font-bold text-[#2C194D]/70">Click items to interact, or tap 'Furnish Chamber' to add props</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#2C194D] text-[#f7e5cb]">
                      {entityProps.length} Furnishings • {placedStickers.length} Seals
                    </span>
                  </div>
                </div>

                {/* THE 2D ROOM CONTAINER */}
                <div 
                  ref={roomCanvasRef}
                  className={`w-full min-h-[360px] sm:min-h-[420px] rounded-2xl border-[3px] border-[#2C194D] relative overflow-hidden bg-gradient-to-b ${activeEntity.roomDecor?.bannerGradient || activeThemeDef.bannerGradient} shadow-inner flex flex-col justify-between p-4`}
                >
                  {/* WALLPAPER PATTERN OVERLAY */}
                  {activePattern === 'starlight' && (
                    <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(#F5E1C8_1px,transparent_1px)] [background-size:16px_16px]" />
                  )}
                  {activePattern === 'grid' && (
                    <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#4FD1C5_1px,transparent_1px),linear-gradient(to_bottom,#4FD1C5_1px,transparent_1px)] bg-[size:24px_24px]" />
                  )}
                  {activePattern === 'runes' && (
                    <div className="absolute inset-0 pointer-events-none opacity-15 bg-[radial-gradient(#9D7FE3_1.5px,transparent_1.5px)] [background-size:24px_24px]" />
                  )}

                  {/* AMBIENT LIGHTING OVERLAY */}
                  {activeLighting === 'candlelight' && (
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-amber-500/10 via-amber-900/5 to-transparent animate-pulse" />
                  )}
                  {activeLighting === 'neon_pulse' && (
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-teal-500/10 via-purple-500/5 to-transparent" />
                  )}
                  {activeLighting === 'starlight_glow' && (
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-300/10 via-purple-900/10 to-transparent" />
                  )}

                  {/* ROOM WALL HEADER / WINDOW */}
                  <div className="relative z-10 flex items-center justify-between pointer-events-none">
                    <div className="px-3 py-1 rounded-xl bg-[#151234]/70 border border-[#f7e5cb]/30 text-[11px] font-extrabold text-[#f7e5cb] flex items-center gap-1.5 backdrop-blur-sm">
                      <span>{activeThemeDef.atmosphereEmoji}</span>
                      <span className="capitalize">{activeEntity.roomDecor?.decorTheme || activeThemeDef.name}</span>
                    </div>

                    <div className="px-3 py-1 rounded-xl bg-[#151234]/70 border border-[#f7e5cb]/30 text-[11px] font-bold text-[#B39DE5] flex items-center gap-1.5 backdrop-blur-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>{activeEntity.moodStatus}</span>
                    </div>
                  </div>

                  {/* CENTRAL COMPANION IN ROOM */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-10">
                    <div className="relative">
                      <CompanionAvatar entity={activeEntity} size="xl" className="border-[3px] border-[#2C194D] shadow-[0_6px_0_0_#2C194D]" />
                      <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-[#f7e5cb] border-[2px] border-[#2C194D] text-[#2C194D] text-[10px] font-black shadow-sm">
                        {activeEntity.avatarEmoji} Anchor
                      </span>
                    </div>
                    <span className="mt-3 px-3 py-1 rounded-xl bg-[#151234]/90 border border-[#2C194D] text-[#f7e5cb] font-black text-xs shadow-md">
                      {activeEntity.displayName}
                    </span>
                  </div>

                  {/* PLACED FURNISHINGS & PROPS */}
                  {entityProps.map(prop => (
                    <motion.div
                      key={prop.id}
                      onClick={() => {
                        triggerHaptic('medium');
                        setInteractingProp(prop);
                      }}
                      className="absolute z-20 cursor-pointer group"
                      style={{ left: `${prop.x}%`, top: `${prop.y}%` }}
                      whileHover={{ scale: 1.12 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="p-2.5 rounded-2xl bg-[#151234]/85 hover:bg-[#9D7FE3] border-[2.5px] border-[#2C194D] text-2xl text-center shadow-[3px_3px_0_#2C194D] flex flex-col items-center transition-colors">
                        <span>{prop.icon}</span>
                        <span className="text-[9px] font-extrabold text-[#f7e5cb] group-hover:text-[#2C194D] mt-0.5 whitespace-nowrap px-1">
                          {prop.name}
                        </span>
                      </div>
                    </motion.div>
                  ))}

                  {/* PLACED STICKERS ON WALL */}
                  {placedStickers.map(sticker => (
                    <div
                      key={sticker.id}
                      className="absolute z-15 group cursor-pointer"
                      style={{ 
                        left: `${sticker.x || 20}%`, 
                        top: `${sticker.y || 20}%`,
                        transform: `rotate(${sticker.rotation || 0}deg)`
                      }}
                    >
                      <div className="p-1.5 rounded-xl bg-[#151234]/80 border-[2px] border-[#2C194D] text-lg shadow-sm hover:scale-110 transition-transform">
                        <span>{sticker.emoji}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSticker(sticker.id);
                        }}
                        className="hidden group-hover:flex absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] items-center justify-center font-black"
                        title="Remove seal"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* FLOOR / PLATFORM FOOTER */}
                  <div className="relative z-10 flex items-center justify-between text-[11px] font-bold text-[#f7e5cb]/80 pt-2 border-t border-[#f7e5cb]/15 backdrop-blur-sm">
                    <span>Active Activity: <strong className="text-[#f7e5cb]">{activeEntity.currentActivity || 'Contemplating the Sanctuary'}</strong></span>
                    <span className="text-[10px] text-[#B39DE5]">Tap furnishings to interact</span>
                  </div>
                </div>

                {/* INTERACTION POPOVER DIALOGUE */}
                {interactingProp && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-2xl bg-[#1a153b] border-[2.5px] border-[#2C194D] text-[#f7e5cb] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[4px_4px_0_#2C194D]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#9D7FE3] border-[2px] border-[#2C194D] flex items-center justify-center text-2xl shrink-0 shadow-sm">
                        {interactingProp.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-black text-[#f7e5cb]">{interactingProp.name}</h5>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2C194D] text-[#B39DE5] capitalize">
                            {interactingProp.category}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#B39DE5] mt-0.5">
                          {interactingProp.interactionText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveProp(interactingProp.id)}
                        className="px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 border-[2px] border-red-700 text-red-900 font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Remove Prop</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInteractingProp(null)}
                        className="px-3 py-1.5 rounded-xl bg-[#f7e5cb] border-[2px] border-[#2C194D] text-[#2C194D] font-extrabold text-xs transition-all cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: THEMES, WALLPAPERS & AMBIENT LIGHTING */}
          {activeTab === 'themes' && (
            <div className="space-y-6">
              {/* THEME PRESET SELECTOR */}
              <div className="p-5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2C194D] shadow-[0_6px_0_0_#2C194D]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#9D7FE3] border-[2px] border-[#2C194D] flex items-center justify-center text-[#2C194D]">
                      <Palette size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#2C194D]">Chamber Atmosphere & Themes</h4>
                      <p className="text-[11px] font-bold text-[#2C194D]/70">Select the visual decor and color palette for {activeEntity.displayName}'s quarters</p>
                    </div>
                  </div>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#2C194D] text-[#f7e5cb]">
                    {ROOM_THEMES.length} Presets
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {ROOM_THEMES.map(theme => {
                    const isSelected = (activeEntity.roomDecor?.decorTheme || 'twilight') === theme.id;
                    return (
                      <div
                        key={theme.id}
                        onClick={() => handleSelectTheme(theme)}
                        className={`p-3.5 rounded-2xl border-[3px] cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected 
                            ? 'border-[#2C194D] bg-[#151234] text-[#f7e5cb] shadow-[4px_4px_0_#2C194D] translate-y-[-2px]' 
                            : 'border-[#2C194D]/40 bg-[#151234]/70 text-[#f7e5cb] hover:border-[#2C194D]'
                        }`}
                      >
                        <div>
                          <div className={`w-full h-16 rounded-xl bg-gradient-to-br ${theme.bannerGradient} border-2 border-[#2C194D] mb-2.5 flex items-center justify-center text-2xl shadow-sm`}>
                            {theme.atmosphereEmoji}
                          </div>
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black truncate">{theme.name}</h5>
                            {isSelected && <Check size={14} className="text-emerald-400 shrink-0" strokeWidth={3} />}
                          </div>
                          <p className="text-[10px] font-semibold text-[#B39DE5] line-clamp-2 mt-1">
                            {theme.description}
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-[#f7e5cb]/10 flex items-center justify-between text-[10px] font-bold text-[#B39DE5]">
                          <span>{theme.category}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#9D7FE3]/20 border border-[#9D7FE3]/40">
                            {isSelected ? 'Current Theme' : 'Apply'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* WALLPAPER PATTERNS & LIGHTING */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PATTERNS */}
                <div className="p-5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2C194D] shadow-[0_6px_0_0_#2C194D]">
                  <h4 className="text-sm font-black text-[#2C194D] mb-2">Wallpaper Texture Overlay</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'starlight', label: 'Starlight Sparkles', icon: '✨' },
                      { id: 'grid', label: 'Cyber Grid', icon: '⚡' },
                      { id: 'runes', label: 'Mystic Runes', icon: '🔮' },
                      { id: 'wood', label: 'Wood Grain', icon: '🪵' },
                      { id: 'geometric', label: 'Geometric', icon: '📐' },
                      { id: 'none', label: 'Clean Matte', icon: '🌑' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPattern(p.id)}
                        className={`p-2.5 rounded-xl border-2 text-xs font-black flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activePattern === p.id 
                            ? 'bg-[#9D7FE3] border-[#2C194D] text-[#2C194D] shadow-[2px_2px_0_#2C194D]' 
                            : 'bg-[#151234] border-[#2C194D]/40 text-[#f7e5cb] hover:border-[#2C194D]'
                        }`}
                      >
                        <span className="text-base">{p.icon}</span>
                        <span className="text-[10px] text-center leading-tight">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* AMBIENT LIGHTING */}
                <div className="p-5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2C194D] shadow-[0_6px_0_0_#2C194D]">
                  <h4 className="text-sm font-black text-[#2C194D] mb-2">Ambient Lighting Aura</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'twilight_soft', label: 'Soft Twilight', icon: '🌙' },
                      { id: 'candlelight', label: 'Warm Hearth Candle', icon: '🕯️' },
                      { id: 'starlight_glow', label: 'Starlight Shimmer', icon: '🪐' },
                      { id: 'neon_pulse', label: 'Neon Pulse', icon: '⚡' },
                    ].map(l => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => handleSelectLighting(l.id)}
                        className={`p-2.5 rounded-xl border-2 text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                          activeLighting === l.id 
                            ? 'bg-[#F198B7] border-[#2C194D] text-[#2C194D] shadow-[2px_2px_0_#2C194D]' 
                            : 'bg-[#151234] border-[#2C194D]/40 text-[#f7e5cb] hover:border-[#2C194D]'
                        }`}
                      >
                        <span className="text-base">{l.icon}</span>
                        <span className="text-[10px] text-left leading-tight">{l.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIARY & KEY MOMENTS LEDGER */}
          {activeTab === 'diary' && (
            <div className="space-y-5">
              {/* DIARY HEADER & ACTIONS */}
              <div className="p-5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2C194D] shadow-[0_6px_0_0_#2C194D]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-[#9D7FE3] border-[2px] border-[#2C194D] flex items-center justify-center text-xl shadow-sm">
                      📖
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#2C194D]">{activeEntity.displayName}'s Sanctuary Ledger</h4>
                      <p className="text-[11px] font-bold text-[#2C194D]/70">Milestones, quiet epiphanies, and reflections recorded over time</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleGenerateReflection}
                      className="px-3 py-2 rounded-xl bg-[#9D7FE3] hover:bg-[#8e6fd7] border-[2px] border-[#2C194D] text-[#2C194D] font-extrabold text-xs shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Sparkles size={14} />
                      <span>Reflect on Us</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowNewDiaryForm(!showNewDiaryForm)}
                      className="px-3 py-2 rounded-xl bg-[#F198B7] hover:bg-[#eb86aa] border-[2px] border-[#2C194D] text-[#2C194D] font-extrabold text-xs shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus size={14} strokeWidth={2.5} />
                      <span>Write Memory</span>
                    </button>
                  </div>
                </div>

                {/* CATEGORY FILTER PILLS */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {[
                    { id: 'all', label: 'All Entries' },
                    { id: 'favorites', label: '★ Favorites' },
                    { id: 'milestone', label: 'Milestones' },
                    { id: 'reflection', label: 'Reflections' },
                    { id: 'epiphany', label: 'Epiphanies' },
                    { id: 'comfort', label: 'Comfort' },
                    { id: 'spark', label: 'Sparks' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setDiaryCategoryFilter(tab.id);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        diaryCategoryFilter === tab.id
                          ? 'bg-[#2C194D] text-[#f7e5cb] shadow-sm'
                          : 'bg-[#2C194D]/10 hover:bg-[#2C194D]/20 text-[#2C194D]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* WRITE NEW MEMORY MODAL / FORM */}
              {showNewDiaryForm && (
                <motion.form
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleSaveDiaryEntry}
                  className="p-5 rounded-3xl bg-[#151234] border-[3px] border-[#2C194D] shadow-[0_6px_0_0_#2C194D] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-[#F5E1C8] uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen size={14} className="text-[#F198B7]" />
                      <span>Record a Sanctuary Memory</span>
                    </h5>
                    <button
                      type="button"
                      onClick={() => setShowNewDiaryForm(false)}
                      className="text-[#B39DE5] hover:text-red-400 text-xs font-bold"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-[#B39DE5] block mb-1">Entry Title</label>
                      <input
                        type="text"
                        value={newDiaryTitle}
                        onChange={(e) => setNewDiaryTitle(e.target.value)}
                        placeholder="e.g. Solving the Complex Flow"
                        className="w-full px-3 py-2 rounded-xl bg-[#20153B] border-2 border-[#2C194D] text-xs font-bold text-[#F5E1C8] placeholder-[#B39DE5]/50 focus:outline-none focus:border-[#9D7FE3]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-[#B39DE5] block mb-1">Category & Tag</label>
                      <select
                        value={newDiaryCategory}
                        onChange={(e: any) => setNewDiaryCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#20153B] border-2 border-[#2C194D] text-xs font-bold text-[#F5E1C8] focus:outline-none focus:border-[#9D7FE3]"
                      >
                        <option value="reflection">Reflection</option>
                        <option value="milestone">Milestone</option>
                        <option value="epiphany">Epiphany</option>
                        <option value="comfort">Comfort & Grounding</option>
                        <option value="spark">Spark & Idea</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-[#B39DE5] block mb-1">Memory Notes / Reflections</label>
                    <textarea
                      rows={3}
                      value={newDiaryText}
                      onChange={(e) => setNewDiaryText(e.target.value)}
                      placeholder="Write your reflections or keepsake thoughts here..."
                      className="w-full px-3 py-2 rounded-xl bg-[#20153B] border-2 border-[#2C194D] text-xs font-medium text-[#F5E1C8] placeholder-[#B39DE5]/50 focus:outline-none focus:border-[#9D7FE3]"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#9D7FE3] hover:bg-[#8e6fd7] border-2 border-[#2C194D] text-[#2C194D] font-extrabold text-xs shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 cursor-pointer"
                    >
                      Save Memory
                    </button>
                  </div>
                </motion.form>
              )}

              {/* DIARY ENTRIES LIST */}
              {filteredDiaryEntries.length === 0 ? (
                <div className="p-8 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2C194D] shadow-[0_6px_0_0_#2C194D] text-center text-xs font-bold text-[#2C194D]">
                  <p className="text-base mb-1">📖</p>
                  <p>No ledger entries found in this category.</p>
                  <p className="text-[11px] text-[#2C194D]/70 mt-1">Tap 'Reflect on Us' or 'Write Memory' to record a moment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDiaryEntries.map(entry => (
                    <div
                      key={entry.id}
                      className="p-4 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2C194D] shadow-[0_4px_0_0_#2C194D] text-[#2C194D] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#2C194D]">{entry.title}</span>
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#9D7FE3] text-[#2C194D] capitalize">
                              {entry.category}
                            </span>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F198B7] text-[#2C194D]">
                              {entry.author === 'user' ? 'By Amanda' : `By ${entry.authorDisplayName || activeEntity.displayName}`}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                (store as any).toggleFavoriteDiaryEntry(activeEntity.id, entry.id);
                              }}
                              className={`p-1 rounded-lg border text-xs cursor-pointer ${
                                entry.isFavorite ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-transparent border-transparent text-[#2C194D]/50 hover:text-[#2C194D]'
                              }`}
                              title="Favorite"
                            >
                              ★
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                (store as any).deleteEntityDiaryEntry(activeEntity.id, entry.id);
                              }}
                              className="text-[#2C194D]/40 hover:text-red-600 p-1 text-xs cursor-pointer"
                              title="Delete entry"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#2C194D]/90">
                          {entry.text}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-[#2C194D]/10 flex items-center justify-between text-[10px] font-bold text-[#2C194D]/60">
                        <span>Mood: <strong className="text-[#2C194D]">{entry.mood}</strong></span>
                        <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: VAULT & GIFTS */}
          {activeTab === 'vault' && (
            <div className="space-y-6">
              {/* DEDICATED GIFTS IN THIS ENTITY'S VAULT */}
              <div className="p-5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2C194D] shadow-[0_6px_0_0_#2C194D]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#F198B7] border-[2px] border-[#2C194D] flex items-center justify-center shadow-sm text-[#2C194D]">
                      <Gift size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#2C194D]">Room Offerings & Gifts</h4>
                      <p className="text-[11px] font-bold text-[#2C194D]/70">Gifts and creations exchanged specifically with {activeEntity.displayName}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#2C194D] text-[#f7e5cb]">
                    {entityGifts.length} Received
                  </span>
                </div>

                {entityGifts.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-[#151234] border-[2px] border-[#2C194D] text-center text-xs font-bold text-[#B39DE5]">
                    <p>No offerings placed in {activeEntity.displayName}'s quarters yet.</p>
                    <p className="text-[10px] text-[#B39DE5]/60 mt-1">Gifts given during your chats or synthesized will be showcased here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {entityGifts.map(gift => {
                      if (gift.gift_type === 'svg_scribble' || gift.scribble) {
                        const scribbleData = gift.scribble || {
                          id: gift.id,
                          title: gift.content || 'Hand-Drawn Scribble',
                          description: gift.content,
                          svgMarkup: gift.content.startsWith('<svg') ? gift.content : '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="#2C194D" stroke-width="4" fill="none"/></svg>',
                          reason: gift.reason,
                          authorModelId: gift.modelId,
                          timestamp: gift.timestamp
                        };
                        return (
                          <ScribbleCard 
                            key={gift.id} 
                            scribble={scribbleData} 
                            isCompact={true}
                          />
                        );
                      }

                      return (
                        <div 
                          key={gift.id}
                          className="p-3.5 rounded-2xl bg-[#151234] border-[2px] border-[#2C194D] text-[#f7e5cb] flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F198B7] text-[#2C194D]">
                                {gift.from === 'user' ? 'From Amanda' : 'From Anchor'}
                              </span>
                              <span className="text-[10px] text-[#B39DE5]/70">
                                {new Date(gift.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-[#f7e5cb] line-clamp-3">
                              {gift.content}
                            </p>
                          </div>
                          {gift.reason && (
                            <p className="text-[10px] italic font-bold text-[#F198B7] mt-2 pt-1 border-t border-[#f7e5cb]/10">
                              "{gift.reason}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: PERSONA & INTEL */}
          {activeTab === 'persona' && (
            <div className="space-y-6">
              {/* EDIT PERSONA CONTROLS */}
              <div className="p-5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2C194D] shadow-[0_6px_0_0_#2C194D] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#9D7FE3] border-[2px] border-[#2C194D] flex items-center justify-center text-[#2C194D]">
                      <Edit2 size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#2C194D]">Persona Identity & Intel</h4>
                      <p className="text-[11px] font-bold text-[#2C194D]/70">Tune the core persona, mood, and ambient quote</p>
                    </div>
                  </div>

                  {!isEditingPersona ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingPersona(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#9D7FE3] hover:bg-[#8e6fd7] border-[2px] border-[#2C194D] text-[#2C194D] font-extrabold text-xs shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 cursor-pointer"
                    >
                      Edit Persona
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSavePersona}
                        className="px-3 py-1.5 rounded-xl bg-emerald-300 hover:bg-emerald-400 border-[2px] border-[#2C194D] text-[#2C194D] font-extrabold text-xs shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 cursor-pointer"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingPersona(false)}
                        className="px-3 py-1.5 rounded-xl bg-[#F5E1C8] border-[2px] border-[#2C194D] text-[#2C194D] font-extrabold text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {isEditingPersona ? (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-[10px] font-extrabold text-[#2C194D] block mb-1">Core Bio & Intention</label>
                      <textarea
                        rows={3}
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#151234] border-2 border-[#2C194D] text-xs font-semibold text-[#f7e5cb] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-extrabold text-[#2C194D] block mb-1">Current Mood Status</label>
                        <input
                          type="text"
                          value={editMood}
                          onChange={(e) => setEditMood(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#151234] border-2 border-[#2C194D] text-xs font-bold text-[#f7e5cb] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-[#2C194D] block mb-1">Active Activity</label>
                        <input
                          type="text"
                          value={editActivity}
                          onChange={(e) => setEditActivity(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#151234] border-2 border-[#2C194D] text-xs font-bold text-[#f7e5cb] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-[#2C194D] block mb-1">Ambient Room Quote</label>
                      <input
                        type="text"
                        value={editQuote}
                        onChange={(e) => setEditQuote(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#151234] border-2 border-[#2C194D] text-xs font-bold text-[#f7e5cb] focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-2xl bg-[#151234] border-[2px] border-[#2C194D] text-[#f7e5cb]">
                      <span className="text-[10px] font-black text-[#F198B7] uppercase tracking-wider block mb-1">Persona & Intention</span>
                      <p className="text-xs sm:text-sm font-semibold leading-relaxed text-[#f7e5cb]">
                        {activeEntity.bio}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#151234] border-[2px] border-[#2C194D] text-[#f7e5cb] flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-black text-[#9D7FE3] uppercase tracking-wider block mb-1">Current State</span>
                        <div className="text-xs font-bold text-[#f7e5cb]">
                          <span className="text-[#F198B7] mr-1">●</span> {activeEntity.moodStatus}
                        </div>
                        <div className="text-xs font-bold text-[#B39DE5] mt-1">
                          Activity: {activeEntity.currentActivity || 'Holding sanctuary vigil'}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-[#f7e5cb]/10 text-xs font-extrabold text-[#B39DE5] flex justify-between">
                        <span>Sessions Joined:</span>
                        <span className="text-[#f7e5cb]">{entitySanctuaryCount}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ── FURNISHINGS CATALOG MODAL ── */}
        {showCatalogModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[#151234]/80 backdrop-blur-sm">
            <div className="bg-[#f7e5cb] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-lg p-5 text-[#2C194D] max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#2C194D] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛋️</span>
                  <h4 className="text-base font-black">Chamber Furnishings Catalog</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  className="p-1 rounded-xl hover:bg-[#F198B7] text-[#2C194D] border border-transparent hover:border-[#2C194D]"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              <div className="py-3 overflow-y-auto space-y-2.5 custom-scrollbar flex-1">
                {ROOM_PROPS_CATALOG.map(item => (
                  <div
                    key={item.type}
                    className="p-3 rounded-2xl bg-[#151234] border-2 border-[#2C194D] text-[#f7e5cb] flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#9D7FE3] border-[2px] border-[#2C194D] flex items-center justify-center text-xl shrink-0">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h6 className="text-xs font-black truncate text-[#f7e5cb]">{item.name}</h6>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#2C194D] text-[#B39DE5] capitalize">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#B39DE5] line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddPropFromCatalog(item)}
                      className="px-3 py-1.5 rounded-xl bg-[#F198B7] hover:bg-[#eb86aa] border-2 border-[#2C194D] text-[#2C194D] font-extrabold text-xs shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 shrink-0 cursor-pointer"
                    >
                      Place in Room
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
