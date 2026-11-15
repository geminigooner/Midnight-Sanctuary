import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');
const BLUEPRINT_PATH = path.resolve(process.cwd(), 'firebase-blueprint.json');

interface SimulatedAuth {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

interface EvalRequest {
  path: string;
  op: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: SimulatedAuth | null;
  incomingData?: Record<string, any>;
  existingData?: Record<string, any>;
  afterStatePaths?: Set<string>;
}

const VALID_ID_RE = /^[a-zA-Z0-9_\-.@:]+$/;
const DOT_ONLY_RE = /^\.+$/;

function isValidId(id: unknown): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    !DOT_ONLY_RE.test(id) &&
    VALID_ID_RE.test(id)
  );
}

function hasOnlyKeys(obj: Record<string, any>, allowed: string[]): boolean {
  const set = new Set(allowed);
  return Object.keys(obj).every((k) => set.has(k));
}

function hasAllKeys(obj: Record<string, any>, required: string[]): boolean {
  return required.every((k) => k in obj);
}

function affectedKeys(
  incoming: Record<string, any>,
  existing: Record<string, any>
): string[] {
  const keys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(incoming[k]) !== JSON.stringify(existing[k])) {
      changed.push(k);
    }
  }
  return changed;
}

/**
 * Deterministic Zero-Trust Policy Evaluator mirroring `/firestore.rules` boolean gates
 * for verifying authorized owner access vs. the "Dirty Dozen" adversarial payloads.
 */
