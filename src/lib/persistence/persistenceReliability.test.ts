import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBVault } from './indexedDbVault';
import { PersistenceCoordinator } from './persistenceCoordinator';
import { deriveConsistentPreviewMessages } from './firestoreAdapter';
import {
  exportSanctuaryBackup,
  restoreSanctuaryBackup,
  validateSanctuaryBackup,
} from './backupService';
import { getContextMemories } from '../memorySystem';
import {
  CloudPersistenceAdapter,
  CloudRemoteSnapshot,
  DurableCompanion,
  DurableConversationMeta,
  DurableGift,
  DurableMessage,
  MutationRecord,
  ScopedMemory,
} from './types';
import { Message } from '../types';

/**
 * Realistic In-Memory Cloud Backend simulating Firestore's exact hierarchical collections,
 * real-time `onSnapshot` listeners, network interruptions, transient write errors,
 * stalled in-flight writes, and duplicate snapshot emissions.
 */
class SimulatedFirestoreCloud {
  public users = new Map<
    string,
    {
      settingsDoc?: any;
      conversations: Map<string, { meta: DurableConversationMeta; previewMessages: Message[] }>;
      messages: Map<string, Map<string, DurableMessage>>;
      companions: Map<string, DurableCompanion>;
      companionMemories: Map<string, Map<string, ScopedMemory>>;
      sharedMemories: Map<string, ScopedMemory>;
      gifts: Map<string, DurableGift>;
    }
  >();

  private listeners = new Map<string, Set<(snap: CloudRemoteSnapshot) => void>>();
  public failNextWritesCount = 0;
  public networkDisconnected = false;
  public stallWrites = false;
  private stalledResolvers: (() => void)[] = [];
  public writeLog: MutationRecord[] = [];

  public ensureUserBucket(uid: string) {
    let b = this.users.get(uid);
    if (!b) {
      b = {
        conversations: new Map(),
        messages: new Map(),
        companions: new Map(),
        companionMemories: new Map(),
        sharedMemories: new Map(),
        gifts: new Map(),
      };
      this.users.set(uid, b);
    }
    return b;
  }

  public releaseStalledWrites(): void {
    const resolvers = [...this.stalledResolvers];
    this.stalledResolvers = [];
    resolvers.forEach((r) => r());
  }

  public emitDuplicateSnapshots(uid: string): void {
    const b = this.ensureUserBucket(uid);
    const subs = this.listeners.get(uid);
    if (!subs) return;
    const convSnap: CloudRemoteSnapshot = {
      conversations: Array.from(b.conversations.values()),
    };
    for (const cb of subs) {
      cb(convSnap);
      for (const [convId, mMap] of b.messages.entries()) {
        cb({
          conversationMessages: {
            conversationId: convId,
            messages: Array.from(mMap.values()),
          },
        });
      }
    }
  }

