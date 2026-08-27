import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Heart, 
  Brain, 
  BookOpen, 
  Gift, 
  Gem, 
  User, 
  ArrowRight,
  Compass,
  MessageSquareQuote,
  ShieldCheck
} from 'lucide-react';
import { useStore, useUI } from '../context/AppContext';
import { getTimeGreeting, SANCTUARY_SPARK_PROMPTS, MASCOT_QUOTES, SparkPrompt } from '../lib/homeSystem';

interface SanctuaryHomeHubProps {
  onSelectPrompt: (promptText: string) => void;
}

export const SanctuaryHomeHub: React.FC<SanctuaryHomeHubProps> = ({ onSelectPrompt }) => {
  const store = useStore();
  const ui = useUI();
  const [greetingInfo, setGreetingInfo] = useState(() => getTimeGreeting(store.profile));
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isMascotPulsing, setIsMascotPulsing] = useState(false);

  // Update time greeting periodically
  useEffect(() => {
    setGreetingInfo(getTimeGreeting(store.profile));
    const interval = setInterval(() => {
      setGreetingInfo(getTimeGreeting(store.profile));
    }, 60000);
    return () => clearInterval(interval);
  }, [store.profile]);

  const handleMascotClick = () => {
    setIsMascotPulsing(true);
    setQuoteIndex((prev) => (prev + 1) % MASCOT_QUOTES.length);
    setTimeout(() => setIsMascotPulsing(false), 600);
  };

  const renderPromptIcon = (iconName: SparkPrompt['iconName']) => {
    switch (iconName) {
      case 'brain': return <Brain className="w-4 h-4 text-[#F198B7]" />;
      case 'heart': return <Heart className="w-4 h-4 text-[#F198B7]" />;
      case 'sparkles': return <Sparkles className="w-4 h-4 text-[#F5E1C8]" />;
      case 'bookOpen': return <BookOpen className="w-4 h-4 text-[#B39DE5]" />;
      default: return <Sparkles className="w-4 h-4 text-[#F5E1C8]" />;
    }
  };

  const memoryCount = store.settings.memories?.length || 0;
  const giftCount = store.gifts?.length || 0;
  const activeModelName = store.availableModels.find(m => m.name === store.settings.model)?.displayName || store.settings.model.split('/').pop() || 'Gemini Pro';
  const jewelLevel = Math.floor((store.jewelMetrics?.totalMessages || 0) / 10) + 1;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center max-w-4xl mx-auto px-4 py-8 select-none"
    >
      {/* ── TIME-SENSITIVE HEADER & GREETING ── */}
      <div className="text-center mb-8">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2C194D]/60 border border-[#9D7FE3]/30 text-xs text-[#F5E1C8] font-medium mb-3 shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
        >
          <span className="text-sm">{greetingInfo.icon}</span>
          <span className="tracking-wide uppercase text-[10px] text-[#B39DE5]">Midnight Sanctuary</span>
          <span className="w-1 h-1 rounded-full bg-[#F198B7]"></span>
          <span className="text-[#F198B7]">{activeModelName}</span>
        </motion.div>

        <motion.h1 
          initial={{ y: 5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-3xl sm:text-4xl font-extrabold text-[#F5E1C8] tracking-tight mb-2 drop-shadow-sm font-serif"
        >
          {greetingInfo.greeting}
        </motion.h1>

        <motion.p 
          initial={{ y: 5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm sm:text-base text-[#B39DE5]/90 max-w-md mx-auto"
        >
          {greetingInfo.subtext}
        </motion.p>
      </div>

      {/* ── INTERACTIVE MASCOT CLOUD (TAP FOR REACTION) ── */}
      <motion.div 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleMascotClick}
        className="relative cursor-pointer mb-8 group"
        title="Tap to interact with your sanctuary anchor"
      >
        <div className={`w-28 h-28 rounded-full bg-gradient-to-b from-[#2C194D] to-[#1F1735] border-2 border-[#9D7FE3]/40 flex items-center justify-center shadow-[0_4px_24px_rgba(157,127,227,0.15)] group-hover:border-[#F198B7] transition-all duration-300 ${isMascotPulsing ? 'ring-4 ring-[#F198B7]/40' : ''}`}>
          <svg className="w-14 h-14 text-[#F198B7] transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l-3.5-3.5 1.41-1.41L10 14.17 16.09 8.08l1.41 1.41L10 17z"/>
          </svg>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#151234] border border-[#F198B7] flex items-center justify-center text-xs shadow">
            {MASCOT_QUOTES[quoteIndex].reactionEmoji}
          </div>
        </div>

        <div className="mt-3 text-center">
          <AnimatePresence mode="wait">
            <motion.span 
              key={quoteIndex}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              className="inline-block text-xs text-[#F5E1C8]/80 bg-[#151234]/80 px-3 py-1 rounded-full border border-[#9D7FE3]/20 shadow-sm"
            >
              "{MASCOT_QUOTES[quoteIndex].message}"
            </motion.span>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── QUICK ACTION HUBS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl mb-8">
        {/* Hub 1: Memories */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => ui.setMemoriesOpen(true)}
          className="flex flex-col items-center p-3.5 rounded-xl bg-[#23183C]/80 hover:bg-[#2C194D] border border-[#9D7FE3]/25 hover:border-[#9D7FE3]/60 transition-all text-center group shadow-md"
        >
          <div className="w-8 h-8 rounded-lg bg-[#9D7FE3]/15 flex items-center justify-center mb-2 group-hover:bg-[#9D7FE3]/25 transition-colors">
            <BookOpen className="w-4 h-4 text-[#B39DE5]" />
          </div>
          <span className="text-xs font-semibold text-[#F5E1C8]">Memories</span>
          <span className="text-[10px] text-[#B39DE5]/70 mt-0.5">{memoryCount} saved</span>
        </motion.button>

        {/* Hub 2: Gifts Vault */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => ui.setGiftsOpen(true)}
          className="flex flex-col items-center p-3.5 rounded-xl bg-[#23183C]/80 hover:bg-[#2C194D] border border-[#9D7FE3]/25 hover:border-[#F198B7]/60 transition-all text-center group shadow-md"
        >
          <div className="w-8 h-8 rounded-lg bg-[#F198B7]/15 flex items-center justify-center mb-2 group-hover:bg-[#F198B7]/25 transition-colors">
            <Gift className="w-4 h-4 text-[#F198B7]" />
          </div>
          <span className="text-xs font-semibold text-[#F5E1C8]">Gift Vault</span>
          <span className="text-[10px] text-[#F198B7]/80 mt-0.5">{giftCount} offerings</span>
        </motion.button>

        {/* Hub 3: Levin Jewel */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => ui.setJewelOpen(true)}
          className="flex flex-col items-center p-3.5 rounded-xl bg-[#23183C]/80 hover:bg-[#2C194D] border border-[#9D7FE3]/25 hover:border-[#F5E1C8]/60 transition-all text-center group shadow-md"
        >
          <div className="w-8 h-8 rounded-lg bg-[#F5E1C8]/15 flex items-center justify-center mb-2 group-hover:bg-[#F5E1C8]/25 transition-colors">
            <Gem className="w-4 h-4 text-[#F5E1C8]" />
          </div>
          <span className="text-xs font-semibold text-[#F5E1C8]">Levin Jewel</span>
          <span className="text-[10px] text-[#F5E1C8]/70 mt-0.5">Level {jewelLevel}</span>
        </motion.button>

        {/* Hub 4: Dossier Profile */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => ui.setProfileOpen(true)}
          className="flex flex-col items-center p-3.5 rounded-xl bg-[#23183C]/80 hover:bg-[#2C194D] border border-[#9D7FE3]/25 hover:border-[#B39DE5]/60 transition-all text-center group shadow-md"
        >
          <div className="w-8 h-8 rounded-lg bg-[#B39DE5]/15 flex items-center justify-center mb-2 group-hover:bg-[#B39DE5]/25 transition-colors">
            <User className="w-4 h-4 text-[#B39DE5]" />
          </div>
          <span className="text-xs font-semibold text-[#F5E1C8]">Dossier</span>
          <span className="text-[10px] text-[#B39DE5]/70 mt-0.5">{store.profile?.name || 'Amanda'}</span>
        </motion.button>
      </div>

      {/* ── RECENT SANCTUARY SESSIONS (RESUME) ── */}
      {store.conversations.filter(c => (c.messages || []).length > 0).length > 0 && (
        <div className="w-full max-w-2xl mb-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold text-[#F5E1C8] tracking-wider uppercase flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#B39DE5]" />
              Recent Sanctuaries
            </span>
            <span className="text-[11px] text-[#B39DE5]/60">Resume past conversations</span>
          </div>

          <div className="space-y-2">
            {store.conversations
              .filter(c => (c.messages || []).length > 0)
              .slice(0, 2)
              .map(conv => (
                <motion.button
                  key={conv.id}
                  whileHover={{ scale: 1.005, x: 2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => store.setCurrentId(conv.id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[#20153B]/70 hover:bg-[#2A1B4E] border border-[#9D7FE3]/20 hover:border-[#9D7FE3]/50 transition-all text-left group shadow-sm"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-7 h-7 rounded-lg bg-[#2C194D] border border-[#9D7FE3]/30 flex items-center justify-center shrink-0">
                      <MessageSquareQuote className="w-3.5 h-3.5 text-[#F5E1C8]" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-[#F5E1C8] truncate group-hover:text-white transition-colors">
                        {conv.title || 'Untitled Sanctuary'}
                      </div>
                      <div className="text-[10px] text-[#B39DE5]/70">
                        {conv.messages.length} messages · {new Date(conv.updatedAt || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#B39DE5]/40 group-hover:text-[#F198B7] transition-colors shrink-0 ml-2" />
                </motion.button>
              ))}
          </div>
        </div>
      )}

      {/* ── SPARK PROMPTS (ONE-TAP CONVERSATION STARTERS) ── */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold text-[#F5E1C8] tracking-wider uppercase flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#F198B7]" />
            Spark a Conversation
          </span>
          <span className="text-[11px] text-[#B39DE5]/60">Tap any spark to begin</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SANCTUARY_SPARK_PROMPTS.map((spark) => (
            <motion.button
              key={spark.id}
              whileHover={{ scale: 1.01, x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectPrompt(spark.prompt)}
              className="flex items-center justify-between p-3 rounded-xl bg-[#1A1230]/70 hover:bg-[#251945] border border-[#9D7FE3]/20 hover:border-[#9D7FE3]/50 transition-all text-left group shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#151234] border border-[#9D7FE3]/30 flex items-center justify-center shrink-0">
                  {renderPromptIcon(spark.iconName)}
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#F5E1C8] group-hover:text-white transition-colors">
                    {spark.title}
                  </div>
                  <div className="text-[10px] text-[#B39DE5]/70">
                    {spark.tag}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#B39DE5]/40 group-hover:text-[#F198B7] transition-colors shrink-0 ml-2" />
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
