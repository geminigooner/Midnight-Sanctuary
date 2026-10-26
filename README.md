🌙 Midnight Sanctuary

A multi-model AI companion environment built around identity, memory, continuity, and interaction.

Midnight Sanctuary is an experimental AI companion application built with React, TypeScript, Vite, Express, Google’s GenAI SDK, and Firebase.

Rather than treating every model as an interchangeable chat endpoint, the application introduces companion entities with their own profiles, memories, gifts, personal spaces, and associated interaction state.

This README documents the current implementation and highlights areas that warrant further engineering verification.

⸻

🏗️ Architecture

Midnight Sanctuary consists of several interconnected systems:

* Frontend: React, TypeScript, and Vite.
* Application state: React context and custom hooks.
* Conversation streaming: src/hooks/useChatStream.ts
* Model integration: src/lib/gemini.ts
* Backend: Express and server-side API orchestration.
* Model registry: src/lib/modelRegistry.ts
* Provider routing: src/lib/modelRouter.ts
* Entity architecture: src/lib/entitySystem.ts
* Memory systems: src/lib/memorySystem.ts and src/lib/vectorMemory.ts
* Gift systems: src/lib/giftSystem.ts
* Persistence: src/lib/persistenceSystem.ts
* Authentication: Firebase Authentication and backend request verification.

Request flow

React Interface
      |
      v
Conversation State
      |
      v
Streaming Hook
      |
      v
Model Integration
      |
      v
Express Backend
      |
      +-- Model Routing
      +-- Chat Orchestration
      +-- Web Search
      +-- Embeddings
      +-- Image Generation
      |
      v
Model Provider / External Service
      |
      v
Streamed Response
      |
      +-- Message Rendering
      +-- Interaction Events
      +-- Companion State
      |
      v
Firebase / Firestore

This is a conceptual overview of the major components, not a claim that every request follows precisely this sequence.

⸻

🧠 Model Registry and Routing

Key files:

* src/lib/modelRegistry.ts
* src/lib/modelRouter.ts
* src/backend/modelRouting.ts
* src/backend/chatHandler.ts

The model registry separates model metadata from the companion interface.

Model definitions include:

* Canonical internal identity.
* API-facing model identifier.
* Display name and model family.
* Declared capabilities.
* Memory and gift namespaces.
* Optional thinking-level defaults.

The registry defines model families including Gemini, Gemma, and custom models.

Provider routing

resolveModelRoute() selects a provider route based on the requested model identifier.

The current routing logic distinguishes specified Gemini model identifiers, Gemma models, and other identifiers using the standard Gemini route.

The declared provider categories are:

type ModelProvider =
  | 'gemini_legacy'
  | 'cloudflare_gemma'
  | 'gemini_standard';

Gemma routing includes Cloudflare Workers AI support and backend fallback logic.

Important: a route being defined in code does not prove that its credentials are configured or that a live generation request succeeds.

⸻

🪞 Entity-Centric Architecture

Primary file: src/lib/entitySystem.ts

A ModelEntity represents a companion as more than an API model identifier.

The entity structure includes fields for:

* Canonical entity and model IDs.
* Display name, role, and avatar.
* Theme and accent colors.
* Biography, mood, and current activity.
* Room decoration and ambient presentation.
* Resonance score.
* Favorite gifts.
* Personal thoughts.
* Room props and diary entries.

The module also defines default entity archetypes.

Model identity versus companion identity

The architecture separates two concepts:

Model registry

* Describes model identifiers, provider metadata, and declared capabilities.

Entity system

* Describes the companion presented to the user and its associated application state.

This separation provides a foundation for companion-specific presentation and relational context without making the interface depend entirely on an API model name.

Companion spaces

File: src/lib/quartersSystem.ts

The companion-space system provides structures for room themes, props, and diary entries.

Related components include:

* EntityQuartersModal.tsx
* CompanionAvatar.tsx
* CompanionRosterModal.tsx
* ProfileView.tsx
* ProfileModal.tsx