  public createAdapter(): CloudPersistenceAdapter {
    return {
      subscribeUser: (uid, _email, onRemoteUpdate, _onError) => {
        const b = this.ensureUserBucket(uid);
        const set = this.listeners.get(uid) || new Set();
        set.add(onRemoteUpdate);
        this.listeners.set(uid, set);

        // Emit initial hydration snapshot asynchronously like real Firestore onSnapshot
        queueMicrotask(() => {
          if (!set.has(onRemoteUpdate) || this.networkDisconnected) return;
          if (b.settingsDoc) {
            onRemoteUpdate({
              settings: b.settingsDoc.settings,
              settingsRevision: b.settingsDoc.settingsRevision || 0,
              jewelMetrics: b.settingsDoc.jewelMetrics,
              jewelRevision: b.settingsDoc.jewelRevision || 0,
              userProfile: b.settingsDoc.userProfile,
              profileRevision: b.settingsDoc.profileRevision || 0,
              memoriesMigratedV2: Boolean(b.settingsDoc.memoriesMigratedV2),
            });
          }
          onRemoteUpdate({
            conversations: Array.from(b.conversations.values()),
          });
          for (const [convId, mMap] of b.messages.entries()) {
            onRemoteUpdate({
              conversationMessages: {
                conversationId: convId,
                messages: Array.from(mMap.values()),
              },
            });
          }
          if (b.companions.size > 0) {
            onRemoteUpdate({
              companions: Object.fromEntries(b.companions.entries()),
            });
          }
          for (const [compId, memMap] of b.companionMemories.entries()) {
            onRemoteUpdate({
              companionMemories: {
                companionId: compId,
                memories: Array.from(memMap.values()),
              },
            });
          }
          if (b.sharedMemories.size > 0) {
            onRemoteUpdate({
              sharedMemories: Array.from(b.sharedMemories.values()),
            });
          }
          if (b.gifts.size > 0) {
            onRemoteUpdate({
              gifts: Array.from(b.gifts.values()),
            });
          }
        });

        return () => {
          set.delete(onRemoteUpdate);
        };
      },

      executeMutation: async (uid, mutation, context) => {
        if (this.stallWrites) {
          await new Promise<void>((resolve) => {
            this.stalledResolvers.push(resolve);
          });
        }
        if (this.networkDisconnected) {
          throw new Error('Network disconnected during Firestore write');
        }
        if (this.failNextWritesCount > 0) {
          this.failNextWritesCount -= 1;
          throw new Error('Simulated transient Firestore UNAVAILABLE error');
        }

        this.writeLog.push({ ...mutation });
        const b = this.ensureUserBucket(uid);
        const broadcast = (snap: CloudRemoteSnapshot) => {
          const subs = this.listeners.get(uid);
          if (!subs) return;
          for (const cb of subs) cb(snap);
        };

        switch (mutation.entityType) {
          case 'settings':
            b.settingsDoc = {
              ...(b.settingsDoc || {}),
              settings: mutation.payload.settings,
              settingsRevision: mutation.revision,
              memoriesMigratedV2: mutation.payload.memoriesMigratedV2,
            };
            broadcast({
              settings: b.settingsDoc.settings,
              settingsRevision: mutation.revision,
              memoriesMigratedV2: b.settingsDoc.memoriesMigratedV2,
            });
            break;

          case 'jewel':
            b.settingsDoc = {
              ...(b.settingsDoc || {}),
              jewelMetrics: mutation.payload.jewelMetrics,
              jewelRevision: mutation.revision,
            };
            broadcast({
              jewelMetrics: b.settingsDoc.jewelMetrics,
              jewelRevision: mutation.revision,
            });
            break;

          case 'profile':
            b.settingsDoc = {
              ...(b.settingsDoc || {}),
              userProfile: mutation.payload.userProfile,
              profileRevision: mutation.revision,
            };
            broadcast({
              userProfile: b.settingsDoc.userProfile,
              profileRevision: mutation.revision,
            });
            break;

          case 'conversation': {
            const convId = mutation.entityId;
            if (mutation.operation === 'delete') {
              b.conversations.delete(convId);
              b.messages.delete(convId);
            } else {
              const meta = mutation.payload as DurableConversationMeta;
              const deletedSet = new Set(meta.deletedMessageIds || []);
              const previewMessages = deriveConsistentPreviewMessages(
                context.conversationMessages || [],
                convId,
                deletedSet
              );
              b.conversations.set(convId, { meta, previewMessages });
            }
            broadcast({ conversations: Array.from(b.conversations.values()) });
            break;
          }

          case 'message': {
            const convId = mutation.parentId!;
            const msgId = mutation.entityId;
            const mMap = b.messages.get(convId) || new Map<string, DurableMessage>();
            if (mutation.operation === 'delete') {
              mMap.delete(msgId);
            } else {
              mMap.set(msgId, mutation.payload as DurableMessage);
            }
            b.messages.set(convId, mMap);

            const existingConv = b.conversations.get(convId);
            const meta: DurableConversationMeta = context.conversationMeta ||
              existingConv?.meta || {
                id: convId,
                title: 'Sanctuary',
                updatedAt: mutation.clientTimestamp,
                revision: mutation.revision,
              };
            const deletedSet = new Set(meta.deletedMessageIds || []);
            const previewMessages = deriveConsistentPreviewMessages(
              Array.from(mMap.values()),
              convId,
              deletedSet
            );
            b.conversations.set(convId, { meta, previewMessages });

            broadcast({ conversations: Array.from(b.conversations.values()) });
            broadcast({
              conversationMessages: {
                conversationId: convId,
                messages: Array.from(mMap.values()),
              },
            });
            break;
          }

          case 'companion': {
            b.companions.set(mutation.entityId, mutation.payload as DurableCompanion);
            broadcast({ companions: Object.fromEntries(b.companions.entries()) });
            break;
          }

          case 'companion_memory': {
            const compId = mutation.parentId!;
            const map = b.companionMemories.get(compId) || new Map<string, ScopedMemory>();
            if (mutation.operation === 'delete') {
              map.delete(mutation.entityId);
            } else {
              map.set(mutation.entityId, mutation.payload as ScopedMemory);
            }
            b.companionMemories.set(compId, map);
            broadcast({
              companionMemories: {
                companionId: compId,
                memories: Array.from(map.values()),
              },
            });
            break;
          }

          case 'shared_memory': {
            if (mutation.operation === 'delete') {
              b.sharedMemories.delete(mutation.entityId);
            } else {
              b.sharedMemories.set(mutation.entityId, mutation.payload as ScopedMemory);
            }
            broadcast({ sharedMemories: Array.from(b.sharedMemories.values()) });
            break;
          }

          case 'gift': {
            if (mutation.operation === 'delete') {
              b.gifts.delete(mutation.entityId);
            } else {
              b.gifts.set(mutation.entityId, mutation.payload as DurableGift);
            }
            broadcast({ gifts: Array.from(b.gifts.values()) });
            break;
          }
        }
      },
    };
  }
}

