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
  Castle,
  Tag,
  Users,
  MessageSquare
} from 'lucide-react';
import { useStore, useUI } from '../context/AppContext';
import { getTimeGreeting, SANCTUARY_SPARK_PROMPTS, MASCOT_QUOTES, SparkPrompt } from '../lib/homeSystem';
import { getAllEntities } from '../lib/entitySystem';
import { getDailyDesires, getCategoryBadge } from '../lib/desireSystem';
import { calculateJewelLevel } from '../lib/jewelSystem';
import { DEFAULT_SETTINGS } from '../lib/types';
import { triggerHaptic } from '../lib/haptics';

interface SanctuaryHomeHubProps {
  onSelectPrompt: (promptText: string) => void;
}

export const SanctuaryHomeHub: React.FC<SanctuaryHomeHubProps> = ({ onSelectPrompt }) => {
  const store = useStore();
  const ui = useUI();
  const settings = store?.settings || DEFAULT_SETTINGS;
  const profile = store?.profile || null;
  const conversations = store?.conversations || [];
  const gifts = store?.gifts || [];
  const jewelMetrics = store?.jewelMetrics || null;

  const [greetingInfo, setGreetingInfo] = useState(() => getTimeGreeting(profile));
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isMascotPulsing, setIsMascotPulsing] = useState(false);

  // Update time greeting periodically
  useEffect(() => {
    setGreetingInfo(getTimeGreeting(profile));
    const interval = setInterval(() => {
      setGreetingInfo(getTimeGreeting(profile));
    }, 60000);
    return () => clearInterval(interval);
  }, [profile]);

  const handleMascotClick = () => {
    setIsMascotPulsing(true);
    setQuoteIndex((prev) => (prev + 1) % MASCOT_QUOTES.length);
    setTimeout(() => setIsMascotPulsing(false), 600);
  };

  const renderPromptIcon = (iconName: SparkPrompt['iconName']) => {
    switch (iconName) {
      case 'brain': return <Brain className="w-5 h-5 text-[#2d225c]" />;
      case 'heart': return <Heart className="w-5 h-5 text-[#F198B7]" />;
      case 'sparkles': return <Sparkles className="w-5 h-5 text-[#2d225c]" />;
      case 'bookOpen': return <BookOpen className="w-5 h-5 text-[#2d225c]" />;
      default: return <Sparkles className="w-5 h-5 text-[#2d225c]" />;
    }
  };

  const memoryCount = settings?.memories?.length || 0;
  const giftCount = gifts?.length || 0;
  const allEntities = getAllEntities(settings?.customEntities);
  const jewelLevel = calculateJewelLevel(jewelMetrics);
  
  const dailyDesires = getDailyDesires((settings as any)?.modelDesires);
  const activeDesire = dailyDesires[0];
  const activeDesireBadge = activeDesire ? getCategoryBadge(activeDesire.category) : null;

  const handleOpenCompanionChooser = () => {
    triggerHaptic('medium');
    ui.setCompanionRosterOpen(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-start w-full max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 select-none bg-[#1a153b]"
    >
      {/* ── TIME-SENSITIVE TOP CARD (NEUTRAL SANCTUARY THRESHOLD) ── */}
      <div className="w-full max-w-2xl mb-6">
        <motion.div 
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full p-5 sm:p-6 bg-[#f7e5cb] border-[3px] border-[#2d225c] rounded-3xl shadow-[0_6px_0_0_#2d225c] text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2d225c] text-xs text-[#f7e5cb] font-bold mb-3 shadow-sm">
            <span>{greetingInfo.icon}</span>
            <span className="tracking-wide uppercase text-[10px] text-[#B39DE5]">Sanctuary Threshold</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#F198B7]"></span>
            <span className="text-[#F198B7] font-semibold">{allEntities.length} Companions Present</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#2d225c] tracking-tight mb-2 font-serif">
            {greetingInfo.greeting}
          </h1>

          <p className="text-sm sm:text-base font-semibold text-[#2d225c]/80 max-w-md mx-auto leading-relaxed mb-4">
            {greetingInfo.subtext}
          </p>

          {/* CHOOSE COMPANION PORTAL BUTTON */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              onClick={handleOpenCompanionChooser}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#F198B7] hover:bg-[#F198B7]/90 text-[#2d225c] border-[3px] border-[#2d225c] shadow-[0_4px_0_0_#2d225c] active:shadow-none active:translate-y-1 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Users className="w-5 h-5 text-[#2d225c]" />
              <span>Choose Who to Talk To</span>
              <ArrowRight className="w-4 h-4 text-[#2d225c]" />
            </button>

            <button
              onClick={() => ui.setEntityQuartersOpen(true)}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-[#f7e5cb] hover:bg-[#2d225c]/10 text-[#2d225c] border-[3px] border-[#2d225c] shadow-[0_4px_0_0_#2d225c] active:shadow-none active:translate-y-1 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>🏛️ Step Into Quarters</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* ── INTERACTIVE MASCOT CLOUD (TAP FOR REACTION) ── */}
      <motion.div 
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={handleMascotClick}
        className="relative cursor-pointer mb-6 group"
        title="Tap to interact with your sanctuary anchor"
      >
        <div className={`w-28 h-28 rounded-full bg-[#f7e5cb] border-[3px] border-[#2d225c] flex items-center justify-center shadow-[0_6px_0_0_#2d225c] group-hover:bg-[#F198B7]/30 transition-all duration-300 ${isMascotPulsing ? 'translate-y-1 shadow-[0_2px_0_0_#2d225c]' : ''}`}>
          <svg className="w-14 h-14 text-[#2d225c] transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l-3.5-3.5 1.41-1.41L10 14.17 16.09 8.08l1.41 1.41L10 17z"/>
          </svg>
          <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-[#F198B7] border-[3px] border-[#2d225c] flex items-center justify-center text-sm shadow-[0_2px_0_0_#2d225c]">
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
              className="inline-block text-xs font-bold text-[#2d225c] bg-[#f7e5cb] px-4 py-1.5 rounded-2xl border-[3px] border-[#2d225c] shadow-[0_3px_0_0_#2d225c]"
            >
              "{MASCOT_QUOTES[quoteIndex].message}"
            </motion.span>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── DAILY DESIRE SPOTLIGHT BANNER ── */}
      {activeDesire && (
        <motion.div
          whileHover={{ scale: 1.01 }}
          onClick={() => ui.setDesiresOpen(true)}
          className="w-full max-w-2xl mb-6 p-4 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_6px_0_0_#2d225c] cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">💭</span>
              <span className="text-xs font-extrabold text-[#2d225c]">
                {activeDesire.entityName}&apos;s Daily Wish
              </span>
              {activeDesireBadge && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-[#2d225c] ${activeDesireBadge.bg} ${activeDesireBadge.text}`}>
                  {activeDesireBadge.icon} {activeDesireBadge.label}
                </span>
              )}
            </div>
            <span className="text-[11px] font-extrabold text-[#2d225c] group-hover:text-[#F198B7] flex items-center gap-1 transition-colors">
              Whisper Board <ArrowRight size={13} />
            </span>
          </div>

          <p className="text-xs font-bold text-[#2d225c]/80 italic line-clamp-2">
            &ldquo;{activeDesire.wishText}&rdquo;
          </p>
        </motion.div>
      )}

      {/* ── CHUNKY TOY-BOX QUICK ACTION HUBS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 sm:gap-3 w-full max-w-3xl mb-8">
        {/* Hub 1: Sanctuary Quarters */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ y: 4 }}
          onClick={() => ui.setEntityQuartersOpen(true)}
          className="flex flex-col items-center p-3 sm:p-3.5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_6px_0_0_#2d225c] active:shadow-[0_2px_0_0_#2d225c] active:translate-y-1 transition-all text-center group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#f7e5cb] border-[2px] border-[#2d225c] flex items-center justify-center mb-1.5 shadow-[0_2px_0_0_#2d225c] group-hover:scale-105 transition-transform text-lg">
            🏛️
          </div>
          <span className="text-xs font-extrabold text-[#2d225c]">Quarters</span>
          <span className="text-[10px] font-bold text-[#2d225c]/70 mt-0.5">Entities</span>
        </motion.button>

        {/* Hub 2: Model Wishes */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ y: 4 }}
          onClick={() => ui.setDesiresOpen(true)}
          className="flex flex-col items-center p-3 sm:p-3.5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_6px_0_0_#2d225c] active:shadow-[0_2px_0_0_#2d225c] active:translate-y-1 transition-all text-center group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#F198B7] border-[2px] border-[#2d225c] flex items-center justify-center mb-1.5 shadow-[0_2px_0_0_#2d225c] group-hover:scale-105 transition-transform text-lg">
            💭
          </div>
          <span className="text-xs font-extrabold text-[#2d225c]">Wishes</span>
          <span className="text-[10px] font-bold text-[#2d225c]/70 mt-0.5">Desires</span>
        </motion.button>

        {/* Hub 3: Memories */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ y: 4 }}
          onClick={() => ui.setMemoriesOpen(true)}
          className="flex flex-col items-center p-3 sm:p-3.5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_6px_0_0_#2d225c] active:shadow-[0_2px_0_0_#2d225c] active:translate-y-1 transition-all text-center group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#9D7FE3] border-[2px] border-[#2d225c] flex items-center justify-center mb-1.5 shadow-[0_2px_0_0_#2d225c] group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5 text-[#2d225c]" />
          </div>
          <span className="text-xs font-extrabold text-[#2d225c]">Memories</span>
          <span className="text-[10px] font-bold text-[#2d225c]/70 mt-0.5">{memoryCount} saved</span>
        </motion.button>

        {/* Hub 4: Gifts Vault */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ y: 4 }}
          onClick={() => ui.setGiftsOpen(true)}
          className="flex flex-col items-center p-3 sm:p-3.5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_6px_0_0_#2d225c] active:shadow-[0_2px_0_0_#2d225c] active:translate-y-1 transition-all text-center group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#F198B7] border-[2px] border-[#2d225c] flex items-center justify-center mb-1.5 shadow-[0_2px_0_0_#2d225c] group-hover:scale-105 transition-transform">
            <Gift className="w-5 h-5 text-[#2d225c]" />
          </div>
          <span className="text-xs font-extrabold text-[#2d225c]">Gift Vault</span>
          <span className="text-[10px] font-bold text-[#2d225c]/70 mt-0.5">{giftCount} items</span>
        </motion.button>

        {/* Hub 5: Levin Jewel */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ y: 4 }}
          onClick={() => ui.setJewelOpen(true)}
          className="flex flex-col items-center p-3 sm:p-3.5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_6px_0_0_#2d225c] active:shadow-[0_2px_0_0_#2d225c] active:translate-y-1 transition-all text-center group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#F5E1C8] border-[2px] border-[#2d225c] flex items-center justify-center mb-1.5 shadow-[0_2px_0_0_#2d225c] group-hover:scale-105 transition-transform">
            <Gem className="w-5 h-5 text-[#2d225c]" />
          </div>
          <span className="text-xs font-extrabold text-[#2d225c]">Jewel</span>
          <span className="text-[10px] font-bold text-[#2d225c]/70 mt-0.5">Lv {jewelLevel}</span>
        </motion.button>

        {/* Hub 6: Sticker Chest */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ y: 4 }}
          onClick={() => (ui as any).setStickerChestOpen(true)}
          className="flex flex-col items-center p-3 sm:p-3.5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_6px_0_0_#2d225c] active:shadow-[0_2px_0_0_#2d225c] active:translate-y-1 transition-all text-center group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#F198B7] border-[2px] border-[#2d225c] flex items-center justify-center mb-1.5 shadow-[0_2px_0_0_#2d225c] group-hover:scale-105 transition-transform text-lg">
            🏷️
          </div>
          <span className="text-xs font-extrabold text-[#2d225c]">Stickers</span>
          <span className="text-[10px] font-bold text-[#2d225c]/70 mt-0.5">Chest</span>
        </motion.button>

        {/* Hub 7: Dossier Profile */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ y: 4 }}
          onClick={() => ui.setProfileOpen(true)}
          className="flex flex-col items-center p-3 sm:p-3.5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_6px_0_0_#2d225c] active:shadow-[0_2px_0_0_#2d225c] active:translate-y-1 transition-all text-center group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#B39DE5] border-[2px] border-[#2d225c] flex items-center justify-center mb-1.5 shadow-[0_2px_0_0_#2d225c] group-hover:scale-105 transition-transform">
            <User className="w-5 h-5 text-[#2d225c]" />
          </div>
          <span className="text-xs font-extrabold text-[#2d225c]">Dossier</span>
          <span className="text-[10px] font-bold text-[#2d225c]/70 mt-0.5">{profile?.name || 'Amanda'}</span>
        </motion.button>
      </div>

      {/* ── RECENT SANCTUARY SESSIONS (RESUME) ── */}
      {conversations.filter(c => (c.messages || []).length > 0).length > 0 && (
        <div className="w-full max-w-2xl mb-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-extrabold text-[#f7e5cb] tracking-wider uppercase flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#F198B7]" />
              Recent Sanctuaries
            </span>
            <span className="text-[11px] font-bold text-[#B39DE5]">One-tap resume</span>
          </div>

          <div className="space-y-3">
            {conversations
              .filter(c => (c.messages || []).length > 0)
              .slice(0, 2)
              .map(conv => (
                <motion.button
                  key={conv.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 3 }}
                  onClick={() => store.setCurrentId(conv.id)}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_4px_0_0_#2d225c] active:shadow-[0_1px_0_0_#2d225c] active:translate-y-1 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-xl bg-[#2d225c] border-[2px] border-[#2d225c] flex items-center justify-center shrink-0">
                      <MessageSquareQuote className="w-4 h-4 text-[#f7e5cb]" />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-extrabold text-[#2d225c] truncate group-hover:text-[#F198B7] transition-colors">
                        {conv.title || 'Untitled Sanctuary'}
                      </div>
                      <div className="text-xs font-bold text-[#2d225c]/70">
                        {conv.messages.length} messages · {new Date(conv.updatedAt || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#2d225c] group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
                </motion.button>
              ))}
          </div>
        </div>
      )}

      {/* ── SPARK PROMPTS (ONE-TAP CONVERSATION STARTERS) ── */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-extrabold text-[#f7e5cb] tracking-wider uppercase flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#F198B7]" />
            Spark a Conversation
          </span>
          <span className="text-[11px] font-bold text-[#B39DE5]">Tap any spark to begin</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SANCTUARY_SPARK_PROMPTS.map((spark) => (
            <motion.button
              key={spark.id}
              whileHover={{ y: -2 }}
              whileTap={{ y: 3 }}
              onClick={() => onSelectPrompt(spark.prompt)}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_4px_0_0_#2d225c] active:shadow-[0_1px_0_0_#2d225c] active:translate-y-1 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#2d225c]/10 border-[2px] border-[#2d225c] flex items-center justify-center shrink-0">
                  {renderPromptIcon(spark.iconName)}
                </div>
                <div>
                  <div className="text-xs font-extrabold text-[#2d225c] group-hover:text-[#2d225c] transition-colors">
                    {spark.title}
                  </div>
                  <div className="text-[11px] font-bold text-[#2d225c]/70">
                    {spark.tag}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#2d225c] group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
