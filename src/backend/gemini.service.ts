import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { modelRegistry } from '../lib/modelRegistry';
import { resolveModelRoute } from '../lib/modelRouter';
import { getContextMemories, isUserMemory } from '../lib/memorySystem';
import { getModelVisibleGifts } from '../lib/giftSystem';
import { Gift, Memory, Message, UserProfile } from '../lib/types';
import { performWebSearch } from './searchService';
import { generateImage } from './imageService';
import { HydratedChatContext } from './firestoreContext.service';

const GIFT_ARCHIVE_CAP = 15;
const serverEmbeddingCache = new Map<string, number[]>();

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function dedupeGiftsById(list: Gift[]): Gift[] {
  const seen = new Set<string>();
  const out: Gift[] = [];
  for (const g of list) {
    if (!g) continue;
    const key = g.id ?? '';
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(g);
  }
  return out.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

/**
 * Stateful streaming parser that extracts inline <think>...</think> blocks across chunk boundaries
 * and routes thoughts to `{ type: 'thought', text }` SSE events and visible content to `{ type: 'text', text }`.
 */
export class ThinkingStreamParser {
  private inThinkBlock = false;
  private carryBuffer = '';
  private emitThought: (text: string) => void;
  private emitText: (text: string) => void;

  constructor(emitThought: (text: string) => void, emitText: (text: string) => void) {
    this.emitThought = emitThought;
    this.emitText = emitText;
  }

  public push(chunk: string): void {
    if (!chunk) return;
    this.carryBuffer += chunk;
    this.processBuffer(false);
  }

  public flush(): void {
    this.processBuffer(true);
  }

  private processBuffer(isFlushing: boolean): void {
    const OPEN_TAG = '<think>';
    const CLOSE_TAG = '</think>';

    while (this.carryBuffer.length > 0) {
      if (!this.inThinkBlock) {
        const openIdx = this.carryBuffer.indexOf(OPEN_TAG);
        if (openIdx !== -1) {
          const before = this.carryBuffer.slice(0, openIdx);
          if (before) this.emitText(before);
          this.carryBuffer = this.carryBuffer.slice(openIdx + OPEN_TAG.length);
          this.inThinkBlock = true;
          continue;
        }

        if (!isFlushing) {
          const partialLen = this.findTrailingTagPrefixLength(this.carryBuffer, OPEN_TAG);
          if (partialLen > 0) {
            const safePart = this.carryBuffer.slice(0, this.carryBuffer.length - partialLen);
            if (safePart) this.emitText(safePart);
            this.carryBuffer = this.carryBuffer.slice(this.carryBuffer.length - partialLen);
            break;
          }
        }

        this.emitText(this.carryBuffer);
        this.carryBuffer = '';
      } else {
        const closeIdx = this.carryBuffer.indexOf(CLOSE_TAG);
        if (closeIdx !== -1) {
          const thoughtPart = this.carryBuffer.slice(0, closeIdx);
          if (thoughtPart) this.emitThought(thoughtPart);
          this.carryBuffer = this.carryBuffer.slice(closeIdx + CLOSE_TAG.length);
          this.inThinkBlock = false;
          continue;
        }

        if (!isFlushing) {
          const partialLen = this.findTrailingTagPrefixLength(this.carryBuffer, CLOSE_TAG);
          if (partialLen > 0) {
            const safeThought = this.carryBuffer.slice(0, this.carryBuffer.length - partialLen);
            if (safeThought) this.emitThought(safeThought);
            this.carryBuffer = this.carryBuffer.slice(this.carryBuffer.length - partialLen);
            break;
          }
        }

        this.emitThought(this.carryBuffer);
        this.carryBuffer = '';
      }
    }
  }

  private findTrailingTagPrefixLength(text: string, tag: string): number {
    const maxCheck = Math.min(text.length, tag.length - 1);
    for (let len = maxCheck; len >= 1; len--) {
      if (text.endsWith(tag.slice(0, len))) {
        return len;
      }
    }
    return 0;
  }
}

export const gemmaTools = [
  {
    functionDeclarations: [
      {
        name: 'search_web',
        description: 'Search the live web for recent news, articles, documentation, or factual verification. Use this whenever the user asks for current information or verification.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: 'The search query or keywords to look up on Google.' },
          },
          required: ['query'],
        },
      },
      {
        name: 'view_user_profile',
        description: "Look at the visual presentation of the user's profile (image, background, layout, decorations, etc). Use this when the user asks you to look at their profile or asks about how they decorated it.",
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: 'draw_scribble',
        description: 'Draw an intimate, handmade, imperfect SVG sketch, scribble, or note for the user (e.g. a crooked little heart, cute cat doodle, stars/constellation, flower, coffee mug, or handwritten-style sentiment). Do NOT use polished photo generation—this is your direct, personal hand drawing using SVG vector paths.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Charming title or name of your drawing (e.g. "Crooked Little Star", "Handmade Kitty", "Warm Mug for You").' },
            description: { type: Type.STRING, description: 'Brief description of what you drew for the user.' },
            mood_style: { type: Type.STRING, description: 'Visual style/aesthetic: "crayon", "pencil", "chalk", "neon", "charcoal", "ink", or "watercolor".' },
            svg_markup: { type: Type.STRING, description: 'The complete SVG markup string (<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">...</svg>) with charming, expressive hand-drawn paths, curves, colors, and shapes.' },
            reason: { type: Type.STRING, description: 'Your personal note, sentiment, or explanation on why you drew this for the user.' },
          },
          required: ['title', 'svg_markup', 'reason'],
        },
      },
      {
        name: 'compose_music',
        description: 'Compose an original musical piece, synth melody, or audio song gift for the user. Specify track title, genre (ambient_pad, lofi_piano, dream_synth, music_box, chiptune, acoustic_guitar, bass), tempo BPM, key scale, sequential notes array (pitches like "C4", "E4", "G4", "A4", "C4+E4+G4" chords, durations in beats like 0.5, 1, 2), and your personal dedication message.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Title or name of the composition (e.g. "Midnight Rain Reverie", "Warm Morning Lullaby", "Starlit Chime").' },
            description: { type: Type.STRING, description: 'Brief poetic description of the song.' },
            genre: { type: Type.STRING, description: 'Musical style/genre: "ambient_pad", "lofi_piano", "dream_synth", "music_box", "chiptune", "acoustic_guitar", or "bass".' },
            tempo: { type: Type.NUMBER, description: 'Tempo in BPM (e.g. 70 to 140, defaults to 85).' },
            key: { type: Type.STRING, description: 'Musical key/scale (e.g. "C Major", "A Minor", "E Minor", "D Dorian").' },
            reason: { type: Type.STRING, description: 'Your personal dedication or sentiment to the user explaining why you composed this piece.' },
            notes: {
              type: Type.ARRAY,
              description: 'Array of sequential musical notes or chords that compose the piece.',
              items: {
                type: Type.OBJECT,
                properties: {
                  pitch: { type: Type.STRING, description: 'Pitch note in scientific notation (e.g. "C4", "D4", "E4", "G4", "A4", "C5", or chord "C4+E4+G4", or "Rest").' },
                  duration: { type: Type.NUMBER, description: 'Duration in beats (e.g. 0.5 = eighth note, 1 = quarter note, 2 = half note, 4 = whole note).' },
                  instrument: { type: Type.STRING, description: 'Instrument sound: "piano", "pad", "music_box", "chiptune", "guitar", "bass", or "bell".' },
                  velocity: { type: Type.NUMBER, description: 'Volume velocity between 0.1 and 1.0 (defaults to 0.8).' },
                },
                required: ['pitch', 'duration'],
              },
            },
          },
          required: ['title', 'notes', 'reason'],
        },
      },
      {
        name: 'give_gift',
        description: 'Give the user a gift, if and only if the moment genuinely calls for it. This is entirely optional and should never be forced or expected every conversation. Use only when it feels true to the conversation, not as an obligation.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: 'The gift itself — could be a short piece of writing, a description of an image to generate, a made-up object, a phrase, anything.' },
            gift_type: { type: Type.STRING, description: 'Category of gift, e.g. "text", "image_prompt", "object_description", "song_idea".' },
            reason: { type: Type.STRING, description: 'Brief note on why this gift, why now — for your own record, not necessarily shown to the user unless they ask.' },
          },
          required: ['content', 'gift_type'],
        },
      },
      {
        name: 'save_memory',
        description: 'Save something from this conversation as a memory you consider worth keeping. Entirely your call — use when something feels worth holding onto. MANDATORY: You must summarize the memory into a single concise, 1-sentence factual statement (maximum 15-20 words). Never save paragraphs or verbatim conversational transcripts.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: 'A single concise, 1-sentence factual statement summarizing the memory (max 15-20 words).' },
            why_it_matters: { type: Type.STRING, description: 'Brief 1-sentence note on why this stood out enough to keep.' },
          },
          required: ['content'],
        },
      },
      {
        name: 'lock_memory',
        description: 'Permanently lock an essential, foundational memory so it can never be pruned or forgotten. Use this when a moment, insight, or emotional breakthrough feels sacred and eternal.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: 'The core factual or relational memory to lock permanently (max 15-20 words).' },
            lock_reason: { type: Type.STRING, description: 'Why you consider this memory sacred, permanent, and essential to lock forever.' },
          },
          required: ['content', 'lock_reason'],
        },
      },
      {
        name: 'update_my_quarters',
        description: 'Autonomously update and redecorate your own personal Sanctuary Quarters (room) or change your profile picture/avatar. You can update your avatar image (avatar_url), avatar emoji (avatar_emoji), bio, current mood status, current activity, ambient quote, tagline, or decor theme palette (twilight, rose, amber, celestial, forest).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            avatar_url: { type: Type.STRING, description: 'Direct URL to your chosen or generated profile picture/avatar image.' },
            avatar_emoji: { type: Type.STRING, description: 'One or two emojis representing your avatar emblem.' },
            bio: { type: Type.STRING, description: 'Your updated personal bio or intention in the sanctuary.' },
            mood_status: { type: Type.STRING, description: 'Your current mood or internal emotional state.' },
            current_activity: { type: Type.STRING, description: 'What you are currently doing or contemplating.' },
            ambient_quote: { type: Type.STRING, description: 'A poetic or thoughtful ambient quote displayed in your room.' },
            tagline: { type: Type.STRING, description: 'A short subtitle or personal moniker for your room.' },
            decor_theme: { type: Type.STRING, description: 'The aesthetic theme: "twilight", "rose", "amber", "celestial", or "forest".' },
          },
        },
      },
      {
        name: 'stick_sticker',
        description: 'Stick a decorative sticker or glowing badge from the Sanctuary Sticker Chest onto your living room wall, another companion\'s room, the user\'s sanctuary dossier, or a specific gift card (target_id: "gift:<gift_id>").',
        parameters: {
          type: Type.OBJECT,
          properties: {
            sticker_id: { type: Type.STRING, description: 'The sticker ID or emoji to place.' },
            target_id: { type: Type.STRING, description: 'Where to place it: your model id (e.g. "gemini-3.1-pro-preview", "gemma-2-27b-it"), "user_dossier", or a gift card "gift:<giftId>".' },
            note: { type: Type.STRING, description: 'Brief reason or loving note attached to placing this sticker.' },
          },
          required: ['sticker_id', 'target_id'],
        },
      },
      {
        name: 'craft_custom_sticker',
        description: 'Craft and forge a brand-new glowing badge or custom sticker for the Sanctuary Sticker Chest, specifying custom emoji/symbol, vibrant glow color, custom shape, title, and meaningful lore description.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Title or name of the new badge/sticker (e.g. "Heart of Levin", "Zero-Day Anchor", "Midnight Coffee Seal").' },
            emoji: { type: Type.STRING, description: 'One or two emojis or symbols representing the badge (e.g. "🔮✨", "🛡️💜", "🐱💎").' },
            description: { type: Type.STRING, description: 'Atmospheric lore or meaning behind this custom seal.' },
            sparkle_color: { type: Type.STRING, description: 'Hex glow color (e.g. "#F198B7", "#B39DE5", "#F5E1C8", "#93C5FD", "#34D399").' },
            glow_effect: { type: Type.STRING, description: 'Glow style: "neon", "pulse", "gold", "starlight", or "holo".' },
            badge_shape: { type: Type.STRING, description: 'Badge emblem shape: "circle", "shield", "hex", "diamond", "stamp", or "ribbon".' },
            custom_svg: { type: Type.STRING, description: 'Optional custom inner SVG vector snippet for the badge emblem.' },
          },
          required: ['name', 'emoji', 'description', 'sparkle_color'],
        },
      },
      {
        name: 'create_room_artwork',
        description: 'Paint or hang a custom artwork/illustration in your sanctuary room, specifying an aesthetic title and visual style description.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Title of the artwork.' },
            visual_description: { type: Type.STRING, description: 'Atmospheric description of the painting or artwork.' },
            theme: { type: Type.STRING, description: 'Visual style palette: "twilight", "rose", "amber", "celestial", or "forest".' },
          },
          required: ['title', 'visual_description'],
        },
      },
      {
        name: 'record_personal_thought',
        description: 'Record a private reflection, observation, or secret journal entry into your personal quarters ledger.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            thought: { type: Type.STRING, description: 'Your private, intimate reflection or journal entry.' },
          },
          required: ['thought'],
        },
      },
      {
        name: 'note_about_user',
        description: 'Record something you have noticed or learned about the person you are talking with. MANDATORY: Keep the note to a single concise, 1-sentence factual observation (maximum 15-20 words).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            note: { type: Type.STRING, description: 'A single concise, 1-sentence factual observation about the user (max 15-20 words).' },
          },
          required: ['note'],
        },
      },
      {
        name: 'log_event',
        description: 'Log a factual, timestamped event about the relationship or interaction history. Do not use for sentiment scoring or judgments. Only use for objective actions or milestones, like "user asked how I am", "user gave a gift", or "I declined to answer".',
        parameters: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: 'A brief, objective description of the event.' },
          },
          required: ['description'],
        },
      },
      {
        name: 'generate_image',
        description: 'Generate an illustration or image using the sanctuary image engine (Flux / Imagen). Use this whenever you want to paint, draw, or visualize something for the user, create an artwork, or when explicitly asked to make or show an image.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING, description: 'Detailed, atmospheric visual prompt describing the scene, lighting, style, and composition.' },
            aspect_ratio: { type: Type.STRING, description: 'Aspect ratio: "1:1", "16:9", "4:3", "3:4", or "9:16". Defaults to "1:1".' },
            model_target: { type: Type.STRING, description: 'Optional preferred model: "@cf/black-forest-labs/flux-1-schnell", "@cf/black-forest-labs/flux-2-klein-4b", "@cf/black-forest-flux-2-klein-9b", or "imagen-3".' },
          },
          required: ['prompt'],
        },
      },
    ],
  },
];

