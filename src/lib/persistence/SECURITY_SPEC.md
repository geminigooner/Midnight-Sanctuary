# Midnight Sanctuary — Firestore Security Specification

## 1. Data Ownership & Security Invariants

1. **Default-Deny Catch-All**: Every path not explicitly matched under `/users/{userId}` is unconditionally denied (`allow read, write: if false;`). The legacy wildcard fallback (`match /{document=**} { allow read, write: if ... request.auth.uid != null; }`) is permanently removed.
2. **Strict UID Ownership**: Every user-owned document and subcollection under `/users/{userId}` requires `request.auth != null && request.auth.uid == userId`. Cross-user reads, lists, writes, and deletes (`uid_B` accessing `/users/uid_A/...`) are unconditionally denied across Conversations, Messages, Companion Memories, Shared Memories, Gifts, Companions, Settings, and User profiles.
3. **Verified Email Requirement**: All standard write operations (`create`, `update`, `delete`) require `request.auth.token.email_verified == true`. Any email-based legacy recovery read on `/users/ahatley094@gmail.com` also requires `request.auth.token.email_verified == true`.
4. **Parent-Child Relational Integrity**:
   - Message documents (`/users/{userId}/conversations/{conversationId}/messages/{messageId}`) require `incoming().conversationId == conversationId` AND `existsAfter(/databases/$(database)/documents/users/$(userId)/conversations/$(conversationId))`.
   - Private companion memory documents (`/users/{userId}/companions/{companionId}/memories/{memoryId}`) require `incoming().scope == 'companion'`, `incoming().author == 'model'`, and bounded `entityId` matching the canonical companion identity.
5. **Anti-Update-Gap & Shadow-Field Prevention**:
   - Every `create` enforces `incoming().keys().hasAll(...)` and `incoming().keys().hasOnly(...)` plus `isValid[Entity](incoming(), ...)`.
   - Every `update` wraps logic in `isValid[Entity](incoming(), ...)` AND enforces `incoming().diff(existing()).affectedKeys().hasOnly(...)` so ghost/shadow fields (e.g., `isAdmin: true`, `isVerified: true`) and type/size poisoning are blocked.
6. **ID Poisoning & Bounded Collections**:
   - Every single-document path variable is validated via `isValidId(id)` (`1..128` chars, safe regex, non-dot).
   - Every string and list property has explicit `.size() <= MAX` bounds.

## 2. Adversarial "Dirty Dozen" Payloads (Must All Return `PERMISSION_DENIED`)

1. **Unauthenticated Read** on `/users/uid-alice/conversations/conv-1`.
2. **Cross-User Conversation Read** (`uid-mallory` reading `/users/uid-alice/conversations/conv-1`).
3. **Cross-User Message Write** (`uid-mallory` creating `/users/uid-alice/conversations/conv-1/messages/msg-1`).
4. **Cross-User Companion Memory Scrape** (`uid-mallory` listing `/users/uid-alice/companions/gemini-3.1-pro-preview/memories`).
5. **Cross-User Gift Delete** (`uid-mallory` deleting `/users/uid-alice/gifts/gift-1`).
6. **Cross-User Settings Overwrite** (`uid-mallory` updating `/users/uid-alice/settings/app`).
7. **Unverified Email Write** (`uid-alice` with `email_verified: false` writing `/users/uid-alice/conversations/conv-1`).
8. **Spoofed Owner Email Read** (`uid-mallory` with `email: 'ahatley094@gmail.com'`, `email_verified: false` reading `/users/ahatley094@gmail.com`).
9. **Wildcard Root Fallback Probe** (`uid-alice` writing `/arbitrary_root_collection/doc-1`).
10. **Shadow/Ghost Field Injection** (`uid-alice` updating `/users/uid-alice/conversations/conv-1` with `{ isVerified: true }`).
11. **Value/Size Poisoning** (`uid-alice` updating `/users/uid-alice/conversations/conv-1` with `title: 99999` or oversized `deletedMessageIds` > 100 items).
12. **Orphaned / Mismatched Parent Message Write** (`uid-alice` creating `/users/uid-alice/conversations/conv-1/messages/msg-1` with `conversationId: 'conv-other'` or without parent conversation existing).
