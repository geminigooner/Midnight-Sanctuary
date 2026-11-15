import { v4 as uuidv4 } from 'uuid';
import { getModelEntity, ModelEntity } from '../entitySystem';
import { canonicalCompanionId, combineIsolatedMemories, toScopedMemory } from '../memorySystem';
import { normalizeModelId } from '../modelSystem';
import { ensureValidDocId, normalizeMessageSchema } from '../persistenceSystem';
import {
  AppSettings,
  Conversation,
  DEFAULT_JEWEL_METRICS,
  DEFAULT_SETTINGS,
  Gift,
  JewelMetrics,
  Memory,
  Message,
  UserProfile,
} from '../types';
import { IndexedDBVault } from './indexedDbVault';
import {
  CloudPersistenceAdapter,
  CloudRemoteSnapshot,
  DurableCompanion,
  DurableConversationMeta,
  DurableGift,
  DurableMessage,
  MutationEntityType,
  MutationOperation,
  MutationRecord,
  ScopedMemory,
  SyncPhase,
  SyncStatusSnapshot,
  UserScopedStateRecord,
} from './types';

const UNAUTH_LOCAL_UID = '__local_unauthenticated__';
const MAX_TOMBSTONES = 100;
const DEFAULT_BASE_DELAY_MS = 400;
const DEFAULT_MAX_DELAY_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 8;

export interface CoordinatorDomainState {
  uid: string | null;
  conversations: Conversation[];
  activeConversationId: string | null;
  settings: AppSettings;
  jewelMetrics: JewelMetrics;
  gifts: Gift[];
  userProfile: UserProfile | null;
  companions: Record<string, ModelEntity>;
  companionMemories: Record<string, ScopedMemory[]>;
  sharedMemories: ScopedMemory[];
}

export interface PersistenceCoordinatorOptions {
  vault?: IndexedDBVault;
  cloudAdapter?: CloudPersistenceAdapter | null;
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
  channelName?: string | null;
  legacyStorage?: Storage | null;
}

/**
 * Single Authoritative Persistence Coordinator for Midnight Sanctuary.
 *
 * Responsibilities:
 * 1. User-partitioned state ownership (cleanly isolating accounts on auth switch).
 * 2. Durable write-ahead mutation journal in IndexedDB BEFORE network transmission.
 * 3. Monotonic revisioning & idempotent coalescing so delayed writes never overwrite newer mutations.
 * 4. Bounded exponential backoff + jitter retry runner & online/offline lifecycle recovery.
 * 5. Tombstone enforcement (`deletedConversationIds` & `deletedMessageIds`) preventing resurrection.
 * 6. Sovereign separation of private companion memories (`companions/{id}/memories`) vs shared memories.
 */
export class PersistenceCoordinator {
  private readonly vault: IndexedDBVault;
  private readonly cloudAdapter: CloudPersistenceAdapter | null;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly maxAttempts: number;
  private readonly legacyStorage: Storage | null;
  private broadcastChannel: BroadcastChannel | null = null;
  private readonly instanceId = uuidv4();

  private activeUid: string | null = null;
  private activeEmail: string | null = null;
  private cloudUnsubscribe: (() => void) | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private flushRequestedWhileBusy = false;
  private isDestroyed = false;
  private isOnline =
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;

  private monotonicClock = 0;
  private sequenceCounter = 0;

  // Authoritative per-UID in-memory projections
  private userState: UserScopedStateRecord = this.createEmptyUserState(UNAUTH_LOCAL_UID);
  private conversationsMap = new Map<string, DurableConversationMeta>();
  private messagesMap = new Map<string, Map<string, DurableMessage>>();
  private companionsMap = new Map<string, DurableCompanion>();
  private companionMemoriesMap = new Map<string, Map<string, ScopedMemory>>();
  private sharedMemoriesMap = new Map<string, ScopedMemory>();
  private giftsMap = new Map<string, DurableGift>();
  private journalMap = new Map<string, MutationRecord>();

  private isHydrated = false;
  private isCloudHydrated = false;
  private lastSyncedAt: number | null = null;
  private lastError: string | null = null;

  private stateListeners = new Set<(state: CoordinatorDomainState) => void>();
  private syncListeners = new Set<(status: SyncStatusSnapshot) => void>();

  private onlineHandler = () => this.setOnlineStatus(true);
  private offlineHandler = () => this.setOnlineStatus(false);

  constructor(options?: PersistenceCoordinatorOptions) {
    this.vault = options?.vault || new IndexedDBVault();
    this.cloudAdapter = options?.cloudAdapter ?? null;
    this.baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.legacyStorage =
      options?.legacyStorage !== undefined
        ? options.legacyStorage
        : typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : null;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }

    const channelName =
      options?.channelName === undefined ? 'midnight_sanctuary_sync_v1' : options.channelName;
    if (channelName && typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(channelName);
        this.broadcastChannel.onmessage = (ev) => {
          const msg = ev.data;
          if (
            msg &&
            msg.senderId !== this.instanceId &&
            msg.uid &&
            msg.uid === this.effectiveUid()
          ) {
            void this.reloadFromVaultFromPeerTab(msg.uid);
          }
        };
      } catch {
        this.broadcastChannel = null;
      }
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.activeUid = null;
    this.activeEmail = null;
    this.detachCloud();
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.stateListeners.clear();
    this.syncListeners.clear();
    void this.vault.close();
  }

  private createEmptyUserState(uid: string): UserScopedStateRecord {
    return {
      uid,
      settings: { ...DEFAULT_SETTINGS, memories: [], eventLog: [], customEntities: {} },
      jewelMetrics: { ...DEFAULT_JEWEL_METRICS },
      userProfile: null,
      activeConversationId: null,
      deletedConversationIds: [],
      settingsRevision: 0,
      jewelRevision: 0,
      profileRevision: 0,
      legacyLocalImported: false,
      memoriesMigratedV2: false,
      updatedAt: 0,
    };
  }

  private effectiveUid(): string {
    return this.activeUid || UNAUTH_LOCAL_UID;
  }

  private nextRevision(): number {
    const now = Date.now();
    this.monotonicClock = Math.max(now, this.monotonicClock + 1);
    return this.monotonicClock;
  }

  private nextSequence(): number {
    this.sequenceCounter += 1;
    return this.sequenceCounter;
  }

  // ---------------------------------------------------------------------------
  // Subscriptions for React Store & Sync Status Badge
  // ---------------------------------------------------------------------------

  public subscribeState(listener: (state: CoordinatorDomainState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.getDomainState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public subscribeSyncStatus(listener: (status: SyncStatusSnapshot) => void): () => void {
    this.syncListeners.add(listener);
    listener(this.getSyncStatus());
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  public getDomainState(): CoordinatorDomainState {
    const deletedConvSet = new Set(this.userState.deletedConversationIds || []);
    const conversations: Conversation[] = [];

    for (const meta of this.conversationsMap.values()) {
      if (meta.isDeleted || deletedConvSet.has(meta.id)) continue;
      const deletedMsgSet = new Set(meta.deletedMessageIds || []);
      const convMsgsMap = this.messagesMap.get(meta.id);
      const msgs: Message[] = [];
      if (convMsgsMap) {
        for (const dm of convMsgsMap.values()) {
          if (dm.isDeleted || deletedMsgSet.has(dm.id)) continue;
          const { isDeleted: _d, revision: _r, ...cleanMsg } = dm;
          msgs.push(cleanMsg);
        }
      }
      msgs.sort(sortMessagesDeterministic);
      conversations.push({
        id: meta.id,
        title: meta.title,
        modelId: meta.modelId,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        type: meta.type,
        participantEntityIds: meta.participantEntityIds,
        messages: msgs,
      });
    }

    conversations.sort((a, b) => {
      const diff = (b.updatedAt || 0) - (a.updatedAt || 0);
      if (diff !== 0) return diff;
      return (a.id || '').localeCompare(b.id || '');
    });

    const companions: Record<string, ModelEntity> = {};
    for (const [id, comp] of this.companionsMap.entries()) {
      companions[id] = comp;
    }

    const companionMemories: Record<string, ScopedMemory[]> = {};
    for (const [entityId, memMap] of this.companionMemoriesMap.entries()) {
      const list = Array.from(memMap.values())
        .filter((m) => !m.isDeleted)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (list.length > 0) {
        companionMemories[entityId] = list;
      }
    }

    const sharedMemories = Array.from(this.sharedMemoriesMap.values())
      .filter((m) => !m.isDeleted)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const combinedMemoriesView = combineIsolatedMemories(sharedMemories, companionMemories);

    const gifts: Gift[] = Array.from(this.giftsMap.values())
      .filter((g) => !g.isDeleted)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const mergedCustomEntities: Record<string, any> = {
      ...(this.userState.settings.customEntities || {}),
      ...companions,
    };

    return {
      uid: this.activeUid,
      conversations,
      activeConversationId: this.userState.activeConversationId,
      settings: {
        ...DEFAULT_SETTINGS,
        ...this.userState.settings,
        memories: combinedMemoriesView,
        customEntities: mergedCustomEntities,
      },
      jewelMetrics: {
        ...DEFAULT_JEWEL_METRICS,
        ...this.userState.jewelMetrics,
      },
      gifts,
      userProfile: this.userState.userProfile,
      companions,
      companionMemories,
      sharedMemories,
    };
  }

  public getSyncStatus(): SyncStatusSnapshot {
    let pendingCount = 0;
    let failedCount = 0;
    for (const m of this.journalMap.values()) {
      if (m.status === 'committed') continue;
      pendingCount++;
      if (m.status === 'failed') failedCount++;
    }

    let phase: SyncPhase = 'idle';
    if (!this.activeUid) {
      phase = this.isOnline ? 'idle' : 'offline';
    } else if (!this.isHydrated) {
      phase = 'hydrating';
    } else if (!this.isOnline) {
      phase = 'offline';
    } else if (failedCount > 0) {
      phase = 'error';
    } else if (pendingCount > 0 || this.isFlushing) {
      phase = 'syncing';
    } else {
      phase = 'synced';
    }

    return {
      uid: this.activeUid,
      phase,
      isOnline: this.isOnline,
      isHydrated: this.isHydrated,
      isCloudHydrated: this.isCloudHydrated,
      pendingCount,
      failedCount,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
    };
  }

  private emitAll(): void {
    const domain = this.getDomainState();
    for (const l of this.stateListeners) l(domain);
    this.emitSyncStatus();
  }

  private emitSyncStatus(): void {
    const status = this.getSyncStatus();
    for (const l of this.syncListeners) l(status);
  }

  private notifyPeerTabs(): void {
    if (!this.broadcastChannel) return;
    try {
      this.broadcastChannel.postMessage({
        senderId: this.instanceId,
        uid: this.effectiveUid(),
        timestamp: Date.now(),
      });
    } catch {
      // Ignore broadcast errors
    }
  }

  // ---------------------------------------------------------------------------
  // Authentication & Hydration Lifecycle
  // ---------------------------------------------------------------------------

  private resetInMemoryProjection(uid: string): void {
    this.userState = this.createEmptyUserState(uid);
    this.conversationsMap.clear();
    this.messagesMap.clear();
    this.companionsMap.clear();
    this.companionMemoriesMap.clear();
    this.sharedMemoriesMap.clear();
    this.giftsMap.clear();
    this.journalMap.clear();
    this.isHydrated = false;
    this.isCloudHydrated = false;
    this.lastError = null;
  }

  private detachCloud(): void {
    if (this.cloudUnsubscribe) {
      this.cloudUnsubscribe();
      this.cloudUnsubscribe = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  public async attachUser(uid: string | null, email?: string | null): Promise<void> {
    if (uid === this.activeUid && this.isHydrated) {
      return;
    }

    this.detachCloud();
    this.activeUid = uid;
    this.activeEmail = email || null;
    const targetUid = this.effectiveUid();

    // Immediately clear previous user's in-memory projection to guarantee zero cross-user bleed
    this.resetInMemoryProjection(targetUid);
    this.emitAll();

    const loaded = await this.vault.loadUserVault(targetUid);

    // Guard against auth changing again while IndexedDB was reading
    if (this.effectiveUid() !== targetUid) return;

    if (loaded.userState) {
      this.userState = {
        ...this.createEmptyUserState(targetUid),
        ...loaded.userState,
        uid: targetUid,
      };
      this.monotonicClock = Math.max(this.monotonicClock, loaded.userState.updatedAt || 0);
    }

    const deletedConvSet = new Set(this.userState.deletedConversationIds || []);

    for (const conv of loaded.conversations) {
      if (conv.isDeleted || deletedConvSet.has(conv.id)) continue;
      this.conversationsMap.set(conv.id, conv);
      this.monotonicClock = Math.max(this.monotonicClock, conv.revision || conv.updatedAt || 0);
    }

    const interruptedStreamingMsgs: { convId: string; msg: DurableMessage }[] = [];

    for (const [convId, msgs] of Object.entries(loaded.messagesByConversation)) {
      if (deletedConvSet.has(convId)) continue;
      const convMeta = this.conversationsMap.get(convId);
      const deletedMsgSet = new Set(convMeta?.deletedMessageIds || []);
      const map = new Map<string, DurableMessage>();
      for (const m of msgs) {
        if (m.isDeleted || deletedMsgSet.has(m.id)) continue;
        if (m.thoughtStatus === 'thinking') {
          const recoveredStreamMsg: DurableMessage = {
            ...m,
            thoughtStatus: 'complete',
            revision: Math.max(m.revision || 0, Date.now()),
          };
          map.set(m.id, recoveredStreamMsg);
          interruptedStreamingMsgs.push({ convId, msg: recoveredStreamMsg });
          this.monotonicClock = Math.max(this.monotonicClock, recoveredStreamMsg.revision);
        } else {
          map.set(m.id, m);
          this.monotonicClock = Math.max(this.monotonicClock, m.revision || m.timestamp || 0);
        }
      }
      this.messagesMap.set(convId, map);
    }

    for (const [compId, comp] of Object.entries(loaded.companions)) {
      this.companionsMap.set(compId, comp);
      this.monotonicClock = Math.max(this.monotonicClock, comp.revision || comp.updatedAt || 0);
    }

    for (const [compId, mems] of Object.entries(loaded.companionMemories)) {
      const map = new Map<string, ScopedMemory>();
      for (const m of mems) {
        if (!m.isDeleted) map.set(m.id, m);
      }
      this.companionMemoriesMap.set(compId, map);
    }

    for (const sm of loaded.sharedMemories) {
      if (!sm.isDeleted) this.sharedMemoriesMap.set(sm.id, sm);
    }

    for (const g of loaded.gifts) {
      if (!g.isDeleted) this.giftsMap.set(g.id, g);
    }

    // Recover any interrupted `in_flight` journal items back to `pending` on cold start
    for (const m of loaded.pendingMutations) {
      this.sequenceCounter = Math.max(this.sequenceCounter, m.sequence);
      this.monotonicClock = Math.max(this.monotonicClock, m.revision);
      const recovered: MutationRecord =
        m.status === 'in_flight' ? { ...m, status: 'pending', nextRetryAt: 0 } : m;
      this.journalMap.set(recovered.mutationId, recovered);
      if (m.status === 'in_flight') {
        await this.vault.putJournalMutation(recovered);
      }
    }

    // Enqueue any interrupted mid-stream model turns so they durably commit to Firestore
    for (const { convId, msg } of interruptedStreamingMsgs) {
      const convMeta = this.conversationsMap.get(convId);
      await this.enqueueMutation(
        {
          entityType: 'message',
          entityId: msg.id,
          parentId: convId,
          operation: 'upsert',
          payload: msg,
          revision: msg.revision,
        },
        {
          conversation: convMeta,
          messages: [msg],
        }
      );
    }

    // One-time safe import from legacy localStorage ONLY when vault is brand-new for the owner
    if (
      uid &&
      !this.userState.legacyLocalImported &&
      this.conversationsMap.size === 0 &&
      this.legacyStorage &&
      (!email || email === 'ahatley094@gmail.com')
    ) {
      await this.importLegacyLocalStorageOnce(uid);
    }

    // Migrate any legacy settings.memories stored locally into isolated memory stores
    if (
      Array.isArray(this.userState.settings.memories) &&
      this.userState.settings.memories.length > 0 &&
      !this.userState.memoriesMigratedV2
    ) {
      await this.migrateFlatMemoriesArray(this.userState.settings.memories);
    }

    this.isHydrated = true;
    this.emitAll();

    // Attach Firestore real-time synchronization & flush journal if authenticated
    if (uid && this.cloudAdapter) {
      this.cloudUnsubscribe = this.cloudAdapter.subscribeUser(
        uid,
        email,
        (remote) => {
          void this.reconcileCloudSnapshot(uid, remote);
        },
        (err) => {
          this.lastError = err.message || String(err);
          this.emitSyncStatus();
        }
      );
      void this.flushJournal();
    }
  }

  private async importLegacyLocalStorageOnce(uid: string): Promise<void> {
    if (!this.legacyStorage) return;
    try {
      const rawConvs = this.legacyStorage.getItem('sanctuary_conversations_cache');
      const rawProfile = this.legacyStorage.getItem('sanctuary_user_profile');
      const rawActiveId = this.legacyStorage.getItem('sanctuary_current_conv_id');

      if (rawActiveId && !this.userState.activeConversationId) {
        this.userState.activeConversationId = rawActiveId;
      }

      if (rawProfile && !this.userState.userProfile) {
        try {
          const parsedProfile = JSON.parse(rawProfile);
          if (parsedProfile && (!parsedProfile.id || parsedProfile.id === uid || parsedProfile.id === 'default-profile')) {
            this.userState.userProfile = { ...parsedProfile, id: uid };
          }
        } catch {}
      }

      if (rawConvs) {
        const parsed = JSON.parse(rawConvs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const convsToSave: DurableConversationMeta[] = [];
          const msgsToSave: DurableMessage[] = [];
          for (const rawC of parsed) {
            if (!rawC || !rawC.id) continue;
            const safeConvId = ensureValidDocId(rawC.id, 'conv');
            const updatedAt = rawC.updatedAt || rawC.createdAt || Date.now();
            const meta: DurableConversationMeta = {
              id: safeConvId,
              title: rawC.title || 'Untitled Sanctuary',
              modelId: rawC.modelId || 'models/gemini-3.1-pro-preview',
              createdAt: rawC.createdAt || updatedAt,
              updatedAt,
              revision: updatedAt,
              type: rawC.type || 'direct',
              participantEntityIds: rawC.participantEntityIds,
              deletedMessageIds: [],
            };
            this.conversationsMap.set(safeConvId, meta);
            convsToSave.push(meta);

            if (Array.isArray(rawC.messages)) {
              const mMap = new Map<string, DurableMessage>();
              rawC.messages.forEach((m: any, idx: number) => {
                const norm = normalizeMessageSchema(m, safeConvId, idx, updatedAt);
                const dm: DurableMessage = {
                  ...norm,
                  conversationId: safeConvId,
                  revision: norm.timestamp || updatedAt,
                };
                mMap.set(dm.id, dm);
                msgsToSave.push(dm);
              });
              this.messagesMap.set(safeConvId, mMap);
            }
          }
          await this.vault.saveConversationsAndMessages(uid, convsToSave, msgsToSave);
        }
      }

      this.userState.legacyLocalImported = true;
      await this.vault.saveUserState(this.userState);

      // Remove legacy un-partitioned localStorage keys so they cannot bleed across accounts later
      this.legacyStorage.removeItem('sanctuary_conversations_cache');
      this.legacyStorage.removeItem('sanctuary_user_profile');
    } catch (err) {
      console.warn('[PersistenceCoordinator] Legacy localStorage import skipped:', err);
    }
  }

  private async reloadFromVaultFromPeerTab(uid: string): Promise<void> {
    if (this.effectiveUid() !== uid) return;
    const loaded = await this.vault.loadUserVault(uid);
    if (this.effectiveUid() !== uid) return;

    if (loaded.userState && loaded.userState.updatedAt >= this.userState.updatedAt) {
      this.userState = loaded.userState;
    }

    const deletedConvSet = new Set(this.userState.deletedConversationIds || []);
    for (const conv of loaded.conversations) {
      if (deletedConvSet.has(conv.id) || conv.isDeleted) {
        this.conversationsMap.delete(conv.id);
        this.messagesMap.delete(conv.id);
        continue;
      }
      const cur = this.conversationsMap.get(conv.id);
      if (!cur || conv.revision >= cur.revision) {
        this.conversationsMap.set(conv.id, conv);
      }
    }
    for (const delId of deletedConvSet) {
      this.conversationsMap.delete(delId);
      this.messagesMap.delete(delId);
    }

    for (const [convId, msgs] of Object.entries(loaded.messagesByConversation)) {
      if (deletedConvSet.has(convId)) continue;
      const convMeta = this.conversationsMap.get(convId);
      const deletedMsgSet = new Set(convMeta?.deletedMessageIds || []);
      const curMap = this.messagesMap.get(convId) || new Map<string, DurableMessage>();
      for (const m of msgs) {
        if (deletedMsgSet.has(m.id) || m.isDeleted) {
          curMap.delete(m.id);
          continue;
        }
        const curMsg = curMap.get(m.id);
        if (!curMsg || m.revision >= curMsg.revision) {
          curMap.set(m.id, m);
        }
      }
      for (const delMsgId of deletedMsgSet) {
        curMap.delete(delMsgId);
      }
      this.messagesMap.set(convId, curMap);
    }

    for (const [compId, comp] of Object.entries(loaded.companions)) {
      const cur = this.companionsMap.get(compId);
      if (!cur || comp.revision >= cur.revision) {
        this.companionsMap.set(compId, comp);
      }
    }

    for (const [compId, mems] of Object.entries(loaded.companionMemories)) {
      const curMap = this.companionMemoriesMap.get(compId) || new Map<string, ScopedMemory>();
      for (const m of mems) {
        if (m.isDeleted) curMap.delete(m.id);
        else curMap.set(m.id, m);
      }
      this.companionMemoriesMap.set(compId, curMap);
    }

    for (const sm of loaded.sharedMemories) {
      if (sm.isDeleted) this.sharedMemoriesMap.delete(sm.id);
      else this.sharedMemoriesMap.set(sm.id, sm);
    }

    for (const g of loaded.gifts) {
      if (g.isDeleted) this.giftsMap.delete(g.id);
      else this.giftsMap.set(g.id, g);
    }

    this.emitAll();
  }

  // ---------------------------------------------------------------------------
  // Connectivity & Bounded Exponential Backoff Journal Runner
  // ---------------------------------------------------------------------------

  public setOnlineStatus(online: boolean): void {
    const changed = this.isOnline !== online;
    this.isOnline = online;
    if (online && changed) {
      // Reset retry timers on reconnect so queued mutations flush immediately
      for (const m of this.journalMap.values()) {
        if (m.status === 'failed' || m.status === 'pending') {
          m.status = 'pending';
          m.nextRetryAt = 0;
        }
      }
      this.lastError = null;
      void this.flushJournal();
    }
    this.emitSyncStatus();
  }

  public async retryPendingMutations(): Promise<void> {
    for (const m of this.journalMap.values()) {
      if (m.status !== 'committed') {
        m.status = 'pending';
        m.attempts = 0;
        m.nextRetryAt = 0;
        await this.vault.putJournalMutation(m);
      }
    }
    this.lastError = null;
    this.emitSyncStatus();
    await this.flushJournal();
  }

  private hasPendingMutationFor(
    entityType: MutationEntityType,
    entityId?: string,
    parentId?: string
  ): boolean {
    for (const m of this.journalMap.values()) {
      if (m.status === 'committed') continue;
      if (m.entityType !== entityType) continue;
      if (entityId !== undefined && m.entityId !== entityId) continue;
      if (parentId !== undefined && m.parentId !== parentId) continue;
      return true;
    }
    return false;
  }

  private async enqueueMutation(
    params: {
      entityType: MutationEntityType;
      entityId: string;
      parentId?: string;
      operation: MutationOperation;
      payload: any;
      revision: number;
    },
    entityWrites: Parameters<IndexedDBVault['recordMutationAndEntity']>[1]
  ): Promise<MutationRecord> {
    const uid = this.effectiveUid();
    const idempotencyKey = `${params.entityType}:${params.parentId || '-'}:${params.entityId}`;

    // Coalesce any existing un-started `pending` mutation for the exact same entity
    let existingPending: MutationRecord | undefined;
    for (const m of this.journalMap.values()) {
      if (m.idempotencyKey === idempotencyKey && m.status === 'pending') {
        existingPending = m;
        break;
      }
    }

    const mutation: MutationRecord = existingPending
      ? {
          ...existingPending,
          operation: params.operation,
          payload: params.payload,
          revision: params.revision,
          clientTimestamp: Date.now(),
          nextRetryAt: 0,
        }
      : {
          mutationId: uuidv4(),
          idempotencyKey,
          uid,
          sequence: this.nextSequence(),
          entityType: params.entityType,
          entityId: params.entityId,
          parentId: params.parentId,
          operation: params.operation,
          payload: params.payload,
          revision: params.revision,
          clientTimestamp: Date.now(),
          status: 'pending',
          attempts: 0,
          nextRetryAt: 0,
        };

    this.journalMap.set(mutation.mutationId, mutation);

    // Durable write-ahead commit to IndexedDB BEFORE returning or attempting cloud sync
    await this.vault.recordMutationAndEntity(mutation, entityWrites);
    this.notifyPeerTabs();
    this.emitSyncStatus();

    if (this.activeUid && this.cloudAdapter && this.isOnline) {
      void this.flushJournal();
    }

    return mutation;
  }

  public async flushJournal(): Promise<void> {
    if (this.isDestroyed || !this.activeUid || !this.cloudAdapter || !this.isOnline) {
      this.emitSyncStatus();
      return;
    }
    if (this.isFlushing) {
      this.flushRequestedWhileBusy = true;
      return;
    }

    this.isFlushing = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.emitSyncStatus();

    const uidAtStart = this.activeUid;

    try {
      while (!this.isDestroyed && this.activeUid === uidAtStart && this.isOnline) {
        const now = Date.now();
        const ordered = Array.from(this.journalMap.values())
          .filter((m) => m.status === 'pending' && m.nextRetryAt <= now)
          .sort((a, b) => a.sequence - b.sequence);

        if (ordered.length === 0) break;

        for (const m of ordered) {
          if (this.isDestroyed || this.activeUid !== uidAtStart || !this.isOnline) break;
          // Re-fetch latest record in case it was coalesced or cancelled by a deletion tombstone
          const current = this.journalMap.get(m.mutationId);
          if (!current || current.status !== 'pending') continue;

          current.status = 'in_flight';
          await this.vault.putJournalMutation(current);

          try {
            const convId =
              current.entityType === 'conversation'
                ? current.entityId
                : current.entityType === 'message'
                ? current.parentId
                : undefined;

            const convMeta = convId ? this.conversationsMap.get(convId) : undefined;
            const convMessages = convId
              ? Array.from(this.messagesMap.get(convId)?.values() || [])
              : undefined;

            await this.cloudAdapter.executeMutation(uidAtStart, current, {
              conversationMeta: convMeta,
              conversationMessages: convMessages,
            });

            if (this.isDestroyed || this.activeUid !== uidAtStart) break;

            // Check if a newer mutation replaced/updated this entry while it was in flight
            const latestAfterWrite = this.journalMap.get(current.mutationId);
            if (latestAfterWrite && latestAfterWrite.revision > current.revision) {
              latestAfterWrite.status = 'pending';
              latestAfterWrite.nextRetryAt = 0;
              await this.vault.putJournalMutation(latestAfterWrite);
            } else {
              this.journalMap.delete(current.mutationId);
              await this.vault.deleteJournalMutation(uidAtStart, current.mutationId);
              this.lastSyncedAt = Date.now();
              this.lastError = null;
            }
          } catch (err: any) {
            if (this.isDestroyed || this.activeUid !== uidAtStart) break;
            const attempts = current.attempts + 1;
            const errMsg = err instanceof Error ? err.message : String(err);
            this.lastError = errMsg;

            if (attempts >= this.maxAttempts) {
              current.status = 'failed';
              current.attempts = attempts;
              current.lastError = errMsg;
            } else {
              const expDelay = Math.min(
                this.maxDelayMs,
                this.baseDelayMs * Math.pow(2, attempts - 1)
              );
              const jitter = Math.floor(expDelay * 0.15 * Math.random());
              current.status = 'pending';
              current.attempts = attempts;
              current.lastError = errMsg;
              current.nextRetryAt = Date.now() + expDelay + jitter;
            }
            await this.vault.putJournalMutation(current);
            // Stop ordered execution on error so dependent causal writes don't race ahead
            break;
          }
        }

        if (!this.flushRequestedWhileBusy) break;
        this.flushRequestedWhileBusy = false;
      }
    } finally {
      this.isFlushing = false;
      this.scheduleNextRetryIfNeeded();
      this.emitSyncStatus();
    }
  }

  private scheduleNextRetryIfNeeded(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (!this.activeUid || !this.isOnline) return;

    let earliestNextRetry = Infinity;
    for (const m of this.journalMap.values()) {
      if (m.status === 'pending' && m.nextRetryAt > 0 && m.nextRetryAt < earliestNextRetry) {
        earliestNextRetry = m.nextRetryAt;
      }
    }

    if (earliestNextRetry < Infinity) {
      const waitMs = Math.max(25, earliestNextRetry - Date.now());
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.flushJournal();
      }, waitMs);
    }
  }

  // ---------------------------------------------------------------------------
  // Safe Cloud Snapshot Reconciliation
  // ---------------------------------------------------------------------------

  private async reconcileCloudSnapshot(uid: string, remote: CloudRemoteSnapshot): Promise<void> {
    if (this.activeUid !== uid) return;

    let stateChanged = false;
    const deletedConvSet = new Set(this.userState.deletedConversationIds || []);

    // 1. Settings, Jewel, Profile & Legacy Memory Migration
    if (remote.settings && !this.hasPendingMutationFor('settings')) {
      const remoteRev = remote.settingsRevision || 0;
      if (remoteRev >= this.userState.settingsRevision || this.userState.settingsRevision === 0) {
        const incomingLegacyMems = Array.isArray(remote.settings.memories)
          ? remote.settings.memories
          : [];
        const { memories: _stripFlat, ...cleanSettings } = remote.settings;

        this.userState = {
          ...this.userState,
          settings: {
            ...DEFAULT_SETTINGS,
            ...this.userState.settings,
            ...cleanSettings,
            memories: [],
          },
          settingsRevision: Math.max(this.userState.settingsRevision, remoteRev),
          memoriesMigratedV2: Boolean(this.userState.memoriesMigratedV2 || remote.memoriesMigratedV2),
          updatedAt: Math.max(this.userState.updatedAt, remoteRev),
        };
        await this.vault.saveUserState(this.userState);
        stateChanged = true;

        if (incomingLegacyMems.length > 0 && !this.userState.memoriesMigratedV2) {
          await this.migrateFlatMemoriesArray(incomingLegacyMems);
        }
      }
    }

    if (remote.jewelMetrics && !this.hasPendingMutationFor('jewel')) {
      const remoteRev = remote.jewelRevision || 0;
      if (remoteRev >= this.userState.jewelRevision || this.userState.jewelRevision === 0) {
        this.userState = {
          ...this.userState,
          jewelMetrics: { ...DEFAULT_JEWEL_METRICS, ...remote.jewelMetrics },
          jewelRevision: Math.max(this.userState.jewelRevision, remoteRev),
        };
        await this.vault.saveUserState(this.userState);
        stateChanged = true;
      }
    }

    if (remote.userProfile !== undefined && !this.hasPendingMutationFor('profile')) {
      const remoteRev = remote.profileRevision || 0;
      if (
        remote.userProfile &&
        (remoteRev >= this.userState.profileRevision || !this.userState.userProfile)
      ) {
        this.userState = {
          ...this.userState,
          userProfile: remote.userProfile,
          profileRevision: Math.max(this.userState.profileRevision, remoteRev),
        };
        await this.vault.saveUserState(this.userState);
        stateChanged = true;
      }
    }

    // 2. Conversations Metadata + Preview Messages (Never wipe populated local state with an empty initial snapshot)
    if (remote.conversations !== undefined) {
      this.isCloudHydrated = true;
      const remoteConvIds = new Set<string>();
      const convsToSave: DurableConversationMeta[] = [];
      const msgsToSave: DurableMessage[] = [];

      for (const { meta: rMeta, previewMessages } of remote.conversations) {
        if (deletedConvSet.has(rMeta.id)) continue;
        remoteConvIds.add(rMeta.id);

        const localMeta = this.conversationsMap.get(rMeta.id);
        const hasPendingConvWrite = this.hasPendingMutationFor('conversation', rMeta.id);

        const mergedDeletedMsgIds = Array.from(
          new Set([
            ...(localMeta?.deletedMessageIds || []),
            ...(rMeta.deletedMessageIds || []),
          ])
        ).slice(-MAX_TOMBSTONES);
        const deletedMsgSet = new Set(mergedDeletedMsgIds);

        let nextMeta: DurableConversationMeta;
        if (!localMeta) {
          nextMeta = { ...rMeta, deletedMessageIds: mergedDeletedMsgIds };
          this.conversationsMap.set(rMeta.id, nextMeta);
          convsToSave.push(nextMeta);
          stateChanged = true;
        } else if (!hasPendingConvWrite && rMeta.revision >= localMeta.revision) {
          nextMeta = {
            ...localMeta,
            ...rMeta,
            deletedMessageIds: mergedDeletedMsgIds,
            revision: Math.max(localMeta.revision, rMeta.revision),
          };
          this.conversationsMap.set(rMeta.id, nextMeta);
          convsToSave.push(nextMeta);
          stateChanged = true;
        } else {
          nextMeta = { ...localMeta, deletedMessageIds: mergedDeletedMsgIds };
          this.conversationsMap.set(rMeta.id, nextMeta);
        }

        // Seed preview messages only when subcollection hasn't populated this message ID yet
        const convMsgs = this.messagesMap.get(rMeta.id) || new Map<string, DurableMessage>();
        for (const pm of previewMessages) {
          if (deletedMsgSet.has(pm.id)) {
            if (convMsgs.delete(pm.id)) stateChanged = true;
            continue;
          }
          if (!convMsgs.has(pm.id) && !this.hasPendingMutationFor('message', pm.id, rMeta.id)) {
            const dm: DurableMessage = {
              ...pm,
              conversationId: rMeta.id,
              revision: pm.timestamp || nextMeta.revision,
            };
            convMsgs.set(pm.id, dm);
            msgsToSave.push(dm);
            stateChanged = true;
          }
        }
        // Purge any local message that appears in remote tombstones
        for (const delMsgId of deletedMsgSet) {
          if (convMsgs.has(delMsgId)) {
            convMsgs.delete(delMsgId);
            msgsToSave.push({
              id: delMsgId,
              conversationId: rMeta.id,
              role: 'user',
              parts: [{ text: '' }],
              timestamp: 0,
              revision: nextMeta.revision,
              isDeleted: true,
            });
            stateChanged = true;
          }
        }
        this.messagesMap.set(rMeta.id, convMsgs);
      }

      // If local vault has conversations that are NOT in remote AND not deleted, backfill them to cloud
      // (instead of wiping local conversations when initial cloud snapshot is empty!)
      for (const [localId, localConv] of this.conversationsMap.entries()) {
        if (!remoteConvIds.has(localId) && !deletedConvSet.has(localId) && !localConv.isDeleted) {
          if (!this.hasPendingMutationFor('conversation', localId)) {
            await this.enqueueMutation(
              {
                entityType: 'conversation',
                entityId: localId,
                operation: 'upsert',
                payload: localConv,
                revision: localConv.revision || this.nextRevision(),
              },
              {}
            );
            const localMsgs = this.messagesMap.get(localId);
            if (localMsgs) {
              for (const lm of localMsgs.values()) {
                if (!lm.isDeleted && !this.hasPendingMutationFor('message', lm.id, localId)) {
                  await this.enqueueMutation(
                    {
                      entityType: 'message',
                      entityId: lm.id,
                      parentId: localId,
                      operation: 'upsert',
                      payload: lm,
                      revision: lm.revision || this.nextRevision(),
                    },
                    {}
                  );
                }
              }
            }
          }
        }
      }

      if (convsToSave.length > 0 || msgsToSave.length > 0) {
        await this.vault.saveConversationsAndMessages(uid, convsToSave, msgsToSave);
      }
    }

    // 3. Authoritative Message Subcollection Updates
    if (remote.conversationMessages) {
      const { conversationId, messages } = remote.conversationMessages;
      if (!deletedConvSet.has(conversationId)) {
        const convMeta = this.conversationsMap.get(conversationId);
        const deletedMsgSet = new Set(convMeta?.deletedMessageIds || []);
        const convMsgs = this.messagesMap.get(conversationId) || new Map<string, DurableMessage>();
        const msgsToPersist: DurableMessage[] = [];

        for (const rm of messages) {
          if (rm.isDeleted || deletedMsgSet.has(rm.id)) continue;
          if (this.hasPendingMutationFor('message', rm.id, conversationId)) continue;

          const existing = convMsgs.get(rm.id);
          if (!existing) {
            convMsgs.set(rm.id, rm);
            msgsToPersist.push(rm);
            stateChanged = true;
          } else {
            // Subcollection carries full untruncated attachments/generatedImages; merge safely
            const existingHasInline = (existing.parts || []).some((p) => p?.inlineData);
            const remoteHasInline = (rm.parts || []).some((p) => p?.inlineData);
            const shouldAcceptRemote =
              rm.revision > existing.revision ||
              (rm.revision === existing.revision && remoteHasInline && !existingHasInline) ||
              (existing.thoughtStatus !== 'thinking' &&
                (rm.publicText?.length || 0) >= (existing.publicText?.length || 0) &&
                remoteHasInline &&
                !existingHasInline);

            if (shouldAcceptRemote || rm.revision >= existing.revision) {
              if (existing.thoughtStatus === 'thinking' && rm.thoughtStatus !== 'complete') {
                continue;
              }
              const merged: DurableMessage = {
                ...existing,
                ...rm,
                parts: remoteHasInline || !existingHasInline ? rm.parts : existing.parts,
                generatedImages: rm.generatedImages || existing.generatedImages,
                revision: Math.max(existing.revision, rm.revision),
              };
              if (!shallowMessageEqual(existing, merged)) {
                convMsgs.set(rm.id, merged);
                msgsToPersist.push(merged);
                stateChanged = true;
              }
            }
          }
        }

        this.messagesMap.set(conversationId, convMsgs);
        if (msgsToPersist.length > 0) {
          await this.vault.saveConversationsAndMessages(uid, [], msgsToPersist);
        }
      }
    }

    // 4. Companions
    if (remote.companions) {
      const toSave: DurableCompanion[] = [];
      for (const [compId, rComp] of Object.entries(remote.companions)) {
        if (this.hasPendingMutationFor('companion', compId)) continue;
        const cur = this.companionsMap.get(compId);
        if (!cur || rComp.revision >= cur.revision) {
          this.companionsMap.set(compId, rComp);
          toSave.push(rComp);
          stateChanged = true;
        }
      }
      if (toSave.length > 0) {
        await this.vault.saveCompanions(uid, toSave);
      }
    }

    // 5. Private Companion Memories (`companions/{companionId}/memories`)
    if (remote.companionMemories) {
      const { companionId, memories } = remote.companionMemories;
      const curMap = this.companionMemoriesMap.get(companionId) || new Map<string, ScopedMemory>();
      const toSave: ScopedMemory[] = [];

      for (const rm of memories) {
        if (rm.isDeleted) continue;
        if (this.hasPendingMutationFor('companion_memory', rm.id, companionId)) continue;
        const cur = curMap.get(rm.id);
        if (!cur || (rm.revision || 0) >= (cur.revision || 0)) {
          curMap.set(rm.id, rm);
          toSave.push(rm);
          stateChanged = true;
        }
      }

      this.companionMemoriesMap.set(companionId, curMap);
      if (toSave.length > 0) {
        await this.vault.saveCompanionMemories(uid, companionId, toSave);
      }
    }

    // 6. Shared Sanctuary Memories (`memories`)
    if (remote.sharedMemories) {
      const toSave: ScopedMemory[] = [];
      for (const sm of remote.sharedMemories) {
        if (sm.isDeleted) continue;
        if (this.hasPendingMutationFor('shared_memory', sm.id)) continue;
        const cur = this.sharedMemoriesMap.get(sm.id);
        if (!cur || (sm.revision || 0) >= (cur.revision || 0)) {
          this.sharedMemoriesMap.set(sm.id, sm);
          toSave.push(sm);
          stateChanged = true;
        }
      }
      if (toSave.length > 0) {
        await this.vault.saveSharedMemories(uid, toSave);
      }
    }

    // 7. Gifts
    if (remote.gifts) {
      const toSave: DurableGift[] = [];
      for (const rg of remote.gifts) {
        if (rg.isDeleted) continue;
        if (this.hasPendingMutationFor('gift', rg.id)) continue;
        const cur = this.giftsMap.get(rg.id);
        if (!cur || rg.revision >= cur.revision) {
          this.giftsMap.set(rg.id, rg);
          toSave.push(rg);
          stateChanged = true;
        }
      }
      if (toSave.length > 0) {
        await this.vault.saveGifts(uid, toSave);
      }
    }

    // 8. Legacy Monolithic Recovery (`users/{uid}`)
    if (remote.legacyMonolithicData) {
      const legacy = remote.legacyMonolithicData;
      if (legacy.userProfile && !this.userState.userProfile) {
        await this.updateProfile({ ...legacy.userProfile, id: uid });
      }
      if (legacy.settings?.memories && legacy.settings.memories.length > 0) {
        await this.migrateFlatMemoriesArray(legacy.settings.memories);
      }
      if (Array.isArray(legacy.conversations)) {
        for (const lc of legacy.conversations) {
          if (!lc || !lc.id) continue;
          const safeId = ensureValidDocId(lc.id, 'conv');
          if (deletedConvSet.has(safeId) || this.conversationsMap.has(safeId)) continue;
          const updatedAt = lc.updatedAt || lc.createdAt || Date.now();
          await this.createOrUpsertConversationFull({
            ...lc,
            id: safeId,
            createdAt: lc.createdAt || updatedAt,
            updatedAt,
          });
        }
      }
      if (Array.isArray(legacy.gifts)) {
        for (const lg of legacy.gifts) {
          if (!lg || !lg.id) continue;
          const safeGiftId = ensureValidDocId(lg.id, 'gift');
          if (!this.giftsMap.has(safeGiftId)) {
            await this.upsertGift({ ...lg, id: safeGiftId });
          }
        }
      }
    }

    if (stateChanged || remote.conversations !== undefined) {
      this.emitAll();
    } else {
      this.emitSyncStatus();
    }
  }

  /**
   * Automatically migrates flat `settings.memories` entries into dedicated
   * `companion_memories` (`companions/{id}/memories`) or `shared_memories` (`memories`) collections.
   */
  private async migrateFlatMemoriesArray(rawMemories: Memory[]): Promise<void> {
    if (!Array.isArray(rawMemories) || rawMemories.length === 0) return;

    for (let i = 0; i < rawMemories.length; i++) {
      const raw = rawMemories[i];
      if (!raw || !raw.content?.trim()) continue;
      const deterministicId = ensureValidDocId(
        raw.id || `migrated-mem-${raw.createdAt || i}-${hashShort(raw.content)}`,
        'mem'
      );
      const scoped = toScopedMemory({ ...raw, id: deterministicId }, this.nextRevision());

      if (scoped.scope === 'companion' && scoped.entityId) {
        const existingMap = this.companionMemoriesMap.get(scoped.entityId);
        if (!existingMap?.has(scoped.id)) {
          await this.upsertScopedMemory(scoped);
        }
      } else {
        if (!this.sharedMemoriesMap.has(scoped.id)) {
          await this.upsertScopedMemory(scoped);
        }
      }
    }

    this.userState = {
      ...this.userState,
      settings: { ...this.userState.settings, memories: [] },
      memoriesMigratedV2: true,
      settingsRevision: this.nextRevision(),
      updatedAt: Date.now(),
    };

    await this.enqueueMutation(
      {
        entityType: 'settings',
        entityId: 'app',
        operation: 'upsert',
        payload: {
          settings: this.stripTransientSettingsFields(this.userState.settings),
          memoriesMigratedV2: true,
        },
        revision: this.userState.settingsRevision,
      },
      { userState: this.userState }
    );
  }

  private stripTransientSettingsFields(settings: AppSettings): AppSettings {
    return {
      ...settings,
      memories: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Ordered Domain Mutation API (Used by React Store & Backup Restoration)
  // ---------------------------------------------------------------------------

  public async setActiveConversationId(id: string | null): Promise<void> {
    this.userState = {
      ...this.userState,
      activeConversationId: id,
      updatedAt: Date.now(),
    };
    await this.vault.saveUserState(this.userState);
    this.emitAll();
  }

  public async createConversation(
    customModelId?: string,
    customTitle?: string,
    initialMessages?: Message[],
    explicitId?: string
  ): Promise<Conversation> {
    const convId = ensureValidDocId(explicitId || uuidv4(), 'conv');
    const rev = this.nextRevision();
    const now = Date.now();
    const modelId = customModelId || this.userState.settings.model || 'models/gemini-3.1-pro-preview';

    const meta: DurableConversationMeta = {
      id: convId,
      title: customTitle || 'New Sanctuary',
      modelId,
      createdAt: now,
      updatedAt: now,
      revision: rev,
      type: 'direct',
      deletedMessageIds: [],
    };

    const durableMsgs: DurableMessage[] = [];
    const mMap = new Map<string, DurableMessage>();
    if (Array.isArray(initialMessages)) {
      initialMessages.forEach((m, idx) => {
        const norm = normalizeMessageSchema(m, convId, idx, now);
        const dm: DurableMessage = {
          ...norm,
          conversationId: convId,
          revision: this.nextRevision(),
        };
        durableMsgs.push(dm);
        mMap.set(dm.id, dm);
      });
    }

    this.conversationsMap.set(convId, meta);
    this.messagesMap.set(convId, mMap);
    this.userState = {
      ...this.userState,
      activeConversationId: convId,
      deletedConversationIds: (this.userState.deletedConversationIds || []).filter(
        (id) => id !== convId
      ),
      updatedAt: now,
    };

    this.emitAll();

    await this.enqueueMutation(
      {
        entityType: 'conversation',
        entityId: convId,
        operation: 'upsert',
        payload: meta,
        revision: rev,
      },
      {
        userState: this.userState,
        conversation: meta,
        messages: durableMsgs,
      }
    );

    for (const dm of durableMsgs) {
      await this.enqueueMutation(
        {
          entityType: 'message',
          entityId: dm.id,
          parentId: convId,
          operation: 'upsert',
          payload: dm,
          revision: dm.revision,
        },
        {}
      );
    }

    return {
      ...meta,
      messages: durableMsgs,
    };
  }

  public async createOrUpsertConversationFull(conv: Conversation): Promise<void> {
    const safeConvId = ensureValidDocId(conv.id, 'conv');
    const rev = this.nextRevision();
    const updatedAt = conv.updatedAt || Date.now();
    const existingMeta = this.conversationsMap.get(safeConvId);

    const existingMsgs = this.messagesMap.get(safeConvId) || new Map<string, DurableMessage>();
    const durableMsgs: DurableMessage[] = [];
    const restoredMsgIds = new Set<string>();
    for (let i = 0; i < (conv.messages || []).length; i++) {
      const norm = normalizeMessageSchema(conv.messages[i], safeConvId, i, updatedAt);
      const dm: DurableMessage = {
        ...norm,
        conversationId: safeConvId,
        revision: this.nextRevision(),
      };
      existingMsgs.set(dm.id, dm);
      durableMsgs.push(dm);
      restoredMsgIds.add(dm.id);
    }

    const meta: DurableConversationMeta = {
      id: safeConvId,
      title: conv.title || existingMeta?.title || 'Untitled Sanctuary',
      modelId: conv.modelId || existingMeta?.modelId || 'models/gemini-3.1-pro-preview',
      createdAt: conv.createdAt || existingMeta?.createdAt || updatedAt,
      updatedAt,
      revision: rev,
      type: conv.type || existingMeta?.type || 'direct',
      participantEntityIds: conv.participantEntityIds || existingMeta?.participantEntityIds,
      deletedMessageIds: (existingMeta?.deletedMessageIds || []).filter(
        (id) => !restoredMsgIds.has(id)
      ),
    };

    if ((this.userState.deletedConversationIds || []).includes(safeConvId)) {
      this.userState = {
        ...this.userState,
        deletedConversationIds: (this.userState.deletedConversationIds || []).filter(
          (id) => id !== safeConvId
        ),
        updatedAt: Date.now(),
      };
    }

    this.conversationsMap.set(safeConvId, meta);
    this.messagesMap.set(safeConvId, existingMsgs);
    this.emitAll();

    await this.enqueueMutation(
      {
        entityType: 'conversation',
        entityId: safeConvId,
        operation: 'upsert',
        payload: meta,
        revision: rev,
      },
      {
        userState: this.userState,
        conversation: meta,
        messages: durableMsgs,
      }
    );

    for (const dm of durableMsgs) {
      await this.enqueueMutation(
        {
          entityType: 'message',
          entityId: dm.id,
          parentId: safeConvId,
          operation: 'upsert',
          payload: dm,
          revision: dm.revision,
        },
        {}
      );
    }
  }

  public async updateConversation(convId: string, updates: Partial<Conversation>): Promise<void> {
    const safeConvId = ensureValidDocId(convId, 'conv');
    const existing = this.conversationsMap.get(safeConvId);
    if (!existing) return;

    const rev = this.nextRevision();
    const now = Date.now();
    let removedMsgIds: string[] = [];

    if (Array.isArray(updates.messages)) {
      const currentMap = this.messagesMap.get(safeConvId) || new Map<string, DurableMessage>();
      const nextIds = new Set(updates.messages.map((m) => ensureValidDocId(m.id, 'msg')));
      for (const curId of currentMap.keys()) {
        if (!nextIds.has(curId)) {
          removedMsgIds.push(curId);
          currentMap.delete(curId);
        }
      }
      updates.messages.forEach((m, idx) => {
        const norm = normalizeMessageSchema(m, safeConvId, idx, now);
        currentMap.set(norm.id, {
          ...norm,
          conversationId: safeConvId,
          revision: rev,
        });
      });
      this.messagesMap.set(safeConvId, currentMap);
    }

    const nextDeletedMsgIds = Array.from(
      new Set([...(existing.deletedMessageIds || []), ...removedMsgIds])
    ).slice(-MAX_TOMBSTONES);

    const { messages: _ignoreMsgs, ...metaUpdates } = updates;
    const nextMeta: DurableConversationMeta = {
      ...existing,
      ...metaUpdates,
      id: safeConvId,
      updatedAt: updates.updatedAt || now,
      revision: rev,
      deletedMessageIds: nextDeletedMsgIds,
    };

    this.conversationsMap.set(safeConvId, nextMeta);

    // Cancel any queued pending message upserts for truncated/removed messages
    const deletedTombstoneRecords: DurableMessage[] = [];
    for (const msgId of removedMsgIds) {
      await this.cancelPendingMutations((m) => m.entityType === 'message' && m.parentId === safeConvId && m.entityId === msgId && m.operation === 'upsert');
      deletedTombstoneRecords.push({
        id: msgId,
        conversationId: safeConvId,
        role: 'user',
        parts: [{ text: '' }],
        timestamp: 0,
        revision: rev,
        isDeleted: true,
      });
    }

    this.emitAll();

    await this.enqueueMutation(
      {
        entityType: 'conversation',
        entityId: safeConvId,
        operation: 'upsert',
        payload: nextMeta,
        revision: rev,
      },
      {
        conversation: nextMeta,
        messages: deletedTombstoneRecords,
      }
    );

    for (const msgId of removedMsgIds) {
      await this.enqueueMutation(
        {
          entityType: 'message',
          entityId: msgId,
          parentId: safeConvId,
          operation: 'delete',
          payload: { id: msgId, conversationId: safeConvId },
          revision: this.nextRevision(),
        },
        {}
      );
    }
  }

  public async deleteConversation(convId: string): Promise<void> {
    const safeConvId = ensureValidDocId(convId, 'conv');
    const rev = this.nextRevision();
    const existingMeta = this.conversationsMap.get(safeConvId);
    const existingMsgs = Array.from(this.messagesMap.get(safeConvId)?.values() || []);

    this.conversationsMap.delete(safeConvId);
    this.messagesMap.delete(safeConvId);

    const nextDeletedConvIds = Array.from(
      new Set([...(this.userState.deletedConversationIds || []), safeConvId])
    ).slice(-MAX_TOMBSTONES);

    let nextActiveId = this.userState.activeConversationId;
    if (nextActiveId === safeConvId) {
      const remaining = Array.from(this.conversationsMap.values())
        .filter((c) => !c.isDeleted)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      nextActiveId = remaining.length > 0 ? remaining[0].id : null;
    }

    this.userState = {
      ...this.userState,
      activeConversationId: nextActiveId,
      deletedConversationIds: nextDeletedConvIds,
      updatedAt: Date.now(),
    };

    // Cancel any queued pending writes for this conversation or its messages so they cannot resurrect it!
    await this.cancelPendingMutations(
      (m) =>
        (m.entityType === 'conversation' && m.entityId === safeConvId && m.operation === 'upsert') ||
        (m.entityType === 'message' && m.parentId === safeConvId)
    );

    this.emitAll();

    const deletedConvRecord: DurableConversationMeta = {
      ...(existingMeta || {
        id: safeConvId,
        title: 'Deleted',
        updatedAt: Date.now(),
      }),
      id: safeConvId,
      revision: rev,
      isDeleted: true,
    };

    const deletedMessagesRecords: DurableMessage[] = existingMsgs.map((m) => ({
      ...m,
      revision: rev,
      isDeleted: true,
    }));

    await this.enqueueMutation(
      {
        entityType: 'conversation',
        entityId: safeConvId,
        operation: 'delete',
        payload: { id: safeConvId },
        revision: rev,
      },
      {
        userState: this.userState,
        conversation: deletedConvRecord,
        messages: deletedMessagesRecords,
      }
    );
  }

  public async upsertMessage(
    convId: string,
    message: Message,
    options?: { syncCloudImmediately?: boolean }
  ): Promise<DurableMessage> {
    const safeConvId = ensureValidDocId(convId, 'conv');
    const rev = this.nextRevision();
    const now = Date.now();
    const normalized = normalizeMessageSchema(message, safeConvId, 0);

    // Ensure parent conversation exists locally even if addMessage was called directly
    let convMeta = this.conversationsMap.get(safeConvId);
    let createdNewConv = false;
    if (!convMeta) {
      createdNewConv = true;
      convMeta = {
        id: safeConvId,
        title: normalized.parts?.[0]?.text?.slice(0, 30) || 'New Sanctuary',
        modelId: this.userState.settings.model || 'models/gemini-3.1-pro-preview',
        createdAt: now,
        updatedAt: now,
        revision: rev,
        type: 'direct',
        deletedMessageIds: [],
      };
      this.conversationsMap.set(safeConvId, convMeta);
    } else {
      convMeta = {
        ...convMeta,
        updatedAt: Math.max(convMeta.updatedAt || 0, normalized.timestamp || now),
        revision: rev,
        deletedMessageIds: (convMeta.deletedMessageIds || []).filter((id) => id !== normalized.id),
      };
      this.conversationsMap.set(safeConvId, convMeta);
    }

    const convMsgs = this.messagesMap.get(safeConvId) || new Map<string, DurableMessage>();
    const existingMsg = convMsgs.get(normalized.id);
    const durableMsg: DurableMessage = {
      ...(existingMsg || {}),
      ...normalized,
      id: normalized.id,
      conversationId: safeConvId,
      revision: rev,
      isDeleted: false,
    };
    convMsgs.set(durableMsg.id, durableMsg);
    this.messagesMap.set(safeConvId, convMsgs);

    this.emitAll();

    const shouldSyncCloud = options?.syncCloudImmediately ?? true;
    if (!shouldSyncCloud) {
      // Checkpoint streaming chunk durably to IndexedDB without spamming Firestore on every 50ms token
      await this.vault.saveConversationsAndMessages(this.effectiveUid(), [convMeta], [durableMsg]);
      this.notifyPeerTabs();
      return durableMsg;
    }

    if (createdNewConv) {
      await this.enqueueMutation(
        {
          entityType: 'conversation',
          entityId: safeConvId,
          operation: 'upsert',
          payload: convMeta,
          revision: rev,
        },
        { conversation: convMeta }
      );
    }

    await this.enqueueMutation(
      {
        entityType: 'message',
        entityId: durableMsg.id,
        parentId: safeConvId,
        operation: 'upsert',
        payload: durableMsg,
        revision: rev,
      },
      {
        conversation: convMeta,
        messages: [durableMsg],
      }
    );

    return durableMsg;
  }

  public async updateMessage(
    convId: string,
    messageId: string,
    updates: Partial<Message>
  ): Promise<void> {
    const safeConvId = ensureValidDocId(convId, 'conv');
    const safeMsgId = ensureValidDocId(messageId, 'msg');
    const convMsgs = this.messagesMap.get(safeConvId);
    const existing = convMsgs?.get(safeMsgId);
    if (!existing) return;

    const safeUpdates = { ...updates };
    if (safeUpdates.parts && safeUpdates.parts.length === 0) {
      safeUpdates.parts = [{ text: '' }];
    }

    const merged: Message = {
      ...existing,
      ...safeUpdates,
      id: safeMsgId,
      conversationId: safeConvId,
    };

    const isTerminalOrReaction =
      updates.thoughtStatus === 'complete' ||
      updates.thoughtStatus === 'error' ||
      updates.finishReason !== undefined ||
      updates.reaction !== undefined;

    await this.upsertMessage(safeConvId, merged, {
      syncCloudImmediately: isTerminalOrReaction,
    });
  }

  public async deleteMessage(convId: string, messageId: string): Promise<void> {
    const safeConvId = ensureValidDocId(convId, 'conv');
    const safeMsgId = ensureValidDocId(messageId, 'msg');
    const rev = this.nextRevision();

    const convMsgs = this.messagesMap.get(safeConvId);
    const existingMsg = convMsgs?.get(safeMsgId);
    convMsgs?.delete(safeMsgId);

    const convMeta = this.conversationsMap.get(safeConvId);
    let updatedMeta: DurableConversationMeta | undefined;
    if (convMeta) {
      updatedMeta = {
        ...convMeta,
        updatedAt: Date.now(),
        revision: rev,
        deletedMessageIds: Array.from(
          new Set([...(convMeta.deletedMessageIds || []), safeMsgId])
        ).slice(-MAX_TOMBSTONES),
      };
      this.conversationsMap.set(safeConvId, updatedMeta);
    }

    await this.cancelPendingMutations(
      (m) =>
        m.entityType === 'message' &&
        m.parentId === safeConvId &&
        m.entityId === safeMsgId &&
        m.operation === 'upsert'
    );

    this.emitAll();

    const tombstoneMsg: DurableMessage = {
      ...(existingMsg || {
        id: safeMsgId,
        conversationId: safeConvId,
        role: 'user',
        parts: [{ text: '' }],
        timestamp: 0,
      }),
      id: safeMsgId,
      conversationId: safeConvId,
      revision: rev,
      isDeleted: true,
    };

    await this.enqueueMutation(
      {
        entityType: 'message',
        entityId: safeMsgId,
        parentId: safeConvId,
        operation: 'delete',
        payload: { id: safeMsgId, conversationId: safeConvId },
        revision: rev,
      },
      {
        conversation: updatedMeta,
        messages: [tombstoneMsg],
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Sovereign Companion Entities & Isolated Memories
  // ---------------------------------------------------------------------------

  public async upsertCompanion(modelKey: string, entity: ModelEntity): Promise<void> {
    const canonicalId = canonicalCompanionId(modelKey);
    const rev = this.nextRevision();
    const durable: DurableCompanion = {
      ...entity,
      id: canonicalId,
      revision: rev,
      updatedAt: Date.now(),
    };

    this.companionsMap.set(canonicalId, durable);
    this.emitAll();

    await this.enqueueMutation(
      {
        entityType: 'companion',
        entityId: canonicalId,
        operation: 'upsert',
        payload: durable,
        revision: rev,
      },
      { companion: durable }
    );
  }

  public async mutateCompanion(
    modelKey: string,
    mutator: (current: ModelEntity) => ModelEntity
  ): Promise<void> {
    const canonicalId = canonicalCompanionId(modelKey);
    const current = getModelEntity(canonicalId, this.getDomainState().settings.customEntities);
    const updated = mutator(current);
    await this.upsertCompanion(canonicalId, updated);
  }

  public async addMemory(params: {
    content: string;
    origin?: string;
    author?: 'user' | 'model';
    modelId?: string;
    caption?: string;
    isLocked?: boolean;
    lockReason?: string;
    explicitId?: string;
    createdAt?: number;
  }): Promise<ScopedMemory | null> {
    const trimmed = params.content?.trim();
    if (!trimmed) return null;

    const author = params.author || 'user';
    const isCompanionScoped = author === 'model' && Boolean(params.modelId);
    const entityId = isCompanionScoped ? canonicalCompanionId(params.modelId) : undefined;

    // Deduplicate within the exact target scope only (so Companion A having a memory never blocks Companion B!)
    if (isCompanionScoped && entityId) {
      const compMap = this.companionMemoriesMap.get(entityId);
      if (compMap) {
        for (const existing of compMap.values()) {
          if (!existing.isDeleted && existing.content.toLowerCase().trim() === trimmed.toLowerCase()) {
            if (params.isLocked && !existing.isLocked) {
              const upgraded: ScopedMemory = {
                ...existing,
                isLocked: true,
                lockReason: params.lockReason || existing.lockReason,
                revision: this.nextRevision(),
                updatedAt: Date.now(),
              };
              return this.upsertScopedMemory(upgraded);
            }
            return existing;
          }
        }
      }
    } else {
      for (const existing of this.sharedMemoriesMap.values()) {
        if (!existing.isDeleted && existing.content.toLowerCase().trim() === trimmed.toLowerCase()) {
          if (params.isLocked && !existing.isLocked) {
            const upgraded: ScopedMemory = {
              ...existing,
              isLocked: true,
              lockReason: params.lockReason || existing.lockReason,
              revision: this.nextRevision(),
              updatedAt: Date.now(),
            };
            return this.upsertScopedMemory(upgraded);
          }
          return existing;
        }
      }
    }

    const rev = this.nextRevision();
    const createdAt = params.createdAt || Date.now();
    const newMem: ScopedMemory = {
      id: ensureValidDocId(params.explicitId || uuidv4(), 'mem'),
      content: trimmed,
      createdAt,
      origin: params.origin || 'direct_input',
      author,
      modelId: entityId || (params.modelId ? normalizeModelId(params.modelId) : undefined),
      caption: params.caption,
      isLocked: Boolean(params.isLocked),
      lockReason: params.lockReason,
      scope: isCompanionScoped && entityId ? 'companion' : 'shared',
      entityId,
      revision: rev,
      updatedAt: createdAt,
    };

    return this.upsertScopedMemory(newMem);
  }

  public async upsertScopedMemory(mem: ScopedMemory): Promise<ScopedMemory> {
    const rev = mem.revision || this.nextRevision();
    const safeId = ensureValidDocId(mem.id, 'mem');
    const cleanMem: ScopedMemory = {
      ...mem,
      id: safeId,
      revision: rev,
      updatedAt: Date.now(),
      isDeleted: false,
    };

    if (cleanMem.scope === 'companion' && cleanMem.entityId) {
      const cid = canonicalCompanionId(cleanMem.entityId);
      cleanMem.entityId = cid;
      cleanMem.modelId = cid;
      cleanMem.author = 'model';

      const map = this.companionMemoriesMap.get(cid) || new Map<string, ScopedMemory>();
      map.set(safeId, cleanMem);
      this.companionMemoriesMap.set(cid, map);
      this.emitAll();

      await this.enqueueMutation(
        {
          entityType: 'companion_memory',
          entityId: safeId,
          parentId: cid,
          operation: 'upsert',
          payload: cleanMem,
          revision: rev,
        },
        { companionMemory: cleanMem }
      );
      return cleanMem;
    }

    this.sharedMemoriesMap.set(safeId, cleanMem);
    this.emitAll();

    await this.enqueueMutation(
      {
        entityType: 'shared_memory',
        entityId: safeId,
        operation: 'upsert',
        payload: cleanMem,
        revision: rev,
      },
      { sharedMemory: cleanMem }
    );
    return cleanMem;
  }

  public async setMemoryLockState(
    memoryId: string,
    isLocked: boolean,
    lockReason?: string
  ): Promise<void> {
    const safeId = ensureValidDocId(memoryId, 'mem');
    const shared = this.sharedMemoriesMap.get(safeId);
    if (shared && !shared.isDeleted) {
      await this.upsertScopedMemory({
        ...shared,
        isLocked,
        lockReason: isLocked ? lockReason || shared.lockReason : shared.lockReason,
        revision: this.nextRevision(),
      });
      return;
    }

    for (const map of this.companionMemoriesMap.values()) {
      const found = map.get(safeId);
      if (found && !found.isDeleted) {
        await this.upsertScopedMemory({
          ...found,
          isLocked,
          lockReason: isLocked ? lockReason || found.lockReason : found.lockReason,
          revision: this.nextRevision(),
        });
        return;
      }
    }
  }

  public async deleteMemory(memoryId: string): Promise<void> {
    const safeId = ensureValidDocId(memoryId, 'mem');
    const rev = this.nextRevision();

    const shared = this.sharedMemoriesMap.get(safeId);
    if (shared) {
      this.sharedMemoriesMap.delete(safeId);
      await this.cancelPendingMutations(
        (m) => m.entityType === 'shared_memory' && m.entityId === safeId && m.operation === 'upsert'
      );
      this.emitAll();
      await this.enqueueMutation(
        {
          entityType: 'shared_memory',
          entityId: safeId,
          operation: 'delete',
          payload: { id: safeId },
          revision: rev,
        },
        { sharedMemory: { ...shared, revision: rev, isDeleted: true } }
      );
      return;
    }

    for (const [cid, map] of this.companionMemoriesMap.entries()) {
      const compMem = map.get(safeId);
      if (compMem) {
        map.delete(safeId);
        await this.cancelPendingMutations(
          (m) =>
            m.entityType === 'companion_memory' &&
            m.parentId === cid &&
            m.entityId === safeId &&
            m.operation === 'upsert'
        );
        this.emitAll();
        await this.enqueueMutation(
          {
            entityType: 'companion_memory',
            entityId: safeId,
            parentId: cid,
            operation: 'delete',
            payload: { id: safeId, entityId: cid },
            revision: rev,
          },
          { companionMemory: { ...compMem, entityId: cid, revision: rev, isDeleted: true } }
        );
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Gifts, Settings, Jewel & Profile
  // ---------------------------------------------------------------------------

  public async addGift(gift: Omit<Gift, 'id' | 'timestamp'>): Promise<Gift> {
    const newGift: Gift = {
      ...gift,
      id: uuidv4(),
      modelId: gift.modelId ? normalizeModelId(gift.modelId) : undefined,
      targetModelId: gift.targetModelId ? normalizeModelId(gift.targetModelId) : undefined,
      timestamp: Date.now(),
    };
    await this.upsertGift(newGift);
    return newGift;
  }

  public async upsertGift(gift: Gift): Promise<void> {
    const safeId = ensureValidDocId(gift.id, 'gift');
    const rev = this.nextRevision();
    const durable: DurableGift = {
      ...gift,
      id: safeId,
      timestamp: gift.timestamp || Date.now(),
      revision: rev,
      isDeleted: false,
    };
    this.giftsMap.set(safeId, durable);
    this.emitAll();

    await this.enqueueMutation(
      {
        entityType: 'gift',
        entityId: safeId,
        operation: 'upsert',
        payload: durable,
        revision: rev,
      },
      { gift: durable }
    );
  }

  public async updateSettings(
    updates: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)
  ): Promise<void> {
    const rev = this.nextRevision();
    const current = this.userState.settings;
    const rawNext = typeof updates === 'function' ? updates(current) : { ...current, ...updates };
    const { memories: _ignoredFlatMemories, customEntities, ...rest } = rawNext;

    this.userState = {
      ...this.userState,
      settings: {
        ...current,
        ...rest,
        memories: [],
        customEntities: customEntities ?? current.customEntities,
      },
      settingsRevision: rev,
      updatedAt: Date.now(),
    };

    this.emitAll();

    await this.enqueueMutation(
      {
        entityType: 'settings',
        entityId: 'app',
        operation: 'upsert',
        payload: {
          settings: this.stripTransientSettingsFields(this.userState.settings),
          memoriesMigratedV2: this.userState.memoriesMigratedV2,
        },
        revision: rev,
      },
      { userState: this.userState }
    );
  }

  public async updateJewelMetrics(
    updates: Partial<JewelMetrics> | ((prev: JewelMetrics) => JewelMetrics)
  ): Promise<void> {
    const rev = this.nextRevision();
    const prev = this.userState.jewelMetrics;
    const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };

    this.userState = {
      ...this.userState,
      jewelMetrics: next,
      jewelRevision: rev,
      updatedAt: Date.now(),
    };

    this.emitAll();

    await this.enqueueMutation(
      {
        entityType: 'jewel',
        entityId: 'app',
        operation: 'upsert',
        payload: { jewelMetrics: next },
        revision: rev,
      },
      { userState: this.userState }
    );
  }

  public async updateProfile(
    updates: UserProfile | ((prev: UserProfile | null) => UserProfile)
  ): Promise<void> {
    const rev = this.nextRevision();
    const nextProfile = typeof updates === 'function' ? updates(this.userState.userProfile) : updates;
    const indexedProfile: UserProfile = {
      ...nextProfile,
      id: nextProfile.id || this.activeUid || 'default-profile',
      updatedAt: Date.now(),
    };

    this.userState = {
      ...this.userState,
      userProfile: indexedProfile,
      profileRevision: rev,
      updatedAt: Date.now(),
    };

    this.emitAll();

    await this.enqueueMutation(
      {
        entityType: 'profile',
        entityId: 'app',
        operation: 'upsert',
        payload: { userProfile: indexedProfile },
        revision: rev,
      },
      { userState: this.userState }
    );
  }

  /**
   * Used exclusively by Confirmed Full Replace Backup Restoration (`confirmReplace === true`).
   * Deletes removed conversations/memories/gifts cleanly via ordered tombstones before writing restored records.
   */
  public async clearAllDataForConfirmedReplace(confirmReplace: boolean): Promise<void> {
    if (confirmReplace !== true) {
      throw new Error('Explicit confirmation required before replacing Sanctuary data');
    }

    const existingConvIds = Array.from(this.conversationsMap.keys());
    for (const convId of existingConvIds) {
      await this.deleteConversation(convId);
    }

    const existingSharedMemIds = Array.from(this.sharedMemoriesMap.keys());
    for (const memId of existingSharedMemIds) {
      await this.deleteMemory(memId);
    }

    for (const map of this.companionMemoriesMap.values()) {
      for (const memId of Array.from(map.keys())) {
        await this.deleteMemory(memId);
      }
    }

    for (const giftId of Array.from(this.giftsMap.keys())) {
      const rev = this.nextRevision();
      const existing = this.giftsMap.get(giftId);
      this.giftsMap.delete(giftId);
      await this.enqueueMutation(
        {
          entityType: 'gift',
          entityId: giftId,
          operation: 'delete',
          payload: { id: giftId },
          revision: rev,
        },
        {
          gift: existing ? { ...existing, revision: rev, isDeleted: true } : undefined,
        }
      );
    }

    this.companionsMap.clear();
    this.emitAll();
  }

  private async cancelPendingMutations(predicate: (m: MutationRecord) => boolean): Promise<void> {
    const uid = this.effectiveUid();
    for (const [id, m] of this.journalMap.entries()) {
      if (m.status === 'pending' && predicate(m)) {
        this.journalMap.delete(id);
        await this.vault.deleteJournalMutation(uid, id);
      }
    }
  }
}

function sortMessagesDeterministic(a: Message, b: Message): number {
  const diff = (a.timestamp || 0) - (b.timestamp || 0);
  if (diff !== 0) return diff;
  if (a.role === 'user' && b.role === 'model') return -1;
  if (a.role === 'model' && b.role === 'user') return 1;
  return (a.id || '').localeCompare(b.id || '');
}

function shallowMessageEqual(a: DurableMessage, b: DurableMessage): boolean {
  return (
    a.revision === b.revision &&
    a.publicText === b.publicText &&
    a.thoughtText === b.thoughtText &&
    a.thoughtStatus === b.thoughtStatus &&
    a.reaction === b.reaction &&
    (a.parts?.length || 0) === (b.parts?.length || 0) &&
    (a.generatedImages?.length || 0) === (b.generatedImages?.length || 0)
  );
}

function hashShort(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