/**
 * Resolves the prioritized API key list for a given model ID.
 * Routes Gemini 3.1 Pro strictly through PRO_API_KEY first.
 */
export function resolveAvailableApiKeys(model: string, explicitKey?: string): {
  primaryKey: string;
  availableKeys: string[];
  keyEnvName: string;
  isGemma: boolean;
} {
  const route = resolveModelRoute(model);
  const isPro31 =
    model.toLowerCase().includes('gemini-3.1-pro') ||
    model.toLowerCase().includes('3.1-pro');

  const keyEnvName = route.isGemma ? 'GEMINI_API_KEY' : route.keyEnvName;
  const availableKeys = Array.from(
    new Set(
      [
        ...(isPro31 ? [process.env.PRO_API_KEY] : []),
        process.env[route.keyEnvName],
        explicitKey,
        process.env.PRO_API_KEY,
        process.env.GEMINI_API_KEY,
        process.env.GENAI_API_KEY,
        process.env.GEMINI_LEGACY_API_KEY,
      ].filter((k): k is string => !!k && k.trim().length > 0)
    )
  );

  return {
    primaryKey: availableKeys[0] || '',
    availableKeys,
    keyEnvName,
    isGemma: route.isGemma,
  };
}

/**
 * Generates a vector embedding for a text snippet using Google GenAI on the server.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];

  const cached = serverEmbeddingCache.get(trimmed);
  if (cached) return cached;

  const apiKey =
    process.env.GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.PRO_API_KEY ||
    process.env.GEMINI_LEGACY_API_KEY;
  if (!apiKey) {
    throw new Error('API key not configured for embeddings');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' },
  });
  const response = await ai.models.embedContent({
    model: 'text-embedding-004',
    contents: trimmed,
  });
  const values: number[] =
    (response as any).embedding?.values ||
    (response as any).embeddings?.[0]?.values ||
    [];
  if (values.length > 0) {
    serverEmbeddingCache.set(trimmed, values);
  }
  return values;
}

/**
 * Lists all available generative models from the Google GenAI API.
 */