function evaluateFirestoreRule(req: EvalRequest): boolean {
  const segs = req.path.replace(/^\/+/, '').split('/');
  const isSignedIn = req.auth !== null && Boolean(req.auth.uid);
  const isOwner = (userId: string) => isSignedIn && req.auth!.uid === userId;
  const isVerifiedOwner = (userId: string) =>
    isOwner(userId) && req.auth!.email_verified === true;
  const isVerifiedBootstrappedOwner = () =>
    isSignedIn &&
    req.auth!.email_verified === true &&
    req.auth!.email === 'ahatley094@gmail.com';

  // Root outside `/users/{userId}` -> Global default-deny `allow read, write: if false`
  if (segs[0] !== 'users' || segs.length < 2) {
    return false;
  }

  const userId = segs[1];

  // `/users/{userId}`
  if (segs.length === 2) {
    const allowedKeys = [
      'id',
      'email',
      'displayName',
      'userProfile',
      'migratedToGranular',
      'updatedAt',
    ];
    if (req.op === 'get') {
      return (
        (isOwner(userId) && isValidId(userId)) ||
        (userId === 'ahatley094@gmail.com' && isVerifiedBootstrappedOwner())
      );
    }
    if (req.op === 'list' || req.op === 'delete') return false;
    const data = req.incomingData || {};
    const validShape =
      (!('id' in data) || (typeof data.id === 'string' && data.id === userId)) &&
      (!('email' in data) || (typeof data.email === 'string' && data.email.length <= 320));
    if (req.op === 'create') {
      return (
        isVerifiedOwner(userId) &&
        isValidId(userId) &&
        hasAllKeys(data, ['id']) &&
        hasOnlyKeys(data, allowedKeys) &&
        validShape
      );
    }
    if (req.op === 'update') {
      const changed = affectedKeys(data, req.existingData || {});
      return (
        isVerifiedOwner(userId) &&
        validShape &&
        isValidId(userId) &&
        changed.every((k) => allowedKeys.includes(k))
      );
    }
    return false;
  }

  // `/users/{userId}/settings/{settingId}`
  if (segs[2] === 'settings' && segs.length === 4) {
    const settingId = segs[3];
    const allowedKeys = [
      'id',
      'userId',
      'settings',
      'settingsRevision',
      'memoriesMigratedV2',
      'jewelMetrics',
      'jewelRevision',
      'userProfile',
      'profileRevision',
      'updatedAt',
    ];
    if (req.op === 'get') return isOwner(userId) && settingId === 'app';
    if (req.op === 'list') return false;
    if (req.op === 'delete') return isVerifiedOwner(userId) && settingId === 'app';
    const data = req.incomingData || {};
    const valid =
      (!('id' in data) || data.id === 'app') &&
      (!('userId' in data) || data.userId === userId) &&
      (!('settings' in data) || (typeof data.settings === 'object' && data.settings !== null));
    if (req.op === 'create') {
      return (
        isVerifiedOwner(userId) &&
        settingId === 'app' &&
        hasAllKeys(data, ['id', 'userId']) &&
        hasOnlyKeys(data, allowedKeys) &&
        valid
      );
    }
    if (req.op === 'update') {
      const changed = affectedKeys(data, req.existingData || {});
      return (
        isVerifiedOwner(userId) &&
        valid &&
        settingId === 'app' &&
        changed.every((k) => allowedKeys.includes(k))
      );
    }
  }

  // `/users/{userId}/conversations/{conversationId}`
  if (segs[2] === 'conversations' && segs.length === 4) {
    const convId = segs[3];
    const allowedKeys = [
      'id',
      'title',
      'modelId',
      'type',
      'participantEntityIds',
      'deletedMessageIds',
      'messages',
      'createdAt',
      'updatedAt',
      'revision',
      'isDeleted',
    ];
    if (req.op === 'list') return isOwner(userId);
    if (req.op === 'get') return isOwner(userId) && isValidId(convId);
    if (req.op === 'delete') return isVerifiedOwner(userId) && isValidId(convId);

    const data = req.incomingData || {};
    const valid =
      typeof data.id === 'string' &&
      data.id === convId &&
      (!('title' in data) || (typeof data.title === 'string' && data.title.length <= 500)) &&
      (!('deletedMessageIds' in data) ||
        (Array.isArray(data.deletedMessageIds) && data.deletedMessageIds.length <= 100));

    if (req.op === 'create') {
      return (
        isVerifiedOwner(userId) &&
        isValidId(convId) &&
        hasAllKeys(data, ['id']) &&
        hasOnlyKeys(data, allowedKeys) &&
        valid
      );
    }
    if (req.op === 'update') {
      const changed = affectedKeys(data, req.existingData || {});
      return (
        isVerifiedOwner(userId) &&
        valid &&
        isValidId(convId) &&
        changed.every((k) => allowedKeys.includes(k))
      );
    }
  }

  // `/users/{userId}/conversations/{conversationId}/messages/{messageId}`
  if (segs[2] === 'conversations' && segs[4] === 'messages' && segs.length === 6) {
    const convId = segs[3];
    const msgId = segs[5];
    const allowedKeys = [
      'id',
      'conversationId',
      'role',
      'parts',
      'timestamp',
      'revision',
      'publicText',
      'thoughtText',
      'thoughtStatus',
      'finishReason',
      'backend',
      'reaction',
      'searchResults',
      'generatedImages',
      'scribbles',
      'musicTracks',
      'authorEntityId',
      'authorDisplayName',
      'authorAvatar',
      'isDeleted',
    ];
    if (req.op === 'list') return isOwner(userId);
    if (req.op === 'get') return isOwner(userId) && isValidId(convId) && isValidId(msgId);
    if (req.op === 'delete')
      return isVerifiedOwner(userId) && isValidId(convId) && isValidId(msgId);

    const data = req.incomingData || {};
    const parentPath = `users/${userId}/conversations/${convId}`;
    const parentExistsAfter = Boolean(req.afterStatePaths?.has(parentPath));
    const valid =
      data.id === msgId &&
      data.conversationId === convId &&
      ['user', 'model'].includes(data.role) &&
      Array.isArray(data.parts) &&
      data.parts.length >= 1 &&
      typeof data.timestamp === 'number';

    if (req.op === 'create') {
      return (
        isVerifiedOwner(userId) &&
        isValidId(convId) &&
        isValidId(msgId) &&
        hasAllKeys(data, ['id', 'conversationId', 'role', 'parts', 'timestamp']) &&
        hasOnlyKeys(data, allowedKeys) &&
        valid &&
        parentExistsAfter
      );
    }
    if (req.op === 'update') {
      const changed = affectedKeys(data, req.existingData || {});
      return (
        isVerifiedOwner(userId) &&
        valid &&
        isValidId(convId) &&
        isValidId(msgId) &&
        changed.every((k) => allowedKeys.includes(k)) &&
        parentExistsAfter
      );
    }
  }

  // `/users/{userId}/companions/{companionId}/memories/{memoryId}`
  if (segs[2] === 'companions' && segs[4] === 'memories' && segs.length === 6) {
    const compId = segs[3];
    const memId = segs[5];
    const allowedKeys = [
      'id',
      'content',
      'createdAt',
      'updatedAt',
      'revision',
      'scope',
      'entityId',
      'origin',
      'author',
      'modelId',
      'caption',
      'isLocked',
      'lockReason',
      'isDeleted',
    ];
    if (req.op === 'list') return isOwner(userId);
    if (req.op === 'get') return isOwner(userId) && isValidId(compId) && isValidId(memId);
    if (req.op === 'delete')
      return isVerifiedOwner(userId) && isValidId(compId) && isValidId(memId);

    const data = req.incomingData || {};
    const valid =
      data.id === memId &&
      typeof data.content === 'string' &&
      data.content.length >= 1 &&
      data.scope === 'companion' &&
      typeof data.entityId === 'string' &&
      data.entityId.length >= 1 &&
      (!('author' in data) || data.author === 'model');

    if (req.op === 'create') {
      return (
        isVerifiedOwner(userId) &&
        isValidId(compId) &&
        isValidId(memId) &&
        hasAllKeys(data, ['id', 'content', 'createdAt', 'scope', 'entityId']) &&
        hasOnlyKeys(data, allowedKeys) &&
        valid
      );
    }
  }

  // `/users/{userId}/gifts/{giftId}`
  if (segs[2] === 'gifts' && segs.length === 4) {
    const giftId = segs[3];
    if (req.op === 'list') return isOwner(userId);
    if (req.op === 'get') return isOwner(userId) && isValidId(giftId);
    if (req.op === 'delete') return isVerifiedOwner(userId) && isValidId(giftId);
  }

  return false;
}

