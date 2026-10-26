🌙 Midnight Sanctuary

A multi-model companion environment built around identity, memory, continuity, and interaction.

Midnight Sanctuary is an experimental AI companion application built with React, TypeScript, Vite, Express, Google’s GenAI SDK, and Firebase.

The application treats model-backed companions as entities with configurable identities, profiles, memories, gifts, personal spaces, and associated interaction state. It combines streamed conversations with application-managed tools, provider routing, and persistent user data.

This document describes the implementation represented by the current codebase, identifies the major systems, and records areas that warrant further verification.

⸻

1. Architecture at a Glance

Layer	Implementation	Primary responsibility
Frontend	React 19, TypeScript, Vite	Application interface and interaction
Application state	React context and custom hooks	Shared state and UI coordination
Conversation streaming	src/hooks/useChatStream.ts	Message lifecycle, streamed responses, interaction events
Model integration	src/lib/gemini.ts	Client-side chat orchestration and streaming protocol
Backend	Express	Authenticated API endpoints and server-side orchestration
Model registry	src/lib/modelRegistry.ts	Model definitions, capabilities, canonical identities, namespaces
Provider routing	src/lib/modelRouter.ts	Provider and credential-selection rules
Entity architecture	src/lib/entitySystem.ts	Companion identity, profiles, rooms, and associated state
Memory	src/lib/memorySystem.ts, src/lib/vectorMemory.ts	Memory classification, contextual selection, retrieval
Gifts	src/lib/giftSystem.ts	Model-associated gift classification and filtering
Persistence	src/lib/persistenceSystem.ts	Firestore storage, subscriptions, and restoration
Authentication	src/lib/firebase.ts, src/backend/verifyAuth.ts	Firebase initialization and authentication integration
Visual interaction systems	src/lib/ and src/components/	Rooms, stickers, gifts, resonance, audio, and other features

Main application flow

React interface
      │
      ▼
Conversation state and useChatStream
      │
      ▼
Client-side model integration
      │
      ▼
Authenticated Express API
      │
      ├── Model routing
      ├── Chat orchestration
      ├── Web search
      ├── Embeddings
      └── Image generation
      │
      ▼
Provider API / external service
      │
      ▼
Streamed events and model response
      │
      ├── Render messages
      ├── Update companion state
      ├── Process interaction events
      └── Update application state
      │
      ▼
Firebase / Firestore persistence

This is a conceptual overview of the major components, not a claim that every request follows precisely this sequence.

⸻

2. Model Registry and Provider Routing

Model registry

File: src/lib/modelRegistry.ts

The registry defines model metadata independently of the interface. Its ModelDefinition structure includes:

* Canonical internal identity.
* API-facing model identifier.
* Display name and model family.
* Capability flags.
* Namespace identifiers for memories, gifts, profiles, and events.
* Optional default thinking level and description.

The declared model families are gemini, gemma, and custom.

Capability flags cover system instructions, tool calling, vision, thinking, and streaming. These flags describe the application’s model definitions; they should not be treated as independent proof that a provider currently supports every declared capability.

Provider routing

File: src/lib/modelRouter.ts

resolveModelRoute() selects a route based on the requested model identifier.

The current routing logic distinguishes:

1. Gemini 3.1 Pro and matching Gemini 3 Flash identifiers.
2. Gemma models.
3. Other model identifiers, which use the standard Gemini route.

The route definition includes the provider category, expected environment-variable name, target model identifier, and model-family flags.

The current route categories are:

type ModelProvider =
  | 'gemini_legacy'
  | 'cloudflare_gemma'
  | 'gemini_standard';

Gemma is designated for Cloudflare Workers AI routing, with direct Gemini API fallback handled by the backend orchestration. The server also contains credential fallback logic for other routes.

Important distinction: route selection, credential selection, successful provider authentication, and successful generation are separate operations. A route existing in code does not establish that its credentials or upstream service are configured correctly.

Relevant files

* src/lib/modelRegistry.ts
* src/lib/modelRouter.ts
* src/lib/gemini.ts
* src/backend/modelRouting.ts
* src/backend/chatHandler.ts
* server.ts
* netlify/functions/chat.ts
* netlify/functions/models.ts

⸻

3. Entity-Centric Companion Architecture

Primary file: src/lib/entitySystem.ts

A ModelEntity represents a companion as more than an API model identifier.

Its defined fields include:

* Canonical entity ID and API model ID.
* Display name, role title, and avatar.
* Theme and accent colors.
* Biography, mood status, and current activity.
* Room decoration and ambient presentation.
* Resonance score.
* Favorite gift identifiers.
* Personal thoughts.
* Room props and diary entries.

