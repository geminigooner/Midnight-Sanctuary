import express from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { performWebSearch } from './src/backend/searchService';
import { createChatStream } from './src/backend/chatHandler';
import { verifyRequest } from './src/backend/verifyAuth';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

app.get('/api/models', async (req, res) => {
  if (!(await verifyRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!process.env.GENAI_API_KEY) {
    return res.status(500).json({ error: 'GENAI_API_KEY is not configured in the environment.' });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GENAI_API_KEY, httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' } });
  try {
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
    res.json(models);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown API Error' });
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
  if (!(await verifyRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const model = req.body?.model || '';
  const modelLower = model.toLowerCase();
  const isGemma = modelLower.includes('gemma');
  const isGemini3Paid = modelLower.includes('gemini-3.1-pro') || modelLower.includes('gemini-3-flash') || modelLower.includes('3.1-pro') || modelLower.includes('3-flash');
  
  let apiKey;
  let keyName;

  if (isGemini3Paid) {
    // Paid key dedicated for Flash 3 and Gemini Pro 3.1
    apiKey = process.env.GEMINI_LEGACY_API_KEY || process.env.GENAI_API_KEY || process.env.GEMINI_API_KEY;
    keyName = 'GEMINI_LEGACY_API_KEY';
  } else if (isGemma) {
    // Gemma fallback key (Cloudflare is handled first in chatHandler with CF_TOKEN)
    apiKey = process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY;
    keyName = 'GEMINI_API_KEY';
  } else {
    // Other Gemini models
    apiKey = process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY;
    keyName = 'GEMINI_API_KEY';
  }
  
  if (!apiKey && !isGemma) {
    return res.status(500).json({ error: `${keyName} is not configured in the environment for model ${model}.` });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abortController.abort();
    });

    const stream = createChatStream(req.body, apiKey, abortController.signal);
    const reader = stream.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err: any) {
    console.error('API Error:', err);
    if (err?.status === 429 || (err.message && err.message.includes('429'))) {
      res.write(`data: ${JSON.stringify({ type: 'rate_limit', message: 'Gemma needs a little breather — try again in a bit' })}\n\n`);
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