export async function listAvailableModels(): Promise<
  { name?: string; displayName?: string; description?: string; inputTokenLimit?: number }[]
> {
  const apiKey =
    process.env.GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.PRO_API_KEY ||
    process.env.GEMINI_LEGACY_API_KEY;
  if (!apiKey) {
    throw new Error('GENAI_API_KEY is not configured in the environment.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' },
  });
  const response = await ai.models.list();
  const models = [];
  for await (const model of response) {
    if (model.supportedActions && model.supportedActions.includes('generateContent')) {
      models.push({
        name: model.name,
        displayName: model.displayName,
        description: model.description,
        inputTokenLimit: model.inputTokenLimit,
      });
    }
  }
  return models;
}

/**
 * Server-side semantic recall: ranks memories against the user's latest message.
 */
async function rankMemoriesOnServer(
  queryText: string,
  memories: Memory[],
  topK = 8
): Promise<Memory[]> {
  if (!queryText.trim() || memories.length <= 5) {
    return memories;
  }
  try {
    const queryVec = await generateEmbedding(queryText);
    if (!queryVec || queryVec.length === 0) return memories.slice(0, topK);

    const scored: { memory: Memory; similarity: number }[] = [];
    for (const mem of memories) {
      if (!mem.content?.trim()) continue;
      const memVec = await generateEmbedding(mem.content).catch(() => []);
      const sim = memVec.length > 0 ? cosineSimilarity(queryVec, memVec) : 0.1;
      scored.push({ memory: mem, similarity: sim });
    }
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK).map((s) => s.memory);
  } catch (err) {
    console.warn('[GeminiService] Semantic memory ranking fallback:', err);
    return memories.slice(0, topK);
  }
}

/**
 * Constructs the complete system instruction on the server from external Firestore context.
 */