The module defines default entity archetypes and their initial configuration.

Why this matters

The model registry and entity system serve different purposes:

* Model registry: describes a model’s identity, routing metadata, and declared capabilities.
* Entity system: describes the companion presented to the user and its associated application state.

This separation provides a foundation for maintaining companion-specific presentation and relational context without making the user interface depend entirely on a model’s API name.

Companion spaces

File: src/lib/quartersSystem.ts

The companion-space system supplies structures for room themes, props, and diary entries. Related interface components include:

* EntityQuartersModal.tsx
* CompanionAvatar.tsx
* CompanionRosterModal.tsx
* ProfileView.tsx
* ProfileModal.tsx

The application also includes systems for updating entity room information and recording personal thoughts.

⸻

4. Conversation and Streaming

Stream orchestration

File: src/hooks/useChatStream.ts

The hook coordinates the lifecycle of a conversation turn.

Its responsibilities include:

* Sending user messages and attachments.
* Maintaining the working message list.
* Tracking generation state and presence.
* Aborting in-progress requests.
* Managing generation identifiers and watchdog timers.
* Updating conversation state as responses arrive.
* Processing structured events returned by the model integration.
* Updating associated interaction systems through callbacks.

The hook accepts conversation data, settings, gifts, profile information, and resonance metrics, alongside callbacks for updating messages and application state.

This keeps much of the conversation lifecycle outside the primary UI components.

Stream event protocol

File: src/lib/gemini.ts

The integration defines structured event types beyond ordinary text.

The declared event categories include:

Event	Purpose
text	Streamed response text
thought	Separate thought-stream content
gift	Gift interaction
memory	Memory creation
lock_memory	Memory-locking action
eventLog	Significant event recording
update_quarters	Companion-space updates
record_thought	Recording a companion thought
music_track	Structured music content
scribble_gift	SVG-based creative content
stick_sticker	Sticker placement
craft_sticker	Sticker creation
create_room_artwork	Room artwork workflow
image_generating	Image-generation progress
image_generated	Image-generation result
history_append	Conversation-history update

These event types establish the integration’s structured interaction vocabulary. Individual event handlers and their persistence behavior should be evaluated separately when verifying a feature end to end.

Request cancellation

The streaming hook uses AbortController and generation identifiers to manage cancellation and stale-generation handling. It also tracks the conversation associated with the active generation.

These mechanisms are important when the user stops a response, changes conversations, or initiates another interaction.

⸻

5. Memory Architecture

File: src/lib/memorySystem.ts

The memory system classifies memories by authorship, origin, and model association.

The current implementation distinguishes:

* User-authored memories.
* Explicit model-authored memories.
* Legacy or ambiguously attributed memories.

Context selection

getContextMemories() returns:

1. User memories.
2. Explicit model memories matching the active model’s resolved memory namespace.

Legacy or ambiguous memories are retained in storage but excluded from this active context selector.

This is an important isolation rule: the implementation does not simply include every stored memory in every model’s context.

Namespace resolution

Memory namespaces are resolved through the model identity system. Registered models use their configured memory namespace; unknown identifiers fall back to normalized identifiers.

Related functions include:

* getUserMemories()
* getModelMemories()
* getLegacyMemories()
* getContextMemories()
* normalizeMemoryNamespace()

Vector memory

File: src/lib/vectorMemory.ts

The repository also contains a vector-memory module. The backend exposes an /api/embed endpoint that calls Google’s embedding API and returns embedding values.

The existence of embedding and retrieval modules does not, by itself, establish that every memory is embedded, indexed, or retrieved through a complete vector-search pipeline. That should be confirmed by tracing the active call paths.

Memory verification priorities

* Confirm the exact path by which new memories enter storage.
* Confirm which memory sources are retrieved for each model request.
* Verify whether vector retrieval is active in the normal chat path.
* Test namespace isolation across all registered models.
* Check migration behavior for older memories with missing model identifiers.

⸻

6. Gifts and Relational State

File: src/lib/giftSystem.ts

Gifts are structured records rather than just text displayed in the conversation.

The module provides logic for:

* Normalizing gift namespaces.
* Identifying gifts authored by the user for a particular model.
* Identifying gifts associated with a model.
* Filtering gifts visible to a specific model.
* Selecting gifts for a model-specific archive.
* Identifying unassigned or other-model gifts.

The intended visibility boundary is explicit: a model should receive gifts associated with its own namespace, rather than automatically receiving every companion’s gifts.

