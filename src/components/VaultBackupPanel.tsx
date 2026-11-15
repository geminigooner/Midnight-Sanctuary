import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  CloudOff,
  Trash2,
} from 'lucide-react';
import { useStore } from '../context/AppContext';
import { ValidatedBackupPreview } from '../lib/persistence/types';
import { getSharedPersistenceCoordinator } from '../lib/store';

export function VaultBackupPanel() {
  const store = useStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [exportSummary, setExportSummary] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ValidatedBackupPreview | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [replaceConfirmText, setReplaceConfirmText] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [restoreOutcome, setRestoreOutcome] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const { syncStatus } = store;
  const coordinator = getSharedPersistenceCoordinator();
  const quarantinedMutations = coordinator.getQuarantinedMutations();
  const domainState = coordinator.getDomainState();

  const totalMessages = (store.conversations || []).reduce(
    (sum, c) => sum + (Array.isArray(c.messages) ? c.messages.length : 0),
    0
  );
  const totalSummaries = (store.conversations || []).reduce(
    (sum, c) => sum + (Array.isArray(c.segmentSummaries) ? c.segmentSummaries.length : 0),
    0
  );
  const mediaAssetsCount = (domainState.mediaAssets || []).length;
  const privateMemoriesCount = Object.values(store.companionMemories || {}).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );
  const sharedMemoriesCount = (store.sharedMemories || []).length;

  const handleRetrySync = async () => {
    setIsRetrying(true);
    try {
      await store.retrySync();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDiscardQuarantined = async (mutationId: string) => {
    await coordinator.discardQuarantinedMutation(mutationId);
  };

  const handleExport = () => {
    const envelope = store.exportBackup();
    const json = JSON.stringify(envelope, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `midnight-sanctuary-backup-${dateStamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setExportSummary(
      `Exported schema v${envelope.schemaVersion} · ${envelope.manifest.conversations} conversations · ${envelope.manifest.messages} messages · ${envelope.manifest.privateMemories + envelope.manifest.sharedMemories} memories`
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setRestoreOutcome(null);
    setReplaceConfirmText('');
    if (!file) return;

    setSelectedFileName(file.name);
    try {
      const text = await file.text();
      const validated = store.validateBackup(text);
      setPreview(validated);
      setRestoreMode('merge');
    } catch (err: any) {
      setPreview({
        valid: false,
        schemaVersionDetected: 0,
        checksumVerified: false,
        exportedAt: null,
        manifest: {
          conversations: 0,
          messages: 0,
          companions: 0,
          privateMemories: 0,
          sharedMemories: 0,
          legacyMemories: 0,
          gifts: 0,
          stickers: 0,
        },
        warnings: [],
        errors: [err?.message || 'Unable to read selected backup file.'],
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRestore = async () => {
    if (!preview || !preview.valid) return;
    const isConfirmedReplace =
      restoreMode === 'replace' && replaceConfirmText.trim().toUpperCase() === 'REPLACE';

    if (restoreMode === 'replace' && !isConfirmedReplace) {
      return;
    }

    setIsRestoring(true);
    setRestoreOutcome(null);
    try {
      const m = await store.restoreBackup(preview, restoreMode, isConfirmedReplace);
      setRestoreOutcome({
        ok: true,
        message:
          restoreMode === 'merge'
            ? `Merged ${m.conversations} conversations, ${m.messages} messages, ${m.privateMemories} companion memories, ${m.sharedMemories} shared memories, and ${m.gifts} gifts.`
            : `Replaced Sanctuary data with ${m.conversations} conversations, ${m.messages} messages, and ${m.privateMemories + m.sharedMemories} memories.`,
      });
      setPreview(null);
      setSelectedFileName(null);
      setReplaceConfirmText('');
    } catch (err: any) {
      setRestoreOutcome({
        ok: false,
        message: err?.message || 'Backup restoration failed.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const statusHeadline = !syncStatus.isOnline
    ? 'Offline — durable local vault active'
    : syncStatus.failedCount > 0
    ? 'Cloud sync paused — local changes preserved'
    : syncStatus.pendingCount > 0
    ? `Syncing ${syncStatus.pendingCount} pending change${syncStatus.pendingCount === 1 ? '' : 's'}`
    : store.user
    ? 'Cloud & local vault synchronized'
    : 'Local IndexedDB vault active (Sign in to sync across devices)';

  return (
    <div className="space-y-6">
      {/* Synchronization & Local Vault Overview */}
      <div className="p-4 rounded-2xl bg-[#1f1947] border-[3px] border-[#2C194D] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {!syncStatus.isOnline ? (
              <CloudOff size={18} className="text-[#F5E1C8] shrink-0" />
            ) : syncStatus.failedCount > 0 ? (
              <AlertTriangle size={18} className="text-[#F198B7] shrink-0" />
            ) : (
              <ShieldCheck size={18} className="text-[#B39DE5] shrink-0" />
            )}
            <span className="text-sm font-extrabold text-[#F5E1C8]">{statusHeadline}</span>
          </div>

          {(syncStatus.pendingCount > 0 || syncStatus.failedCount > 0) && store.user && (
            <button
              type="button"
              onClick={handleRetrySync}
              disabled={isRetrying || !syncStatus.isOnline}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#B39DE5] hover:bg-[#F198B7] disabled:opacity-50 border-[2.5px] border-[#2C194D] text-[#2C194D] font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={isRetrying ? 'animate-spin' : ''} />
              <span>Retry Sync</span>
            </button>
          )}
        </div>

        <p className="text-xs font-bold text-[#B39DE5] tabular-nums leading-relaxed">
          {store.conversations.length} conversations · {totalMessages} messages ·{' '}
          {privateMemoriesCount} private companion memories · {sharedMemoriesCount} shared memories ·{' '}
          {store.gifts.length} gifts
          {totalSummaries > 0 ? ` · ${totalSummaries} rolling chapters` : ''}
          {mediaAssetsCount > 0 ? ` · ${mediaAssetsCount} deduplicated media assets` : ''}
          {syncStatus.pendingCount > 0 ? ` · ${syncStatus.pendingCount} queued in journal` : ''}
        </p>

        {syncStatus.lastError && (
          <p className="text-xs font-bold text-[#F198B7] break-words">
            Last sync notice: {syncStatus.lastError}
          </p>
        )}

        {quarantinedMutations.length > 0 && (
          <div className="pt-2 border-t border-[#2C194D] space-y-2">
            <p className="text-xs font-extrabold text-[#F198B7]">
              Quarantined Mutations ({quarantinedMutations.length} isolated so other lanes continue syncing):
            </p>
            {quarantinedMutations.map((m) => (
              <div
                key={m.mutationId}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#151234] border border-[#2C194D] text-xs"
              >
                <div className="min-w-0">
                  <p className="font-extrabold text-[#F5E1C8] truncate">
                    {m.entityType} · {m.operation} ({m.entityId})
                  </p>
                  {m.lastError && (
                    <p className="text-[11px] font-semibold text-[#F198B7] truncate">
                      {m.lastError}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDiscardQuarantined(m.mutationId)}
                  className="px-2.5 py-1 rounded-lg bg-[#2a1538] hover:bg-[#F198B7] hover:text-[#2C194D] text-[#F198B7] border border-[#F198B7]/40 font-extrabold text-[11px] flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>Discard</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete Sanctuary Export */}
      <div className="space-y-2.5">
        <div>
          <h3 className="text-sm font-extrabold text-[#F5E1C8]">Export Sanctuary Archive</h3>
          <p className="text-xs font-semibold text-[#B39DE5] mt-0.5">
            Downloads a versioned JSON archive with integrity checksum containing all conversations,
            full message history, rolling continuity chapters, companion quarters, private memories,
            shared memories, deduplicated media references, gifts, and settings.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="min-h-[44px] px-4 py-2.5 bg-[#F198B7] hover:bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] font-extrabold text-sm shadow-[3px_3px_0_#2C194D] active:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Download size={16} strokeWidth={2.5} />
          <span>Export Backup</span>
        </button>

        {exportSummary && (
          <p className="text-xs font-bold text-[#F5E1C8] flex items-center gap-1.5 tabular-nums">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span>{exportSummary}</span>
          </p>
        )}
      </div>

      {/* Validated Restoration */}
      <div className="pt-4 border-t-[2px] border-[#2C194D] space-y-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#F5E1C8]">Restore from Backup</h3>
          <p className="text-xs font-semibold text-[#B39DE5] mt-0.5">
            Validates backup schema and checksum before any changes are applied. Merges safely with
            existing data by default.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[44px] px-4 py-2.5 bg-[#F5E1C8] hover:bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] font-extrabold text-sm shadow-[3px_3px_0_#2C194D] active:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Upload size={16} strokeWidth={2.5} />
          <span>Select Backup File</span>
        </button>

        {preview && !preview.valid && (
          <div className="p-4 rounded-2xl bg-[#2a1538] border-[2.5px] border-[#F198B7] space-y-1.5">
            <p className="text-xs font-extrabold text-[#F198B7] flex items-center gap-1.5">
              <AlertTriangle size={14} />
              <span>Backup Validation Failed{selectedFileName ? ` (${selectedFileName})` : ''}</span>
            </p>
            {preview.errors.map((err, i) => (
              <p key={i} className="text-xs font-semibold text-[#F5E1C8]">
                {err}
              </p>
            ))}
          </div>
        )}

        {preview && preview.valid && (
          <div className="p-4 rounded-2xl bg-[#F5E1C8] border-[3px] border-[#2C194D] text-[#2C194D] space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#2C194D]/70">
                Validated Archive{selectedFileName ? ` · ${selectedFileName}` : ''}
              </p>
              <p className="text-sm font-extrabold tabular-nums">
                Schema v{preview.schemaVersionDetected} ·{' '}
                {preview.checksumVerified ? 'Checksum verified' : 'Validated'}
              </p>
              <p className="text-xs font-bold text-[#2C194D]/80 tabular-nums">
                {preview.manifest.conversations} conversations · {preview.manifest.messages} messages
                · {preview.manifest.companions} companions · {preview.manifest.privateMemories}{' '}
                private memories · {preview.manifest.sharedMemories} shared memories ·{' '}
                {preview.manifest.gifts} gifts
              </p>
            </div>

            {preview.warnings.length > 0 && (
              <div className="text-xs font-bold text-[#2C194D]/75 space-y-0.5">
                {preview.warnings.map((w, idx) => (
                  <p key={idx}>Note: {w}</p>
                ))}
              </div>
            )}

            {/* Restoration Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRestoreMode('merge');
                  setReplaceConfirmText('');
                }}
                className={`p-3 rounded-xl border-[2.5px] border-[#2C194D] text-left transition-all cursor-pointer ${
                  restoreMode === 'merge'
                    ? 'bg-[#B39DE5] shadow-[2px_2px_0_#2C194D]'
                    : 'bg-white/60 hover:bg-white'
                }`}
              >
                <p className="text-xs font-extrabold">Merge with Current Sanctuary (Recommended)</p>
                <p className="text-[11px] font-semibold text-[#2C194D]/75 mt-0.5">
                  Preserves all current conversations and memories while adding backup items.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRestoreMode('replace')}
                className={`p-3 rounded-xl border-[2.5px] border-[#2C194D] text-left transition-all cursor-pointer ${
                  restoreMode === 'replace'
                    ? 'bg-[#F198B7] shadow-[2px_2px_0_#2C194D]'
                    : 'bg-white/60 hover:bg-white'
                }`}
              >
                <p className="text-xs font-extrabold">Replace Current Sanctuary</p>
                <p className="text-[11px] font-semibold text-[#2C194D]/75 mt-0.5">
                  Deletes records not in this backup and restores exact archive state.
                </p>
              </button>
            </div>

            {restoreMode === 'replace' && (
              <div className="p-3 rounded-xl bg-[#151234] text-[#F5E1C8] border-[2px] border-[#2C194D] space-y-2">
                <p className="text-xs font-bold text-[#F198B7]">
                  Type REPLACE below to confirm overwriting current Sanctuary conversations,
                  memories, and gifts.
                </p>
                <input
                  type="text"
                  value={replaceConfirmText}
                  onChange={(e) => setReplaceConfirmText(e.target.value)}
                  placeholder="Type REPLACE to confirm"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F5E1C8] text-[#2C194D] font-extrabold text-xs border-[2px] border-[#2C194D] focus:outline-none"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRestore}
                disabled={
                  isRestoring ||
                  (restoreMode === 'replace' &&
                    replaceConfirmText.trim().toUpperCase() !== 'REPLACE')
                }
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#151234] text-[#F5E1C8] hover:bg-[#2C194D] disabled:opacity-40 border-[2.5px] border-[#2C194D] font-extrabold text-xs transition-colors cursor-pointer"
              >
                {isRestoring
                  ? 'Restoring...'
                  : restoreMode === 'merge'
                  ? 'Restore & Merge'
                  : 'Confirm Full Replace'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setSelectedFileName(null);
                  setReplaceConfirmText('');
                }}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-transparent hover:bg-[#2C194D]/10 text-[#2C194D] font-extrabold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {restoreOutcome && (
          <div
            className={`p-3.5 rounded-2xl border-[2.5px] border-[#2C194D] text-xs font-bold ${
              restoreOutcome.ok
                ? 'bg-[#B39DE5] text-[#2C194D]'
                : 'bg-[#2a1538] text-[#F198B7] border-[#F198B7]'
            }`}
          >
            {restoreOutcome.message}
          </div>
        )}
      </div>
    </div>
  );
}
