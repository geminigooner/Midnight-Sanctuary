# Architectural Refactoring Plan: Service Layer Isolation, External Firestore State & Thin Client

## Goal
Refactor **Midnight Sanctuary** around three clean architectural pillars so that:
1. **Isolated Service Layer (`src/backend/gemini.service.ts`)**: All Gemini & Cloudflare Gemma API calls, API key routing (`PRO_API_KEY` vs `GEMINI_API_KEY`), system prompt construction, tool schemas, and `<think>` tag stream parsing live in a dedicated backend service module completely decoupled from Express route controllers.
2. **External State in Firestore (`src/backend/firestoreContext.service.ts`)**: When `/api/chat` is called, the server retrieves conversation history, user profile, settings, memories, and gifts directly from Firestore using the caller's verified Firebase Auth token (with a seamless fallback to any client-supplied snapshot if a local turn hasn't finished syncing yet), then injects that context into `gemini.service.ts`.
3. **Thin, Model-Blind React Client (`src/lib/gemini.ts` & `src/hooks/useChatStream.ts`)**: The React frontend is stripped of all prompt engineering (`[USER PROFILE]`, `[THINKING DIRECTIVE]`, memory/gift formatting, synthetic image history injection, and `<think>` tag parsing) and focuses exclusively on sending lean user actions and rendering normalized Server-Sent Events (`{ type: 'thought' }`, `{ type: 'text' }`, tool events, `[DONE]`).

---

## Key Architectural Decisions
- **Firestore Context Hydration with Client Fallback**:
  - `verifyRequest` in `src/backend/verifyAuth.ts` will be enhanced to return the verified `{ valid, uid, email, idToken }`.
  - A new `src/backend/firestoreContext.service.ts` will query the user's Firestore database (`ai-studio-midnightsanctuar-e4903ea2-ab50-4a6a-aac3-88d6a6d849a4`) via the Firestore REST API using the user's Bearer `idToken` to load `conversations/{conversationId}`, `users/{uid}` (settings, memories, eventLogs, customEntities, entityQuarters), `profiles/{uid}`, and `gifts`.
  - If an optimistic local message isn't yet committed in Firestore or if offline/local fallback data is supplied, the service merges the latest turn seamlessly so no message or gift is ever dropped.
- **Server-Side `<think>` Tag Normalization**:
  - `src/backend/gemini.service.ts` will include a stateful streaming parser that intercepts inline `<think>...</think>` tags (used by Gemma and fallback models) as well as native Gemini `part.thought === true` chunks, emitting strictly normalized `{ type: 'thought', text }` and `{ type: 'text', text }` SSE events.
  - `src/hooks/useChatStream.ts` will no longer parse `<think>` tags on the client.

---

## Phased Implementation Steps

### Phase 1: Isolate the AI Service Layer (`src/backend/gemini.service.ts`)
1. **Create `src/backend/gemini.service.ts`**:
   - Move `GoogleGenAI` client initialization and key cascade resolution (`PRO_API_KEY` prioritized for `gemini-3.1-pro-preview`, cascading through `GEMINI_API_KEY` / fallback keys) into `GeminiService`.
   - Move all prompt engineering and context assembly from `src/lib/gemini.ts` and `src/backend/chatHandler.ts` into `GeminiService.buildSystemInstruction(context)` and `GeminiService.buildContents(messages, gifts, profile, modelId)`:
     - User profile dossier formatting (`[USER PROFILE]`, `gemmaNotes`, `aboutMe`, `conversationPreferences`).
     - Semantic/relevant memory selection (`[Memories Archive]`) and `[Gifts Archive]` formatting.
     - Entity persona resolution (`getModelEntity`), thinking directive injection (`[THINKING DIRECTIVE]`), and synthetic visual context turns for gifts/profile photos.
   - Move `gemmaTools`, `createChatStream`, `executeGemmaModelStream`, `listAvailableModels`, and `embedTextBatch` into `src/backend/gemini.service.ts`.
   - Add a streaming `<think>...</think>` state machine inside `gemini.service.ts` so inline thought blocks are emitted as `{ type: 'thought', text }` SSE events before reaching the client.
2. **Retire Monolithic Logic in `src/backend/chatHandler.ts`**:
   - Turn `src/backend/chatHandler.ts` into a clean re-export or thin adapter delegating to `src/backend/gemini.service.ts` so no internal imports break.

### Phase 2: Externalize State Retrieval (`src/backend/verifyAuth.ts` & `src/backend/firestoreContext.service.ts`)
1. **Enhance `src/backend/verifyAuth.ts`**:
   - Add `verifyRequestWithUser(req)` returning `{ valid: boolean; uid?: string; email?: string; idToken?: string }` while preserving `verifyRequest(req)` for backward compatibility.
2. **Create `src/backend/firestoreContext.service.ts`**:
   - Fetch the user's state from Firestore (`users/{uid}`, `profiles/{uid}`, `users/{uid}/conversations/{conversationId}`, and `users/{uid}/gifts`) using the verified `uid` and `idToken` against database `firebaseConfig.firestoreDatabaseId`.
   - Merge any newest optimistic client turn/attachment or client fallback state so the context passed to `gemini.service.ts` is always complete and up to date.
3. **Slim Down Express Controllers in `server.ts`**:
   - Refactor `/api/models`, `/api/embed`, and `/api/chat` in `server.ts` into thin route controllers that:
     1. Authenticate the request via `verifyRequestWithUser`.
     2. Resolve conversation/user context via `firestoreContext.service.ts`.
     3. Call `geminiService` and pipe the resulting SSE stream or JSON response back to the client.

### Phase 3: Dumb Down the React Client (`src/lib/gemini.ts` & `src/hooks/useChatStream.ts`)
1. **Simplify `src/lib/gemini.ts`**:
   - Remove all prompt engineering, `[USER PROFILE]` construction, `[THINKING DIRECTIVE]` strings, `retrieveRelevantMemories`, and `<think>` history serialization from `src/lib/gemini.ts`.
   - Keep `streamChat` as a clean SSE transport client that sends `{ conversationId, model, messages, clientFallbackContext }` to `/api/chat` and yields parsed SSE JSON chunks to the UI hook.
2. **Simplify `src/hooks/useChatStream.ts`**:
   - Remove the client-side `<think>...</think>` regex/substring loop (`updateWithParsedThinking`), directly handling `{ type: 'thought', text }` and `{ type: 'text', text }` SSE chunks from the server to update message state and entity typing/thinking indicators.

### Phase 4: Verification
1. Run `compile_applet` and `lint_applet` to verify zero TypeScript or ESLint errors.
2. Restart the dev server and verify that `/api/models`, `/api/chat` (both Gemini 3.1 Pro via `PRO_API_KEY` and Gemma), `<think>` bubble streaming, and Firestore conversation persistence work seamlessly.