Gift creation and related state updates are connected to the application’s shared state through callbacks.

Related systems

* src/lib/giftSystem.ts
* src/lib/jewelSystem.ts
* src/lib/desireSystem.ts
* src/lib/stickerSystem.ts
* src/lib/quartersSystem.ts

The interface also contains a Levin Jewel, gifts archive, sticker interfaces, and model-desire interactions.

These systems represent different kinds of application state and should not be assumed to share identical persistence or context-injection behavior.

⸻

7. Persistence and Firebase

Firebase initialization

File: src/lib/firebase.ts

The application initializes Firebase using firebase-applet-config.json.

The module initializes Firebase Authentication and Firestore. Where supported by the configuration, Firestore is initialized with persistent local caching and multi-tab coordination.

The code also includes a fallback to an existing Firestore instance if initialization has already occurred.

Firestore persistence

File: src/lib/persistenceSystem.ts

The persistence layer includes operations for application state and real-time subscriptions.

The declared loaded-state structure includes:

* Conversations.
* Application settings.
* Levin Jewel metrics.
* Gifts.
* User profile.
* Companion data.

subscribeToState() uses Firestore snapshot listeners for settings, conversations, gifts, companions, and granular message streams. The module also contains document and collection operations for storing and retrieving application data.

In App.tsx, the application uses a debounced save path that sanitizes undefined values before writing the application payload through saveSettings().

Persistence is more than a single save call

When debugging persistence, trace the entire path:

UI action
   ↓
React state update
   ↓
Save trigger / subscription
   ↓
Persistence helper
   ↓
Firestore document or collection
   ↓
Snapshot listener
   ↓
State restoration
   ↓
UI

A successful write does not independently prove that restoration, real-time synchronization, model isolation, or multi-device behavior is correct.

Persistence verification priorities

* Verify initial-load ordering and autosave timing.
* Confirm the first save cannot overwrite newer state with stale data.
* Test simultaneous updates from multiple tabs or devices.
* Verify message-level subscriptions and cleanup.
* Confirm model and entity associations survive save-and-restore cycles.
* Test migration from older state formats.

⸻

8. Authentication and API Endpoints

Authentication

Files:

* src/lib/firebase.ts
* src/backend/verifyAuth.ts
* server.ts
* firestore.rules

The frontend initializes Firebase Authentication and configures Google sign-in.

The Express API calls verifyRequest() on several endpoints before continuing. Firestore rules also contain owner-restricted access logic.

Authentication and authorization are distinct: validating a request does not automatically prove that every data-access rule is correctly scoped.

Security note: the current firestore.rules contains an explicit owner-email restriction and a catch-all rule. Review these rules carefully before changing account access or deploying under a different identity. The ZIP’s Firestore rules are evidence of the checked-in policy, not proof of the effective rules currently deployed in Firebase.

Express endpoints

The current server.ts defines these API routes:

Endpoint	Method	Purpose
/api/chat	POST	Stream a model response using server-side provider routing
/api/models	GET	Retrieve models supporting generateContent through the Google GenAI SDK
/api/embed	POST	Generate text embeddings
/api/search	POST	Execute a web-search request
/api/generate-image	POST	Generate an image through the backend image service

The chat endpoint responds using Server-Sent Events. It forwards streamed data from the chat handler and emits structured error or rate-limit events when appropriate.

The models, search, chat, and image endpoints call the backend request-verification helper. The embedding endpoint, in the checked-in server.ts, does not call that helper; treat this as a security-review item rather than assuming all API routes share the same authentication boundary.

Backend modules

* src/backend/chatHandler.ts
* src/backend/modelRouting.ts
* src/backend/searchService.ts
* src/backend/imageService.ts
* src/backend/verifyAuth.ts

⸻

9. Interface and Interaction Modules

The src/components/ directory contains the main interface elements, including:

* ChatArea.tsx
* ChatHeader.tsx
* ChatInputDock.tsx
* MessageList.tsx
* MessageBubble.tsx
* StreamingMarkdown.tsx
* Sidebar.tsx
* Settings.tsx
* AuthModal.tsx
* MemoriesArchive.tsx
* GiftsArchive.tsx
* EntityQuartersModal.tsx
* CompanionRosterModal.tsx
* SanctuaryHomeHub.tsx
* LevinJewel.tsx
* InsightsChart.tsx
* NebulaArchive.tsx
* StickerChestModal.tsx
* CraftStickerModal.tsx
* ModelDesiresModal.tsx
* Presence.tsx
* ErrorBoundary.tsx

Additional systems include audio synthesis, haptics, motion, image utilities, and SVG sanitization.

