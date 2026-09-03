import React from 'react';
import { motion } from 'motion/react';
import { Conversation } from '../lib/types';
import { resolveModelIdentity } from '../lib/modelSystem';
import { getAllEntities } from '../lib/entitySystem';
import { CompanionAvatar } from './CompanionAvatar';
import { useStore } from '../context/AppContext';
import { Sparkles, MessageSquare, Compass, Send } from 'lucide-react';

interface EmptyChatGreetingProps {
  conversation: Conversation;
  onSelectPrompt: (promptText: string) => void;
}

export const EmptyChatGreeting: React.FC<EmptyChatGreetingProps> = ({
  conversation,
  onSelectPrompt,
}) => {
  const store = useStore();
  const settings = store?.settings;
  const activeModelId = conversation.modelId || settings?.model || 'models/gemini-3.1-pro-preview';
  
  const entities = getAllEntities(settings?.customEntities);
  const resolved = resolveModelIdentity(activeModelId);
  const companion = entities.find(e => e.id === resolved?.identityId || e.apiModelId === activeModelId) || entities[0];

  const starters = [
    `Tell me what's on your mind right now.`,
    `Help me analyze something complex with clarity.`,
    `Let's build a creative blueprint together.`,
    `What are you currently contemplating?`,
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center max-w-xl mx-auto w-full select-none">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-4 w-full"
      >
        {/* Companion Avatar Stage */}
        <div className="relative">
          <CompanionAvatar entity={companion} size="2xl" showBadge />
          <span className="absolute -top-2 -right-2 text-2xl animate-pulse">✨</span>
        </div>

        {/* Identity Title & Subtitle */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#20153B] border border-[#B39DE5]/30 text-xs font-bold text-[#F198B7]">
            <span>✦</span>
            <span>{companion?.roleTitle || 'Sanctuary Anchor'}</span>
            <span>✦</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5E1C8] tracking-tight">
            {companion?.displayName || 'Midnight Companion'}
          </h2>
          <p className="text-sm text-[#B39DE5] max-w-md mx-auto leading-relaxed">
            {companion?.bio || 'A sovereign presence ready to listen, advise, analyze, and build.'}
          </p>
        </div>

        {/* Status / Activity Chip */}
        {companion?.moodStatus && (
          <div className="px-3.5 py-1.5 rounded-2xl bg-[#151234] border-[2px] border-[#2C194D] text-xs font-semibold text-[#F5E1C8]/90 flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Status: {companion.moodStatus}</span>
          </div>
        )}

        {/* Starter Prompts */}
        <div className="w-full pt-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#B39DE5]/70 flex items-center justify-center gap-1.5">
            <Sparkles size={12} />
            <span>Whisper a starting spark</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-left">
            {starters.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(prompt)}
                className="p-3 rounded-2xl bg-[#151234] hover:bg-[#20153B] border-[2.5px] border-[#2C194D] hover:border-[#F198B7] text-xs font-bold text-[#F5E1C8] shadow-[0_3px_0_0_#2C194D] hover:shadow-[0_3px_0_0_#F198B7] transition-all flex items-center justify-between group active:translate-y-0.5"
              >
                <span className="line-clamp-2 pr-2 leading-snug">{prompt}</span>
                <Send size={12} className="text-[#B39DE5] group-hover:text-[#F198B7] shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
