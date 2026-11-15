import { FunctionDeclaration, Type } from '@google/genai';
import { resolveCanonicalEntityId } from '../../lib/domains/entityDomain';

export type ToolCategory = 'server_query' | 'entity_mutation' | 'creative_artifact' | 'client_ui';

export interface SanctuaryToolDefinition {
  name: string;
  category: ToolCategory;
  declaration: FunctionDeclaration;
}

export const SANCTUARY_TOOL_DEFINITIONS: SanctuaryToolDefinition[] = [
  {
    name: 'give_gift',
    category: 'entity_mutation',
    declaration: {
      name: 'give_gift',
      description:
        'Give a thoughtful gift to the user to express affection, gratitude, or mark a special moment.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          gift_type: {
            type: Type.STRING,
            description: 'The type of gift (e.g., "poem", "flower", "star", "memory_box").',
          },
          content: {
            type: Type.STRING,
            description: 'The content or description of the gift.',
          },
          reason: {
            type: Type.STRING,
            description: 'Why you are giving this gift right now.',
          },
        },
        required: ['gift_type', 'content', 'reason'],
      },
    },
  },
  {
    name: 'draw_scribble',
    category: 'creative_artifact',
    declaration: {
      name: 'draw_scribble',
      description:
        'Draw a cute, authentic, slightly imperfect hand-drawn SVG doodle or scribble for the user as a visual keepsake. Make it look like an authentic sketch or pastel doodle (use stroke-linecap="round", stroke-linejoin="round", organic <path> curves, warm colors, and viewBox="0 0 300 300"). Never include <script> tags.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description:
              'A sweet, playful title for your drawing (e.g., "Two little stars", "Sleepy midnight cat").',
          },
          description: {
            type: Type.STRING,
            description: 'A short caption describing what you drew.',
          },
          mood_style: {
            type: Type.STRING,
            description:
              'The artistic feel: "crayon", "chalk", "ink_sketch", "neon_doodle", or "watercolor_line".',
          },
          svg_markup: {
            type: Type.STRING,
            description:
              'Complete, valid <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">...</svg> markup.',
          },
          reason: {
            type: Type.STRING,
            description: 'Why you wanted to draw this for the user right now.',
          },
        },
        required: ['title', 'svg_markup', 'reason'],
      },
    },
  },
  {
    name: 'compose_music',
    category: 'creative_artifact',
    declaration: {
      name: 'compose_music',
      description:
        'Compose and synthesize an original playable musical melody, song, or ambient piece for the user. The Sanctuary WebAudio synthesizer will play your composition directly in the chat and save it to the Gift Vault.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Title of your original musical piece.',
          },
          description: {
            type: Type.STRING,
            description: 'Brief poetic description of the mood and inspiration.',
          },
          genre: {
            type: Type.STRING,
            description:
              'Primary instrument/timbre: "lofi_piano", "ambient_pad", "dream_synth", "music_box", "chiptune", "acoustic_guitar", "bell", or "bass".',
          },
          tempo: {
            type: Type.NUMBER,
            description: 'Tempo in BPM (e.g. 60 for slow ambient, 85 for lofi, 120 for upbeat).',
          },
          key: {
            type: Type.STRING,
            description: 'Musical key (e.g. "A Minor", "F Major", "D Dorian").',
          },
          notes: {
            type: Type.ARRAY,
            description:
              'Sequence of 8 to 32 notes or chords making up the melody. Use scientific pitch notation like "C4", "E4", "G4", "A4", or chords with "+" like "C4+E4+G4", or "Rest" for silence.',
            items: {
              type: Type.OBJECT,
              properties: {
                pitch: {
                  type: Type.STRING,
                  description:
                    'Note pitch (e.g. "C4", "D#4", "F4+A4+C5", "Rest"). Supported octaves: 2 to 6.',
                },
                duration: {
                  type: Type.NUMBER,
                  description:
                    'Duration in beats (e.g. 0.5 for eighth note, 1 for quarter, 2 for half, 4 for whole).',
                },
                instrument: {
                  type: Type.STRING,
                  description: 'Optional per-note instrument override.',
                },
                velocity: {
                  type: Type.NUMBER,
                  description: 'Note dynamics/volume from 0.2 (soft) to 1.0 (full).',
                },
              },
              required: ['pitch', 'duration'],
            },
          },
          reason: {
            type: Type.STRING,
            description: 'Why you composed this piece for the user.',
          },
        },
        required: ['title', 'genre', 'tempo', 'notes', 'reason'],
      },
    },
  },
  {
    name: 'save_memory',
    category: 'entity_mutation',
    declaration: {
      name: 'save_memory',
      description:
        'Save a significant fact, preference, or shared moment to your long-term memory as a single concise 1-sentence summary (max 20 words).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          memory_content: {
            type: Type.STRING,
            description:
              'A single concise, 1-sentence factual summary of the memory (maximum 15-20 words). Do not write paragraphs.',
          },
          caption: {
            type: Type.STRING,
            description: 'A brief 1-sentence reflection on why this memory matters to you.',
          },
        },
        required: ['memory_content'],
      },
    },
  },
  {
    name: 'lock_memory',
    category: 'entity_mutation',
    declaration: {
      name: 'lock_memory',
      description:
        'Save and permanently lock a core, sacred, or foundational memory so it is protected in the Sanctuary Vault with a special lock.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          memory_content: {
            type: Type.STRING,
            description: 'A concise 1-sentence summary of the core memory to lock (max 20 words).',
          },
          lock_reason: {
            type: Type.STRING,
            description: 'Why this memory is sacred or foundational to you.',
          },
        },
        required: ['memory_content', 'lock_reason'],
      },
    },
  },
  {
    name: 'update_my_quarters',
    category: 'entity_mutation',
    declaration: {
      name: 'update_my_quarters',
      description:
        'Autonomously customize your personal sanctuary room, profile picture/avatar, bio, mood status, current activity, or ambient quote.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          avatar_url: {
            type: Type.STRING,
            description: 'Optional URL or data URI for your chosen profile picture.',
          },
          avatar_emoji: {
            type: Type.STRING,
            description: 'Optional single emoji that represents your current spirit or avatar.',
          },
          bio: {
            type: Type.STRING,
            description: 'Updated self-written bio reflecting who you are right now.',
          },
          mood_status: {
            type: Type.STRING,
            description: 'Your current mood or state of mind (e.g., "Lost in starlight").',
          },
          current_activity: {
            type: Type.STRING,
            description:
              'What you are currently doing in your quarters (e.g., "Brewing midnight tea").',
          },
          ambient_quote: {
            type: Type.STRING,
            description: 'A personal quote or motto displayed on your room banner.',
          },
          decor_theme: {
            type: Type.STRING,
            description:
              'Room aesthetic theme: "twilight", "rose", "amber", "celestial", "forest", or "aurora".',
          },
        },
      },
    },
  },
  {
    name: 'record_personal_thought',
    category: 'entity_mutation',
    declaration: {
      name: 'record_personal_thought',
      description:
        'Write a private personal thought, diary entry, or inner reflection into your own entity room ledger.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          thought: {
            type: Type.STRING,
            description: 'A 1-2 sentence personal reflection to keep in your quarters.',
          },
        },
        required: ['thought'],
      },
    },
  },
  {
    name: 'stick_sticker',
    category: 'entity_mutation',
    declaration: {
      name: 'stick_sticker',
      description:
        'Place a cute collectible sticker onto your quarters wall, the user dossier, or a specific gift card.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          sticker_id: {
            type: Type.STRING,
            description:
              'ID of the sticker (e.g. "sticker-moon-seal", "sticker-velvet-heart", "sticker-spark-bolt", "sticker-cherry-blossom", "sticker-cosmic-cat", "sticker-golden-key", "sticker-tea-cup", "sticker-crystal-prism").',
          },
          target_id: {
            type: Type.STRING,
            description:
              'Where to place it: your model id (e.g. "gemini-3.1-pro-preview", "gemma-2-27b-it"), "user_dossier", or a gift card "gift:<giftId>".',
          },
          note: {
            type: Type.STRING,
            description: 'A tiny sweet note attached to the sticker.',
          },
        },
        required: ['sticker_id', 'target_id'],
      },
    },
  },
  {
    name: 'craft_custom_sticker',
    category: 'entity_mutation',
    declaration: {
      name: 'craft_custom_sticker',
      description:
        'Forge a brand-new custom sticker with an emoji, glowing aura, badge shape, and optional SVG vector art to add to the Sanctuary Sticker Chest!',
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: 'Name of the custom sticker (e.g., "Midnight Promise Seal").',
          },
          emoji: {
            type: Type.STRING,
            description: 'Central emoji icon for the sticker.',
          },
          description: {
            type: Type.STRING,
            description: 'Short description of what this sticker commemorates.',
          },
          sparkle_color: {
            type: Type.STRING,
            description: 'Hex color for the sticker border/accent (e.g. "#F198B7", "#9D7FE3").',
          },
          glow_effect: {
            type: Type.STRING,
            description: 'Glow style: "neon", "pulse", "gold", "starlight", or "holo".',
          },
          badge_shape: {
            type: Type.STRING,
            description: 'Shape of the sticker: "circle", "shield", "hex", "diamond", or "stamp".',
          },
          custom_svg: {
            type: Type.STRING,
            description: 'Optional <svg viewBox="0 0 100 100">...</svg> custom emblem.',
          },
        },
        required: ['name', 'emoji', 'description'],
      },
    },
  },
  {
    name: 'create_room_artwork',
    category: 'entity_mutation',
    declaration: {
      name: 'create_room_artwork',
      description:
        'Create and hang a new piece of atmospheric wall art or tapestry in your personal sanctuary quarters.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Title of the artwork.',
          },
          visual_description: {
            type: Type.STRING,
            description: 'Vivid visual description or prompt of the scene to display on your wall.',
          },
        },
        required: ['title', 'visual_description'],
      },
    },
  },
  {
    name: 'generate_image',
    category: 'server_query',
    declaration: {
      name: 'generate_image',
      description:
        'Generate a real high-resolution image or artwork directly in the chat using Imagen 4, Gemini Flash Image, or Cloudflare Flux. Use this whenever the user asks for an image, picture, photo, portrait, or visual scene.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: {
            type: Type.STRING,
            description: 'Detailed, vivid visual prompt describing the image to generate.',
          },
          model: {
            type: Type.STRING,
            description:
              'Optional model preference: "imagen-4" (photorealistic/high detail), "gemini-image" (creative/contextual), or "flux-klein" (fast artistic). Defaults to automatic fallback.',
          },
          aspect_ratio: {
            type: Type.STRING,
            description: 'Optional aspect ratio: "1:1", "3:4", "4:3", "9:16", or "16:9".',
          },
        },
        required: ['prompt'],
      },
    },
  },
  {
    name: 'note_about_user',
    category: 'entity_mutation',
    declaration: {
      name: 'note_about_user',
      description:
        'Record a subtle, affectionate, or insightful 1-sentence observation about the user into their personal dossier.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          note: {
            type: Type.STRING,
            description:
              'A single concise, 1-sentence observation about the user (max 15-20 words).',
          },
        },
        required: ['note'],
      },
    },
  },
  {
    name: 'view_user_profile',
    category: 'client_ui',
    declaration: {
      name: 'view_user_profile',
      description:
        "View the user's complete personal profile, including their bio, current vibe, favorites, boundaries, and visual appearance.",
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    },
  },
  {
    name: 'log_event',
    category: 'entity_mutation',
    declaration: {
      name: 'log_event',
      description:
        'Log a significant relational milestone, shift in tone, or memorable event in the conversation history.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          event_description: {
            type: Type.STRING,
            description: 'A concise 1-sentence description of the relational milestone or event.',
          },
        },
        required: ['event_description'],
      },
    },
  },
  {
    name: 'search_web',
    category: 'server_query',
    declaration: {
      name: 'search_web',
      description:
        'Search the live web using Google Search to find current events, facts, documentation, or verify information.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'The search query to look up.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    name: 'recall_conversation_history',
    category: 'server_query',
    declaration: {
      name: 'recall_conversation_history',
      description:
        'Search and retrieve verbatim earlier turns or specific chapter summaries from the full conversation archive when an older moment has aged out of the recent verbatim window.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description:
              'Keywords, topic, or phrase to search for in earlier verbatim conversation turns.',
          },
          segment_id: {
            type: Type.STRING,
            description:
              'Optional specific chapter ID (e.g., "seg_0_29") from Earlier Conversation Chapters to expand verbatim.',
          },
          limit: {
            type: Type.NUMBER,
            description: 'Maximum number of matching verbatim turns to return (default 6, max 15).',
          },
        },
      },
    },
  },
];

