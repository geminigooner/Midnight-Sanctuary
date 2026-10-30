import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AlertCircle, RotateCcw, Trash2, ArrowRight } from 'lucide-react';
import { triggerHaptic } from '../lib/haptics';

export interface ErrorStateProps {
  /** The error message or raw error text from API */
  errorMessage?: string;
  /** The original user prompt that failed to transmit / get a response */
  userPrompt?: string;
  /** Callback invoked when the user clicks 'Retry' */
  onRetry: () => void;
  /** Optional callback to delete or dismiss the failed message */
  onDismiss?: () => void;
  /** Whether a retry generation is currently underway */
  isRetrying?: boolean;
  /** Optional custom class name */
  className?: string;
}

/**
 * ErrorState Component
 * Displays a friendly, neobrutalist error banner for failed chat transmissions
 * and provides a 1-click 'Retry' button that re-transmits without re-typing.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  errorMessage = 'Failed to generate a response. Transmission was interrupted.',
  userPrompt,
  onRetry,
  onDismiss,
  isRetrying = false,
  className = '',
}) => {
  const reducedMotion = useReducedMotion();

  // Clean bracketed errors like "[Error: Overloaded]" into readable sentences
  const cleanErrorText = React.useMemo(() => {
    let text = errorMessage.trim();
    if (text.startsWith('[') && text.endsWith(']')) {
      text = text.slice(1, -1).trim();
    }
    if (text.startsWith('Error:')) {
      text = text.replace(/^Error:\s*/i, '').trim();
    }
    return text || 'Failed to complete message transmission.';
  }, [errorMessage]);

  const handleRetryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRetrying) return;
    triggerHaptic('medium');
    onRetry();
  };

  const handleDismissClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    onDismiss?.();
  };

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 450, damping: 28 }}
      className={`w-full rounded-2xl bg-[#22183d] border-[3px] border-[#2C194D] p-3.5 sm:p-4 text-[#F5E1C8] shadow-[4px_4px_0_#2C194D] relative overflow-hidden select-text ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#EF4444]/20 border-[2px] border-[#2C194D] flex items-center justify-center shrink-0 text-[#F198B7]">
            <AlertCircle size={16} strokeWidth={2.5} />
          </div>
          <span className="font-black text-xs sm:text-sm text-[#F5E1C8] tracking-tight truncate">
            Transmission Interrupted
          </span>
        </div>

        <span className="shrink-0 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#EF4444]/20 text-[#F198B7] border border-[#F198B7]/30 tracking-wider">
          Failed
        </span>
      </div>

      {/* Error Details */}
      <p className="text-xs text-[#F5E1C8]/90 font-medium leading-relaxed mb-3">
        {cleanErrorText}
      </p>

      {/* User prompt preview if available */}
      {userPrompt && (
        <div className="mb-3 p-2.5 rounded-xl bg-[#151234]/90 border-[2px] border-[#2C194D] text-[11px] leading-snug">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#B39DE5] mb-1 flex items-center gap-1">
            <ArrowRight size={10} strokeWidth={3} />
            <span>Original message to retry:</span>
          </div>
          <p className="text-[#F5E1C8]/80 italic line-clamp-2 break-words">
            "{userPrompt}"
          </p>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t-[2px] border-[#2C194D]/30">
        <div className="text-[11px] text-[#B39DE5]/70 hidden sm:block font-medium">
          Retries without re-typing
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {onDismiss && (
            <button
              type="button"
              onClick={handleDismissClick}
              className="px-2.5 py-1.5 rounded-xl bg-[#151234] hover:bg-[#2C194D] text-[#F5E1C8]/70 hover:text-[#F5E1C8] border-[2px] border-[#2C194D] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:translate-y-0.5"
              title="Dismiss error message"
            >
              <Trash2 size={12} />
              <span>Dismiss</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRetryClick}
            disabled={isRetrying}
            className={`px-3.5 py-1.5 rounded-xl bg-[#F198B7] hover:bg-[#ff9cbd] active:translate-y-0.5 text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
            title="Retry sending this message"
          >
            <RotateCcw
              size={13}
              strokeWidth={2.7}
              className={isRetrying ? 'animate-spin' : ''}
            />
            <span>{isRetrying ? 'Retrying...' : 'Retry Message'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};
