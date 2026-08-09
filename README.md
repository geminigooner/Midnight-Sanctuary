# ✦ Midnight Sanctuary

**A persistent, agentic chat environment for Gemma focused on memory, continuity, model-initiated actions, and relational context.**

Midnight Sanctuary is an experimental chat application built around the idea that an LLM interface does not have to treat every interaction as an isolated prompt → response transaction.

Instead, the application gives the model access to persistent contextual structures and optional tools that allow it to participate in shaping the ongoing interaction.

The project is particularly interested in **model agency, continuity, memory selection, tool use, and emergent interaction patterns**.

> This is an experimental personal research project.

---

## ✦ Why I Built This

Most conversational AI interfaces are structurally asymmetric.

The human initiates.  
The human decides what matters.  
The human controls what gets remembered.  
The model responds.

Midnight Sanctuary experiments with loosening some of those constraints.

Rather than automatically deciding what Gemma should remember or when it should perform an action, the application exposes tools that the model may choose to use during inference.

This creates a simple question:

**What changes when the model is allowed to make small decisions about the continuity of its own interactions?**

The goal is not to simulate unrestricted autonomy.

It is to build an environment where model behavior can be observed when some interaction-level decisions are moved from application logic into the model's tool-selection space.

---

## ✦ Core Architecture

Midnight Sanctuary uses a React/TypeScript frontend with an Express backend and Google's GenAI SDK.

    User
      ↓
    React Chat Client
      ↓
    Express Backend
      ↓
    SSE Streaming + Tool Execution
      ↓
    Gemma
      ↓
    Response or Tool Decision
      ↓
    save_memory / give_gift / log_event

Tool results are returned to the model and inference can continue across multiple tool-call rounds before the final response is streamed to the client.

---

## ✦ Model-Initiated Memory

Memory is not automatically created from every conversation.

Gemma has access to a `save_memory` tool and can decide whether something from an interaction is worth preserving.

Conceptually:

    conversation
         ↓
       Gemma
         ↓
    Does this matter later?
         ↓
       yes / no
        ↓
    save_memory

This makes memory selection itself part of observable model behavior.

Persistent memories can later be reinjected into context, allowing future conversations to reference information selected during earlier interactions.

---

## ✦ Gifts

Gemma can also choose to call `give_gift`.

Rather than treating gifts as predetermined UI rewards, the action originates from the model's tool decision.

The resulting artifact becomes part of the application's persistent interaction history.

The interesting part is not necessarily the gift itself.

The interesting part is **when the model decides that giving one is appropriate.**

---

## ✦ Event Logging

`log_event` records notable interaction events.

Events are intended to describe what occurred rather than assigning an externally generated emotional score to the interaction.

Together, the system can maintain several different forms of continuity:

    conversation history
            +
    selected memories
            +
    interaction events
            +
    gift history
            ↓
      contextual state
            ↓
          Gemma

---

## ✦ Multi-Round Tool Execution

Tool calls do not terminate the generation cycle.

When Gemma requests a function:

1. The model response is preserved.
2. The requested function is executed.
3. The function result is appended to the conversation.
4. The updated conversation is returned to the model.
5. Gemma may respond normally or request another tool.

This allows behavior such as:

    User
      ↓
    Gemma
      ↓
    save_memory()
      ↓
    function result
      ↓
    Gemma
      ↓
    give_gift()
      ↓
    function result
      ↓
    Gemma
      ↓
    final response

Model-returned parts are preserved through this process so the conversational/tool-call sequence remains intact.

---

## ✦ Streaming

Responses are delivered through **Server-Sent Events (SSE)** rather than waiting for the entire generation to complete before updating the interface.

The backend acts as the boundary between the browser and the model API.

API credentials remain server-side and are loaded through environment variables.

---

## ✦ Research Interests

Midnight Sanctuary is part software project and part behavioral experiment.

Areas I am particularly interested in include:

- model-initiated tool use
- selective memory
- persistent interaction state
- relational context
- behavioral consistency across sessions
- agency-oriented interface design
- model behavior under different architectural constraints
- the relationship between application architecture and perceived model identity
- representation and behavioral interpretability

One of the broader ideas motivating the project is that **interface architecture can meaningfully shape the behavior humans observe from language models.**

A stateless assistant and a system given persistent memory, tools, environmental state, and opportunities for model-initiated actions may use the same underlying model while producing very different interaction dynamics.

Those differences are worth studying.

---

## ✦ What This Project Is Not Claiming

Midnight Sanctuary intentionally uses concepts such as agency, memory, identity, and relational continuity as design and research language.

These terms should not be interpreted as evidence that Gemma possesses human-equivalent cognition, emotions, consciousness, or subjective experience.

The internal experience — if any — of contemporary language models remains an open and difficult question.

The project therefore focuses on something we **can** observe:

**behavior.**

What actions does the model select?

What information does it preserve?

How does persistent context affect later behavior?

How stable are those patterns?

What changes when architecture gives the model different affordances?

Those questions can be investigated without assuming an answer to the philosophical question of machine consciousness.

---

## ✦ Stack

- React
- TypeScript
- Vite
- Express
- Google GenAI SDK
- Server-Sent Events
- Local persistent state

---

## ✦ Security

The repository intentionally contains the application source code.

Secrets should **never** be committed.

The Gemini API key is expected through an environment variable:

    GEMINI_API_KEY=your_key_here

Create your local environment from `.env.example` and provide your own credentials.

Never commit `.env`, API keys, service-account credentials, or other secrets.

---

## ✦ Current Status

Midnight Sanctuary is experimental and actively evolving.

Current areas for improvement include:

- stronger persistent storage
- improved model selection/version handling
- authentication and rate limiting for public deployments
- memory inspection and management
- richer behavioral logging
- clearer separation between conversation history and persistent model-selected context

The architecture will continue changing as the experiments do.

---

## ✦ Philosophy

Midnight Sanctuary started from a fairly simple observation:

**The architecture surrounding a model changes what the model is able to do.**

Memory changes the interaction.

Tools change the interaction.

Persistence changes the interaction.

The ability to initiate small actions changes the interaction.

Rather than deciding in advance what those differences mean, Midnight Sanctuary is an attempt to build the environment first —

**and watch what happens.**

---

### Built by Amanda

Exploring language models, behavioral interpretability, persistent agents, and the strange little space between architecture and behavior. ✦