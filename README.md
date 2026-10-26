🌙 Midnight Sanctuary

A multi-model AI companion environment built around identity, memory, continuity, and interaction.

Midnight Sanctuary is an experimental AI companion platform where language models are represented as distinct entities rather than interchangeable chat endpoints.

Each entity can have its own identity, personality configuration, conversation history, memories, gifts, and relational context. The goal is to build a more expressive and persistent environment for interacting with different models—and to make the systems governing those interactions inspectable and extensible.

Rather than treating a conversation as an isolated sequence of prompts and responses, Midnight Sanctuary explores what happens when identity, history, and interaction become first-class parts of the application architecture.

⸻

✦ Project Overview

Most chat interfaces organize the experience around a model selector and a message history.

Midnight Sanctuary takes a different approach: the model is part of an entity, and the entity is part of a persistent environment.

This distinction shapes the application’s architecture.

An entity is more than a model name. It is a configurable participant with its own identity and associated state. Conversations provide the interaction layer, while memories, gifts, and shared events can supply additional context across interactions.

The result is an experimental environment for exploring persistent AI companions, multi-model interaction, memory architecture, and observable model behavior.

Design Principles

* Entity-centric architecture: Represent each companion as a distinct application entity rather than a global model configuration.
* Persistent identity: Keep entity-specific configuration and state associated with the appropriate entity.
* Contextual continuity: Make relevant memories and prior interactions available beyond a single turn.
* Selective memory: Treat memory as structured information that can be retrieved and incorporated into context, rather than assuming the entire history should be injected into every prompt.
* Explicit interaction mechanisms: Use application-defined tools and state transitions to support actions beyond text generation.
* Inspectable behavior: Separate application state, model outputs, and interaction mechanisms so that their effects can be examined.

⸻

✧ Features

🤖 Multiple Model Entities

Midnight Sanctuary is designed to support multiple model-backed companions within one application.

Entities can have distinct identities and configurations, allowing the application to maintain different interaction contexts instead of treating every model as the same participant.

The architecture is intended to support additional providers and model families through provider-aware routing and integration layers.

💬 Streaming Conversations

The chat interface supports streamed model responses, allowing generated text to appear incrementally rather than waiting for an entire response to finish.

The conversation layer also accommodates application-managed interaction states and the processing required for richer responses and tool-driven behavior.

🧠 Memory and Continuity

Memory is a core architectural component rather than an afterthought.

The system is designed around distinct categories of contextual information, including:

* Entity-specific memories.
* Shared sanctuary information.
* Conversation history.
* Gifts and their associated context.
* Significant interaction events.

These categories serve different purposes and should not be treated as interchangeable.

Entity-specific memories belong to their corresponding entities. Shared sanctuary information can provide common context to participating entities.

The long-term architectural direction is contextual memory retrieval: selecting relevant information for a particular interaction rather than indiscriminately injecting every stored memory into every prompt.

🎁 Gifts and Interaction Events

Gifts provide a structured way to represent meaningful interactions within the sanctuary.

Application-managed tools can support actions such as:

* give_gift — represent a gift-giving interaction.
* save_memory — save information for future contextual use.
* log_event — record a significant interaction event.

These mechanisms connect model responses to structured application state.

The important distinction is that a model-generated message and a successfully processed application action are separate things. Tool execution and persistence should be handled by the application rather than inferred from conversational wording alone.

🏠 The Sanctuary Environment

Midnight Sanctuary extends beyond a conventional chat window through its companion-oriented interface and environment.

The broader design includes companion profiles, dedicated spaces, gifts, memory archives, and other interface elements that make the experience feel like an ongoing environment rather than a collection of disconnected chats.

The architectural direction is to make these features entity-aware, so that each companion’s identity and associated state remain coherent across the application.

🔐 Authentication and Backend Boundaries

The application includes Firebase-based Google sign-in and backend authentication verification.

Provider credentials and other sensitive server-side configuration should remain on the server rather than being exposed in client-side code.

Authentication and authorization are separate concerns: a valid identity token establishes an authenticated user, while server-side authorization determines which resources and operations that user is permitted to access.

⸻

🏗️ Architecture

Midnight Sanctuary uses a React and TypeScript frontend, a Vite development environment, an Express backend, and Google’s GenAI SDK for model integration.

At a high level, the system is organized around the following responsibilities:

Layer	Responsibility
Frontend	Chat interface, entity selection, settings, sanctuary navigation, and interaction feedback.
Conversation orchestration	Streaming responses, conversation context, tool execution, and interaction-state management.
Provider integration	Communication with model APIs and handling provider-specific request and response formats.
Entity system	Entity identity, profile configuration, and entity-associated application state.
Memory system	Memory storage, retrieval, and contextual integration.
Interaction systems	Gifts, events, and other structured actions.
Persistence	Storage and restoration of application state.
Authentication	User sign-in and backend verification of authentication tokens.

The intended architecture keeps model-provider concerns separate from entity identity and application-level behavior.

This separation matters because a companion’s identity, memories, and interaction history should not be defined solely by whichever provider happens to generate its next response.