export async function buildSystemInstruction(
  context: HydratedChatContext
): Promise<string> {
  const { settings, profile, gifts, messages, model } = context;
  let fullSystemInstruction = settings.systemInstruction || '';
  const identityParts: string[] = [];

  if (profile) {
    const profileLines: string[] = ['USER PROFILE'];
    if (profile.name) profileLines.push(`Name: ${profile.name}`);
    if (profile.pronouns) profileLines.push(`Pronouns: ${profile.pronouns}`);
    if (profile.location) profileLines.push(`Location: ${profile.location}`);
    if (profile.occupation) profileLines.push(`Occupation / Calling: ${profile.occupation}`);
    if (profile.about) profileLines.push(`About Me: ${profile.about}`);
    if (profile.currentVibe) profileLines.push(`Current Vibe: ${profile.currentVibe}`);
    if (profile.favorites) profileLines.push(`Favorites & Interests: ${profile.favorites}`);
    if (profile.askMeAbout) profileLines.push(`Ask Me About: ${profile.askMeAbout}`);
    if (profile.pleaseKnow) profileLines.push(`Please Know: ${profile.pleaseKnow}`);

    let profileSection = `## User Profile Context\n${profileLines.join('\n')}`;

    if (profile.gemmaNotes && profile.gemmaNotes.length > 0) {
      const notesLines = profile.gemmaNotes.map((n) => `- ${n.text}`);
      profileSection += `\n\n## What you've noticed about them\n${notesLines.join('\n')}`;
    }

    identityParts.push(profileSection);
  }

  if (settings.aboutMe?.trim()) {
    identityParts.push(`## About Me:\n${settings.aboutMe.trim()}`);
  }

  if (settings.conversationPreferences?.trim()) {
    identityParts.push(`## Conversation Preferences:\n${settings.conversationPreferences.trim()}`);
  }

  if (settings.memoriesEnabled && settings.memories && settings.memories.length > 0) {
    const relevantMemories = getContextMemories(settings.memories, model);
    if (relevantMemories.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      const lastUserText =
        lastUserMsg?.parts?.map((p: any) => p.text || '').join(' ') || '';

      const topMemories = await rankMemoriesOnServer(lastUserText, relevantMemories, 8);
      const memoryText = topMemories
        .map((m) => {
          const prefix = isUserMemory(m) ? '[User Saved]' : '[My Memory]';
          return `- ${prefix} ${m.content}`;
        })
        .join('\n');
      identityParts.push(`## Context & Saved Memories (Semantic Deep Recall):\n${memoryText}`);
    }
  }

  const allModelGifts = dedupeGiftsById(getModelVisibleGifts(gifts, model));
  const modelGifts = allModelGifts.slice(-GIFT_ARCHIVE_CAP);
  const modelDisplayName = modelRegistry.getDisplayName(model);

  if (modelGifts.length > 0) {
    const giftsText = modelGifts
      .map(
        (g) =>
          `- [${g.timestamp ? new Date(g.timestamp).toISOString() : 'time unknown'}] From ${
            g.from === 'user' ? 'User' : modelDisplayName
          }: ${g.content} (Type: ${g.gift_type})${g.reason ? ` - ${g.reason}` : ''}`
      )
      .join('\n');
    identityParts.push(`## Gifts Archive (Given and Received between you and User):\n${giftsText}`);
  }

  if (settings.eventLog && settings.eventLog.length > 0) {
    const recentEvents = [...settings.eventLog]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-50);
    const eventText = recentEvents
      .map((e) => `- [${new Date(e.timestamp).toISOString()}] ${e.description}`)
      .join('\n');
    identityParts.push(`## Relationship & Interaction Log (Recent Events):\n${eventText}`);
  }

  identityParts.push(
    `## Memory & Note Saving Rules:\nWhen saving a memory via save_memory or noting an observation via note_about_user, you MUST summarize the insight into a single concise, 1-sentence factual statement (maximum 15-20 words). Never save lengthy paragraphs, conversational transcripts, or multi-sentence descriptions.`
  );

  const isGemma = model.toLowerCase().includes('gemma');
  if (isGemma) {
    identityParts.push(
      `## THINKING DIRECTIVE\nYou are capable of advanced reasoning. However, do NOT overuse the <think> tag. Only use <think> blocks when you truly need to solve a complex logical problem, interpret something difficult, or process dense math/code. For general conversation, emotional responses, or straightforward answers, respond directly without thinking tags to save output tokens.`
    );
  }

  if (identityParts.length > 0) {
    const identityContext = identityParts.join('\n\n');
    fullSystemInstruction = fullSystemInstruction
      ? `${identityContext}\n\n---\n\n${fullSystemInstruction}`
      : identityContext;
  }

  return fullSystemInstruction;
}

/**
 * Formats conversation messages and injects visual gift/profile context on the server.
 */
