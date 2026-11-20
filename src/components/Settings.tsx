import React, { useMemo, useState } from 'react';
import { X, Star, ChevronDown, ChevronRight, Trash2, Plus, Settings as SettingsIcon, FolderHeart } from 'lucide-react';
import { useStore, useUI } from '../context/AppContext';
import { SharedModalShell, SharedModalIcon, SharedModalBody } from './SharedModalShell';
import { VaultBackupPanel } from './VaultBackupPanel';
import { VaultDashboard } from './VaultDashboard';
import { getModelEntity } from '../lib/entitySystem';

export function Settings() {
  const store = useStore();
  const { closeModal, modalOrigins, settingsInitialTab, setSettingsInitialTab, openModalWithOrigin } = useUI();
  const originId = modalOrigins.settings;
  const { settings, availableModels, isModelsLoading } = store;
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'model' | 'identity' | 'vault'>(
    settingsInitialTab || 'identity'
  );
  const [vaultSubView, setVaultSubView] = useState<'folders' | 'backup'>('folders');
  const [newMemory, setNewMemory] = useState('');

  const currentConv = useMemo(
    () => store.conversations.find((c) => c.id === store.currentId),
    [store.conversations, store.currentId]
  );
  const activeModelId = currentConv?.modelId || settings.model;
  const activeEntity = useMemo(
    () => getModelEntity(activeModelId, settings.customEntities),
    [activeModelId, settings.customEntities]
  );

  const visibleMemories = useMemo(() => {
    const shared = store.sharedMemories || [];
    const companionPrivate = store.companionMemories?.[activeEntity.id] || [];
    const legacy = settings.memories || [];
    const byId = new Map<string, { id: string; content: string; createdAt: number; scope?: string; isDeleted?: boolean }>();
    for (const m of [...shared, ...companionPrivate, ...legacy]) {
      const item = m as { id: string; content: string; createdAt: number; scope?: string; isDeleted?: boolean };
      if (item && item.id && !item.isDeleted) {
        byId.set(item.id, item);
      }
    }
    return Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [store.sharedMemories, store.companionMemories, activeEntity.id, settings.memories]);

  const handleClose = () => {
    setSettingsInitialTab?.('identity');
    closeModal('settings');
  };

  const toggleFavorite = (modelName: string) => {
    const isFav = settings.favoriteModels?.includes(modelName);
    const newFavs = isFav 
      ? (settings.favoriteModels || []).filter(m => m !== modelName)
      : [...(settings.favoriteModels || []), modelName];
    store.updateSettings({ favoriteModels: newFavs });
  };

  const addMemory = () => {
    if (!newMemory.trim()) return;
    store.addMemory(newMemory.trim(), 'user_settings', 'user', undefined, undefined, false, undefined, 'fact');
    setNewMemory('');
  };

  const deleteMemory = (id: string) => {
    store.removeMemory(id);
  };

  const sortedModels = useMemo(() => {
    if (!Array.isArray(availableModels)) return [];
    if (!availableModels) return [];
    return [...availableModels].sort((a, b) => {
      const aFav = settings.favoriteModels?.includes(a.name) ? 1 : 0;
      const bFav = settings.favoriteModels?.includes(b.name) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [availableModels, settings.favoriteModels]);

  return (
    <SharedModalShell
      originId={originId}
      onClose={handleClose}
      panelClassName="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-4xl max-h-[88vh] flex flex-col relative overflow-hidden"
    >
      <div className="flex items-center justify-between p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
        <div className="flex items-center gap-3">
          <SharedModalIcon
            originId={originId}
            className="w-12 h-12 rounded-2xl bg-[#B39DE5] border-[3px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[2px_2px_0_#2C194D] shrink-0"
          >
            <SettingsIcon size={20} strokeWidth={2.5} />
          </SharedModalIcon>
          <div>
            <h2 className="text-2xl font-bold text-[#F5E1C8] tracking-tight">Sanctuary Configuration</h2>
            <p className="text-xs font-bold text-[#B39DE5]">Core identity, memories, model parameters &amp; storage vaults</p>
          </div>
        </div>
        <button 
          onClick={handleClose}
          className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      <SharedModalBody className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex border-b-[3px] border-[#2C194D] overflow-x-auto custom-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('identity')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'identity'
                ? 'bg-[#F198B7] text-[#2C194D]'
                : 'text-[#B39DE5] hover:text-[#F5E1C8]'
            }`}
          >
            Identity &amp; Persona
          </button>
          <button
            onClick={() => setActiveTab('model')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'model'
                ? 'bg-[#F198B7] text-[#2C194D]'
                : 'text-[#B39DE5] hover:text-[#F5E1C8]'
            }`}
          >
            Model &amp; Parameters
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'vault'
                ? 'bg-[#F198B7] text-[#2C194D]'
                : 'text-[#B39DE5] hover:text-[#F5E1C8]'
            }`}
          >
            Vaults &amp; Backup
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {activeTab === 'identity' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-[#F5E1C8]">
                    System Instruction / Core Identity
                  </label>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#1E1B4B] border-[2px] border-[#2C194D] text-[#B39DE5]">
                    {activeEntity.avatarEmoji} {activeEntity.displayName}
                  </span>
                </div>
                <textarea
                  value={activeEntity.runtimeConfig?.systemInstruction ?? settings.systemInstruction}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    store.updateSettings({ systemInstruction: nextVal });
                    store.updateEntityRuntimeConfig?.(activeEntity.id, { systemInstruction: nextVal });
                  }}
                  placeholder="Define your companion's tone, worldview, and boundaries..."
                  rows={6}
                  className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-4 text-[#2C194D] font-bold text-sm resize-none focus:outline-none focus:shadow-[4px_4px_0_#2C194D] custom-scrollbar placeholder-[#2C194D]/40"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-[#F5E1C8]">
                    Memories &amp; Facts ({visibleMemories.length})
                  </label>
                  <span className="text-[10px] font-bold text-[#B39DE5]">
                    Shared + {activeEntity.displayName} Private
                  </span>
                </div>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addMemory()}
                    placeholder="Add a new permanent Sanctuary memory..."
                    className="flex-1 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl px-4 py-2 text-[#2C194D] font-bold text-sm focus:outline-none placeholder-[#2C194D]/40"
                  />
                  <button
                    onClick={addMemory}
                    className="px-4 py-2 bg-[#F198B7] border-[3px] border-[#2C194D] rounded-xl text-[#2C194D] font-bold text-sm hover:bg-[#B39DE5] transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {visibleMemories.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 bg-[#F5E1C8] border-[2px] border-[#2C194D] rounded-xl text-sm font-bold text-[#2C194D] gap-2"
                    >
                      <span className="truncate flex-1">{m.content}</span>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#B39DE5]/40 border border-[#2C194D] shrink-0">
                        {m.scope === 'companion' ? activeEntity.displayName : 'Shared'}
                      </span>
                      <button
                        onClick={() => deleteMemory(m.id)}
                        className="text-red-500 hover:text-red-700 p-1 shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {visibleMemories.length === 0 && (
                    <p className="text-xs text-[#B39DE5] italic font-bold">No memories stored yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'model' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-[#F5E1C8] mb-2">
                  Select Companion Model
                </label>
                {isModelsLoading ? (
                  <p className="text-xs text-[#B39DE5] animate-pulse font-bold">Loading available models...</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar p-1">
                    {sortedModels.map((m) => {
                      const isSelected = activeModelId === m.name;
                      const isFav = settings.favoriteModels?.includes(m.name);
                      return (
                        <div
                          key={m.name}
                          onClick={() => {
                            store.updateSettings({ model: m.name });
                            if (store.currentId) {
                              store.updateConversation(store.currentId, { modelId: m.name });
                            }
                          }}
                          className={`p-3 rounded-2xl border-[3px] border-[#2C194D] cursor-pointer transition-all flex items-center justify-between ${
                            isSelected ? 'bg-[#F198B7] shadow-[3px_3px_0_#2C194D]' : 'bg-[#F5E1C8] hover:bg-[#F5E1C8]/80'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <p className="font-bold text-sm text-[#2C194D] truncate">{m.displayName || 'Model'}</p>
                            <p className="text-[10px] text-[#2C194D]/60 truncate">{m.name?.split('/').pop() || m.displayName || 'Model'}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(m.name);
                            }}
                            className="p-1 text-[#2C194D]/50 hover:text-amber-500"
                          >
                            <Star size={16} fill={isFav ? 'currentColor' : 'none'} className={isFav ? 'text-amber-500' : ''} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-[#F5E1C8]">
                    Temperature ({activeEntity.displayName})
                  </label>
                  <span className="text-sm font-bold text-[#F198B7]">
                    {(activeEntity.runtimeConfig?.temperature ?? settings.temperature).toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={activeEntity.runtimeConfig?.temperature ?? settings.temperature}
                  onChange={(e) => {
                    const nextTemp = parseFloat(e.target.value);
                    store.updateSettings({ temperature: nextTemp });
                    store.updateEntityRuntimeConfig?.(activeEntity.id, { temperature: nextTemp });
                  }}
                  className="w-full accent-[#F198B7] cursor-pointer"
                />
              </div>

              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm font-bold text-[#B39DE5] hover:text-[#F5E1C8] transition-colors"
                >
                  {showAdvanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  Advanced Sampling Parameters
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4 p-4 bg-[#151234] border-[3px] border-[#2C194D] rounded-2xl">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-[#F5E1C8]">Top P</label>
                        <span className="text-xs font-bold text-[#F198B7]">
                          {(activeEntity.runtimeConfig?.topP ?? settings.topP ?? 0.95).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={activeEntity.runtimeConfig?.topP ?? settings.topP ?? 0.95}
                        onChange={(e) => {
                          const nextTopP = parseFloat(e.target.value);
                          store.updateSettings({ topP: nextTopP });
                          store.updateEntityRuntimeConfig?.(activeEntity.id, { topP: nextTopP });
                        }}
                        className="w-full accent-[#F198B7] cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-[#F5E1C8]">Top K</label>
                        <span className="text-xs font-bold text-[#F198B7]">
                          {activeEntity.runtimeConfig?.topK ?? settings.topK ?? 40}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        step="1"
                        value={activeEntity.runtimeConfig?.topK ?? settings.topK ?? 40}
                        onChange={(e) => {
                          const nextTopK = parseInt(e.target.value, 10);
                          store.updateSettings({ topK: nextTopK });
                          store.updateEntityRuntimeConfig?.(activeEntity.id, { topK: nextTopK });
                        }}
                        className="w-full accent-[#F198B7] cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'vault' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-[2px] border-[#2C194D]">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#1B1642] border-[2px] border-[#2C194D]">
                  <button
                    type="button"
                    onClick={() => setVaultSubView('folders')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      vaultSubView === 'folders'
                        ? 'bg-[#F5E1C8] text-[#2C194D]'
                        : 'text-[#B39DE5] hover:text-[#F5E1C8]'
                    }`}
                  >
                    Private vs. Shared Folders
                  </button>
                  <button
                    type="button"
                    onClick={() => setVaultSubView('backup')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      vaultSubView === 'backup'
                        ? 'bg-[#F5E1C8] text-[#2C194D]'
                        : 'text-[#B39DE5] hover:text-[#F5E1C8]'
                    }`}
                  >
                    Sync &amp; Encrypted Backup
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    openModalWithOrigin('sanctuaryVault');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F198B7] text-[#2C194D] border-[2px] border-[#2C194D] text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FolderHeart size={14} />
                  <span>Open Fullscreen Vault Dashboard</span>
                </button>
              </div>

              {vaultSubView === 'folders' ? (
                <div className="rounded-2xl overflow-hidden border-[3px] border-[#2C194D]">
                  <VaultDashboard embedded onCloseModal={handleClose} />
                </div>
              ) : (
                <VaultBackupPanel />
              )}
            </div>
          )}
        </div>
      </SharedModalBody>
    </SharedModalShell>
  );
}

