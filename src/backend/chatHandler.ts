import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { modelRegistry, assembleModelContext } from '../lib/modelRegistry';
import { performWebSearch } from './searchService';
import { generateImage } from './imageService';
import { Memory, Gift } from '../lib/types';

const gemmaTools = [
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
        description: 'Look at the visual presentation of the user\'s profile (image, background, layout, decorations, etc). Use this when the user asks you to look at their profile or asks about how they decorated it.',
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
                  velocity: { type: Type.NUMBER, description: 'Volume velocity between 0.1 and 1.0 (defaults to 0.8).' }
                },
                required: ['pitch', 'duration']
              }
            }
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

export function createChatStream(reqBody: any, apiKey: string, abortSignal?: AbortSignal): ReadableStream {
  const { messages, systemInstruction, temperature, topP, maxOutputTokens, model, forceCloudflare, thinkingLevel, includeThoughts } = reqBody;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  if (!model) {
    throw new Error('Model ID is required.');
  }

  const ai = new GoogleGenAI({ apiKey, httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' } });
  let currentMessages = [...messages];
  const maxRounds = 5;
  let round = 0;

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;
      const send = (data: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (e) {
            isClosed = true;
          }
        }
      };
      const safeClose = () => {
        if (!isClosed) {
          isClosed = true;
          try { controller.close(); } catch (e) {}
        }
      };
      
      const abortHandler = () => {
         console.warn("Client disconnected, aborting generation...");
         safeClose();
      };
      if (abortSignal) abortSignal.addEventListener('abort', abortHandler);

      try {
        while (round < maxRounds) {
          if (abortSignal?.aborted) break;
          round++;

          const config: any = {
            systemInstruction,
            temperature: temperature ?? 2.0,
            topP: topP ?? 0.95,
            maxOutputTokens: maxOutputTokens ?? 4096,
            tools: gemmaTools,
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ]
          };

          const modelDef = modelRegistry.get(model);
          const userThinkingLevel = thinkingLevel || 'HIGH';
          const userIncludeThoughts = includeThoughts ?? true;
          
          if (modelDef?.capabilities.supportsThinking) {
            const defLevelKey = modelDef.defaultThinkingLevel || 'MEDIUM';
            const defaultLevel = ThinkingLevel[defLevelKey as keyof typeof ThinkingLevel] || ThinkingLevel.MEDIUM;
            config.thinkingConfig = {
              thinkingLevel: thinkingLevel ? ThinkingLevel[thinkingLevel as keyof typeof ThinkingLevel] || defaultLevel : defaultLevel,
              includeThoughts: userIncludeThoughts
            };
          } else if (model.includes('gemma-4')) {
            config.thinkingConfig = {
              thinkingLevel: ThinkingLevel[userThinkingLevel as keyof typeof ThinkingLevel] || ThinkingLevel.HIGH,
              includeThoughts: userIncludeThoughts
            };
            config.maxOutputTokens = Math.max(config.maxOutputTokens ?? 4096, 16384);
          }

          console.log(`ROUND ${round} CONTENTS:`, JSON.stringify(currentMessages, null, 2));
          
          let responseStream: any;
          let retries = 0;
          const backoffTimes = [1000, 2500, 5000];
          
          if (forceCloudflare) {
            if (model.toLowerCase().includes('gemma')) {
              throw new Error("Forcing Cloudflare fallback for testing");
            } else {
              // Ignore forceCloudflare for Gemini
            }
          }

          let useLegacyFallback = false;
          let currentAi = ai;

          while (true) {
            try {
              responseStream = await currentAi.models.generateContentStream({
                model: model,
                contents: currentMessages,
                config: {
                   ...config,
                   abortSignal
                }
              });
              break;
            } catch (err: any) {
              const status = err?.status;
              
              // Only fallback for registered Gemini 3 Preview models
              const isGemini3Preview = modelDef?.identityId === 'gemini-3-flash-preview' || modelDef?.identityId === 'gemini-3.1-pro-preview';
              const isFallbackEligibleError = status === 429 || status === 401 || status === 403 || status === 404;
              const hasLegacyKey = !!process.env.GEMINI_LEGACY_API_KEY;

              if (isGemini3Preview && isFallbackEligibleError && hasLegacyKey && !useLegacyFallback) {
                console.warn(`[Fallback] Primary API key failed with ${status} for ${model}. Retrying with GEMINI_LEGACY_API_KEY.`);
                useLegacyFallback = true;
                currentAi = new GoogleGenAI({ apiKey: process.env.GEMINI_LEGACY_API_KEY as string, httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' } });
                continue;
              }

              if ((status === 500 || status === 503) && retries < backoffTimes.length) {
                console.error(`API Error ${status}. Retrying in ${backoffTimes[retries]}ms... (Attempt ${retries + 1}/3)`);
                await new Promise(resolve => setTimeout(resolve, backoffTimes[retries]));
                retries++;
              } else {
                throw err;
              }
            }
          }

          let modelParts: any[] = [];
          let functionResponses: any[] = [];
          let hasFunctionCalls = false;
          let hasClientFulfillmentSent = false;
          let hasText = false;
          let blocked = false;

          const requestStartTime = Date.now();
          let firstTokenTime = null;
          let streamStatus = 'normal';

          try {
            for await (const chunk of responseStream) {
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
                console.log(`[Stream] First token latency: ${firstTokenTime - requestStartTime}ms for model ${model}`);
              }
              const fr = chunk.candidates?.[0]?.finishReason;
            if (fr) {
              console.log("FINISH REASON:", fr, JSON.stringify(chunk.candidates?.[0]?.safetyRatings ?? []));
              if (fr !== 'STOP') {
                send(`data: ${JSON.stringify({ type: 'finish_reason', reason: fr })}\n\n`);
              }
            }
            if (chunk.candidates && chunk.candidates.length > 0) {
              if (chunk.candidates[0].finishReason === 'SAFETY') {
                 send('data: ' + JSON.stringify({ error: 'Safety block triggered: The model refused to generate a response due to safety filters.' }) + '\n\n');
                 blocked = true;
                 break;
              }
            }
            if (chunk.candidates && chunk.candidates.length > 0 && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
              for (const part of chunk.candidates[0].content.parts) {
                console.log("RECEIVED PART:", JSON.stringify(part));
                modelParts.push(part);
                if (part.thought === true && part.text) {
                  send(`data: ${JSON.stringify({ type: 'thought', text: part.text })}\n\n`);
                } else if (part.text) {
                  hasText = true;
                  send(`data: ${JSON.stringify({ text: part.text })}\n\n`);
                } else if (part.functionCall) {
                  hasFunctionCalls = true;
                  const call = part.functionCall;
                  let requireClientFulfillment = false;
                  if (call.name === 'view_user_profile' && !hasClientFulfillmentSent) {
                    send(`data: ${JSON.stringify({ type: 'client_tool_call', name: call.name, callId: call.id })}\n\n`);
                    requireClientFulfillment = true;
                    hasClientFulfillmentSent = true;
                    hasFunctionCalls = true;
                  } else if (call.name === 'draw_scribble') {
                    send(`data: ${JSON.stringify({ 
                      type: 'scribble_gift', 
                      title: call.args?.title || 'A Little Scribble',
                      description: call.args?.description || '',
                      mood_style: call.args?.mood_style || 'crayon',
                      svg_markup: call.args?.svg_markup || '',
                      reason: call.args?.reason || 'I drew this for you.',
                      modelId: model 
                    })}\n\n`);
                  } else if (call.name === 'compose_music') {
                    send(`data: ${JSON.stringify({ 
                      type: 'music_track', 
                      title: call.args?.title || 'Original Sanctuary Composition',
                      description: call.args?.description || '',
                      genre: call.args?.genre || 'lofi_piano',
                      tempo: call.args?.tempo || 85,
                      key: call.args?.key || 'C Major',
                      notes: Array.isArray(call.args?.notes) ? call.args.notes : [],
                      reason: call.args?.reason || 'I composed this melody for you.',
                      modelId: model 
                    })}\n\n`);
                  } else if (call.name === 'give_gift') {
                    send(`data: ${JSON.stringify({ type: 'gift', ...call.args })}\n\n`);
                  } else if (call.name === 'save_memory') {
                    send(`data: ${JSON.stringify({ type: 'memory', ...call.args, author: 'model', modelId: model })}\n\n`);
                  } else if (call.name === 'lock_memory') {
                    send(`data: ${JSON.stringify({ type: 'lock_memory', ...call.args, author: 'model', modelId: model, isLocked: true })}\n\n`);
                  } else if (call.name === 'update_my_quarters') {
                    send(`data: ${JSON.stringify({ type: 'update_quarters', ...call.args, modelId: model })}\n\n`);
                  } else if (call.name === 'record_personal_thought') {
                    send(`data: ${JSON.stringify({ type: 'record_thought', ...call.args, modelId: model })}\n\n`);
                  } else if (call.name === 'note_about_user') {
                    send(`data: ${JSON.stringify({ type: 'user_note', ...call.args })}\n\n`);
                  } else if (call.name === 'log_event') {
                    send(`data: ${JSON.stringify({ type: 'eventLog', ...call.args })}\n\n`);
                  } else if (call.name === 'stick_sticker') {
                    send(`data: ${JSON.stringify({ type: 'stick_sticker', ...call.args, modelId: model })}\n\n`);
                  } else if (call.name === 'craft_custom_sticker') {
                    send(`data: ${JSON.stringify({ type: 'craft_sticker', ...call.args, modelId: model })}\n\n`);
                  } else if (call.name === 'create_room_artwork') {
                    send(`data: ${JSON.stringify({ type: 'create_room_artwork', ...call.args, modelId: model })}\n\n`);
                  } else if (call.name === 'generate_image') {
                    const prompt = call.args?.prompt || '';
                    const aspectRatio = call.args?.aspect_ratio || '1:1';
                    const modelTarget = call.args?.model_target || '@cf/black-forest-labs/flux-1-schnell';
                    
                    send(`data: ${JSON.stringify({ type: 'image_generating', prompt, modelTarget })}\n\n`);
                    const imgRes = await generateImage({ prompt, aspectRatio, model: modelTarget });
                    send(`data: ${JSON.stringify({ type: 'image_generated', ...imgRes, modelId: model })}\n\n`);
                    
                    const fr: any = {
                      name: call.name,
                      response: {
                        result: imgRes.success ? `Image successfully generated (${imgRes.provider}): ${imgRes.imageUrl}` : `Image generation failed: ${imgRes.error}`
                      }
                    };
                    if (call.id) fr.id = call.id;
                    functionResponses.push({ functionResponse: fr });
                    requireClientFulfillment = true;
                  } else if (call.name === 'search_web') {
                    const query = call.args?.query || '';
                    const searchRes = await performWebSearch(query);
                    send(`data: ${JSON.stringify({ type: 'search_result', query, results: searchRes.items, error: searchRes.error })}\n\n`);
                    const fr: any = {
                      name: call.name,
                      response: {
                        result: searchRes.error ? `Search error: ${searchRes.error}` : JSON.stringify(searchRes.items)
                      }
                    };
                    if (call.id) fr.id = call.id;
                    functionResponses.push({ functionResponse: fr });
                    requireClientFulfillment = true; // Handled directly on server
                  }
                  
                  if (!requireClientFulfillment) {
                    const fr: any = { name: call.name, response: { result: "ok" } };
                    if (call.id) fr.id = call.id; // only echo an id the model actually sent
                    functionResponses.push({ functionResponse: fr });
                  }
                }
              }
            }
            } // close for await
          } catch (e: any) {
            if (e.name === 'AbortError' || abortSignal?.aborted) {
               streamStatus = 'aborted';
               console.warn(`[Stream] Aborted for model ${model} after ${Date.now() - requestStartTime}ms`);
               throw e;
            } else {
               streamStatus = 'errored';
               console.error(`[Stream] Errored for model ${model}:`, e.message);
               throw e;
            }
          } finally {
            if (streamStatus === 'normal') {
               console.log(`[Stream] Ended normally for model ${model} after ${Date.now() - requestStartTime}ms. First token latency: ${firstTokenTime ? firstTokenTime - requestStartTime : 'N/A'}ms.`);
            }
          }

          if (blocked) { safeClose(); return; }

          if (!hasFunctionCalls) {
            // Preserve the exact API response, including thoughtSignature metadata.
            send(`data: ${JSON.stringify({ type: 'model_parts', parts: modelParts })}\n\n`);
            break;
          } else {
            const newMessages = [
              { role: 'model', parts: modelParts },
              { role: 'user', parts: functionResponses }
            ];
            currentMessages.push(...newMessages);
            send(`data: ${JSON.stringify({ type: 'history_append', messages: newMessages })}\n\n`);
            if (round >= maxRounds && !hasText) {
              send(`data: ${JSON.stringify({ text: "*I wanted to do something quietly just then.*" })}\n\n`);
            }
          }
        }

        send('data: [DONE]\n\n');
        safeClose();
      } catch (err: any) {
        console.error('API Error:', err);
        console.error('API Error detail:', JSON.stringify({
          status: err?.status, code: err?.code, name: err?.name,
          message: err?.message, response: err?.response?.data ?? err?.error
        }, null, 2));

        if (abortSignal?.aborted) {
          safeClose();
          return;
        }

        try {
          if (!model.toLowerCase().includes('gemma')) {
            throw new Error("Cloudflare fallback is only allowed for Gemma models.");
          }
          console.log("Attempting Cloudflare fallback...");
          const cfMessages = [];
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
          
          const cfToken = process.env.CF_TOKEN || process.env.CF_API_TOKEN;
          const cfAccountId = process.env.CF_ACCOUNT_ID || 'default';
          
          send(`data: ${JSON.stringify({ type: 'backend', name: 'cloudflare' })}\n\n`);
          
          const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/google/gemma-4-26b-a4b-it`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${cfToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages: cfMessages,
              stream: true,
              max_tokens: 4096
            }),
            signal: abortSignal
          });

          if (!cfRes.ok) {
            throw new Error(`Cloudflare API Error: ${cfRes.status} ${cfRes.statusText}`);
          }

          const reader = cfRes.body?.getReader();
          if (!reader) throw new Error("No response body from Cloudflare");
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') break;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.response) {
                    send(`data: ${JSON.stringify({ type: 'text', text: parsed.response })}\n\n`);
                  }
                } catch (e) {}
              }
            }
          }
          
          if (buffer.startsWith('data: ')) {
             const data = buffer.slice(6).trim();
             if (data !== '[DONE]') {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.response) {
                    send(`data: ${JSON.stringify({ type: 'text', text: parsed.response })}\n\n`);
                  }
                } catch (e) {}
             }
          }

          send('data: [DONE]\n\n');
          safeClose();
          return;
        } catch (cfErr: any) {
          console.error("Cloudflare fallback failed:", cfErr);
        }

        try {
          if (err?.status === 429 || (err.message && err.message.includes('429'))) {
            send(`data: ${JSON.stringify({ type: 'rate_limit', message: 'Gemma needs a little breather — try again in a bit' })}\n\n`);
          } else {
            const detail = err?.error?.message || err?.message || 'Unknown API Error';
            send(`data: ${JSON.stringify({ error: `[${err?.status ?? '?'}] ${detail}` })}\n\n`);
          }
        } catch (sendErr) {
          console.error('Error sending error chunk:', sendErr);
        } finally {
          safeClose();
        }
      } finally {
        if (abortSignal) abortSignal.removeEventListener('abort', abortHandler);
      }
    }
  });
}
