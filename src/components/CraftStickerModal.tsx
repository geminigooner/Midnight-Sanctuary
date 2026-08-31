import React, { useState } from 'react';
import { Sparkles, X, Check, Shield, Circle, Hexagon, Gem, Award, Bookmark } from 'lucide-react';
import { motion } from 'motion/react';
import { SanctuarySticker } from '../lib/stickerSystem';
import { triggerHaptic } from '../lib/haptics';

export interface StickerBadgeProps {
  sticker: SanctuarySticker;
  size?: 'sm' | 'md' | 'lg';
  isGlowing?: boolean;
  className?: string;
  onClick?: () => void;
}

export function StickerBadge({
  sticker,
  size = 'md',
  isGlowing = true,
  className = '',
  onClick,
}: StickerBadgeProps) {
  const sparkleColor = sticker.sparkleColor || '#F198B7';
  const shape = sticker.badgeShape || 'shield';
  const glow = sticker.glowEffect || 'neon';

  const sizeClasses = {
    sm: 'w-8 h-8 text-base',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl',
  }[size];

  const glowStyles = isGlowing ? {
    boxShadow: `0 0 16px ${sparkleColor}66, inset 0 0 8px ${sparkleColor}33`,
    borderColor: sparkleColor,
  } : {
    borderColor: '#2C194D',
  };

  const getShapeBorderClass = () => {
    switch (shape) {
      case 'circle': return 'rounded-full';
      case 'diamond': return 'rounded-2xl rotate-45';
      case 'hex': return 'rounded-xl';
      case 'stamp': return 'rounded-lg border-dashed';
      case 'ribbon': return 'rounded-t-2xl rounded-b-sm';
      case 'shield':
      default:
        return 'rounded-2xl';
    }
  };

  return (
    <div
      onClick={onClick}
      style={glowStyles}
      className={`relative inline-flex items-center justify-center border-[2.5px] bg-[#1a153b] transition-transform select-none cursor-pointer hover:scale-105 active:scale-95 ${sizeClasses} ${getShapeBorderClass()} ${className}`}
    >
      {/* Inner subtle glow ring */}
      <div 
        className={`absolute inset-0.5 pointer-events-none opacity-40 ${shape === 'circle' ? 'rounded-full' : 'rounded-xl'}`}
        style={{
          background: `radial-gradient(circle, ${sparkleColor}44 0%, transparent 70%)`
        }}
      />

      {/* SVG or Emoji */}
      <div className={shape === 'diamond' ? '-rotate-45' : ''}>
        {sticker.customSvg ? (
          <div 
            className="w-full h-full p-1 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
            dangerouslySetInnerHTML={{ __html: sticker.customSvg }}
          />
        ) : (
          <span>{sticker.emoji}</span>
        )}
      </div>

      {/* Pulsing Sparkle Indicator */}
      {isGlowing && glow === 'pulse' && (
        <span 
          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-ping"
          style={{ backgroundColor: sparkleColor }}
        />
      )}
    </div>
  );
}

export interface CraftStickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sticker: {
    name: string;
    emoji: string;
    description: string;
    sparkleColor: string;
    glowEffect: 'neon' | 'pulse' | 'gold' | 'starlight' | 'holo';
    badgeShape: 'circle' | 'shield' | 'hex' | 'diamond' | 'stamp' | 'ribbon';
    customSvg?: string;
  }) => void;
}

const PRESET_COLORS = [
  { label: 'Rose Levin', hex: '#F198B7' },
  { label: 'Violet Nebula', hex: '#B39DE5' },
  { label: 'Warm Amber', hex: '#F5E1C8' },
  { label: 'Cyan Matrix', hex: '#93C5FD' },
  { label: 'Emerald Kernel', hex: '#34D399' },
  { label: 'Golden Sovereign', hex: '#FBBF24' },
  { label: 'Obsidian Velvet', hex: '#E4E4E7' },
];

const PRESET_EMOJIS = [
  '🐱✨', '💜🔒', '👑✨', '💡⚡', '🛡️💫', '🔮🌌', '☕🎀', '🌙⭐',
  '🧸💕', '💎🔥', '🧬🔬', '🕸️👁️', '🪐✨', '🎧💿', '🌸🤍', '🗝️💖'
];

