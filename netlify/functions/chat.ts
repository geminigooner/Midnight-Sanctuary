import { createChatStream } from '../../src/backend/chatHandler';
import { verifyRequest } from '../../src/backend/verifyAuth';
import { resolveModelRoute } from '../../src/lib/modelRouter';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!(await verifyRequest(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const reqBody = await req.json();
    // Same key selection as server.ts: resolveModelRoute() decides which env key a model uses
    const route = resolveModelRoute(String(reqBody?.model || ''));
    const apiKey = process.env[route.keyEnvName] || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GEMINI_LEGACY_API_KEY;
    if (!apiKey && !route.isGemma) {
      return new Response(JSON.stringify({ error: `${route.keyEnvName} is not configured.` }), { status: 500 });
    }
    const stream = createChatStream(reqBody, apiKey, req.signal);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown API Error' }), { status: 500 });
  }
};