describe('Firestore Zero-Trust Security Rules & Blueprint Audit', () => {
  const rulesText = fs.readFileSync(RULES_PATH, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf8'));

  it('enforces rules_version 2, global default-deny catch-all, and removes permissive wildcard fallback', () => {
    expect(rulesText).toContain("rules_version = '2';");
    expect(rulesText).toMatch(/match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/);
    // The old vulnerable fallback `request.auth.uid != null` MUST NOT exist anywhere
    expect(rulesText).not.toContain('request.auth.uid != null');
    expect(rulesText).not.toMatch(/match\s+\/\{allSubcollections=\*\*\}/);
  });

  it('aligns every Firestore path in firebase-blueprint.json with explicit match blocks and validation helpers', () => {
    const blueprintPaths = Object.keys(blueprint.firestore || {});
    expect(blueprintPaths).toEqual(
      expect.arrayContaining([
        '/users/{userId}',
        '/users/{userId}/settings/{settingId}',
        '/users/{userId}/memories/{memoryId}',
        '/users/{userId}/gifts/{giftId}',
        '/users/{userId}/companions/{companionId}',
        '/users/{userId}/companions/{companionId}/memories/{memoryId}',
        '/users/{userId}/conversations/{conversationId}',
        '/users/{userId}/conversations/{conversationId}/messages/{messageId}',
      ])
    );

    // Every allow update block must invoke its isValid[Entity] helper AND affectedKeys().hasOnly(...)
    const updateBlocks = rulesText.split('allow update: if').slice(1);
    expect(updateBlocks.length).toBe(8);
    for (const block of updateBlocks) {
      const ruleBody = block.split('allow ')[0];
      expect(ruleBody).toMatch(/isValid[A-Za-z]+Doc\(/);
      expect(ruleBody).toContain('incoming().diff(existing()).affectedKeys().hasOnly(');
    }
  });

  it('allows verified owner operations across conversations, messages, private companion memories, and settings', () => {
    const alice: SimulatedAuth = {
      uid: 'uid-alice',
      email: 'alice@example.com',
      email_verified: true,
    };

    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/conversations/conv-101',
        op: 'create',
        auth: alice,
        incomingData: { id: 'conv-101', title: 'Sanctuary', updatedAt: 1700000000000 },
      })
    ).toBe(true);

    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/conversations/conv-101/messages/msg-1',
        op: 'create',
        auth: alice,
        afterStatePaths: new Set(['users/uid-alice/conversations/conv-101']),
        incomingData: {
          id: 'msg-1',
          conversationId: 'conv-101',
          role: 'user',
          parts: [{ text: 'Hello' }],
          timestamp: 1700000000100,
        },
      })
    ).toBe(true);

    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/companions/gemini-3.1-pro-preview/memories/mem-1',
        op: 'create',
        auth: alice,
        incomingData: {
          id: 'mem-1',
          content: 'Private companion observation',
          createdAt: 1700000000200,
          scope: 'companion',
          entityId: 'gemini-3.1-pro-preview',
          author: 'model',
        },
      })
    ).toBe(true);
  });

  it('denies all 12 "Dirty Dozen" unauthorized, cross-user, spoofed, shadow-field, and poisoned payloads', () => {
    const aliceUnverified: SimulatedAuth = {
      uid: 'uid-alice',
      email: 'alice@example.com',
      email_verified: false,
    };
    const mallory: SimulatedAuth = {
      uid: 'uid-mallory',
      email: 'mallory@example.com',
      email_verified: true,
    };
    const spoofedOwnerUnverified: SimulatedAuth = {
      uid: 'uid-mallory',
      email: 'ahatley094@gmail.com',
      email_verified: false,
    };

    // 1. Unauthenticated read
    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/conversations/conv-1',
        op: 'get',
        auth: null,
      })
    ).toBe(false);

    // 2. Cross-user conversation read
    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/conversations/conv-1',
        op: 'get',
        auth: mallory,
      })
    ).toBe(false);

    // 3. Cross-user message write
    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/conversations/conv-1/messages/msg-1',
        op: 'create',
        auth: mallory,
        afterStatePaths: new Set(['users/uid-alice/conversations/conv-1']),
        incomingData: {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          parts: [{ text: 'Injected' }],
          timestamp: 1,
        },
      })
    ).toBe(false);

    // 4. Cross-user private companion memory list scrape
    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/companions/gemini-3.1-pro-preview/memories/any',
        op: 'list',
        auth: mallory,
      })
    ).toBe(false);

    // 5. Cross-user gift deletion
    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/gifts/gift-1',
        op: 'delete',
        auth: mallory,
      })
    ).toBe(false);

    // 6. Cross-user settings overwrite
    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/settings/app',
        op: 'update',
        auth: mallory,
        existingData: { id: 'app', userId: 'uid-alice', settings: {} },
        incomingData: { id: 'app', userId: 'uid-alice', settings: { systemInstruction: 'Pwned' } },
      })
    ).toBe(false);

    // 7. Unverified email write by owner
    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/conversations/conv-1',
        op: 'create',
        auth: aliceUnverified,
        incomingData: { id: 'conv-1', title: 'Blocked' },
      })
    ).toBe(false);

    // 8. Spoofed owner email read with email_verified == false
    expect(
      evaluateFirestoreRule({
        path: 'users/ahatley094@gmail.com',
        op: 'get',
        auth: spoofedOwnerUnverified,
      })
    ).toBe(false);

    // 9. Wildcard root fallback probe
    expect(
      evaluateFirestoreRule({
        path: 'arbitrary_root_collection/doc-1',
        op: 'get',
        auth: { uid: 'uid-alice', email: 'ahatley094@gmail.com', email_verified: true },
      })
    ).toBe(false);

    // 10. Shadow/Ghost field injection (`isVerified: true`) on update
    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/conversations/conv-1',
        op: 'update',
        auth: { uid: 'uid-alice', email: 'alice@example.com', email_verified: true },
        existingData: { id: 'conv-1', title: 'Old' },
        incomingData: { id: 'conv-1', title: 'New', isVerified: true },
      })
    ).toBe(false);

    // 11. Value / Size poisoning (non-string title or >100 tombstones)
    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/conversations/conv-1',
        op: 'update',
        auth: { uid: 'uid-alice', email: 'alice@example.com', email_verified: true },
        existingData: { id: 'conv-1', title: 'Old' },
        incomingData: { id: 'conv-1', title: 999999 },
      })
    ).toBe(false);

    // 12. Orphaned message write without parent conversation existing in batch/DB
    expect(
      evaluateFirestoreRule({
        path: 'users/uid-alice/conversations/conv-orphan/messages/msg-1',
        op: 'create',
        auth: { uid: 'uid-alice', email: 'alice@example.com', email_verified: true },
        afterStatePaths: new Set(), // Parent conv-orphan missing!
        incomingData: {
          id: 'msg-1',
          conversationId: 'conv-orphan',
          role: 'user',
          parts: [{ text: 'Orphan' }],
          timestamp: 1700000000000,
        },
      })
    ).toBe(false);
  });
});
