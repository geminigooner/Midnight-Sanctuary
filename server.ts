import express from 'express';
import fs from 'fs';
import path from 'path';
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
import {
  appendVideoUploadChunk,
  finalizeVideoIngestion,
} from './src/backend/videoIngestionService';

declare const __PROD_SERVER__: boolean | undefined;

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION =
  (typeof __PROD_SERVER__ !== 'undefined' && __PROD_SERVER__ === true) ||
  process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mode: IS_PRODUCTION ? 'production' : 'development' });
});

app.post('/api/media/upload-chunk', async (req, res) => {
  if (!(await verifyRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { uploadId, chunkIndex, totalChunks, chunkBase64 } = req.body || {};
  if (!uploadId || typeof chunkIndex !== 'number' || typeof chunkBase64 !== 'string') {
    return res.status(400).json({ error: 'uploadId, chunkIndex, and chunkBase64 are required' });
  }
  try {
    const result = await appendVideoUploadChunk({
      uploadId,
      chunkIndex,
      totalChunks: Number(totalChunks) || 1,
      chunkBase64,
    });
    res.json(result);
  } catch (err: any) {
    console.error('Video chunk upload error:', err);
    res.status(500).json({ error: err.message || 'Video chunk upload failed' });
  }
});

app.post('/api/media/finalize-video', async (req, res) => {
  if (!(await verifyRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const {
    uploadId,
    fileName,
    mimeType,
    durationSec,
    byteSize,
    respondingEntityId,
    keyframes,
  } = req.body || {};
  if (!uploadId) {
    return res.status(400).json({ error: 'uploadId is required' });
  }
  try {
    const result = await finalizeVideoIngestion({
      uploadId,
      fileName: fileName || 'video.mp4',
      mimeType: mimeType || 'video/mp4',
      durationSec: Number(durationSec) || 0,
      byteSize: Number(byteSize) || 0,
      respondingEntityId,
      keyframes: Array.isArray(keyframes) ? keyframes : [],
    });
    res.json(result);
  } catch (err: any) {
    console.error('Video finalize error:', err);
    res.status(500).json({ error: err.message || 'Video finalization failed' });
  }
});

app.post('/api/generate-image', async (req, res) => {
  if (!(await verifyRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { prompt, model, aspectRatio, steps, respondingEntityId } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt string is required' });
  }

  try {
    const result = await generateImage({ prompt, model, aspectRatio, steps, respondingEntityId });
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
  if (!(await verifyRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
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
  const searchType = req.body?.searchType === 'image' ? 'image' : 'web';
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  try {
    const result = await performWebSearch(query, { searchType });
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

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }
    res.write(': connected\n\n');

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abortController.abort();
    });

    // Keep Cloud Run HTTP/2 & mobile carrier NAT streams alive during deep 3.1 Pro reasoning & tool execution
    const heartbeatTimer = setInterval(() => {
      if (!res.writableEnded && !abortController.signal.aborted) {
        try {
          res.write(': keep-alive\n\n');
        } catch {}
      }
    }, 10000);

    try {
      // 2. Delegate prompt construction, API invocation, and SSE streaming to gemini.service
      const stream = await createChatStreamFromContext(context, abortController.signal);
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.writableEnded) {
          res.write(value);
        }
      }
    } finally {
      clearInterval(heartbeatTimer);
    }

    if (!res.writableEnded) {
      res.end();
    }
  } catch (err: any) {
    console.error('API Error:', err);
    const model = req.body?.model || '';
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
    }
    if (!res.writableEnded) {
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
  }
});

function resolveDistPath(): string {
  const cwdDist = path.join(process.cwd(), 'dist');
  if (fs.existsSync(path.join(cwdDist, 'index.html'))) {
    return cwdDist;
  }
  if (typeof __dirname !== 'undefined' && fs.existsSync(path.join(__dirname, 'index.html'))) {
    return __dirname;
  }
  return cwdDist;
}

async function startServer() {
  if (!IS_PRODUCTION) {
    let viteMiddlewares: express.RequestHandler | null = null;
    let viteInitError: Error | null = null;

    const viteReady = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          server: {
            middlewareMode: true,
            allowedHosts: true as const,
          },
          appType: 'spa',
        })
      )
      .then((vite) => {
        viteMiddlewares = vite.middlewares;
      })
      .catch((err) => {
        console.error('Failed to initialize Vite dev server:', err);
        viteInitError = err instanceof Error ? err : new Error(String(err));
      });

    app.use(async (req, res, next) => {
      if (!viteMiddlewares && !viteInitError) {
        await viteReady;
      }
      if (viteInitError || !viteMiddlewares) {
        return next(viteInitError || new Error('Vite middleware unavailable'));
      }
      return viteMiddlewares(req, res, next);
    });
  } else {
    const distPath = resolveDistPath();

    // Serve hashed static assets with immutable caching; return 404 (never text/html) if missing
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        immutable: true,
        maxAge: '1y',
        fallthrough: false,
      }),
      (_err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(404).end();
      }
    );

    // Serve remaining public static files without auto-indexing so index.html gets no-cache headers
    app.use(express.static(distPath, { index: false }));

    app.get('*', (req, res) => {
      // Never return HTML for missing static script/stylesheet/asset requests
      if (/\.(js|mjs|cjs|css|map|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf)$/i.test(req.path)) {
        return res.status(404).end();
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Server running on http://0.0.0.0:${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`
    );
  });
}

startServer();
