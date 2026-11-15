# Phase A — Midnight Sanctuary Persistence Architecture Audit

## 1. Inspected Stack & Persistence Pathways

Every layer of the existing persistence and authentication stack was inspected prior to implementation:

- **Client State & Store (`src/lib/store.ts`, `src/context/AppContext.tsx`)**:
  - Hydrates initial `conversations` from `localStorage.getItem('sanctuary_conversations_cache')`, `currentId` from `localStorage.getItem('sanctuary_current_conv_id')`, and `profile` from `localStorage.getItem('sanctuary_user_profile')`.
  - Subscribes to Firebase Auth via `onAuthStateChanged(auth, ...)`.
  - Attaches Firestore listeners via `subscribeToState(user.uid, ...)` in `src/lib/persistenceSystem.ts`.
  - Runs BOTH immediate granular writes (`saveMessageDoc`, `saveConversationDoc`, `saveGiftDoc`, `saveProfileDoc`, `deleteMessageDoc`, `deleteConversationDocs`) AND a 1,000 ms debounced full-state catch-all (`saveSettings(user.uid, payload)` -> `saveFullGranularState`).
- **Firestore Persistence Module (`src/lib/persistenceSystem.ts`, `src/lib/firebase.ts`)**:
  - Enables Firestore `persistentLocalCache` with `persistentMultipleTabManager`.
  - Maintains 4 top-level `onSnapshot` listeners (`settings/app`, `conversations`, `gifts`, `companions`) plus N nested `conversations/{convId}/messages` listeners.
  - Performs one-time monolithic legacy check on `users/{uid}` (and `users/{email}`).
- **Entity, Memory & Gift Isolation (`src/lib/entitySystem.ts`, `src/lib/memorySystem.ts`, `src/lib/giftSystem.ts`, `src/lib/vectorMemory.ts`)**:
  - `entitySystem.ts` resolves sovereign companion profiles from `DEFAULT_ENTITIES` overlaid with `customEntities[identityId]`.
  - `memorySystem.ts` logically filters `settings.memories` into user memories (`author === 'user'`) and model memories (`author === 'model'` matching `normalizeMemoryNamespace(modelId)`), excluding unassigned legacy memories from context.
  - Physical storage previously collapsed all user, model, and legacy memories into a single `settings.memories` array inside `users/{uid}/settings/app`.
- **Chat Streaming & Server Context Hydration (`src/hooks/useChatStream.ts`, `src/backend/firestoreContext.service.ts`, `src/backend/gemini.service.ts`, `src/backend/verifyAuth.ts`)**:
  - `useChatStream.ts` generates optimistic UUIDs for user and model turns, streaming chunks into `onUpdateMessage` and persisting to Firestore only when `thoughtStatus === 'complete' | 'error'` (plus the competing 1,000 ms store debounce).
  - `firestoreContext.service.ts` verifies the Bearer ID token via Identity Toolkit and reads `users/{uid}/settings/app`, `users/{uid}/gifts`, `users/{uid}/conversations/{convId}`, and `messages` via the Firestore REST API, merging with `req.body` fallback context.
- **Firestore Security Rules (`firestore.rules`, `firebase-blueprint.json`)**:
  - `firestore.rules` previously contained a permissive root wildcard rule:
    `match /{document=**} { allow read, write: if request.auth != null && (request.auth.token.email == 'ahatley094@gmail.com' || request.auth.uid != null); }`
    Because `request.auth.uid != null` is true for every authenticated Firebase user, any signed-in user had full read/write access to arbitrary paths not shadowed, and email checks lacked `email_verified == true`.

---

## 2. Verified Failure Mechanisms

1. **Competing Full-State vs. Granular Writes (`store.ts` lines 329–375 vs. lines 806–1005)**:
   - Every state update schedules `saveFullGranularState` after 1,000 ms, rewriting `settings/app`, all `companions/*`, all `gifts/*`, and the first 15 `conversations/*` documents.
   - If a granular `deleteConversationDocs`, `deleteMessageDoc`, or companion update executes while an older debounced timer or slow request is in flight, the full-state write can resurrect deleted records or overwrite newer fields.
   - Furthermore, `saveFullGranularState` sliced `payload.conversations.slice(0, 15)`, silently skipping conversations beyond index 15.
2. **Destructive Local Cache Truncation & Cross-Account Bleed (`store.ts` lines 38–88, 106–136)**:
   - `localStorage` was not scoped by `uid` (risking cross-user state bleed on account switch).
   - `store.ts` truncated cached conversations to 30 threads and 40 messages per thread while stripping `inlineData` attachments, `data:` generated images, and `thoughtSignature` fields.
3. **Dual Message Representation Drift (`persistenceSystem.ts` lines 272–320, 567–622)**:
   - Conversation documents store a 25-message inline `messages` preview array alongside the `messages/{msgId}` subcollection without tombstones (`deletedMessageIds`) or monotonic revisions.
   - When `regenerateMessage` truncates trailing messages (`updateConversation(id, { messages: sliced })`), `saveConversationDoc` updates the preview while `deleteMessageDoc` fires asynchronously; an in-flight snapshot from either source can re-merge deleted messages back into state.
4. **Unjournaled Fire-and-Forget Writes & Stream Interruption Loss**:
   - All Firestore writes in `store.ts` use `.catch(console.error)` with no durable write-ahead journal, no retry backoff, and no tracking of uncommitted mutations.
   - Closing or refreshing the browser while offline or mid-write permanently loses uncommitted messages if `localStorage` quota fails or strips attachments.
   - During long streaming responses, intermediate chunks are never checkpointed to durable local storage, so refreshing mid-stream loses partial responses.
5. **Collapsed Global Memory Store**:
   - Storing all shared user memories and all companions' private memories inside `users/{uid}/settings/app.settings.memories` lacks collection-level isolation and risks hitting Firestore's 1 MB document size limit as memories grow.
6. **Permissive Firestore Rules Fallback**:
   - Wildcard `request.auth.uid != null` rule violated least-privilege ownership isolation, and rules lacked schema/type/size validation and `email_verified` enforcement.

---

## 3. Target Ownership & Consolidated Architecture

| Domain Entity | Local Authoritative Store (`IndexedDB`) | Cloud Authoritative Path (`Firestore`) | Isolation Scope |
| :--- | :--- | :--- | :--- |
| Write-Ahead Queue | `mutation_journal` (`uid`-scoped) | Flushed via `CloudPersistenceAdapter` | Per-UID ordered WAL |
| Conversations | `conversations` (`uid`-scoped) | `users/{uid}/conversations/{convId}` | User-owned + tombstones |
| Messages | `messages` (`uid`-scoped, full fidelity) | `users/{uid}/conversations/{convId}/messages/{msgId}` | Thread-scoped, atomic batch with preview |
| Companion State | `companions` (`uid`-scoped) | `users/{uid}/companions/{companionId}` | Sovereign per-entity |
| Private Memories | `companion_memories` (`uid` + `companionId`) | `users/{uid}/companions/{companionId}/memories/{memId}` | Sovereign per-entity |
| Shared Memories | `shared_memories` (`uid`-scoped) | `users/{uid}/memories/{memId}` | Shared Sanctuary (user-authored) |
| Gifts | `gifts` (`uid`-scoped) | `users/{uid}/gifts/{giftId}` | Namespace-isolated per companion |
| Settings & Jewel | `user_state` (`uid`-scoped) | `users/{uid}/settings/app` | User-owned configuration |