export function CraftStickerModal({ isOpen, onClose, onSave }: CraftStickerModalProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💜✨');
  const [description, setDescription] = useState('');
  const [sparkleColor, setSparkleColor] = useState('#F198B7');
  const [glowEffect, setGlowEffect] = useState<'neon' | 'pulse' | 'gold' | 'starlight' | 'holo'>('neon');
  const [badgeShape, setBadgeShape] = useState<'circle' | 'shield' | 'hex' | 'diamond' | 'stamp' | 'ribbon'>('shield');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    triggerHaptic('heavy');
    onSave({
      name: name.trim(),
      emoji: emoji.trim() || '✨',
      description: description.trim() || 'Custom sanctuary badge forged with love.',
      sparkleColor,
      glowEffect,
      badgeShape,
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#151234]/90 backdrop-blur-sm select-none"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-[#20153B] border-[3px] border-[#2C194D] shadow-[0_8px_0_0_#2C194D] p-5 sm:p-6 text-[#F5E1C8] flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2C194D]/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#F198B7] text-[#2C194D] border border-[#2C194D]">
              <Sparkles size={18} />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#F5E1C8]">Forge Custom Glowing Badge</h3>
              <p className="text-xs text-[#B39DE5] font-bold">Craft a bespoke seal for walls & gift cards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#2C194D] hover:bg-[#2C194D]/80 text-[#F5E1C8] border border-[#B39DE5]/30 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Preview */}
        <div className="p-4 rounded-2xl bg-[#151234] border-[2px] border-[#2C194D] flex flex-col items-center justify-center text-center gap-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#B39DE5]">Live Badge Preview</p>
          <StickerBadge
            sticker={{
              id: 'preview',
              name: name || 'Your Custom Badge',
              emoji: emoji || '✨',
              category: 'custom',
              description: description || 'Badge description...',
              sparkleColor,
              glowEffect,
              badgeShape,
              unlockedAt: Date.now(),
            }}
            size="lg"
            isGlowing={true}
          />
          <div className="mt-1">
            <h4 className="text-sm font-black text-[#F5E1C8]">{name || 'Unnamed Badge'}</h4>
            <p className="text-xs text-[#B39DE5] font-medium max-w-xs">{description || 'Crafted in the Sanctuary forge'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Badge Name */}
          <div>
            <label className="text-xs font-black text-[#F5E1C8] mb-1 block">Badge Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Heart of Levin, Zero-Day Shield, Cozy Tea"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#151234] border-[2px] border-[#2C194D] text-[#F5E1C8] text-xs font-bold focus:border-[#F198B7] outline-none placeholder-[#B39DE5]/40"
            />
          </div>

          {/* Emoji Selection */}
          <div>
            <label className="text-xs font-black text-[#F5E1C8] mb-1 block">Emoji / Icon Symbol</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-24 px-3 py-2 rounded-xl bg-[#151234] border-[2px] border-[#2C194D] text-[#F5E1C8] text-center text-base font-black outline-none"
              />
              <div className="flex-1 flex flex-wrap gap-1 items-center max-h-16 overflow-y-auto p-1.5 rounded-xl bg-[#151234] border border-[#2C194D]">
                {PRESET_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setEmoji(em)}
                    className="p-1 text-sm rounded hover:bg-[#2C194D] transition-colors"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-black text-[#F5E1C8] mb-1 block">Lore & Meaning</label>
            <textarea
              rows={2}
              placeholder="Brief note or memory commemorating why this badge exists..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#151234] border-[2px] border-[#2C194D] text-[#F5E1C8] text-xs font-bold focus:border-[#F198B7] outline-none placeholder-[#B39DE5]/40 resize-none"
            />
          </div>

          {/* Color & Shape Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Glow Color */}
            <div>
              <label className="text-xs font-black text-[#F5E1C8] mb-1 block">Glow Sparkle Color</label>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-[#151234] border border-[#2C194D]">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setSparkleColor(c.hex)}
                    title={c.label}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${sparkleColor === c.hex ? 'border-white scale-110 shadow-md' : 'border-[#2C194D]'}`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Emblem Shape */}
            <div>
              <label className="text-xs font-black text-[#F5E1C8] mb-1 block">Emblem Shape</label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#151234] border border-[#2C194D]">
                {[
                  { id: 'shield', label: 'Shield' },
                  { id: 'circle', label: 'Circle' },
                  { id: 'hex', label: 'Hex' },
                  { id: 'diamond', label: 'Diamond' },
                  { id: 'stamp', label: 'Stamp' },
                  { id: 'ribbon', label: 'Ribbon' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setBadgeShape(s.id as any)}
                    className={`py-1 text-[10px] font-black rounded-lg border transition-all ${
                      badgeShape === s.id
                        ? 'bg-[#F198B7] text-[#2C194D] border-[#2C194D]'
                        : 'bg-[#20153B] text-[#B39DE5] border-transparent hover:border-[#2C194D]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Save */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2C194D]/60 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#2C194D] text-[#B39DE5] text-xs font-black hover:bg-[#2C194D]/80 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#F198B7] text-[#2C194D] text-xs font-black border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] hover:bg-[#F198B7]/90 active:translate-y-0.5 transition-all flex items-center gap-1.5"
            >
              <Sparkles size={14} />
              <span>Forge & Add to Chest</span>
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