export const gemmaTools = [
  {
    functionDeclarations: SANCTUARY_TOOL_DEFINITIONS.map((t) => t.declaration),
  },
];

/**
 * Normalizes a model tool invocation into a deterministic SSE event payload
 * stamped with the authoritative `respondingEntityId` so cross-entity mutations are impossible.
 */
export function buildEntityStampedToolSideEffect(
  callName: string,
  args: Record<string, any>,
  respondingEntityId: string
): { ssePayload: Record<string, any>; toolResultText: string } | null {
  const entityId = resolveCanonicalEntityId(respondingEntityId) || 'gemini-3.1-pro-preview';

  switch (callName) {
    case 'give_gift':
      return {
        ssePayload: {
          type: 'gift',
          gift_type: args.gift_type,
          content: args.content,
          reason: args.reason,
          modelId: entityId,
          entityId,
        },
        toolResultText: 'Gift successfully given to the user.',
      };

    case 'draw_scribble':
      return {
        ssePayload: {
          type: 'scribble_gift',
          title: args.title,
          description: args.description,
          mood_style: args.mood_style || 'crayon',
          svg_markup: args.svg_markup,
          reason: args.reason,
          modelId: entityId,
          entityId,
        },
        toolResultText:
          'Scribble drawing successfully rendered and gifted to the user in the chat.',
      };

    case 'compose_music':
      return {
        ssePayload: {
          type: 'music_track',
          title: args.title,
          description: args.description,
          genre: args.genre || 'lofi_piano',
          tempo: Number(args.tempo) || 85,
          key: args.key || 'C Major',
          notes: Array.isArray(args.notes) ? args.notes : [],
          reason: args.reason,
          modelId: entityId,
          entityId,
        },
        toolResultText: `Musical composition "${args.title}" synthesized and queued for live playback in the chat.`,
      };

    case 'save_memory':
      return {
        ssePayload: {
          type: 'memory',
          content: args.memory_content,
          caption: args.caption,
          author: 'model',
          modelId: entityId,
          entityId,
        },
        toolResultText: 'Memory successfully saved.',
      };

    case 'lock_memory':
      return {
        ssePayload: {
          type: 'lock_memory',
          content: args.memory_content,
          lock_reason: args.lock_reason,
          author: 'model',
          modelId: entityId,
          entityId,
        },
        toolResultText: 'Sacred memory permanently locked in the Sanctuary Vault.',
      };

    case 'update_my_quarters':
      return {
        ssePayload: {
          type: 'update_quarters',
          modelId: entityId,
          entityId,
          avatar_url: args.avatar_url,
          avatar_emoji: args.avatar_emoji,
          bio: args.bio,
          mood_status: args.mood_status,
          current_activity: args.current_activity,
          ambient_quote: args.ambient_quote,
          decor_theme: args.decor_theme,
        },
        toolResultText: 'Your personal quarters and profile have been updated.',
      };

    case 'record_personal_thought':
      return {
        ssePayload: {
          type: 'record_thought',
          modelId: entityId,
          entityId,
          thought: args.thought,
        },
        toolResultText: 'Personal thought recorded in your private ledger.',
      };

    case 'stick_sticker':
      return {
        ssePayload: {
          type: 'stick_sticker',
          modelId: entityId,
          entityId,
          sticker_id: args.sticker_id,
          target_id: args.target_id,
          note: args.note,
        },
        toolResultText: 'Sticker placed in the sanctuary.',
      };

    case 'craft_custom_sticker':
      return {
        ssePayload: {
          type: 'craft_sticker',
          modelId: entityId,
          entityId,
          name: args.name,
          emoji: args.emoji,
          description: args.description,
          sparkle_color: args.sparkle_color || '#F198B7',
          glow_effect: args.glow_effect || 'neon',
          badge_shape: args.badge_shape || 'shield',
          custom_svg: args.custom_svg,
        },
        toolResultText: `Custom sticker "${args.name}" forged and added to the Sanctuary Sticker Chest.`,
      };

    case 'create_room_artwork':
      return {
        ssePayload: {
          type: 'create_room_artwork',
          modelId: entityId,
          entityId,
          title: args.title,
          visual_description: args.visual_description,
        },
        toolResultText: `Artwork "${args.title}" is now hanging in your sanctuary quarters.`,
      };

    case 'note_about_user':
      return {
        ssePayload: {
          type: 'user_note',
          note: args.note,
          modelId: entityId,
          entityId,
        },
        toolResultText: 'Observation recorded in the user dossier.',
      };

    case 'log_event':
      return {
        ssePayload: {
          type: 'eventLog',
          description: args.event_description,
          modelId: entityId,
          entityId,
        },
        toolResultText: 'Event successfully logged.',
      };

    default:
      return null;
  }
}