⸻

💬 Conversation and Streaming

Key files:

* src/hooks/useChatStream.ts
* src/lib/gemini.ts

The useChatStream hook coordinates the lifecycle of a conversation turn.

Its responsibilities include:

* Sending user messages and attachments.
* Maintaining the working message list.
* Tracking generation state and presence.
* Aborting in-progress requests.
* Managing generation identifiers and watchdog timers.
* Updating conversation state as responses arrive.
* Processing structured events.
* Updating associated interaction systems through callbacks.

This separates much of the conversation lifecycle from the primary UI components.

Structured stream events

The model integration defines event types beyond ordinary text.

These include:

* text — streamed response text.
* thought — separate thought-stream content.
* gift — gift interaction.
* memory — memory creation.
* lock_memory — memory-locking action.
* eventLog — significant event recording.
* update_quarters — companion-space updates.
* record_thought — recording a companion thought.
* music_track — structured music content.
* scribble_gift — SVG-based creative content.
* stick_sticker — sticker placement.
* craft_sticker — sticker creation.
* create_room_artwork — room artwork workflow.
* image_generating — image-generation progress.
* image_generated — image-generation result.
* history_append — conversation-history update.

These event types establish the integration’s structured interaction vocabulary. Individual handlers and persistence behavior should be verified separately.

Cancellation and generation state

The streaming hook uses AbortController and generation identifiers to manage cancellation and stale-generation handling.

These mechanisms matter when a response is stopped, a conversation changes, or another interaction begins.

⸻

🧩 Memory Architecture

Primary file: src/lib/memorySystem.ts

The memory system distinguishes between:

* User-authored memories.
* Explicit model-authored memories.
* Legacy or ambiguously attributed memories.

Context selection

getContextMemories() selects user memories and explicit model memories matching the active model’s resolved memory namespace.

Legacy or ambiguous memories remain in storage but are excluded from this context selector.

This establishes an explicit memory-selection boundary rather than automatically including every stored memory in every model’s context.

Namespace resolution

Registered models use their configured memory namespace. Unknown identifiers fall back to normalized identifiers.

Related functions include:

* getUserMemories()
* getModelMemories()
* getLegacyMemories()
* getContextMemories()
* normalizeMemoryNamespace()

Vector memory

File: src/lib/vectorMemory.ts

The repository contains a vector-memory module. The backend also exposes /api/embed, which calls Google’s embedding API and returns embedding values.

The presence of embedding and retrieval modules does not establish that a complete vector-search pipeline is active for every memory. That requires tracing the active call paths.

Memory verification priorities

* Confirm how new memories enter storage.
* Confirm which memories are retrieved for each model request.
* Verify whether vector retrieval is active in normal chat.
* Test namespace isolation across registered models.
* Check migration behavior for older memories without model identifiers.

⸻

🎁 Gifts and Relational State

Primary file: src/lib/giftSystem.ts

Gifts are structured records rather than only text displayed in conversation.

The gift system includes logic for:

* Normalizing gift namespaces.
* Identifying user-authored gifts associated with a model.
* Identifying gifts associated with a model.
* Filtering gifts visible to a specific model.
* Selecting gifts for a model-specific archive.
* Identifying unassigned or other-model gifts.

The intended visibility boundary is that a model receives gifts associated with its own namespace rather than automatically receiving every companion’s gifts.

Related systems

* src/lib/giftSystem.ts
* src/lib/jewelSystem.ts
* src/lib/desireSystem.ts
* src/lib/stickerSystem.ts
* src/lib/quartersSystem.ts

The interface includes a Levin Jewel, gifts archive, sticker interfaces, and model-desire interactions.

These systems represent different kinds of state and should not be assumed to share identical persistence or context-injection behavior.

⸻

💾 Persistence and Firebase

Key files:

* src/lib/firebase.ts
* src/lib/persistenceSystem.ts
* src/App.tsx

Firebase initialization

