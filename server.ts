import './server/env';
import express from 'express';
import path from 'path';
import multer from 'multer';
import { requireAuth, type AuthedRequest } from './server/auth';
import { adminAuth } from './server/firebaseAdmin';
import { createModuleOutline } from './server/generation/moduleAgent';
import { generateChapterVersion } from './server/generation/chapterAgent';
import { readChapterJson } from './server/generation/chapterStorage';
import { extractImageText } from './server/generation/openai';
import {
  createCourseShell,
  findChapterVersion,
  getCourseForUser,
  markCourseFailed,
  markCourseOutlineReady,
  sanitizeFiles,
} from './server/generation/moduleRepository';
import { completeChat, generateChatTitle } from './server/generation/chatAgent';

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add body parser for large json
  app.use(express.json({ limit: '50mb' }));

  app.post('/api/modules', requireAuth, async (req: AuthedRequest, res) => {
    let courseId: string | null = null;
    try {
      const { topic = '', moduleType = 'guided', personalization = {}, files = [] } = req.body || {};
      const safeFiles = sanitizeFiles(files);
      courseId = await createCourseShell({
        userId: req.user!.uid,
        authorName: req.user!.name || req.user!.email?.split('@')[0] || 'Anonymous',
        topic,
        moduleType,
        personalization,
      });

      const outline = await createModuleOutline({
        topic,
        moduleType,
        personalization,
        files: safeFiles,
      });
      await markCourseOutlineReady(courseId, outline);
      res.json({ courseId });
    } catch (error: any) {
      if (courseId) {
        await markCourseFailed(courseId, error.message || String(error)).catch(() => {});
      }
      res.status(500).json({ error: error.message || 'Failed to create module', courseId });
    }
  });

  app.post('/api/modules/:courseId/chapters/:chapterId/generate', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const result = await generateChapterVersion({
        courseId: req.params.courseId,
        chapterId: req.params.chapterId,
        userId: req.user!.uid,
        generationConfig: req.body?.generationConfig || {},
        files: sanitizeFiles(req.body?.files || []),
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to generate chapter' });
    }
  });

  app.get('/api/modules/:courseId/chapters/:chapterId/content', async (req: AuthedRequest, res) => {
    try {
      const authHeader = req.header('authorization') || '';
      const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
      const decoded = token ? await adminAuth.verifyIdToken(token).catch(() => null) : null;
      const course = await getCourseForUser(req.params.courseId, decoded?.uid, true);
      if (!course) {
        return res.status(404).json({ error: 'Course not found or permission denied' });
      }

      const version = findChapterVersion(course, req.params.chapterId, typeof req.query.versionId === 'string' ? req.query.versionId : undefined);
      if (!version) {
        return res.status(404).json({ error: 'Chapter version not found' });
      }

      const content = await readChapterJson(version.storagePath);
      res.json(content);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load chapter content' });
    }
  });

  app.post('/api/chat/complete', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const text = await completeChat({
        chapterText: req.body?.chapterText || '',
        message: req.body?.message || '',
        history: req.body?.history || [],
      });
      res.json({ text });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to complete chat' });
    }
  });

  app.post('/api/chat/title', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const title = await generateChatTitle(req.body?.message || '');
      res.json({ title });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to generate chat title' });
    }
  });

  app.post('/api/ocr-pdf', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const formData = new FormData();
      formData.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);

      const response = await fetch('https://asia-south1-gen-lang-client-0904504622.cloudfunctions.net/ocr-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Cloud Function Error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('OCR Proxy Error:', error);
      res.status(500).json({ error: error.message || 'Failed to process OCR' });
    }
  });

  app.post('/api/ocr-image', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { data, mimeType = 'image/jpeg' } = req.body || {};
      if (!data) {
        return res.status(400).json({ error: 'Missing image data' });
      }

      const text = await extractImageText({ data, mimeType });
      res.json({ text });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to extract image text' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
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