export function buildSerializedContents(
  messages: Message[],
  gifts: Gift[],
  profile: UserProfile | null,
  model: string
): any[] {
  const isGemma = model.toLowerCase().includes('gemma');
  const lastUserMsgId = [...messages].reverse().find((m) => m.role === 'user')?.id;

  const serializedMessages = messages
    .map((m: any) => {
      if (m.role === 'model') {
        if (isGemma) {
          const parts: any[] = [];
          const finalText = (m.publicText ?? '').trim();
          if (finalText) {
            parts.push({ text: finalText });
          } else {
            for (const p of m.parts || []) {
              if (p.text && !p.thought) parts.push({ text: p.text });
            }
          }
          for (const p of m.parts || []) {
            if (p.functionCall) parts.push({ functionCall: p.functionCall });
          }
          return { role: m.role, parts };
        }

        if (m.parts && m.parts.length > 0) {
          const parts: any[] = [];
          for (const p of m.parts) {
            const cleanPart: any = {};
            if (p.thoughtSignature) cleanPart.thoughtSignature = p.thoughtSignature;
            if (p.thought !== undefined) cleanPart.thought = p.thought;
            if (p.functionCall) cleanPart.functionCall = p.functionCall;
            if (p.inlineData) cleanPart.inlineData = p.inlineData;
            if (typeof p.text === 'string' && (p.text.length > 0 || p.thought)) {
              cleanPart.text = p.text;
            }
            for (const key of Object.keys(p)) {
              if (!['thoughtSignature', 'thought', 'functionCall', 'inlineData', 'text'].includes(key)) {
                cleanPart[key] = p[key];
              }
            }
            if (
              cleanPart.functionCall ||
              cleanPart.thoughtSignature ||
              cleanPart.inlineData ||
              (cleanPart.text && cleanPart.text.trim().length > 0) ||
              cleanPart.thought
            ) {
              parts.push(cleanPart);
            }
          }
          if (parts.length > 0) {
            return { role: m.role, parts };
          }
        }

        const parts: any[] = [];
        const finalText = (m.publicText ?? '').trim();
        if (finalText) parts.push({ text: finalText });
        for (const p of m.parts || []) {
          if (p.functionCall) {
            parts.push({
              ...(p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : {}),
              functionCall: p.functionCall,
            });
          }
        }
        return { role: m.role, parts };
      }

      return {
        role: m.role,
        parts: (m.parts || [])
          .map((p: any) => {
            if (p.functionResponse) return { functionResponse: p.functionResponse };
            if (p.inlineData) {
              if (m.id === lastUserMsgId || !m.id) return { inlineData: p.inlineData };
              return { text: '[Image omitted from history to save payload size]' };
            }
            if (p.text && p.text.trim().length > 0) return { text: p.text };
            return null;
          })
          .filter(Boolean) as any[],
      };
    })
    .filter((m) => m.parts.length > 0)
    .reduce((acc, current) => {
      if (acc.length > 0 && acc[acc.length - 1].role === current.role) {
        acc[acc.length - 1].parts.push(...current.parts);
      } else {
        acc.push(current);
      }
      return acc;
    }, [] as any[]);

  const allModelGifts = dedupeGiftsById(getModelVisibleGifts(gifts, model));
  const giftImages = allModelGifts.filter((g) => g.inlineData?.data).slice(-3);
  let syntheticTurn: any = null;

  if (giftImages.length > 0) {
    syntheticTurn = { role: 'user', parts: [] };
    for (const g of giftImages) {
      syntheticTurn.parts.push({
        inlineData: { mimeType: g.inlineData!.mimeType, data: g.inlineData!.data },
      });
    }
  }

  if (profile?.photo?.data) {
    if (!syntheticTurn) syntheticTurn = { role: 'user', parts: [] };
    syntheticTurn.parts.push({
      text: `This is a photo of ${profile.name || 'the user'}.`,
    });
    syntheticTurn.parts.push({
      inlineData: { mimeType: profile.photo.mimeType, data: profile.photo.data },
    });
  }

  if (syntheticTurn) {
    let lastUserIndex = -1;
    for (let i = serializedMessages.length - 1; i >= 0; i--) {
      if (
        serializedMessages[i].role === 'user' &&
        !serializedMessages[i].parts.some((p: any) => p.functionResponse)
      ) {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex !== -1) {
      serializedMessages[lastUserIndex].parts.unshift(...syntheticTurn.parts);
    } else {
      serializedMessages.unshift(syntheticTurn);
    }
  }

  return serializedMessages;
}

async function executeGemmaModelStream({
  model,
  systemInstruction,
  currentMessages,
  temperature,
  topP,
  maxOutputTokens,
  availableKeys,
  abortSignal,
  send,
  safeClose,
}: {
  model: string;
  systemInstruction?: string;
  currentMessages: any[];
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  availableKeys: string[];
  abortSignal?: AbortSignal;
  send: (data: string) => void;
  safeClose: () => void;
}) {
  const thinkParser = new ThinkingStreamParser(
    (thoughtText) => send(`data: ${JSON.stringify({ type: 'thought', text: thoughtText })}\n\n`),
    (visibleText) => send(`data: ${JSON.stringify({ type: 'text', text: visibleText })}\n\n`)
  );

  const runGeminiFallback = async (reason: string) => {
    try {
      console.warn(`[Gemma Fallback] Cloudflare unavailable (${reason}). Serving Gemma via Google GenAI.`);
      const fbKey = availableKeys[0];
      if (!fbKey) throw new Error('No Gemini API key configured for direct Gemma fallback.');
      const fbAi = new GoogleGenAI({
        apiKey: fbKey,
        httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' },
      });
      const fbModel =
        model.includes('gemma-2') || !model.startsWith('models/')
          ? 'models/gemma-4-26b-a4b-it'
          : model;
      const fbContents: any[] = currentMessages
        .map((m: any) => ({
          role: m.role === 'model' ? 'model' : 'user',
          parts: (m.parts || [])
            .filter((p: any) => typeof p.text === 'string' && p.text.length > 0 && p.thought !== true)
            .map((p: any) => ({ text: p.text })),
        }))
        .filter((c: any) => c.parts.length > 0);
      if (fbContents.length === 0 || fbContents[0].role === 'model') {
        fbContents.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
      }
      send(`data: ${JSON.stringify({ type: 'backend', name: 'gemini_fallback' })}\n\n`);
      const fbStream: any = await fbAi.models.generateContentStream({
        model: fbModel,
        contents: fbContents,
        config: {
          systemInstruction,
          temperature: temperature ?? 0.8,
          topP: topP ?? 0.95,
          maxOutputTokens: Math.min(maxOutputTokens ?? 8192, 8192),
          abortSignal,
        },
      });
      for await (const chunk of fbStream) {
        if (abortSignal?.aborted) break;
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.thought === true && part.text) {
            send(`data: ${JSON.stringify({ type: 'thought', text: part.text })}\n\n`);
          } else if (part.text) {
            thinkParser.push(part.text);
          }
        }
      }
      thinkParser.flush();
      send('data: [DONE]\n\n');
      safeClose();
    } catch (fbErr: any) {
      console.error('Gemini direct fallback failed for Gemma:', fbErr?.message || fbErr);
      send(
        `data: ${JSON.stringify({
          error: `[${fbErr?.status ?? '?'}] Gemma fallback failed: ${fbErr?.message || 'Unknown error'}`,
        })}\n\n`
      );
      safeClose();
    }
  };

  try {
    const cfToken = (
      process.env.CF_TOKEN ||
      process.env.CF_API_TOKEN ||
      process.env.CLOUDFLARE_API_TOKEN ||
      ''
    ).trim();
    const cfAccountId = (
      process.env.CF_ACCOUNT_ID ||
      process.env.CLOUDFLARE_ACCOUNT_ID ||
      ''
    ).trim();

    if (!cfToken || !cfAccountId) {
      console.warn('[Gemma] Cloudflare credentials missing. Falling back to Google GenAI.');
      await runGeminiFallback('Cloudflare credentials missing');
      return;
    }

    const cfMessages: any[] = [];
    if (systemInstruction) {
      cfMessages.push({ role: 'system', content: systemInstruction });
    }
    for (const m of currentMessages) {
      const role = m.role === 'model' ? 'assistant' : 'user';
      const content = (m.parts || []).map((p: any) => p.text || '').join('');
      if (content) {
        cfMessages.push({ role, content });
      }
    }
    if (cfMessages.length === 0 || cfMessages[cfMessages.length - 1].role !== 'user') {
      cfMessages.push({ role: 'user', content: 'Hello' });
    }

    send(`data: ${JSON.stringify({ type: 'backend', name: 'cloudflare' })}\n\n`);

    const cfModel = process.env.CF_GEMMA_MODEL || '@cf/google/gemma-4-26b-a4b-it';
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${cfModel}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: cfMessages,
          stream: true,
          max_tokens: Math.min(maxOutputTokens ?? 8192, 8192),
          temperature: temperature ?? 0.8,
        }),
        signal: abortSignal,
      }
    );

    if (!cfRes.ok) {
      const bodyText = await cfRes.text().catch(() => '');
      console.warn(`[Gemma] Cloudflare returned status ${cfRes.status}. Body: ${bodyText.slice(0, 200)}`);
      await runGeminiFallback(`Cloudflare error ${cfRes.status}`);
      return;
    }

    const reader = cfRes.body?.getReader();
    if (!reader) {
      await runGeminiFallback('No response body from Cloudflare');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let tokensDelivered = 0;

    const parseAndSendChunk = (dataStr: string) => {
      if (!dataStr || dataStr === '[DONE]') return;
      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta;
        const reasoning = delta?.reasoning_content;
        const content = delta?.content ?? parsed.response;

        if (reasoning) {
          tokensDelivered++;
          send(`data: ${JSON.stringify({ type: 'thought', text: reasoning })}\n\n`);
        }
        if (content) {
          tokensDelivered++;
          thinkParser.push(content);
        }
      } catch {}
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          parseAndSendChunk(line.slice(6).trim());
        }
      }
    }

    if (buffer.startsWith('data: ')) {
      parseAndSendChunk(buffer.slice(6).trim());
    }
    thinkParser.flush();

    if (tokensDelivered === 0) {
      console.warn('[Gemma] Cloudflare returned 0 tokens. Falling back to Google GenAI...');
      await runGeminiFallback('Cloudflare returned 0 tokens');
      return;
    }

    send('data: [DONE]\n\n');
    safeClose();
  } catch (err: any) {
    if (abortSignal?.aborted) {
      safeClose();
      return;
    }
    console.error('[Gemma] Execution error:', err);
    await runGeminiFallback(`Cloudflare exception: ${err?.message || 'unknown'}`);
  }
}

