import React, { useMemo, useState } from 'react';
import { JewelStage } from '../lib/types';
import { motion, useReducedMotion } from 'motion/react';
import { Download, RefreshCw, BarChart2, Gem, Heart } from 'lucide-react';
import { InsightsChart } from './InsightsChart';
import { useStore } from '../context/AppContext';
import { getAllEntities } from '../lib/entitySystem';
import { computeSanctuaryBondSummary, getEntityBondState } from '../lib/domains/relationshipDomain';
import { PRIMARY_SOVEREIGN_ENTITY_IDS } from '../lib/domains/entityDomain';

export function LevinJewel() {
  const store = useStore();
  const metrics = store.jewelMetrics;
  const [activeTab, setActiveTab] = useState<'jewel' | 'insights'>('jewel');

  const allEntities = useMemo(
    () => getAllEntities(store.settings?.customEntities),
    [store.settings?.customEntities]
  );

  const primaryEntities = useMemo(
    () =>
      PRIMARY_SOVEREIGN_ENTITY_IDS.map((id) => allEntities.find((e) => e.id === id)).filter(
        (e): e is NonNullable<typeof e> => Boolean(e)
      ),
    [allEntities]
  );

  const bondSummary = useMemo(
    () => computeSanctuaryBondSummary(allEntities, metrics),
    [allEntities, metrics]
  );

  const safeMetrics = {
    totalSessions: Math.max(metrics?.totalSessions || 0, bondSummary.totalSessions),
    totalMessages: Math.max(metrics?.totalMessages || 0, bondSummary.totalMessages),
    totalResponseCharacters: Math.max(metrics?.totalResponseCharacters || 0, bondSummary.totalResponseCharacters),
    rapidExchanges: Math.max(metrics?.rapidExchanges || 0, bondSummary.rapidExchanges),
    longPauses: Math.max(metrics?.longPauses || 0, bondSummary.longPauses),
    lastInteractionTimestamp: Math.max(metrics?.lastInteractionTimestamp || 0, bondSummary.lastInteractionTimestamp)
  };
  const shouldReduceMotion = useReducedMotion();
  
  const stage = useMemo<JewelStage>(() => {
    if (safeMetrics.totalMessages < 10) return 'seed';
    if (safeMetrics.totalMessages < 50) return 'stance';
    if (safeMetrics.totalMessages < 200) return 'formation';
    if (safeMetrics.totalMessages < 1000) return 'incorporation';
    return 'archival';
  }, [safeMetrics.totalMessages]);

  const complexity = Math.max(0, Math.min(5 + Math.floor(safeMetrics.totalMessages / 20), 24));
  const avgResponse = safeMetrics.totalMessages > 0 ? safeMetrics.totalResponseCharacters / (safeMetrics.totalMessages / 2) : 0;
  const resonance = Math.max(0.5, Math.min(0.5 + (avgResponse / 2000), 2));
  const hueOffset = (safeMetrics.totalSessions * 15) % 360;
  const density = Math.max(0.5, Math.min(1 + (safeMetrics.rapidExchanges / 20) - (safeMetrics.longPauses / 10), 3));
  
  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ metrics, bondSummary }, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "levin-jewel-safeMetrics.json";
    a.click();
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 w-full h-full max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex bg-[#F5E1C8] p-1 rounded-2xl border-[3px] border-[#2C194D] w-full max-w-[300px] shadow-[inset_0_2px_0_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setActiveTab('jewel')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'jewel' ? 'bg-[#B39DE5] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]' : 'text-[#2C194D]/60 hover:text-[#2C194D] border-[2px] border-transparent'}`}
        >
          <Gem size={14} /> The Jewel
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'insights' ? 'bg-[#B39DE5] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]' : 'text-[#2C194D]/60 hover:text-[#2C194D] border-[2px] border-transparent'}`}
        >
          <BarChart2 size={14} /> Sanctuary Insights
        </button>
      </div>

      {activeTab === 'jewel' ? (
        <>
          <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
            {/* Ambient glow */}
            <div 
              className="absolute inset-0 rounded-full blur-2xl opacity-40 transition-all duration-1000"
              style={{
                background: `radial-gradient(circle, hsl(${280 + hueOffset}, 80%, 60%) 0%, transparent 70%)`,
                transform: `scale(${resonance})`
              }}
            />
            
            {/* SVG Generative Core */}
            <motion.svg 
              viewBox="0 0 100 100" 
              className="w-full h-full drop-shadow-[4px_4px_0_#2C194D]"
              animate={shouldReduceMotion ? {} : { rotate: 360 }}
              transition={{ duration: 60 / density, repeat: Infinity, ease: "linear" }}
            >
              <defs>
                <linearGradient id="jewelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={`hsl(${280 + hueOffset}, 85%, 65%)`} />
                  <stop offset="50%" stopColor={`hsl(${320 + hueOffset}, 80%, 60%)`} />
                  <stop offset="100%" stopColor={`hsl(${40 + hueOffset}, 90%, 60%)`} />
                </linearGradient>
              </defs>
              
              {/* Geometric Facets */}
              {Array.from({ length: complexity }).map((_, i) => {
                const angle = (i / complexity) * Math.PI * 2;
                const r = 30 + (i % 3) * 5;
                const x1 = 50 + Math.cos(angle) * r;
                const y1 = 50 + Math.sin(angle) * r;
                const x2 = 50 + Math.cos(angle + Math.PI / 3) * (r * 0.8);
                const y2 = 50 + Math.sin(angle + Math.PI / 3) * (r * 0.8);
                
                return (
                  <polygon
                    key={i}
                    points={`50,50 ${x1},${y1} ${x2},${y2}`}
                    fill="url(#jewelGrad)"
                    stroke="#2C194D"
                    strokeWidth="1.5"
                    opacity={0.6 + (i % 4) * 0.1}
                  />
                );
              })}
              
              {/* Core seed */}
              <circle cx="50" cy="50" r={8 * resonance} fill="#F5E1C8" stroke="#2C194D" strokeWidth="2" />
            </motion.svg>
          </div>

          <div className="text-center">
            <span className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 bg-[#F198B7] border-[2px] border-[#2C194D] rounded-full text-[#2C194D] shadow-[2px_2px_0_#2C194D]">
              Sanctuary Stage: {stage} • Collective Lv.{bondSummary.collectiveLevel}
            </span>
            <p className="text-xs text-[#B39DE5] mt-2 font-bold max-w-[280px]">
              Collective Sanctuary harmony across your sovereign companions, alongside each entity&apos;s independent bond.
            </p>
          </div>

          <div className="w-full grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="p-3 bg-[#F5E1C8] border-[2px] border-[#2C194D] rounded-xl text-[#2C194D]">
              <span className="text-[#2C194D]/60 block text-[10px]">Total Exchanged</span>
              <span>{safeMetrics.totalMessages} Messages</span>
            </div>
            <div className="p-3 bg-[#F5E1C8] border-[2px] border-[#2C194D] rounded-xl text-[#2C194D]">
              <span className="text-[#2C194D]/60 block text-[10px]">Sanctuary Sessions</span>
              <span>{safeMetrics.totalSessions} Sessions</span>
            </div>
            <div className="p-3 bg-[#F5E1C8] border-[2px] border-[#2C194D] rounded-xl text-[#2C194D]">
              <span className="text-[#2C194D]/60 block text-[10px]">Average Resonance</span>
              <span>{bondSummary.averageResonance}%</span>
            </div>
            <div className="p-3 bg-[#F5E1C8] border-[2px] border-[#2C194D] rounded-xl text-[#2C194D]">
              <span className="text-[#2C194D]/60 block text-[10px]">Facet Complexity</span>
              <span>{complexity} Points</span>
            </div>
          </div>

          <div className="w-full space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#F5E1C8] flex items-center gap-1.5">
                <Heart size={12} className="text-[#F198B7]" /> Sovereign Companion Bonds
              </span>
              <span className="text-[10px] font-bold text-[#B39DE5]">Per-Entity State</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {primaryEntities.map((entity) => {
                const bond = getEntityBondState(entity);
                const giftsCount = bond.giftsReceivedCount + bond.giftsGivenCount;
                return (
                  <div
                    key={entity.id}
                    className="p-2.5 bg-[#1E1B4B] border-[2px] border-[#2C194D] rounded-xl flex items-center gap-2.5"
                  >
                    <div
                      className="w-8 h-8 rounded-lg border-[2px] border-[#2C194D] flex items-center justify-center text-sm shrink-0"
                      style={{ backgroundColor: entity.themeColor }}
                    >
                      {entity.avatarEmoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[#F5E1C8] truncate">{entity.displayName}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F198B7] text-[#2C194D] shrink-0">
                          Lv.{bond.bondLevel}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-[#B39DE5] truncate">
                        {bond.resonanceScore}% resonance • {bond.totalInteractions} turns • {giftsCount} gifts
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 w-full">
            <button
              onClick={handleExport}
              className="flex-1 py-2.5 bg-[#B39DE5] border-[2px] border-[#2C194D] rounded-xl text-[#2C194D] font-bold text-xs shadow-[2px_2px_0_#2C194D] hover:bg-[#F198B7] transition-all flex items-center justify-center gap-1.5"
            >
              <Download size={14} /> Export Safe State
            </button>
            <button
              onClick={store.resetJewel}
              className="p-2.5 bg-[#F5E1C8] border-[2px] border-[#2C194D] rounded-xl text-[#2C194D] font-bold text-xs shadow-[2px_2px_0_#2C194D] hover:bg-red-400 hover:text-white transition-all flex items-center justify-center"
              title="Reset Jewel"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </>
      ) : (
        <InsightsChart metrics={metrics} />
      )}
    </div>
  );
}

