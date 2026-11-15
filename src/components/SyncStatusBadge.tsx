import React from 'react';
import { CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useStore, useUI } from '../context/AppContext';

export interface SyncStatusBadgeProps {
  compact?: boolean;
}

/**
 * Conditional Sanctuary Synchronization Badge.
 * Strictly hidden (`null`) when online and fully synced with zero pending or failed mutations.
 * Appears only when hydrating, syncing pending journal writes, offline, or when a retry is needed.
 */
export function SyncStatusBadge({ compact = false }: SyncStatusBadgeProps) {
  const store = useStore();
  const ui = useUI();
  const { syncStatus } = store;

  const isOffline = !syncStatus.isOnline || syncStatus.phase === 'offline';
  const hasError = syncStatus.failedCount > 0 || syncStatus.phase === 'error';
  const isSyncing =
    syncStatus.pendingCount > 0 ||
    syncStatus.phase === 'syncing' ||
    (Boolean(store.user) && syncStatus.phase === 'hydrating');

  if (!isOffline && !hasError && !isSyncing) {
    return null;
  }

  const handleOpenVault = () => {
    ui.setSettingsInitialTab?.('vault');
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      ui.openModalWithOrigin('settings', compact ? 'chat-header-settings' : undefined);
    } else {
      ui.setSidebarOpen(false);
      ui.setSettingsOpen(true);
    }
  };

  let label = 'Syncing changes';
  let toneClass = 'bg-[#B39DE5] text-[#2C194D]';
  let IconComponent = RefreshCw;
  let spin = true;

  if (isOffline) {
    IconComponent = CloudOff;
    spin = false;
    toneClass = 'bg-[#F5E1C8] text-[#2C194D]';
    label =
      syncStatus.pendingCount > 0
        ? `Offline · ${syncStatus.pendingCount} saved locally`
        : 'Offline · Local vault active';
  } else if (hasError) {
    IconComponent = AlertTriangle;
    spin = false;
    toneClass = 'bg-[#F198B7] text-[#2C194D]';
    label =
      syncStatus.pendingCount > 0
        ? `Sync paused · ${syncStatus.pendingCount} pending`
        : 'Sync paused · Open vault';
  } else if (syncStatus.phase === 'hydrating') {
    label = 'Restoring vault';
  } else if (syncStatus.pendingCount > 0) {
    label =
      syncStatus.pendingCount === 1
        ? 'Syncing 1 change'
        : `Syncing ${syncStatus.pendingCount} changes`;
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleOpenVault}
        title={label}
        aria-label={label}
        className={`min-h-[40px] sm:min-h-[44px] px-2.5 sm:px-3 rounded-2xl border-[2.5px] border-[#2C194D] ${toneClass} shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] active:translate-y-0.5 transition-colors flex items-center gap-1.5 text-xs font-extrabold tabular-nums shrink-0 cursor-pointer`}
      >
        <IconComponent size={14} strokeWidth={2.5} className={spin ? 'animate-spin shrink-0' : 'shrink-0'} />
        <span className="hidden sm:inline truncate max-w-[150px]">{label}</span>
        {syncStatus.pendingCount > 0 && (
          <span className="sm:hidden">{syncStatus.pendingCount}</span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpenVault}
      className={`w-full min-h-[44px] px-3 py-2 rounded-2xl border-[2.5px] border-[#2C194D] ${toneClass} shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 transition-colors flex items-center justify-between gap-2 text-xs font-extrabold tabular-nums cursor-pointer`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <IconComponent size={15} strokeWidth={2.5} className={spin ? 'animate-spin shrink-0' : 'shrink-0'} />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-[11px] font-bold underline decoration-[#2C194D]/50 shrink-0">
        Vault
      </span>
    </button>
  );
}