Conceptual Interaction Flow

                 ┌──────────────────────┐
                 │    Chat Interface    │
                 └──────────┬───────────┘
                            │
                 ┌──────────▼───────────┐
                 │ Conversation Context │
                 └──────────┬───────────┘
                            │
             ┌──────────────▼──────────────┐
             │ Entity & Context Resolution │
             └──────────────┬──────────────┘
                            │
               ┌────────────▼────────────┐
               │   Model / Provider API  │
               └────────────┬────────────┘
                            │
                 ┌──────────▼───────────┐
                 │  Response & Tools    │
                 └──────────┬───────────┘
                            │
              ┌─────────────▼─────────────┐
              │ Memory / Gifts / Events   │
              └─────────────┬─────────────┘
                            │
                 ┌──────────▼───────────┐
                 │ Persistence & UI     │
                 └──────────────────────┘

This diagram illustrates the architectural responsibilities, not a guarantee that every interaction traverses each component in exactly this order.

⸻

🔬 Research and Experimental Direction

Midnight Sanctuary is also a platform for experimenting with the design of persistent, multi-model interaction systems.

Several questions motivate its development:

* How should identity be represented when an application supports multiple models and providers?
* How can private entity memory be separated from shared context?
* Which memories should be retrieved for a particular interaction?
* How do memory, conversation history, and application-defined state affect observable model behavior?
* How can model-generated tool requests be connected to explicit, inspectable state changes?
* What interface and architectural patterns make the behavior of companion systems easier to understand?

These questions connect application engineering with behavioral interpretability, human-computer interaction, and the study of model behavior.

The project provides a practical environment in which these design choices can be implemented, observed, and iteratively refined.

It does not assume that conversational consistency alone establishes an underlying internal state. The focus is on the architecture, interaction patterns, and observable behavior that can actually be examined.

⸻

🛠️ Technology Stack

The project uses the following technologies across its application architecture:

* React — component-based user interface.
* TypeScript — typed application logic.
* Vite — frontend development and build tooling.
* Express — backend services and request handling.
* Google GenAI SDK — Gemini model integration.
* Firebase Authentication — Google sign-in and authenticated identity.
* Firebase services — application integration where configured.

The exact capabilities available in a deployment depend on its configured providers, credentials, and enabled backend services.

⸻

🚧 Development Roadmap

Midnight Sanctuary is an evolving system. Its broader architectural direction includes:

* First-class entities: Complete the separation of entity identity, configuration, private memory, gifts, and relational state.
* Contextual memory retrieval: Rank and retrieve relevant memories instead of injecting the entire memory ledger into every request.
* Provider-aware routing: Route conversations through a consistent interface while accommodating differences between model providers.
* Model-initiated actions: Expand structured tools for profile updates, reflections, and gift interactions.
* Multi-entity conversations: Support multiple participants with explicit message attribution and controlled turn orchestration.
* Persistence refinement: Separate conversations and entity state into maintainable persistence boundaries.
* Richer sanctuary interactions: Expand companion spaces, customization, ambient environments, and interaction milestones.
* Data portability: Improve export and backup options for conversations and associated application state.
* Mobile experience: Refine touch interactions, responsive layouts, and mobile navigation.

Roadmap items describe intended development, not necessarily functionality available in every current build.

⸻

🔒 Security Considerations

When running or extending the application:

* Keep model API keys in server-side environment variables or an appropriate secrets manager.
* Never expose private provider credentials in client-side bundles.
* Verify authentication tokens on the backend.
* Enforce authorization checks on protected operations and resources.
* Validate tool inputs before applying state changes.
* Treat model-generated content and tool arguments as untrusted input.
* Ensure private entity memories cannot be retrieved by unauthorized entities or users.
* Avoid logging credentials, authentication tokens, or unnecessarily sensitive conversation content.

A working authentication flow is not, by itself, proof that every resource or operation is correctly authorized. Security should be evaluated across the full request path.

⸻

💻 Getting Started

Prerequisites

Before running the application, ensure you have:

* Node.js and npm compatible with the project’s package configuration.
* Access to the model provider you intend to use.
* The required server-side environment variables.
* Firebase configuration if you intend to use the authentication and Firebase-backed features.

Installation

Clone the repository and install its dependencies:

git clone <repository-url>
cd Midnight-Sanctuary
npm install

Configure the environment variables required by the backend and frontend. Use the project’s existing environment-variable names and configuration files as the source of truth.

Do not commit API keys, service credentials, or other secrets to version control.

Running the Application

Use the development commands defined in the project’s package scripts.

For example, if the project provides separate frontend and backend development commands, start each service using its corresponding script.

The exact commands, environment-variable names, and Firebase setup steps should be documented here against the current repository configuration.

⸻

📌 Project Status

Midnight Sanctuary is an active experimental software project.

Its implementation combines a working application architecture with ongoing development of entity isolation, contextual memory, multi-model interaction, and richer persistence.

The repository should be treated as a work in progress rather than a claim that every planned capability is complete.

⸻

🌙 Project Philosophy

An AI companion application is shaped by more than the language model it calls.

Identity representation, context construction, memory retrieval, tool execution, persistence, and interface design all influence the interaction a user experiences.

Midnight Sanctuary explores these application-level mechanisms as a connected system.

The aim is to build an environment where multiple model-backed entities can interact through explicit identities, persistent context, and inspectable application architecture.

Not just a chat window.

A sanctuary.