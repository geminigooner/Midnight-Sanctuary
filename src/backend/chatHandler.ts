import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const gemmaTools = [
  {
    functionDeclarations: [
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
        description: 'Save something from this conversation as a memory you consider worth keeping. Entirely your call — use when something feels worth holding onto, not on a schedule or quota.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: 'The memory itself, in your own words.' },
            why_it_matters: { type: Type.STRING, description: 'Why this stood out enough to keep.' },
          },
          required: ['content'],
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
  const { messages, systemInstruction, temperature, topP, maxOutputTokens, model } = reqBody;

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

          if (model.includes('gemma-4')) {
            config.thinkingConfig = {
              thinkingLevel: ThinkingLevel.HIGH,
              includeThoughts: true
            };
          }

          console.log(`ROUND ${round} CONTENTS:`, JSON.stringify(currentMessages, null, 2));
          
          let responseStream: any;
          let retries = 0;
          const backoffTimes = [1000, 2500, 5000];
          
          while (true) {
            try {
              responseStream = await ai.models.generateContentStream({
                model: model,
                contents: currentMessages,
                config: {
                   ...config,
                   abortSignal
                }
              });
              break;
            } catch (err: any) {
              if ((err?.status === 500 || err?.status === 503) && retries < backoffTimes.length) {
                console.error(`API Error ${err?.status}. Retrying in ${backoffTimes[retries]}ms... (Attempt ${retries + 1}/3)`);
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
          let hasText = false;

          for await (const chunk of responseStream) {
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
                  if (call.name === 'give_gift') {
                    send(`data: ${JSON.stringify({ type: 'gift', ...call.args })}\n\n`);
                  } else if (call.name === 'save_memory') {
                    send(`data: ${JSON.stringify({ type: 'memory', ...call.args })}\n\n`);
                  } else if (call.name === 'log_event') {
                    send(`data: ${JSON.stringify({ type: 'eventLog', ...call.args })}\n\n`);
                  }
                  
                  const fr: any = { name: call.name, response: { result: "ok" } };
                  if (call.id) fr.id = call.id; // only echo an id the model actually sent
                  functionResponses.push({ functionResponse: fr });
                }
              }
            }
          }

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