async function waitForCondition(
  predicate: () => boolean,
  timeoutMs = 2000,
  stepMs = 15
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  expect(predicate()).toBe(true);
}

describe('Midnight Sanctuary Persistence Reliability Overhaul (12 Core Scenarios)', () => {
  let idb: IDBFactory;
  let cloud: SimulatedFirestoreCloud;

  beforeEach(() => {
    idb = new IDBFactory();
    cloud = new SimulatedFirestoreCloud();
  });

  it('Scenario 1: User sends a message with attachment and immediately refreshes', async () => {
    cloud.stallWrites = true;
    const vault1 = new IndexedDBVault('sanctuary_test_s1', idb);
    const coord1 = new PersistenceCoordinator({
      vault: vault1,
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });

    await coord1.attachUser('uid-owner', 'ahatley094@gmail.com');
    const conv = await coord1.createConversation('models/gemini-3.1-pro-preview', 'Midnight Walk');

    const richMessage: Message = {
      id: 'msg-immediate-refresh',
      role: 'user',
      parts: [
        { text: 'Look at the moon tonight' },
        { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAUA' } },
      ],
      publicText: 'Look at the moon tonight',
      timestamp: 1700000001000,
    };
    await coord1.upsertMessage(conv.id, richMessage);

    // Immediate browser refresh BEFORE cloud write completes
    coord1.destroy();
    cloud.stallWrites = false;
    cloud.releaseStalledWrites();

    // Boot fresh coordinator against the same IndexedDB
    const vault2 = new IndexedDBVault('sanctuary_test_s1', idb);
    const coord2 = new PersistenceCoordinator({
      vault: vault2,
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });
    await coord2.attachUser('uid-owner', 'ahatley094@gmail.com');

    const restoredConvs = coord2.getDomainState().conversations;
    expect(restoredConvs).toHaveLength(1);
    expect(restoredConvs[0].messages).toHaveLength(1);
    expect(restoredConvs[0].messages[0].publicText).toBe('Look at the moon tonight');
    // Verify attachment data was NOT stripped in local vault!
    expect(restoredConvs[0].messages[0].parts[1]?.inlineData?.data).toBe(
      'iVBORw0KGgoAAAANSUhEUgAAAAUA'
    );

    await waitForCondition(() => coord2.getSyncStatus().pendingCount === 0);
    const cloudMsgs = cloud.ensureUserBucket('uid-owner').messages.get(conv.id);
    expect(cloudMsgs?.get('msg-immediate-refresh')?.parts[1]?.inlineData?.data).toBe(
      'iVBORw0KGgoAAAANSUhEUgAAAAUA'
    );
    coord2.destroy();
  });

  it('Scenario 2: Browser closes while a message is in_flight / pending and recovers on restart', async () => {
    cloud.stallWrites = true;
    const coord1 = new PersistenceCoordinator({
      vault: new IndexedDBVault('sanctuary_test_s2', idb),
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });

    await coord1.attachUser('uid-owner');
    const conv = await coord1.createConversation('models/gemini-3.1-pro-preview', 'Pending Session');
    await coord1.upsertMessage(conv.id, {
      id: 'msg-inflight-1',
      role: 'user',
      parts: [{ text: 'Still pending when tab closed' }],
      timestamp: 1700000002000,
    });

    expect(coord1.getSyncStatus().pendingCount).toBeGreaterThan(0);

    // Simulate hard tab close while mutation is `in_flight`
    coord1.destroy();
    cloud.stallWrites = false;
    cloud.releaseStalledWrites();

    // Cloud never received msg-inflight-1 yet because conv write was stalled first
    expect(cloud.ensureUserBucket('uid-owner').messages.get(conv.id)?.has('msg-inflight-1')).toBeFalsy();

    // Restart app: `in_flight` journal record resets to `pending` and replays cleanly
    const coord2 = new PersistenceCoordinator({
      vault: new IndexedDBVault('sanctuary_test_s2', idb),
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });
    await coord2.attachUser('uid-owner');
    await waitForCondition(() => coord2.getSyncStatus().pendingCount === 0);

    const cloudMsg = cloud.ensureUserBucket('uid-owner').messages.get(conv.id)?.get('msg-inflight-1');
    expect(cloudMsg?.parts[0]?.text).toBe('Still pending when tab closed');
    coord2.destroy();
  });

  it('Scenario 3: Network disconnects during a Firestore write — never falsely marks committed', async () => {
    const coord = new PersistenceCoordinator({
      vault: new IndexedDBVault('sanctuary_test_s3', idb),
      cloudAdapter: cloud.createAdapter(),
      baseDelayMs: 5000,
      channelName: null,
      legacyStorage: null,
    });

    await coord.attachUser('uid-owner');
    const conv = await coord.createConversation('models/gemini-3.1-pro-preview', 'Cutover Test');
    await waitForCondition(() => coord.getSyncStatus().pendingCount === 0);

    // Disconnect network right before sending message
    cloud.networkDisconnected = true;
    await coord.upsertMessage(conv.id, {
      id: 'msg-cut-1',
      role: 'user',
      parts: [{ text: 'Written during disconnect' }],
      timestamp: 1700000003000,
    });

    await new Promise((r) => setTimeout(r, 40));

    // Must remain uncommitted in journal with error recorded, NOT falsely treated as synced
    const status = coord.getSyncStatus();
    expect(status.pendingCount).toBe(1);
    expect(status.lastError).toContain('Network disconnected');
    expect(coord.getDomainState().conversations[0].messages).toHaveLength(1);
    expect(cloud.ensureUserBucket('uid-owner').messages.get(conv.id)?.size ?? 0).toBe(0);

    coord.destroy();
  });

  it('Scenario 4: Network reconnects after several pending messages and preserves exact ordering', async () => {
    const coord = new PersistenceCoordinator({
      vault: new IndexedDBVault('sanctuary_test_s4', idb),
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });

    await coord.attachUser('uid-owner');
    coord.setOnlineStatus(false);
    expect(coord.getSyncStatus().phase).toBe('offline');

    const conv = await coord.createConversation('models/gemini-3.1-pro-preview', 'Offline Sequence');
    const texts = ['First whisper', 'Second reply', 'Third note', 'Fourth anchor'];
    for (let i = 0; i < texts.length; i++) {
      await coord.upsertMessage(conv.id, {
        id: `msg-seq-${i + 1}`,
        role: i % 2 === 0 ? 'user' : 'model',
        parts: [{ text: texts[i] }],
        publicText: texts[i],
        timestamp: 1700000010000 + i * 100,
      });
    }

    expect(coord.getSyncStatus().pendingCount).toBe(5); // 1 conv + 4 messages
    expect(cloud.ensureUserBucket('uid-owner').conversations.size).toBe(0);

    // Reconnect!
    coord.setOnlineStatus(true);
    await waitForCondition(() => coord.getSyncStatus().pendingCount === 0);
    expect(coord.getSyncStatus().phase).toBe('synced');

    const domainMsgs = coord.getDomainState().conversations[0].messages;
    expect(domainMsgs.map((m) => m.publicText)).toEqual(texts);

    const cloudPreview = cloud.ensureUserBucket('uid-owner').conversations.get(conv.id)?.previewMessages;
    expect(cloudPreview?.map((m) => m.publicText)).toEqual(texts);
    coord.destroy();
  });

  it('Scenario 5: Firestore listener reconnects and emits duplicate snapshots without duplicating messages', async () => {
    const coord = new PersistenceCoordinator({
      vault: new IndexedDBVault('sanctuary_test_s5', idb),
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });

    await coord.attachUser('uid-owner');
    const conv = await coord.createConversation('models/gemini-3.1-pro-preview', 'Dedup Thread');
    await coord.upsertMessage(conv.id, {
      id: 'msg-d1',
      role: 'user',
      parts: [
        { text: 'Hello there' },
        { inlineData: { mimeType: 'image/jpeg', data: 'BASE64_IMAGE_PAYLOAD' } },
      ],
      timestamp: 1700000020000,
    });
    await coord.upsertMessage(conv.id, {
      id: 'msg-d2',
      role: 'model',
      parts: [{ text: 'Welcome home' }],
      publicText: 'Welcome home',
      thoughtStatus: 'complete',
      timestamp: 1700000020500,
    });

    await waitForCondition(() => coord.getSyncStatus().pendingCount === 0);

    // Emit duplicate reconnect snapshots 3 times in a row
    cloud.emitDuplicateSnapshots('uid-owner');
    cloud.emitDuplicateSnapshots('uid-owner');
    cloud.emitDuplicateSnapshots('uid-owner');
    await new Promise((r) => setTimeout(r, 30));

    const msgs = coord.getDomainState().conversations[0].messages;
    expect(msgs).toHaveLength(2);
    expect(msgs.map((m) => m.id)).toEqual(['msg-d1', 'msg-d2']);
    // Stripped preview snapshot must NOT overwrite full inlineData from subcollection!
    expect(msgs[0].parts[1]?.inlineData?.data).toBe('BASE64_IMAGE_PAYLOAD');
    coord.destroy();
  });

  it('Scenario 6: Two concurrent browser sessions modify the same conversation without data loss', async () => {
    const coordA = new PersistenceCoordinator({
      vault: new IndexedDBVault('sanctuary_tab_a', new IDBFactory()),
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });
    const coordB = new PersistenceCoordinator({
      vault: new IndexedDBVault('sanctuary_tab_b', new IDBFactory()),
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });

    await coordA.attachUser('uid-owner');
    await coordB.attachUser('uid-owner');

    const conv = await coordA.createConversation('models/gemini-3.1-pro-preview', 'Shared Chamber');
    await waitForCondition(() => coordB.getDomainState().conversations.length === 1);

    // Concurrent writes from both sessions
    await Promise.all([
      coordA.upsertMessage(conv.id, {
        id: 'msg-session-A',
        role: 'user',
        parts: [{ text: 'From Session A' }],
        publicText: 'From Session A',
        timestamp: 1700000030100,
      }),
      coordB.upsertMessage(conv.id, {
        id: 'msg-session-B',
        role: 'model',
        parts: [{ text: 'From Session B' }],
        publicText: 'From Session B',
        timestamp: 1700000030200,
      }),
    ]);

    await waitForCondition(
      () =>
        coordA.getSyncStatus().pendingCount === 0 &&
        coordB.getSyncStatus().pendingCount === 0 &&
        coordA.getDomainState().conversations[0]?.messages.length === 2 &&
        coordB.getDomainState().conversations[0]?.messages.length === 2
    );

    expect(coordA.getDomainState().conversations[0].messages.map((m) => m.id)).toEqual([
      'msg-session-A',
      'msg-session-B',
    ]);
    expect(coordB.getDomainState().conversations[0].messages.map((m) => m.id)).toEqual([
      'msg-session-A',
      'msg-session-B',
    ]);

    coordA.destroy();
    coordB.destroy();
  });

  it('Scenario 7: Authentication changes between users strictly isolates local & cloud state', async () => {
    const sharedVault = new IndexedDBVault('sanctuary_multi_auth', idb);
    const coord = new PersistenceCoordinator({
      vault: sharedVault,
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });

    // 1. User Alice signs in and creates private data
    await coord.attachUser('uid-alice', 'alice@example.com');
    const aliceConv = await coord.createConversation('models/gemini-3.1-pro-preview', 'Alice Secret');
    await coord.upsertMessage(aliceConv.id, {
      id: 'alice-msg-1',
      role: 'user',
      parts: [{ text: 'Alice private message' }],
      timestamp: 1700000040000,
    });
    await coord.addMemory({
      content: 'Alice loves jasmine tea',
      author: 'user',
      origin: 'user_settings',
    });
    await waitForCondition(() => coord.getSyncStatus().pendingCount === 0);

    // 2. Switch auth to Bob — zero Alice records may leak!
    await coord.attachUser('uid-bob', 'bob@example.com');
    expect(coord.getDomainState().conversations).toHaveLength(0);
    expect(coord.getDomainState().settings.memories).toHaveLength(0);

    const bobConv = await coord.createConversation('models/gemma-2-27b-it', 'Bob Chamber');
    await coord.upsertMessage(bobConv.id, {
      id: 'bob-msg-1',
      role: 'user',
      parts: [{ text: 'Bob note' }],
      timestamp: 1700000045000,
    });
    await waitForCondition(() => coord.getSyncStatus().pendingCount === 0);

    // 3. Switch back to Alice — Alice's exact data returns, zero Bob data visible!
    await coord.attachUser('uid-alice', 'alice@example.com');
    expect(coord.getDomainState().conversations).toHaveLength(1);
    expect(coord.getDomainState().conversations[0].title).toBe('Alice Secret');
    expect(coord.getDomainState().settings.memories.map((m) => m.content)).toEqual([
      'Alice loves jasmine tea',
    ]);

    coord.destroy();
  });

  it('Scenario 8: Initial hydration returning an empty cloud snapshot never wipes populated local state', async () => {
    const vaultName = 'sanctuary_test_s8';

    // Populate local IndexedDB while offline (cloud stays completely empty)
    const coordOffline = new PersistenceCoordinator({
      vault: new IndexedDBVault(vaultName, idb),
      cloudAdapter: null,
      channelName: null,
      legacyStorage: null,
    });
    await coordOffline.attachUser('uid-owner');
    const localConv = await coordOffline.createConversation(
      'models/gemini-3.1-pro-preview',
      'Locally Preserved Thread'
    );
    await coordOffline.upsertMessage(localConv.id, {
      id: 'msg-local-safe',
      role: 'user',
      parts: [{ text: 'Must survive empty cloud snapshot' }],
      timestamp: 1700000050000,
    });
    coordOffline.destroy();

    // Now boot with an empty cloud database that emits `conversations: []` on initial snapshot
    expect(cloud.ensureUserBucket('uid-owner').conversations.size).toBe(0);
    const coordOnline = new PersistenceCoordinator({
      vault: new IndexedDBVault(vaultName, idb),
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });
    await coordOnline.attachUser('uid-owner');

    await waitForCondition(
      () =>
        coordOnline.getSyncStatus().isCloudHydrated &&
        coordOnline.getSyncStatus().pendingCount === 0
    );

    // Local conversation was preserved AND backfilled to Firestore!
    expect(coordOnline.getDomainState().conversations).toHaveLength(1);
    expect(coordOnline.getDomainState().conversations[0].messages[0].parts[0].text).toBe(
      'Must survive empty cloud snapshot'
    );
    expect(cloud.ensureUserBucket('uid-owner').conversations.has(localConv.id)).toBe(true);
    expect(
      cloud.ensureUserBucket('uid-owner').messages.get(localConv.id)?.has('msg-local-safe')
    ).toBe(true);

    coordOnline.destroy();
  });

  it('Scenario 9: Conversation deletion while writes are pending cancels queued upserts and prevents resurrection', async () => {
    const coord = new PersistenceCoordinator({
      vault: new IndexedDBVault('sanctuary_test_s9', idb),
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });

    await coord.attachUser('uid-owner');
    const conv = await coord.createConversation('models/gemini-3.1-pro-preview', 'Ephemeral');
    await waitForCondition(() => coord.getSyncStatus().pendingCount === 0);

    // Go offline, queue several message writes, then delete the conversation before reconnecting
    coord.setOnlineStatus(false);
    await coord.upsertMessage(conv.id, {
      id: 'msg-ephemeral-1',
      role: 'user',
      parts: [{ text: 'Pending before delete' }],
      timestamp: 1700000060000,
    });
    await coord.deleteConversation(conv.id);

    expect(coord.getDomainState().conversations).toHaveLength(0);

    // Reconnect: pending message upsert must NOT resurrect the deleted conversation!
    coord.setOnlineStatus(true);
    await waitForCondition(() => coord.getSyncStatus().pendingCount === 0);

    expect(coord.getDomainState().conversations).toHaveLength(0);
    expect(cloud.ensureUserBucket('uid-owner').conversations.has(conv.id)).toBe(false);
    coord.destroy();
  });

  it('Scenario 10: Companion memories persist independently of conversation deletion and never leak across entities', async () => {
    // Seed legacy flat settings.memories in cloud to also verify automatic v2 migration!
    cloud.ensureUserBucket('uid-owner').settingsDoc = {
      settings: {
        memories: [
          {
            id: 'legacy-pro-mem',
            content: 'Pro private reflection from legacy array',
            createdAt: 1700000070000,
            author: 'model',
            origin: 'model_initiated',
            modelId: 'models/gemini-3.1-pro-preview',
          },
          {
            id: 'legacy-shared-mem',
            content: 'User prefers midnight jazz',
            createdAt: 1700000070100,
            author: 'user',
            origin: 'user_settings',
          },
        ],
      },
      settingsRevision: 100,
      memoriesMigratedV2: false,
    };

    const coord = new PersistenceCoordinator({
      vault: new IndexedDBVault('sanctuary_test_s10', idb),
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });

    await coord.attachUser('uid-owner');
    await waitForCondition(() => coord.getSyncStatus().isCloudHydrated);
    await waitForCondition(() => coord.getSyncStatus().pendingCount === 0);

    // Add a private memory for Gemma (Entity B) + diary entry on Gemini Pro (Entity A)
    await coord.addMemory({
      content: 'Gemma private poetry observation',
      author: 'model',
      origin: 'model_initiated',
      modelId: 'models/gemma-2-27b-it',
    });
    await coord.mutateCompanion('gemini-3.1-pro-preview', (ent) => ({
      ...ent,
      moodStatus: 'Watching the observatory stars',
    }));

    // Create a group conversation with both companions, then delete ALL conversations
    const groupConv = await coord.createConversation(
      'models/gemini-3.1-pro-preview',
      'Group Sanctuary'
    );
    await coord.updateConversation(groupConv.id, {
      type: 'group',
      participantEntityIds: ['gemini-3.1-pro-preview', 'gemma-2-27b-it'],
    });
    await coord.deleteConversation(groupConv.id);
    await waitForCondition(() => coord.getSyncStatus().pendingCount === 0);

    const state = coord.getDomainState();
    expect(state.conversations).toHaveLength(0);

    // Companion entities and memories survive conversation deletion untouched
    expect(state.companions['gemini-3.1-pro-preview']?.moodStatus).toBe(
      'Watching the observatory stars'
    );
    expect(state.companionMemories['gemini-3.1-pro-preview']?.map((m) => m.content)).toContain(
      'Pro private reflection from legacy array'
    );
    expect(state.companionMemories['gemma-2-27b-it']?.map((m) => m.content)).toContain(
      'Gemma private poetry observation'
    );

    // Strict sovereignty check: Gemini Pro sees Shared + Pro private, NEVER Gemma's private memory!
    const proContext = getContextMemories(state.settings.memories, 'models/gemini-3.1-pro-preview');
    expect(proContext.map((m) => m.content)).toContain('User prefers midnight jazz');
    expect(proContext.map((m) => m.content)).toContain('Pro private reflection from legacy array');
    expect(proContext.map((m) => m.content)).not.toContain('Gemma private poetry observation');

    // Gemma sees Shared + Gemma private, NEVER Pro's private memory!
    const gemmaContext = getContextMemories(state.settings.memories, 'models/gemma-2-27b-it');
    expect(gemmaContext.map((m) => m.content)).toContain('User prefers midnight jazz');
    expect(gemmaContext.map((m) => m.content)).toContain('Gemma private poetry observation');
    expect(gemmaContext.map((m) => m.content)).not.toContain(
      'Pro private reflection from legacy array'
    );

    coord.destroy();
  });

  it('Scenario 11: A failed write is retried with bounded exponential backoff without duplicating messages', async () => {
    const coord = new PersistenceCoordinator({
      vault: new IndexedDBVault('sanctuary_test_s11', idb),
      cloudAdapter: cloud.createAdapter(),
      baseDelayMs: 20,
      maxDelayMs: 100,
      channelName: null,
      legacyStorage: null,
    });

    await coord.attachUser('uid-owner');
    const conv = await coord.createConversation('models/gemini-3.1-pro-preview', 'Retry Resilience');
    await waitForCondition(() => coord.getSyncStatus().pendingCount === 0);

    // Force the next 2 cloud write attempts to fail, succeeding on attempt 3
    cloud.failNextWritesCount = 2;

    await coord.upsertMessage(conv.id, {
      id: 'msg-retry-idempotent',
      role: 'user',
      parts: [{ text: 'Idempotent retry test' }],
      publicText: 'Idempotent retry test',
      timestamp: 1700000080000,
    });

    await waitForCondition(() => coord.getSyncStatus().pendingCount === 0, 2500);
    expect(coord.getSyncStatus().phase).toBe('synced');

    const localMsgs = coord.getDomainState().conversations[0].messages;
    expect(localMsgs).toHaveLength(1);
    expect(localMsgs[0].id).toBe('msg-retry-idempotent');

    const cloudMsgs = cloud.ensureUserBucket('uid-owner').messages.get(conv.id);
    expect(cloudMsgs?.size).toBe(1);
    expect(cloudMsgs?.get('msg-retry-idempotent')?.publicText).toBe('Idempotent retry test');
    coord.destroy();
  });

  it('Scenario 12: App restarts with uncommitted mutations across domains + Validated Backup Export/Merge/Replace', async () => {
    const vaultName = 'sanctuary_test_s12';
    const coord1 = new PersistenceCoordinator({
      vault: new IndexedDBVault(vaultName, idb),
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });

    await coord1.attachUser('uid-owner');
    coord1.setOnlineStatus(false);

    // Queue uncommitted mutations across ALL Sanctuary domains while offline
    const conv = await coord1.createConversation('models/gemini-4-argon', 'Argon Chamber');
    await coord1.upsertMessage(conv.id, {
      id: 'msg-uncommitted-restart',
      role: 'user',
      parts: [{ text: 'Saved in Argon chamber' }],
      publicText: 'Saved in Argon chamber',
      timestamp: 1700000090000,
    });
    await coord1.addMemory({
      content: 'Argon remembers the aurora',
      author: 'model',
      modelId: 'gemini-4-argon',
    });
    await coord1.addMemory({
      content: 'Shared sanctuary vow',
      author: 'user',
    });
    await coord1.addGift({
      from: 'Gemini 4 Argon',
      content: 'Starlight Compass',
      gift_type: 'artifact',
      reason: 'For finding your way back',
      modelId: 'gemini-4-argon',
    });
    await coord1.updateSettings({ aboutMe: 'Keeper of the Sanctuary' });

    expect(coord1.getSyncStatus().pendingCount).toBeGreaterThanOrEqual(5);
    coord1.destroy();

    // Cold restart with connectivity restored
    const coord2 = new PersistenceCoordinator({
      vault: new IndexedDBVault(vaultName, idb),
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });
    await coord2.attachUser('uid-owner');
    await waitForCondition(() => coord2.getSyncStatus().pendingCount === 0);

    // Export schemaVersion 2 backup
    const backup = exportSanctuaryBackup(coord2.getDomainState());
    expect(backup.schemaVersion).toBe(2);
    expect(backup.manifest.conversations).toBe(1);
    expect(backup.manifest.messages).toBe(1);
    expect(backup.manifest.privateMemories).toBe(1);
    expect(backup.manifest.sharedMemories).toBe(1);
    expect(backup.manifest.gifts).toBe(1);

    // Verify tamper detection on corrupted checksum
    const tampered = JSON.stringify({
      ...backup,
      data: { ...backup.data, gifts: [] },
    });
    const tamperedValidation = validateSanctuaryBackup(tampered);
    expect(tamperedValidation.valid).toBe(false);
    expect(tamperedValidation.errors[0]).toContain('checksum mismatch');

    // Validate authentic backup
    const validPreview = validateSanctuaryBackup(JSON.stringify(backup));
    expect(validPreview.valid).toBe(true);
    expect(validPreview.checksumVerified).toBe(true);

    // Restore into a second account that already has an existing conversation:
    // 1) Merge mode preserves existing conversation AND adds backup items
    const targetCloud = new SimulatedFirestoreCloud();
    const coordTarget = new PersistenceCoordinator({
      vault: new IndexedDBVault('sanctuary_restore_target', new IDBFactory()),
      cloudAdapter: targetCloud.createAdapter(),
      channelName: null,
      legacyStorage: null,
    });
    await coordTarget.attachUser('uid-target');
    await coordTarget.createConversation('models/gemini-3.1-pro-preview', 'Pre-existing Thread');

    await restoreSanctuaryBackup(coordTarget, validPreview, { mode: 'merge' });
    expect(coordTarget.getDomainState().conversations).toHaveLength(2);
    expect(coordTarget.getDomainState().gifts).toHaveLength(1);
    expect(coordTarget.getDomainState().companionMemories['gemini-4-argon']).toHaveLength(1);

    // 2) Full Replace without explicit confirmation MUST throw and never delete existing data
    await expect(
      restoreSanctuaryBackup(coordTarget, validPreview, { mode: 'replace', confirmReplace: false })
    ).rejects.toThrow(/Explicit confirmation/);
    expect(coordTarget.getDomainState().conversations).toHaveLength(2);

    // 3) Confirmed Full Replace (`confirmReplace: true`) replaces cleanly to exact backup manifest
    await restoreSanctuaryBackup(coordTarget, validPreview, {
      mode: 'replace',
      confirmReplace: true,
    });
    expect(coordTarget.getDomainState().conversations).toHaveLength(1);
    expect(coordTarget.getDomainState().conversations[0].title).toBe('Argon Chamber');

    coord2.destroy();
    coordTarget.destroy();
  });

  it('Migration: One-time legacy localStorage cache (`sanctuary_conversations_cache`) migrates safely into IndexedDB & Firestore', async () => {
    const storeMap = new Map<string, string>();
    const fakeLegacyStorage: Storage = {
      get length() {
        return storeMap.size;
      },
      clear: () => storeMap.clear(),
      getItem: (key: string) => storeMap.get(key) ?? null,
      key: (index: number) => Array.from(storeMap.keys())[index] ?? null,
      removeItem: (key: string) => {
        storeMap.delete(key);
      },
      setItem: (key: string, value: string) => {
        storeMap.set(key, value);
      },
    };

    fakeLegacyStorage.setItem(
      'sanctuary_conversations_cache',
      JSON.stringify([
        {
          id: 'legacy-cached-conv',
          title: 'Recovered From Legacy LocalStorage',
          modelId: 'models/gemini-3.1-pro-preview',
          updatedAt: 1700000099000,
          messages: [
            {
              id: 'legacy-cached-msg',
              role: 'user',
              parts: [{ text: 'Previously trapped in localStorage' }],
              timestamp: 1700000099000,
            },
          ],
        },
      ])
    );

    const coord = new PersistenceCoordinator({
      vault: new IndexedDBVault('sanctuary_legacy_ls_migration', idb),
      cloudAdapter: cloud.createAdapter(),
      channelName: null,
      legacyStorage: fakeLegacyStorage,
    });

    await coord.attachUser('uid-owner', 'ahatley094@gmail.com');
    await waitForCondition(() => coord.getSyncStatus().pendingCount === 0);

    expect(coord.getDomainState().conversations).toHaveLength(1);
    expect(coord.getDomainState().conversations[0].title).toBe('Recovered From Legacy LocalStorage');
    expect(
      cloud.ensureUserBucket('uid-owner').messages.get('legacy-cached-conv')?.has('legacy-cached-msg')
    ).toBe(true);
    // Legacy un-keyed localStorage entry removed after durable IndexedDB commit
    expect(fakeLegacyStorage.getItem('sanctuary_conversations_cache')).toBeNull();

    coord.destroy();
  });
});