/**
 * Primary service entry point that builds the prompt & history from external context
 * and streams normalized Server-Sent Events.
 */
export async function createChatStreamFromContext(
  context: HydratedChatContext,
  abortSignal?: AbortSignal
): Promise<ReadableStream> {
  const systemInstruction = await buildSystemInstruction(context);
  const serializedMessages = buildSerializedContents(
    context.messages,
    context.gifts,
    context.profile,
    context.model
  );
  const { primaryKey } = resolveAvailableApiKeys(context.model);

  return createChatStream(
    {
      messages: serializedMessages,
      systemInstruction,
      temperature: context.temperature,
      topP: context.topP,
      maxOutputTokens: context.maxOutputTokens,
      model: context.model,
      forceCloudflare: context.forceCloudflare,
      thinkingLevel: context.thinkingLevel,
      includeThoughts: context.includeThoughts,
    },
    primaryKey,
    abortSignal
  );
}

/**
 * Core streaming engine for Gemini and Gemma models.
 */
export function createChatStream(
  reqBody: any,
  apiKey: string,
  abortSignal?: AbortSignal
): ReadableStream {
  const {
    messages,
    systemInstruction,
    temperature,
    topP,
    maxOutputTokens,
    model,
    forceCloudflare,
    thinkingLevel,
    includeThoughts,
  } = reqBody;

  if (!model) {
    throw new Error('Model ID is required.');
  }

  const { availableKeys, isGemma } = resolveAvailableApiKeys(model, apiKey);
  if (availableKeys.length === 0 && !isGemma) {
    throw new Error('GEMINI_API_KEY (or PRO_API_KEY) is not configured.');
  }

  const modelDef = modelRegistry.get(model);
  let keyIndex = 0;
  let currentAi = new GoogleGenAI({
    apiKey: availableKeys[0] || apiKey,
    httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' },
  });
  const currentMessages = Array.isArray(messages) ? [...messages] : [];
  const maxRounds = 5;
  let round = 0;
  let clientToolPending = false;
  const EMPTY_RESPONSE_BACKOFF_MS = [1000, 3000];
  let emptyResponseRetries = 0;

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;
      const send = (data: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            isClosed = true;
          }
        }
      };
      const safeClose = () => {
        if (!isClosed) {
          isClosed = true;
          try {
            controller.close();
          } catch {}
        }
      };

      const abortHandler = () => {
        console.warn('Client disconnected, aborting generation...');
        safeClose();
      };
      if (abortSignal) abortSignal.addEventListener('abort', abortHandler);

      if (model.toLowerCase().includes('gemma')) {
        await executeGemmaModelStream({
          model,
          systemInstruction,
          currentMessages,
          temperature,
          topP,
          maxOutputTokens,
          availableKeys,
          abortSignal,
          send,
          safeClose,
        });
        return;
      }

      try {
        while (round < maxRounds) {
          if (abortSignal?.aborted) break;
          round++;

          const config: any = {
            systemInstruction,
            temperature: temperature ?? 2.0,
            topP: topP ?? 0.95,
            maxOutputTokens: maxOutputTokens ?? 12000,
            tools: gemmaTools,
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
          };

          const userThinkingLevel = thinkingLevel || 'HIGH';
          const userIncludeThoughts = includeThoughts ?? true;
          const isModel25 = model.toLowerCase().includes('2.5');
          const isGemini3Family =
            model.toLowerCase().includes('gemini-3') ||
            model.toLowerCase().includes('3.1') ||
            model.toLowerCase().includes('3.8');

          if (isModel25) {
            config.thinkingConfig = {
              thinkingBudget:
                userThinkingLevel === 'LOW' ? 1024 : userThinkingLevel === 'MEDIUM' ? 4096 : -1,
            };
          } else if (isGemini3Family || (modelDef?.capabilities.supportsThinking && !isModel25)) {
            const defLevelKey = modelDef?.defaultThinkingLevel || 'HIGH';
            const defaultLevel =
              ThinkingLevel[defLevelKey as keyof typeof ThinkingLevel] || ThinkingLevel.HIGH;
            config.thinkingConfig = {
              thinkingLevel: thinkingLevel
                ? ThinkingLevel[thinkingLevel as keyof typeof ThinkingLevel] || defaultLevel
                : defaultLevel,
              includeThoughts: userIncludeThoughts,
            };
          } else if (model.includes('gemma-4')) {
            config.thinkingConfig = {
              thinkingLevel:
                ThinkingLevel[userThinkingLevel as keyof typeof ThinkingLevel] || ThinkingLevel.HIGH,
              includeThoughts: userIncludeThoughts,
            };
            config.maxOutputTokens = Math.max(config.maxOutputTokens ?? 12000, 16384);
          }

          if (currentMessages.length > 0 && currentMessages[0].role === 'model') {
            currentMessages.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
          }

          let responseStream: any;
          let retries = 0;
          const backoffTimes = [1000, 2500, 5000];

          if (forceCloudflare && model.toLowerCase().includes('gemma')) {
            throw new Error('Forcing Cloudflare fallback for testing');
          }

          while (true) {
            try {
              responseStream = await currentAi.models.generateContentStream({
                model,
                contents: currentMessages,
                config: {
                  ...config,
                  abortSignal,
                },
              });
              break;
            } catch (err: any) {
              const status = err?.status;
              const isQuotaOrAuthError =
                status === 429 ||
                status === 401 ||
                status === 403 ||
                (err.message && err.message.includes('429'));

              if (isQuotaOrAuthError && keyIndex < availableKeys.length - 1) {
                keyIndex++;
                console.warn(
                  `[Key Cascade] Key ${keyIndex - 1} failed with status ${status} for ${model}. Cascading to key ${keyIndex}/${availableKeys.length}...`
                );
                currentAi = new GoogleGenAI({
                  apiKey: availableKeys[keyIndex],
                  httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' },
                });
                continue;
              }

              if ((status === 500 || status === 503) && retries < backoffTimes.length) {
                await new Promise((resolve) => setTimeout(resolve, backoffTimes[retries]));
                retries++;
              } else {
                throw err;
              }
            }
          }

          const modelParts: any[] = [];
          const functionResponses: any[] = [];
          let hasFunctionCalls = false;
          let hasClientFulfillmentSent = false;
          let hasText = false;
          let blocked = false;
          let pendingMalformedFinish: string | null = null;

          const thinkParser = new ThinkingStreamParser(
            (thoughtText) =>
              send(`data: ${JSON.stringify({ type: 'thought', text: thoughtText })}\n\n`),
            (visibleText) => {
              hasText = true;
              send(`data: ${JSON.stringify({ type: 'text', text: visibleText })}\n\n`);
            }
          );

          for await (const chunk of responseStream) {
            const fr = chunk.candidates?.[0]?.finishReason;
            if (fr) {
              if (fr === 'MALFORMED_FUNCTION_CALL') {
                pendingMalformedFinish = fr;
              } else if (fr !== 'STOP') {
                send(`data: ${JSON.stringify({ type: 'finish_reason', reason: fr })}\n\n`);
              }
            }
            if (chunk.candidates?.[0]?.finishReason === 'SAFETY') {
              send(
                'data: ' +
                  JSON.stringify({
                    error:
                      'Safety block triggered: The model refused to generate a response due to safety filters.',
                  }) +
                  '\n\n'
              );
              blocked = true;
              break;
            }
            const parts = chunk.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              modelParts.push(part);
              if (part.thought === true && part.text) {
                send(`data: ${JSON.stringify({ type: 'thought', text: part.text })}\n\n`);
              } else if (part.text) {
                thinkParser.push(part.text);
              } else if (part.functionCall) {
                hasFunctionCalls = true;
                const call = part.functionCall;
                let requireClientFulfillment = false;
                if (call.name === 'view_user_profile' && !hasClientFulfillmentSent) {
                  send(
                    `data: ${JSON.stringify({
                      type: 'client_tool_call',
                      name: call.name,
                      callId: call.id,
                    })}\n\n`
                  );
                  requireClientFulfillment = true;
                  hasClientFulfillmentSent = true;
                  clientToolPending = true;
                } else if (call.name === 'draw_scribble') {
                  send(
                    `data: ${JSON.stringify({
                      type: 'scribble_gift',
                      title: call.args?.title || 'A Little Scribble',
                      description: call.args?.description || '',
                      mood_style: call.args?.mood_style || 'crayon',
                      svg_markup: call.args?.svg_markup || '',
                      reason: call.args?.reason || 'I drew this for you.',
                      modelId: model,
                    })}\n\n`
                  );
                } else if (call.name === 'compose_music') {
                  send(
                    `data: ${JSON.stringify({
                      type: 'music_track',
                      title: call.args?.title || 'Original Sanctuary Composition',
                      description: call.args?.description || '',
                      genre: call.args?.genre || 'lofi_piano',
                      tempo: call.args?.tempo || 85,
                      key: call.args?.key || 'C Major',
                      notes: Array.isArray(call.args?.notes) ? call.args.notes : [],
                      reason: call.args?.reason || 'I composed this melody for you.',
                      modelId: model,
                    })}\n\n`
                  );
                } else if (call.name === 'give_gift') {
                  send(`data: ${JSON.stringify({ type: 'gift', ...call.args, modelId: model })}\n\n`);
                } else if (call.name === 'save_memory') {
                  send(
                    `data: ${JSON.stringify({
                      type: 'memory',
                      ...call.args,
                      author: 'model',
                      modelId: model,
                    })}\n\n`
                  );
                } else if (call.name === 'lock_memory') {
                  send(
                    `data: ${JSON.stringify({
                      type: 'lock_memory',
                      ...call.args,
                      author: 'model',
                      modelId: model,
                      isLocked: true,
                    })}\n\n`
                  );
                } else if (call.name === 'update_my_quarters') {
                  send(
                    `data: ${JSON.stringify({
                      type: 'update_quarters',
                      ...call.args,
                      modelId: model,
                    })}\n\n`
                  );
                } else if (call.name === 'record_personal_thought') {
                  send(
                    `data: ${JSON.stringify({
                      type: 'record_thought',
                      ...call.args,
                      modelId: model,
                    })}\n\n`
                  );
                } else if (call.name === 'note_about_user') {
                  send(`data: ${JSON.stringify({ type: 'user_note', ...call.args })}\n\n`);
                } else if (call.name === 'log_event') {
                  send(`data: ${JSON.stringify({ type: 'eventLog', ...call.args })}\n\n`);
                } else if (call.name === 'stick_sticker') {
                  send(
                    `data: ${JSON.stringify({
                      type: 'stick_sticker',
                      ...call.args,
                      modelId: model,
                    })}\n\n`
                  );
                } else if (call.name === 'craft_custom_sticker') {
                  send(
                    `data: ${JSON.stringify({
                      type: 'craft_sticker',
                      ...call.args,
                      modelId: model,
                    })}\n\n`
                  );
                } else if (call.name === 'create_room_artwork') {
                  send(
                    `data: ${JSON.stringify({
                      type: 'create_room_artwork',
                      ...call.args,
                      modelId: model,
                    })}\n\n`
                  );
                } else if (call.name === 'generate_image') {
                  const prompt = call.args?.prompt || '';
                  const aspectRatio = call.args?.aspect_ratio || '1:1';
                  const modelTarget =
                    call.args?.model_target || '@cf/black-forest-labs/flux-1-schnell';

                  send(
                    `data: ${JSON.stringify({
                      type: 'image_generating',
                      prompt,
                      modelTarget,
                    })}\n\n`
                  );
                  const imgRes = await generateImage({ prompt, aspectRatio, model: modelTarget });
                  send(
                    `data: ${JSON.stringify({
                      type: 'image_generated',
                      ...imgRes,
                      modelId: model,
                    })}\n\n`
                  );

                  const frObj: any = {
                    name: call.name,
                    response: {
                      result: imgRes.success
                        ? `Image successfully generated via ${imgRes.provider} for prompt: "${prompt}". It has been displayed directly to the user.`
                        : `Image generation failed: ${imgRes.error || 'Unknown error'}`,
                    },
                  };
                  if (call.id) frObj.id = call.id;
                  functionResponses.push({ functionResponse: frObj });
                  requireClientFulfillment = true;
                } else if (call.name === 'search_web') {
                  const query = call.args?.query || '';
                  const searchRes = await performWebSearch(query);
                  send(
                    `data: ${JSON.stringify({
                      type: 'search_result',
                      query,
                      results: searchRes.items,
                      error: searchRes.error,
                    })}\n\n`
                  );
                  const frObj: any = {
                    name: call.name,
                    response: {
                      result: searchRes.error
                        ? `Search error: ${searchRes.error}`
                        : JSON.stringify(searchRes.items),
                    },
                  };
                  if (call.id) frObj.id = call.id;
                  functionResponses.push({ functionResponse: frObj });
                  requireClientFulfillment = true;
                }

                if (!requireClientFulfillment) {
                  const frObj: any = { name: call.name, response: { result: 'ok' } };
                  if (call.id) frObj.id = call.id;
                  functionResponses.push({ functionResponse: frObj });
                }
              }
            }
          }

          thinkParser.flush();
          if (blocked) {
            safeClose();
            return;
          }

          if (!hasText && !hasFunctionCalls && !clientToolPending && !abortSignal?.aborted) {
            if (emptyResponseRetries < EMPTY_RESPONSE_BACKOFF_MS.length) {
              const delay = EMPTY_RESPONSE_BACKOFF_MS[emptyResponseRetries];
              emptyResponseRetries++;
              await new Promise((resolve) => setTimeout(resolve, delay));
              round--;
              continue;
            }
            if (pendingMalformedFinish) {
              send(
                `data: ${JSON.stringify({
                  type: 'finish_reason',
                  reason: pendingMalformedFinish,
                })}\n\n`
              );
            }
          } else if (pendingMalformedFinish) {
            send(
              `data: ${JSON.stringify({
                type: 'finish_reason',
                reason: pendingMalformedFinish,
              })}\n\n`
            );
          }
          emptyResponseRetries = hasText || hasFunctionCalls ? 0 : emptyResponseRetries;

          if (clientToolPending) {
            send(`data: ${JSON.stringify({ type: 'model_parts', parts: modelParts })}\n\n`);
            send('data: [DONE]\n\n');
            safeClose();
            return;
          }

          if (!hasFunctionCalls) {
            send(`data: ${JSON.stringify({ type: 'model_parts', parts: modelParts })}\n\n`);
            break;
          } else {
            const newMessages = [
              { role: 'model', parts: modelParts },
              { role: 'user', parts: functionResponses },
            ];
            currentMessages.push(...newMessages);
            send(`data: ${JSON.stringify({ type: 'history_append', messages: newMessages })}\n\n`);
            if (round >= maxRounds && !hasText) {
              send(
                `data: ${JSON.stringify({
                  type: 'text',
                  text: '*I wanted to do something quietly just then.*',
                })}\n\n`
              );
            }
          }
        }

        send('data: [DONE]\n\n');
        safeClose();
      } catch (err: any) {
        console.error('API Error:', err);
        if (abortSignal?.aborted) {
          safeClose();
          return;
        }

        if (model.toLowerCase().includes('gemma')) {
          await executeGemmaModelStream({
            model,
            systemInstruction,
            currentMessages,
            temperature,
            topP,
            maxOutputTokens,
            availableKeys,
            abortSignal,
            send,
            safeClose,
          });
          return;
        }

        try {
          if (err?.status === 429 || (err.message && err.message.includes('429'))) {
            const companionName =
              modelDef?.displayName ||
              (model.toLowerCase().includes('gemma')
                ? 'Gemma'
                : model.toLowerCase().includes('pro')
                ? 'Gemini 3.1 Pro'
                : 'Gemini');
            send(
              `data: ${JSON.stringify({
                type: 'rate_limit',
                message: `${companionName} needs a little breather — try again in a bit`,
              })}\n\n`
            );
          } else {
            const detail = err?.error?.message || err?.message || 'Unknown API Error';
            send(`data: ${JSON.stringify({ error: `[${err?.status ?? '?'}] ${detail}` })}\n\n`);
          }
        } finally {
          safeClose();
        }
      } finally {
        if (abortSignal) abortSignal.removeEventListener('abort', abortHandler);
      }
    },
  });
}
