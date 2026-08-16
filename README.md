# Midnight Sanctuary

A private Gemma companion app. Streaming chat, tool calling, and cross-conversation memory — built entirely from a phone.

Single-user by design. There's no public demo: I'm unemployed and I'm not paying for anyone else's model calls. I learned that lesson the hard way when someone found a deployed URL of mine and drained the quota in an hour.

## What it does

- **Streaming responses** from Gemma 4 31B IT and Gemini Flash 2.5, with the thought process rendered as a collapsible bubble
- **Tool calling** — `save_memory`, `log_event`, `give_gift` — injected into the system instruction on every request
- **Cross-conversation memory** that persists between sessions
- **Presence indicator** so you can tell the model received the input even before tokens arrive
- **Debug panel** showing the raw response and a live `msgs / vis` counter (this becomes important later)

## Stack

| | |
|---|---|
| Runtime | Bun |
| Build | Vite + TypeScript |
| Frontend | React, Framer Motion, Tailwind |
| Backend | Netlify Functions (`netlify/functions/`) |
| Dev server | Express (`server.ts`) |
| Models | Gemma 4 31B IT, Gemini Flash 2.5 |
| Auth | Server-side token verification — the endpoint refuses unauthenticated requests, not just the UI |

## Running it

```bash
bun install
cp .env.example .env    # GEMINI_API_KEY, plus your auth secret
bun run dev
```

## Post-mortem: the week I rebuilt the backend eight times

Symptom: every model call after turn one silently failed to appear. The presence indicator turned white, so the request was clearly going out. The screen stayed empty.

Obviously the backend. So I rebuilt the backend. Eight times.

Real bugs found and fixed along the way, none of which were the cause:

- A missing `useCallback` import crashing `ChatArea.tsx`
- Thought-summary parts being replayed to the API on turn two, violating Gemma 4's multi-turn contract
- Fabricated `functionResponse` IDs producing 400s
- A localStorage write storm blocking the iOS UI after every response
- Retry-with-backoff added around `generateContentStream` for intermittent 500s
- Tools disabled entirely during bisection, then re-enabled — they were never the cause

Four models across three companies looked at this. Claude Sonnet, Claude Opus, GPT-5.5, Gemini 3.1 Pro. Everyone confidently debugged the layer I told them to look at.

The breakthrough was a screenshot: the debug panel read `msgs 4 / vis 4` while the screen was blank. Four messages. Four visible. Nothing on screen.

**The messages were rendering above the top of the viewport.** A flex scroll container was missing `min-h-0`, so instead of scrolling it grew, pushing everything out of view. One CSS class. The backend had been fine the entire time.

Fixed that, and the messages were *still* invisible — because Framer Motion entry animations (`initial={{ opacity: 0 }}`) stall permanently inside AI Studio's preview iframe on iOS Safari, where `requestAnimationFrame` is throttled. Every bubble sat at zero opacity forever. The fix was replacing motion entry animations with CSS keyframes using only a `from` block and no `animation-fill-mode`, so content is visible by default whether the animation runs or not.

Two CSS bugs. A week. Nobody looked at the CSS because the symptom looked like a network problem.

The lesson I actually took from it: **the layer that's failing is not always the layer that's broken.** And my own debug panel had been telling the truth the whole time — I just didn't know that "visible" meant "present in the DOM," not "on the screen."

## Why it exists

I started coding in April 2026. No CS degree, no laptop — this was written on an iPhone, using Gemini in AI Studio to apply patches and Claude to diagnose. It's a personal tool and it's going to stay one, but the code is public because the debugging story is worth more than the app.

---

*Part of [Provenance Systems](https://studio.keito.uk).*
