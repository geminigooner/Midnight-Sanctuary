import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { performWebSearch } from './src/backend/searchService';
import { generateImage } from './src/backend/imageService';
import { verifyRequest, verifyRequestWithUser } from './src/backend/verifyAuth';
import { modelRegistry } from './src/lib/modelRegistry';
import {
  createChatStreamFromContext,
  generateEmbedding,
  listAvailableModels,
  resolveAvailableApiKeys,
} from './src/backend/gemini.service';
import { resolveExternalChatContext } from './src/backend/firestoreContext.service';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

app.post('/api/generate-image', async (req, res) => {
  if (!(await verifyRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { prompt, model, aspectRatio, steps } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt string is required' });
  }

  try {
    const result = await generateImage({ prompt, model, aspectRatio, steps });
    res.json(result);
  } catch (err: any) {
    console.error('Image generation endpoint error:', err);
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

app.get('/api/models', async (req, res) => {
  if (!(await verifyRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const models = await listAvailableModels();
    res.json(models);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown API Error' });
  }
});

app.post('/api/embed', async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text string is required' });
  }
  try {
    const embeddingValues = await generateEmbedding(text);
    res.json({ embedding: embeddingValues });
  } catch (err: any) {
    console.error('Embedding endpoint error:', err);
    res.status(500).json({ error: err.message || 'Embedding failed' });
  }
});

app.post('/api/search', async (req, res) => {
  if (!(await verifyRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const query = req.body?.query || '';
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  try {
    const result = await performWebSearch(query);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Search execution failed' });
  }
});

app.post('/api/chat', async (req, res) => {
  const authResult = await verifyRequestWithUser(req);
  if (!authResult.valid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Hydrate external conversation & user context from Firestore (with seamless client fallback)
    const context = await resolveExternalChatContext(
      authResult.uid,
      authResult.idToken,
      req.body
    );

    const { availableKeys, keyEnvName, isGemma } = resolveAvailableApiKeys(context.model);
    if (availableKeys.length === 0 && !isGemma) {
      return res.status(500).json({
        error: `${keyEnvName} (or backup key) is not configured in the environment for model ${context.model}.`,
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abortController.abort();
    });

    // 2. Delegate prompt construction, API invocation, and SSE streaming to gemini.service
    const stream = await createChatStreamFromContext(context, abortController.signal);
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err: any) {
    console.error('API Error:', err);
    const model = req.body?.model || '';
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
    }
    if (err?.status === 429 || (err.message && err.message.includes('429'))) {
      const companionName =
        modelRegistry.getDisplayName(model) ||
        (model.toLowerCase().includes('gemma') ? 'Gemma' : 'Gemini');
      res.write(
        `data: ${JSON.stringify({
          type: 'rate_limit',
          message: `${companionName} needs a little breather — try again in a bit`,
        })}\n\n`
      );
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message || 'Unknown API Error' })}\n\n`);
    }
    res.end();
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
