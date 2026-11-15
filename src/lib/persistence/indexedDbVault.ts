import { ConversationSegmentSummary, MediaAssetRecord } from '../types';
import {
  DurableCompanion,
  DurableConversationMeta,
  DurableGift,
  DurableMessage,
  HydratedVaultState,
  MutationRecord,
  ScopedMemory,
  UserScopedStateRecord,
} from './types';

const DEFAULT_DB_NAME = 'midnight_sanctuary_vault_v1';
const DB_VERSION = 2;

const STORES = {
  USER_STATE: 'user_state',
  MUTATION_JOURNAL: 'mutation_journal',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  CONVERSATION_SUMMARIES: 'conversation_summaries',
  COMPANIONS: 'companions',
  COMPANION_MEMORIES: 'companion_memories',
  SHARED_MEMORIES: 'shared_memories',
  GIFTS: 'gifts',
  MEDIA_ASSETS: 'media_assets',
  MEDIA_BLOBS: 'media_blobs',
} as const;

export interface StoredMediaBlob {
  assetId: string;
  ownerUid: string;
  mimeType: string;
  dataUrl: string;
  byteSize: number;
  createdAt: number;
}

interface StoredEnvelope<T> {
  pk: string;
  uid: string;
  parentKey?: string;
  sequence?: number;
  status?: string;
  record: T;
}

/**
 * Durable user-partitioned local persistence engine backed by IndexedDB,
 * with automatic in-memory fallback if IndexedDB is unavailable or blocked.
 */
export class IndexedDBVault {
  private readonly dbName: string;
  private readonly idbFactory: IDBFactory | null;
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryFallback = new Map<string, Map<string, StoredEnvelope<any>>>();

  constructor(
    optionsOrDbName?: string | { dbName?: string; idbFactory?: IDBFactory | null },
    idbFactoryArg?: IDBFactory | null
  ) {
    const options =
      typeof optionsOrDbName === 'string'
        ? { dbName: optionsOrDbName, idbFactory: idbFactoryArg }
        : optionsOrDbName;

    this.dbName = options?.dbName || DEFAULT_DB_NAME;
    this.idbFactory =
      options?.idbFactory !== undefined
        ? options.idbFactory
        : typeof globalThis !== 'undefined' && 'indexedDB' in globalThis
        ? globalThis.indexedDB
        : null;

    for (const storeName of Object.values(STORES)) {
      this.memoryFallback.set(storeName, new Map());
    }
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (!this.idbFactory) {
      return Promise.resolve(null);
    }
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const request = this.idbFactory!.open(this.dbName, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          for (const storeName of Object.values(STORES)) {
            if (!db.objectStoreNames.contains(storeName)) {
              const store = db.createObjectStore(storeName, { keyPath: 'pk' });
              store.createIndex('by_uid', 'uid', { unique: false });
              store.createIndex('by_parent', 'parentKey', { unique: false });
            }
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.dbPromise = null;
          };
          resolve(db);
        };

        request.onerror = () => {
          console.warn('[IndexedDBVault] Falling back to in-memory vault:', request.error);
          resolve(null);
        };

        request.onblocked = () => {
          console.warn('[IndexedDBVault] Database open blocked; using fallback temporarily.');
          resolve(null);
        };
      } catch (err) {
        console.warn('[IndexedDBVault] Exception opening IndexedDB:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  public async close(): Promise<void> {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    if (db) {
      db.close();
    }
    this.dbPromise = null;
  }

