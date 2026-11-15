import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { getMotion, resolveSharedLayoutId } from '../lib/motion';

// Stack of active modal close handlers so Escape only dismisses the topmost modal
const activeModalStack: Array<{ id: symbol; onClose: () => void }> = [];
let escapeListenerAttached = false;

function handleGlobalModalEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape' || activeModalStack.length === 0) return;
  const topModal = activeModalStack[activeModalStack.length - 1];
  if (topModal) {
    e.preventDefault();
    e.stopPropagation();
    topModal.onClose();
  }
}

function registerModalEscape(id: symbol, onClose: () => void) {
  const existingIdx = activeModalStack.findIndex((item) => item.id === id);
  if (existingIdx >= 0) {
    activeModalStack[existingIdx].onClose = onClose;
  } else {
    activeModalStack.push({ id, onClose });
  }
  if (!escapeListenerAttached && typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalModalEscape);
    escapeListenerAttached = true;
  }
}

function unregisterModalEscape(id: symbol) {
  const idx = activeModalStack.findIndex((item) => item.id === id);
  if (idx >= 0) {
    activeModalStack.splice(idx, 1);
  }
  if (activeModalStack.length === 0 && escapeListenerAttached && typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalModalEscape);
    escapeListenerAttached = false;
  }
}

export interface SharedModalShellProps {
  originId?: string;
  onClose: () => void;
  backdropClassName?: string;
  panelClassName: string;
  borderRadius?: number;
  zIndexClassName?: string;
  children: React.ReactNode;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

export function SharedModalShell({
  originId,
  onClose,
  backdropClassName = 'bg-[#151234]/88 backdrop-blur-md p-3 sm:p-4',
  panelClassName,
  borderRadius = 24,
  zIndexClassName = 'z-50',
  children,
  closeOnBackdropClick = true,
  closeOnEscape = true,
}: SharedModalShellProps) {
  const reducedMotion = useReducedMotion();
  const sharedLayoutId = resolveSharedLayoutId(originId, reducedMotion);
  const sharedTransition = getMotion('shared', reducedMotion);
  const heavyTransition = getMotion('heavy', reducedMotion);
  const backdropTransition = getMotion('backdrop', reducedMotion);
  const instanceIdRef = useRef<symbol | null>(null);
  if (!instanceIdRef.current) {
    instanceIdRef.current = Symbol('shared-modal');
  }
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!closeOnEscape) return;
    const modalSymbol = instanceIdRef.current!;
    registerModalEscape(modalSymbol, () => onCloseRef.current());
    return () => {
      unregisterModalEscape(modalSymbol);
    };
  }, [closeOnEscape]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={backdropTransition}
      onClick={closeOnBackdropClick ? onClose : undefined}
      className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center ${backdropClassName}`}
    >
      <motion.div
        layoutId={sharedLayoutId}
        style={{ borderRadius }}
        initial={sharedLayoutId ? false : { opacity: 0, scale: 0.95, y: 12 }}
        animate={sharedLayoutId ? undefined : { opacity: 1, scale: 1, y: 0 }}
        exit={sharedLayoutId ? undefined : { opacity: 0, scale: 0.95, y: 12 }}
        transition={sharedLayoutId ? { layout: sharedTransition } : heavyTransition}
        onClick={(e) => e.stopPropagation()}
        className={panelClassName}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export interface SharedModalIconProps {
  originId?: string;
  className: string;
  borderRadius?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function SharedModalIcon({
  originId,
  className,
  borderRadius = 16,
  style,
  children,
}: SharedModalIconProps) {
  const reducedMotion = useReducedMotion();
  const iconLayoutId = resolveSharedLayoutId(originId, reducedMotion, 'icon');
  const sharedTransition = getMotion('shared', reducedMotion);

  return (
    <motion.div
      layoutId={iconLayoutId}
      transition={{ layout: sharedTransition }}
      style={{ borderRadius, ...style }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export interface SharedModalBodyProps {
  className?: string;
  children: React.ReactNode;
}

export function SharedModalBody({ className = '', children }: SharedModalBodyProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: reducedMotion ? 0.12 : 0.2,
        delay: reducedMotion ? 0 : 0.04,
        ease: 'easeOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
