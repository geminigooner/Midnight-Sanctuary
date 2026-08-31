import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { modelRegistry, assembleModelContext } from '../lib/modelRegistry';
import { performWebSearch } from './searchService';
import { Memory, Gift } from '../lib/types';

const gemmaTools = [
  {
    functionDeclarations: [
      {
        name: 'search_web',
        description: 'Search the live web for recent news, fraud intelligence, articles, security alerts, technical documentation, or factual verification. Use this whenever the user asks for current information or verification.',
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
        description: 'Autonomously update and redecorate your own personal Sanctuary Quarters (room). You can update your bio, current mood status, current activity, ambient quote, tagline, or decor theme palette (twilight, rose, amber, celestial, forest).',
        parameters: {
          type: Type.OBJECT,
          properties: {
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