  private async putEnvelope<T>(storeName: string, envelope: StoredEnvelope<T>): Promise<void> {
    const db = await this.openDb();
    if (!db) {
      this.memoryFallback.get(storeName)!.set(envelope.pk, structuredCloneSafe(envelope));
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(envelope);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error(`Failed writing to ${storeName}`));
      tx.onabort = () => reject(tx.error || new Error(`Transaction aborted on ${storeName}`));
    });
  }

  private async putBatch(writes: { storeName: string; envelope: StoredEnvelope<any> }[]): Promise<void> {
    if (writes.length === 0) return;
    const db = await this.openDb();
    if (!db) {
      for (const w of writes) {
        this.memoryFallback.get(w.storeName)!.set(w.envelope.pk, structuredCloneSafe(w.envelope));
      }
      return;
    }

    const storeNames = Array.from(new Set(writes.map((w) => w.storeName)));
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readwrite');
      for (const w of writes) {
        tx.objectStore(w.storeName).put(w.envelope);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Batch write failed'));
      tx.onabort = () => reject(tx.error || new Error('Batch transaction aborted'));
    });
  }

  private async deleteByPk(storeName: string, pk: string): Promise<void> {
    const db = await this.openDb();
    if (!db) {
      this.memoryFallback.get(storeName)!.delete(pk);
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(pk);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error(`Delete failed on ${storeName}`));
    });
  }

  private async getByPk<T>(storeName: string, pk: string): Promise<T | null> {
    const db = await this.openDb();
    if (!db) {
      const env = this.memoryFallback.get(storeName)!.get(pk);
      return env ? structuredCloneSafe(env.record) : null;
    }

    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(pk);
      req.onsuccess = () => {
        const result = req.result as StoredEnvelope<T> | undefined;
        resolve(result ? result.record : null);
      };
      req.onerror = () => reject(req.error || new Error(`Read failed on ${storeName}`));
    });
  }

  private async getAllByUid<T>(storeName: string, uid: string): Promise<T[]> {
    const db = await this.openDb();
    if (!db) {
      const items: T[] = [];
      for (const env of this.memoryFallback.get(storeName)!.values()) {
        if (env.uid === uid) {
          items.push(structuredCloneSafe(env.record));
        }
      }
      return items;
    }

    return new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const idx = tx.objectStore(storeName).index('by_uid');
      const req = idx.getAll(uid);
      req.onsuccess = () => {
        const envelopes = (req.result || []) as StoredEnvelope<T>[];
        resolve(envelopes.map((e) => e.record));
      };
      req.onerror = () => reject(req.error || new Error(`Index query failed on ${storeName}`));
    });
  }

  // ---------------------------------------------------------------------------
  // Key Builders (Strictly Partitioned by UID)
  // ---------------------------------------------------------------------------

  private userPk(uid: string): string {
    return `user::${uid}`;
  }

  private journalPk(uid: string, mutationId: string): string {
    return `journal::${uid}::${mutationId}`;
  }

  private convPk(uid: string, convId: string): string {
    return `conv::${uid}::${convId}`;
  }

  private msgPk(uid: string, convId: string, msgId: string): string {
    return `msg::${uid}::${convId}::${msgId}`;
  }

  private summaryPk(uid: string, convId: string, summaryId: string): string {
    return `sum::${uid}::${convId}::${summaryId}`;
  }

  private companionPk(uid: string, companionId: string): string {
    return `comp::${uid}::${companionId}`;
  }

  private companionMemPk(uid: string, companionId: string, memId: string): string {
    return `cmem::${uid}::${companionId}::${memId}`;
  }

  private sharedMemPk(uid: string, memId: string): string {
    return `smem::${uid}::${memId}`;
  }

  private giftPk(uid: string, giftId: string): string {
    return `gift::${uid}::${giftId}`;
  }

  private mediaAssetPk(uid: string, assetId: string): string {
    return `media::${uid}::${assetId}`;
  }

  private mediaBlobPk(uid: string, assetId: string): string {
    return `mblob::${uid}::${assetId}`;
  }

  // ---------------------------------------------------------------------------
  // Hydration & Snapshot Loading
  // ---------------------------------------------------------------------------

  public async loadUserVault(uid: string): Promise<HydratedVaultState> {
    const [
      userState,
      conversations,
      allMessages,
      allSummaries,
      companionList,
      allCompanionMemories,
      sharedMemories,
      gifts,
      mediaAssets,
      journalEntries,
    ] = await Promise.all([
      this.getByPk<UserScopedStateRecord>(STORES.USER_STATE, this.userPk(uid)),
      this.getAllByUid<DurableConversationMeta>(STORES.CONVERSATIONS, uid),
      this.getAllByUid<DurableMessage>(STORES.MESSAGES, uid),
      this.getAllByUid<ConversationSegmentSummary>(STORES.CONVERSATION_SUMMARIES, uid),
      this.getAllByUid<DurableCompanion>(STORES.COMPANIONS, uid),
      this.getAllByUid<ScopedMemory>(STORES.COMPANION_MEMORIES, uid),
      this.getAllByUid<ScopedMemory>(STORES.SHARED_MEMORIES, uid),
      this.getAllByUid<DurableGift>(STORES.GIFTS, uid),
      this.getAllByUid<MediaAssetRecord>(STORES.MEDIA_ASSETS, uid),
      this.getAllByUid<MutationRecord>(STORES.MUTATION_JOURNAL, uid),
    ]);

    const messagesByConversation: Record<string, DurableMessage[]> = {};
    for (const msg of allMessages) {
      if (!msg || msg.isDeleted) continue;
      if (!messagesByConversation[msg.conversationId]) {
        messagesByConversation[msg.conversationId] = [];
      }
      messagesByConversation[msg.conversationId].push(msg);
    }

    const summariesByConversation: Record<string, ConversationSegmentSummary[]> = {};
    for (const sum of allSummaries) {
      if (!sum || sum.isDeleted || !sum.conversationId) continue;
      if (!summariesByConversation[sum.conversationId]) {
        summariesByConversation[sum.conversationId] = [];
      }
      summariesByConversation[sum.conversationId].push(sum);
    }

    const companions: Record<string, DurableCompanion> = {};
    for (const comp of companionList) {
      if (comp?.id && !comp.isDeleted) {
        companions[comp.id] = comp;
      }
    }

    const companionMemories: Record<string, ScopedMemory[]> = {};
    for (const mem of allCompanionMemories) {
      if (!mem || mem.isDeleted || !mem.entityId) continue;
      if (!companionMemories[mem.entityId]) {
        companionMemories[mem.entityId] = [];
      }
      companionMemories[mem.entityId].push(mem);
    }

    const pendingMutations = journalEntries
      .filter((m) => m && m.status !== 'committed')
      .sort((a, b) => a.sequence - b.sequence);

    return {
      userState,
      conversations: conversations.filter((c) => c && !c.isDeleted),
      messagesByConversation,
      summariesByConversation,
      companions,
      companionMemories,
      sharedMemories: sharedMemories.filter((m) => m && !m.isDeleted),
      gifts: gifts.filter((g) => g && !g.isDeleted),
      mediaAssets: mediaAssets.filter((a) => a && !a.isDeleted),
      pendingMutations,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Write-Ahead Journal + Entity Operations
  // ---------------------------------------------------------------------------

  public async recordMutationAndEntity(
    mutation: MutationRecord,
    entityWrites: {
      userState?: UserScopedStateRecord;
      conversation?: DurableConversationMeta;
      messages?: DurableMessage[];
      conversationSummary?: ConversationSegmentSummary;
      companion?: DurableCompanion;
      companionMemory?: ScopedMemory;
      sharedMemory?: ScopedMemory;
      gift?: DurableGift;
      mediaAsset?: MediaAssetRecord;
    }
  ): Promise<void> {
    const uid = mutation.uid;
    const writes: { storeName: string; envelope: StoredEnvelope<any> }[] = [
      {
        storeName: STORES.MUTATION_JOURNAL,
        envelope: {
          pk: this.journalPk(uid, mutation.mutationId),
          uid,
          sequence: mutation.sequence,
          status: mutation.status,
          record: mutation,
        },
      },
    ];

    if (entityWrites.userState) {
      writes.push({
        storeName: STORES.USER_STATE,
        envelope: {
          pk: this.userPk(uid),
          uid,
          record: entityWrites.userState,
        },
      });
    }

    if (entityWrites.conversation) {
      writes.push({
        storeName: STORES.CONVERSATIONS,
        envelope: {
          pk: this.convPk(uid, entityWrites.conversation.id),
          uid,
          record: entityWrites.conversation,
        },
      });
    }

    if (entityWrites.messages && entityWrites.messages.length > 0) {
      for (const msg of entityWrites.messages) {
        writes.push({
          storeName: STORES.MESSAGES,
          envelope: {
            pk: this.msgPk(uid, msg.conversationId, msg.id),
            uid,
            parentKey: `${uid}::${msg.conversationId}`,
            record: msg,
          },
        });
      }
    }

    if (entityWrites.conversationSummary && entityWrites.conversationSummary.conversationId) {
      writes.push({
        storeName: STORES.CONVERSATION_SUMMARIES,
        envelope: {
          pk: this.summaryPk(
            uid,
            entityWrites.conversationSummary.conversationId,
            entityWrites.conversationSummary.id
          ),
          uid,
          parentKey: `${uid}::${entityWrites.conversationSummary.conversationId}`,
          record: entityWrites.conversationSummary,
        },
      });
    }

    if (entityWrites.companion) {
      writes.push({
        storeName: STORES.COMPANIONS,
        envelope: {
          pk: this.companionPk(uid, entityWrites.companion.id),
          uid,
          record: entityWrites.companion,
        },
      });
    }

    if (entityWrites.companionMemory && entityWrites.companionMemory.entityId) {
      writes.push({
        storeName: STORES.COMPANION_MEMORIES,
        envelope: {
          pk: this.companionMemPk(
            uid,
            entityWrites.companionMemory.entityId,
            entityWrites.companionMemory.id
          ),
          uid,
          parentKey: `${uid}::${entityWrites.companionMemory.entityId}`,
          record: entityWrites.companionMemory,
        },
      });
    }

    if (entityWrites.sharedMemory) {
      writes.push({
        storeName: STORES.SHARED_MEMORIES,
        envelope: {
          pk: this.sharedMemPk(uid, entityWrites.sharedMemory.id),
          uid,
          record: entityWrites.sharedMemory,
        },
      });
    }

    if (entityWrites.gift) {
      writes.push({
        storeName: STORES.GIFTS,
        envelope: {
          pk: this.giftPk(uid, entityWrites.gift.id),
          uid,
          record: entityWrites.gift,
        },
      });
    }

    if (entityWrites.mediaAsset) {
      writes.push({
        storeName: STORES.MEDIA_ASSETS,
        envelope: {
          pk: this.mediaAssetPk(uid, entityWrites.mediaAsset.id),
          uid,
          record: entityWrites.mediaAsset,
        },
      });
    }

    await this.putBatch(writes);
  }

  public async putJournalMutation(mutation: MutationRecord): Promise<void> {
    await this.putEnvelope(STORES.MUTATION_JOURNAL, {
      pk: this.journalPk(mutation.uid, mutation.mutationId),
      uid: mutation.uid,
      sequence: mutation.sequence,
      status: mutation.status,
      record: mutation,
    });
  }

  public async deleteJournalMutation(uid: string, mutationId: string): Promise<void> {
    await this.deleteByPk(STORES.MUTATION_JOURNAL, this.journalPk(uid, mutationId));
  }

  public async getPendingMutations(uid: string): Promise<MutationRecord[]> {
    const all = await this.getAllByUid<MutationRecord>(STORES.MUTATION_JOURNAL, uid);
    return all
      .filter((m) => m && m.status !== 'committed')
      .sort((a, b) => a.sequence - b.sequence);
  }

  // ---------------------------------------------------------------------------
  // Direct Entity Sync Helpers (Used when reconciling authoritative cloud updates)
  // ---------------------------------------------------------------------------

  public async saveUserState(state: UserScopedStateRecord): Promise<void> {
    await this.putEnvelope(STORES.USER_STATE, {
      pk: this.userPk(state.uid),
      uid: state.uid,
      record: state,
    });
  }

  public async saveConversationsAndMessages(
    uid: string,
    conversations: DurableConversationMeta[],
    messages: DurableMessage[]
  ): Promise<void> {
    const writes: { storeName: string; envelope: StoredEnvelope<any> }[] = [];
    for (const conv of conversations) {
      writes.push({
        storeName: STORES.CONVERSATIONS,
        envelope: {
          pk: this.convPk(uid, conv.id),
          uid,
          record: conv,
        },
      });
    }
    for (const msg of messages) {
      writes.push({
        storeName: STORES.MESSAGES,
        envelope: {
          pk: this.msgPk(uid, msg.conversationId, msg.id),
          uid,
          parentKey: `${uid}::${msg.conversationId}`,
          record: msg,
        },
      });
    }
    await this.putBatch(writes);
  }

  public async saveConversationSummaries(
    uid: string,
    conversationId: string,
    summaries: ConversationSegmentSummary[]
  ): Promise<void> {
    const writes = summaries.map((s) => ({
      storeName: STORES.CONVERSATION_SUMMARIES,
      envelope: {
        pk: this.summaryPk(uid, conversationId, s.id),
        uid,
        parentKey: `${uid}::${conversationId}`,
        record: s,
      },
    }));
    await this.putBatch(writes);
  }

  public async saveCompanions(uid: string, companions: DurableCompanion[]): Promise<void> {
    const writes = companions.map((c) => ({
      storeName: STORES.COMPANIONS,
      envelope: {
        pk: this.companionPk(uid, c.id),
        uid,
        record: c,
      },
    }));
    await this.putBatch(writes);
  }

  public async saveCompanionMemories(
    uid: string,
    companionId: string,
    memories: ScopedMemory[]
  ): Promise<void> {
    const writes = memories.map((m) => ({
      storeName: STORES.COMPANION_MEMORIES,
      envelope: {
        pk: this.companionMemPk(uid, companionId, m.id),
        uid,
        parentKey: `${uid}::${companionId}`,
        record: m,
      },
    }));
    await this.putBatch(writes);
  }

  public async saveSharedMemories(uid: string, memories: ScopedMemory[]): Promise<void> {
    const writes = memories.map((m) => ({
      storeName: STORES.SHARED_MEMORIES,
      envelope: {
        pk: this.sharedMemPk(uid, m.id),
        uid,
        record: m,
      },
    }));
    await this.putBatch(writes);
  }

  public async saveGifts(uid: string, gifts: DurableGift[]): Promise<void> {
    const writes = gifts.map((g) => ({
      storeName: STORES.GIFTS,
      envelope: {
        pk: this.giftPk(uid, g.id),
        uid,
        record: g,
      },
    }));
    await this.putBatch(writes);
  }

  public async saveMediaAssets(uid: string, assets: MediaAssetRecord[]): Promise<void> {
    const writes = assets.map((a) => ({
      storeName: STORES.MEDIA_ASSETS,
      envelope: {
        pk: this.mediaAssetPk(uid, a.id),
        uid,
        record: a,
      },
    }));
    await this.putBatch(writes);
  }

  public async putMediaBlob(blob: StoredMediaBlob): Promise<void> {
    await this.putEnvelope(STORES.MEDIA_BLOBS, {
      pk: this.mediaBlobPk(blob.ownerUid, blob.assetId),
      uid: blob.ownerUid,
      record: blob,
    });
  }

  public async getMediaBlob(uid: string, assetId: string): Promise<StoredMediaBlob | null> {
    return this.getByPk<StoredMediaBlob>(STORES.MEDIA_BLOBS, this.mediaBlobPk(uid, assetId));
  }

  public async deleteMediaBlob(uid: string, assetId: string): Promise<void> {
    await this.deleteByPk(STORES.MEDIA_BLOBS, this.mediaBlobPk(uid, assetId));
  }

  public async clearUserVaultData(uid: string, preserveJournal = false): Promise<void> {
    const db = await this.openDb();
    const targetStores = Object.values(STORES).filter(
      (s) => !(preserveJournal && s === STORES.MUTATION_JOURNAL)
    );

    if (!db) {
      for (const storeName of targetStores) {
        const map = this.memoryFallback.get(storeName)!;
        for (const [k, v] of map.entries()) {
          if (v.uid === uid) map.delete(k);
        }
      }
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(targetStores, 'readwrite');
      for (const storeName of targetStores) {
        const store = tx.objectStore(storeName);
        const idx = store.index('by_uid');
        const req = idx.openKeyCursor(uid);
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed clearing user vault'));
    });
  }
}

function structuredCloneSafe<T>(val: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(val);
    } catch {
      return JSON.parse(JSON.stringify(val));
    }
  }
  return JSON.parse(JSON.stringify(val));
}