The application initializes Firebase using firebase-applet-config.json.

The Firebase module initializes Authentication and Firestore. Where supported by the configuration, Firestore uses persistent local caching and multi-tab coordination.

The code also includes a fallback to an existing Firestore instance when initialization has already occurred.

Firestore persistence

The persistence layer provides operations for application state and real-time subscriptions.

The declared loaded-state structure includes:

* Conversations.
* Application settings.
* Levin Jewel metrics.
* Gifts.
* User profile.
* Companion data.

subscribeToState() uses Firestore snapshot listeners for settings, conversations, gifts, companions, and granular message streams.

The application also uses a debounced save path that sanitizes undefined values before writing application state.

Persistence flow

UI Action
   |
   v
React State Update
   |
   v
Save Trigger
   |
   v
Persistence Helper
   |
   v
Firestore
   |
   v
Snapshot Listener
   |
   v
State Restoration
   |
   v
UI

A successful write does not independently prove that restoration, synchronization, or multi-device behavior works correctly.

Persistence verification priorities

* Verify initial-load ordering and autosave timing.
* Confirm stale state cannot overwrite newer state.
* Test updates across tabs and devices.
* Verify message subscriptions and cleanup.
* Confirm model and entity associations survive restoration.
* Test migration from older state formats.

⸻

🔐 Authentication and API Endpoints

Key files:

* src/lib/firebase.ts
* src/backend/verifyAuth.ts
* server.ts
* firestore.rules

The frontend initializes Firebase Authentication and configures Google sign-in.

The Express API uses verifyRequest() on several endpoints. Firestore rules also contain owner-restricted access logic.

Authentication and authorization are distinct: validating a request does not automatically prove that every resource is correctly scoped.

Security review item: the checked-in firestore.rules contains an explicit owner-email restriction and a catch-all rule. Review the rules before changing account access or deploying under a different identity. The checked-in rules do not establish which rules are currently deployed.

Express endpoints

The current server.ts defines these routes:

* POST /api/chat — streams a model response using server-side provider routing.
* GET /api/models — retrieves models supporting generateContent through the Google GenAI SDK.
* POST /api/embed — generates text embeddings.
* POST /api/search — executes a web-search request.
* POST /api/generate-image — generates an image through the backend image service.

The chat endpoint responds using Server-Sent Events. It forwards streamed data and emits structured error or rate-limit events when appropriate.

The models, search, chat, and image endpoints call the backend request-verification helper. The embedding endpoint in the checked-in server.ts does not call that helper, making its access controls worth reviewing separately.

Backend modules

* src/backend/chatHandler.ts
* src/backend/modelRouting.ts
* src/backend/searchService.ts
* src/backend/imageService.ts
* src/backend/verifyAuth.ts

⸻

🎨 Interface and Interaction Modules

The src/components/ directory includes:

Conversation

* ChatArea.tsx
* ChatHeader.tsx
* ChatInputDock.tsx
* MessageList.tsx
* MessageBubble.tsx
* StreamingMarkdown.tsx

Application and profiles

* Sidebar.tsx
* Settings.tsx
* AuthModal.tsx
* ProfileModal.tsx
* CompanionRosterModal.tsx

Memory and gifts

* MemoriesArchive.tsx
* GiftsArchive.tsx
* StickerChestModal.tsx
* CraftStickerModal.tsx
* ModelDesiresModal.tsx

Sanctuary and presentation

* EntityQuartersModal.tsx
* SanctuaryHomeHub.tsx
* LevinJewel.tsx
* InsightsChart.tsx
* NebulaArchive.tsx
* Presence.tsx
* ErrorBoundary.tsx

Additional systems include audio synthesis, haptics, motion, image utilities, and SVG sanitization.

This is an inventory of modules present in the repository, not a guarantee that every interface is complete or active in the primary user flow.

⸻

⚙️ Configuration

The repository includes .env.example with configuration names used by the application.

