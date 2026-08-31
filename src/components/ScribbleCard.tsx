import React, { useState, useRef } from 'react';
import { SvgScribbleData } from '../lib/types';
import { getScribbleStyle, sanitizeSvg } from '../lib/svgSanitizer';
import { Download, Maximize2, X, Sparkles, Heart, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { triggerHaptic } from '../lib/haptics';

export interface ScribbleCardProps {
  scribble: SvgScribbleData;
  className?: string;
  isCompact?: boolean;
  showActions?: boolean;
}

export function ScribbleCard({
  scribble,
  className = '',
  isCompact = false,
  showActions = true,
}: ScribbleCardProps) {
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [copied, setCopied] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const styleMeta = getScribbleStyle(scribble.moodStyle);
  const safeSvg = sanitizeSvg(scribble.svgMarkup);
  const authorName = scribble.authorDisplayName || scribble.authorModelId?.split('/').pop()?.replace(/^gemma/, 'Gemma')?.replace(/^gemini/, 'Gemini') || 'Your Companion';

  const handleDownloadSvg = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    const blob = new Blob([safeSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(scribble.title || 'sanctuary-scribble').toLowerCase().replace(/\s+/g, '-')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopySvg = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    navigator.clipboard.writeText(safeSvg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div 
        className={`relative group/scribble overflow-hidden rounded-2xl border-[3px] border-[#2C194D] bg-gradient-to-b ${styleMeta.bgGradient} p-3 sm:p-4 shadow-[4px_4px_0_#2C194D] transition-transform ${className}`}
      >
        {/* Top Paper Tape / Accent Pin */}
        <div 
          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-16 h-4 rounded-sm border border-[#2C194D]/30 shadow-sm rotate-[-2deg] pointer-events-none z-10 opacity-90"
          style={{ backgroundColor: styleMeta.tapeColor }}
        />

        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 mb-2.5 pt-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm shrink-0">🖍️</span>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-black text-[#2C194D] truncate tracking-tight">
                {scribble.title || 'Hand-Drawn Scribble'}
              </h4>
              <p className="text-[10px] font-bold text-[#2C194D]/70 truncate">
                Handmade by <span className="text-[#2C194D] font-black">{authorName}</span> for Amanda
              </p>
            </div>
          </div>

          <span 
            className="text-[10px] font-black px-2 py-0.5 rounded-full border border-[#2C194D]/30 bg-white/60 text-[#2C194D] shrink-0 shadow-sm"
          >
            {styleMeta.badge}
          </span>
        </div>

        {/* SVG Drawing Canvas Container */}
        <div 
          ref={svgContainerRef}
          onClick={() => { setIsEnlarged(true); triggerHaptic('light'); }}
          className={`relative w-full rounded-xl border-[2px] border-[#2C194D]/40 p-2 sm:p-3 overflow-hidden cursor-pointer transition-all hover:border-[#2C194D] ${isCompact ? 'aspect-[4/3] max-h-[220px]' : 'aspect-[4/3] max-h-[340px]'}`}
          style={{ 
            backgroundColor: styleMeta.paperBg,
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
          }}
        >
          {/* Subtle Paper Grid / Texture Overlay */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#2C194D 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }}
          />

          {/* Rendered SVG Drawing */}
          <div 
            className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-full [&>svg]:object-contain"
            dangerouslySetInnerHTML={{ __html: safeSvg }}
          />

          {/* Hover Zoom Prompt */}
          <div className="absolute bottom-2 right-2 opacity-0 group-hover/scribble:opacity-100 transition-opacity bg-[#2C194D]/80 text-[#F5E1C8] p-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 backdrop-blur-sm">
            <Maximize2 size={12} />
            <span>Enlarge</span>
          </div>
        </div>

        {/* Reason / Accompanying Message */}
        {scribble.reason && (
          <div className="mt-2.5 p-2 rounded-xl bg-[#2C194D]/5 border border-[#2C194D]/15">
            <p className="text-[11px] font-bold text-[#2C194D] italic leading-snug flex items-start gap-1.5">
              <Heart size={12} className="text-[#F198B7] shrink-0 mt-0.5 fill-[#F198B7]" />
              <span>"{scribble.reason}"</span>
            </p>
          </div>
        )}

        {/* Action Controls */}
        {showActions && (
          <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-[#2C194D]/15 text-xs font-bold text-[#2C194D]">
            <div className="flex items-center gap-1 text-[10px] text-[#2C194D]/70">
              <Sparkles size={11} className="text-[#F198B7]" />
              <span>Saved to Gift Vault</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopySvg}
                title="Copy SVG Code"
                className="p-1.5 rounded-lg bg-white/70 hover:bg-white text-[#2C194D] border border-[#2C194D]/30 shadow-sm active:translate-y-0.5 transition-all text-[11px] font-extrabold flex items-center gap-1"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <span>SVG</span>}
              </button>

              <button
                onClick={handleDownloadSvg}
                title="Download SVG Drawing"
                className="p-1.5 rounded-lg bg-[#F198B7] hover:bg-[#F198B7]/90 text-[#2C194D] border border-[#2C194D] shadow-[1px_1px_0_#2C194D] active:translate-y-0.5 transition-all flex items-center gap-1 text-[11px] font-black"
              >
                <Download size={12} />
                <span>Save</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Enlarged Cozy Lightbox Modal */}
      <AnimatePresence>
        {isEnlarged && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsEnlarged(false)}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#151234]/95 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-2xl w-full rounded-3xl border-[4px] border-[#2C194D] p-5 sm:p-7 shadow-[8px_8px_0_#2C194D] cursor-default flex flex-col gap-4"
              style={{ backgroundColor: styleMeta.paperBg }}
            >
              {/* Close Button */}
              <button
                onClick={() => setIsEnlarged(false)}
                className="absolute top-4 right-4 p-2 bg-[#F198B7] text-[#2C194D] rounded-xl border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] hover:bg-[#F198B7]/80 transition-all font-black"
              >
                <X size={18} strokeWidth={3} />
              </button>

              {/* Title & Author */}
              <div className="pr-12">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🖍️</span>
                  <h3 className="text-xl sm:text-2xl font-black text-[#2C194D] tracking-tight">
                    {scribble.title || 'Hand-Drawn Scribble'}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#2C194D]/70">
                  Drawn by <strong className="text-[#2C194D]">{authorName}</strong> as an intimate handmade gift for Amanda
                </p>
              </div>

              {/* High-res Large SVG Canvas */}
              <div 
                className="w-full aspect-[4/3] rounded-2xl border-[3px] border-[#2C194D] p-4 sm:p-6 bg-white/70 shadow-inner flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-full [&>svg]:object-contain overflow-hidden"
              >
                <div 
                  className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
                  dangerouslySetInnerHTML={{ __html: safeSvg }}
                />
              </div>

              {/* Note and metadata */}
              {scribble.reason && (
                <div className="p-3.5 rounded-2xl bg-[#2C194D]/5 border-[2px] border-[#2C194D]/20">
                  <p className="text-sm font-bold text-[#2C194D] italic leading-relaxed">
                    "{scribble.reason}"
                  </p>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-xs font-bold text-[#2C194D]/70">
                  Style: <strong className="text-[#2C194D]">{scribble.moodStyle || 'Crayon Doodle'}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySvg}
                    className="px-3 py-2 rounded-xl bg-white text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] font-black text-xs hover:bg-[#F5E1C8] transition-all flex items-center gap-1.5"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <span>Copy SVG</span>}
                  </button>

                  <button
                    onClick={handleDownloadSvg}
                    className="px-4 py-2 rounded-xl bg-[#F198B7] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] font-black text-xs hover:bg-[#F198B7]/90 transition-all flex items-center gap-1.5"
                  >
                    <Download size={14} />
                    <span>Download SVG</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