This is an inventory of modules present in the repository, not a guarantee that every interface is complete or that each module is active in the primary user flow.

⸻

10. Configuration

The repository includes .env.example with configuration names used by the application.

Variable	Intended role in the current code
GEMINI_API_KEY	Standard Gemini access and direct Gemini fallback for Gemma
GENAI_API_KEY	Additional Google GenAI credential and fallback
GEMINI_LEGACY_API_KEY	Dedicated routing for specified Gemini model identifiers
CF_TOKEN	Cloudflare Workers AI credential for Gemma routing
CF_ACCOUNT_ID	Cloudflare account identifier
CLOUDFLARE_API_TOKEN	Additional Cloudflare token used by image/provider integrations
CLOUDFLARE_WORKER_URL	Optional custom Cloudflare Worker endpoint
GOOGLE_SEARCH_API_KEY	Google Custom Search credential
GOOGLE_SEARCH_CX	Programmable Search Engine identifier
APP_URL	Hosting URL used by the application

Not every variable is required for every feature. Exact requirements depend on the chosen model and enabled integration.

The checked-in example contains placeholders; it does not prove that a credential exists or that a provider is configured.

Never commit actual API keys, tokens, private service-account credentials, or other secrets. Configure secrets in the relevant local or deployment environment.

⸻

11. Development Commands

The checked-in package.json declares these scripts:

npm install
npm run dev

The development script runs:

tsx server.ts

The server starts Express and mounts Vite middleware outside production mode. Its default port is 3000, with an override available through PORT.

Other scripts

npm run build
npm start
npm run lint
npm test
npm run clean

Their declared purposes are:

Script	Command	Purpose
dev	tsx server.ts	Run the development server
build	vite build && esbuild ...	Build the frontend and bundle the server
start	node dist/server.cjs	Start the production server bundle
lint	tsc --noEmit	Run TypeScript checking
test	vitest run	Run the Vitest suite
clean	rm -rf dist server.js	Remove selected build artifacts

These commands are taken from the repository’s package manifest; they have not been independently executed as part of this documentation pass.

The project also contains a Netlify configuration and Netlify function files. The presence of both deployment paths should be considered when maintaining API behavior and authentication.

⸻

12. Current Engineering Priorities

These are recommended verification tasks based on the architecture and checked-in implementation, not assertions that each item is currently broken.

Model and entity isolation

* Verify canonical model identity resolution for every registered model.
* Confirm conversations retain the intended model/entity association.
* Test switching models within an existing conversation.
* Ensure memories and gifts remain correctly scoped.
* Check behavior for unknown, legacy, and renamed model identifiers.

Streaming reliability

* Test stop-generation behavior under slow and interrupted network conditions.
* Confirm partial responses are persisted consistently.
* Verify that errors and rate limits leave the conversation in a recoverable state.
* Check that switching conversations cannot apply stale generation results to the wrong conversation.

Persistence

* Test first-load, refresh, and restart recovery.
* Verify debounced writes cannot race with initial state loading.
* Confirm granular listeners are unsubscribed when no longer needed.
* Test multi-tab and multi-device synchronization.

Security

* Review every backend endpoint for consistent authentication and authorization.
* Check whether authorization is scoped to the intended user and resource.
* Review the Firestore catch-all rule before any deployment or account migration.
* Confirm all provider credentials remain server-side.
* Review image, SVG, and attachment handling for safe limits and validation.

Feature completeness

* Trace the vector-memory retrieval path from stored memory to actual model context.
* Verify each declared stream event has a functioning handler.
* Test image generation and provider routing against real configured credentials.
* Distinguish UI-only state from state that is durably persisted.
* Run the available tests and record actual results before describing the system as production-ready.

⸻

13. Architectural Direction

The core direction is to make each companion a first-class application entity.

That direction can be extended through:

* More explicit entity-level persistence.
* Better contextual memory ranking.
* Capability-aware model routing.
* Clearer separation of conversation identity and provider identity.
* Multi-entity conversations with explicit message attribution.
* More granular persistence and recovery.
* Richer room, gift, and interaction state.
* Better observability of model requests, tool actions, and state changes.

These are architectural directions; they should be labeled as planned until their implementation is confirmed.

⸻

Project Status

Midnight Sanctuary is an actively evolving experimental application with a substantial set of implemented frontend, backend, persistence, and companion-interaction modules.

Its defining engineering idea is the separation of model integration from companion identity and application state.

The next step is not simply to add more features. It is to keep the boundaries between models, entities, memories, conversations, and persisted state correct as the system grows.