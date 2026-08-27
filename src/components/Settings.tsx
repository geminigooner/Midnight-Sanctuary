import React, { useMemo, useState } from 'react';
import { AppSettings } from '../lib/types';
import { X, Star, ChevronDown, ChevronRight, Trash2, Plus, Edit2, Check } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import { getMotion } from '../lib/motion';
import { useStore, useUI } from '../context/AppContext';

export function Settings() {
  const store = useStore();
  const { setSettingsOpen } = useUI();
  const { settings, availableModels, isModelsLoading } = store;

  const reducedMotion = useReducedMotion();
  const panelMotion = getMotion('heavy', reducedMotion);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'model' | 'identity'>('identity');
  const [newMemory, setNewMemory] = useState('');

  const toggleFavorite = (modelName: string) => {
    const isFav = settings.favoriteModels?.includes(modelName);
    const newFavs = isFav 
      ? (settings.favoriteModels || []).filter(m => m !== modelName)
      : [...(settings.favoriteModels || []), modelName];
    store.updateSettings({ favoriteModels: newFavs });
  };

  const addMemory = () => {
    if (!newMemory.trim()) return;
    store.addMemory(newMemory.trim(), 'user_settings', 'user');
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#151234]/90 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={panelMotion}
        className="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col relative overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
          <h2 className="text-2xl font-bold text-[#F5E1C8] tracking-tight">Sanctuary Configuration</h2>
          <button 
            onClick={() => setSettingsOpen(false)}
            className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b-[3px] border-[#2C194D] overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('identity')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap ${
              activeTab === 'identity'
                ? 'bg-[#F198B7] text-[#2C194D]'
                : 'text-[#B39DE5] hover:text-[#F5E1C8]'
            }`}
          >
            Identity & Persona
          </button>
          <button
            onClick={() => setActiveTab('model')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap ${
              activeTab === 'model'
                ? 'bg-[#F198B7] text-[#2C194D]'
                : 'text-[#B39DE5] hover:text-[#F5E1C8]'
            }`}
          >
            Model & Parameters
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {activeTab === 'identity' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-[#F5E1C8] mb-2">
                  System Instruction / Core Identity
                </label>
                <textarea
                  value={settings.systemInstruction}
                  onChange={(e) => store.updateSettings({ systemInstruction: e.target.value })}
                  placeholder="Define your companion's tone, worldview, and boundaries..."
                  rows={6}
                  className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-4 text-[#2C194D] font-bold text-sm resize-none focus:outline-none focus:shadow-[4px_4px_0_#2C194D] custom-scrollbar placeholder-[#2C194D]/40"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#F5E1C8] mb-2">
                  Memories & Facts
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addMemory()}
                    placeholder="Add a new permanent memory..."
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
                  {(settings.memories || []).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 bg-[#F5E1C8] border-[2px] border-[#2C194D] rounded-xl text-sm font-bold text-[#2C194D]"
                    >
                      <span className="truncate flex-1 pr-2">{m.content}</span>
                      <button
                        onClick={() => deleteMemory(m.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {(!settings.memories || settings.memories.length === 0) && (
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
                  Select Model
                </label>
                {isModelsLoading ? (
                  <p className="text-xs text-[#B39DE5] animate-pulse font-bold">Loading available models...</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar p-1">
                    {sortedModels.map((m) => {
                      const isSelected = settings.model === m.name;
                      const isFav = settings.favoriteModels?.includes(m.name);
                      return (
                        <div
                          key={m.name}
                          onClick={() => store.updateSettings({ model: m.name })}
                          className={`p-3 rounded-2xl border-[3px] border-[#2C194D] cursor-pointer transition-all flex items-center justify-between ${
                            isSelected ? 'bg-[#F198B7] shadow-[3px_3px_0_#2C194D]' : 'bg-[#F5E1C8] hover:bg-[#F5E1C8]/80'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <p className="font-bold text-sm text-[#2C194D] truncate">{m.displayName}</p>
                            <p className="text-[10px] text-[#2C194D]/60 truncate">{m.name.split('/').pop()}</p>
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
                  <label className="text-sm font-bold text-[#F5E1C8]">Temperature</label>
                  <span className="text-sm font-bold text-[#F198B7]">{settings.temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={settings.temperature}
                  onChange={(e) => store.updateSettings({ temperature: parseFloat(e.target.value) })}
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
                        <span className="text-xs font-bold text-[#F198B7]">{settings.topP?.toFixed(2) ?? '0.95'}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.topP ?? 0.95}
                        onChange={(e) => store.updateSettings({ topP: parseFloat(e.target.value) })}
                        className="w-full accent-[#F198B7] cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-[#F5E1C8]">Top K</label>
                        <span className="text-xs font-bold text-[#F198B7]">{settings.topK ?? 40}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        step="1"
                        value={settings.topK ?? 40}
                        onChange={(e) => store.updateSettings({ topK: parseInt(e.target.value) })}
                        className="w-full accent-[#F198B7] cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