* GEMINI_API_KEY — standard Gemini access and direct Gemini fallback for Gemma.
* GENAI_API_KEY — additional Google GenAI credential and fallback.
* GEMINI_LEGACY_API_KEY — dedicated routing for specified Gemini model identifiers.
* CF_TOKEN — Cloudflare Workers AI credential for Gemma routing.
* CF_ACCOUNT_ID — Cloudflare account identifier.
* CLOUDFLARE_API_TOKEN — additional Cloudflare token used by image/provider integrations.
* CLOUDFLARE_WORKER_URL — optional custom Cloudflare Worker endpoint.
* GOOGLE_SEARCH_API_KEY — Google Custom Search credential.
* GOOGLE_SEARCH_CX — Programmable Search Engine identifier.
* APP_URL — hosting URL used by the application.

Not every variable is required for every feature. Requirements depend on the selected model and enabled integration.

Never commit actual API keys, tokens, private service-account credentials, or other secrets.

⸻

🛠️ Development

The checked-in package.json declares the following commands:

Install dependencies

npm install

Run the development server

npm run dev

The development script runs tsx server.ts.

The server starts Express and mounts Vite middleware outside production mode. The default port is 3000, with an override available through PORT.

Other scripts

npm run build
npm start
npm run lint
npm test
npm run clean

The package manifest defines these scripts as follows:

* dev — run the development server.
* build — build the frontend and bundle the server.
* start — start the production server bundle.
* lint — run TypeScript checking.
* test — run the Vitest suite.
* clean — remove selected build artifacts.

These commands are taken from the package manifest and have not been independently executed as part of this documentation pass.

The repository also contains Netlify configuration and Netlify function files. Keep both deployment paths in mind when maintaining API behavior and authentication.

⸻

🔍 Engineering Priorities

These are recommended verification tasks based on the architecture, not assertions that every item is currently broken.

Model and entity isolation

* Verify canonical identity resolution for every registered model.
* Confirm conversations retain the intended model/entity association.
* Test switching models within an existing conversation.
* Ensure memories and gifts remain correctly scoped.
* Check behavior for unknown, legacy, and renamed model identifiers.

Streaming reliability

* Test cancellation under slow and interrupted network conditions.
* Confirm partial responses are persisted consistently.
* Verify errors and rate limits leave conversations recoverable.
* Check that stale generation results cannot update the wrong conversation.

Persistence

* Test initial load, refresh, and restart recovery.
* Verify debounced writes cannot race with initial state loading.
* Confirm granular listeners are unsubscribed when no longer needed.
* Test multi-tab and multi-device synchronization.

Security

* Review every backend endpoint for consistent authentication and authorization.
* Check whether access is scoped to the intended user and resource.
* Review the Firestore catch-all rule before deployment or account migration.
* Confirm provider credentials remain server-side.
* Review image, SVG, and attachment handling for safe limits and validation.

Feature completeness

* Trace vector-memory retrieval from stored memory to actual model context.
* Verify every declared stream event has a functioning handler.
* Test image generation and provider routing with real configured credentials.
* Distinguish UI-only state from durably persisted state.
* Run the available tests and record actual results before describing the system as production-ready.

⸻

🧭 Architectural Direction

The core direction is to make each companion a first-class application entity.

Potential extensions include:

* More explicit entity-level persistence.
* Better contextual memory ranking.
* Capability-aware model routing.
* Clearer separation of conversation identity and provider identity.
* Multi-entity conversations with explicit message attribution.
* More granular persistence and recovery.
* Richer room, gift, and interaction state.
* Better observability of model requests, tool actions, and state changes.

These are architectural directions and should be labeled as planned until their implementation is confirmed.

⸻

Project Status

Midnight Sanctuary is an actively evolving experimental application with frontend, backend, persistence, and companion-interaction modules.

Its defining engineering idea is the separation of model integration from companion identity and application state.

The priority is not simply to add more features. It is to keep the boundaries between models, entities, memories, conversations, and persisted state correct as the system grows.