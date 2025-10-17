import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import session from 'cookie-session';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

import { getAuthUrl, handleOAuthCallback, ensureAuthed, getCalendarClient } from './google.js';
import { ocrImagesToText, ocrAnalyzeImages } from './ocr.js';
import { parseWeeklySchedule, parseWeeklyScheduleSpatial } from './parseSchedule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGINS = [
  ...(process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',').map(s => s.trim()) : ['http://localhost:5173']),
  'capacitor://localhost'
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // mobile apps or curl
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(
  session({
    name: 'session',
    secret: process.env.SESSION_SECRET || 'dev-secret',
    httpOnly: true,
    sameSite: (process.env.SESSION_SAMESITE || 'lax'),
    secure: String(process.env.SESSION_SECURE || '').toLowerCase() === 'true'
  })
);

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Auth
app.get('/auth/google', (req, res) => {
  const url = getAuthUrl();
  res.json({ url });
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    await handleOAuthCallback(req, code);
    // Redirect back to web app root
    // Redirect back to the first allowed web origin
    const backTo = ALLOWED_ORIGINS.find(o => o.startsWith('http')) || 'http://localhost:5173';
    res.redirect(backTo);
  } catch (e) {
    console.error(e);
    res.status(500).send('OAuth failed');
  }
});

app.get('/auth/me', (req, res) => {
  res.json({ authed: !!(req.session && req.session.tokens) });
});

// Upload + OCR + Parse
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', ensureAuthed, upload.array('images', 10), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No images' });

    const weekStartISO = req.body.weekStartISO; // Monday of the week, ISO date e.g. 2025-01-13
    const timezone = req.body.timezone || process.env.DEFAULT_TIMEZONE || 'UTC';
    if (!weekStartISO) return res.status(400).json({ error: 'Missing weekStartISO' });

    const docs = await ocrAnalyzeImages(files.map(f => f.buffer));
    const combinedText = docs.map(d => d.text).join('\n');
    // Try spatial parser first; fallback to text-only
    const spatial = parseWeeklyScheduleSpatial(docs, weekStartISO, timezone);
    const basic = spatial.blocks.length ? spatial : parseWeeklySchedule(combinedText, weekStartISO, timezone);
    res.json({ rawText: combinedText, blocks: basic.blocks, warnings: (spatial.warnings || []).concat(basic.warnings || []) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to process images' });
  }
});

// Create blocks on Google Calendar
app.post('/api/block', ensureAuthed, async (req, res) => {
  try {
    const { blocks, calendarId } = req.body;
    if (!Array.isArray(blocks) || !blocks.length) return res.status(400).json({ error: 'No blocks provided' });
    const cal = await getCalendarClient(req);

    const created = [];
    for (const b of blocks) {
      const event = {
        summary: 'Blocked - Work',
        description: '',
        start: { dateTime: b.start, timeZone: b.timezone },
        end: { dateTime: b.end, timeZone: b.timezone },
        transparency: 'opaque',
        visibility: 'private'
      };
      const r = await cal.events.insert({ calendarId: calendarId || 'primary', requestBody: event });
      created.push({ id: r.data.id, htmlLink: r.data.htmlLink });
    }
    res.json({ created });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create events' });
  }
});

// Optional: serve built web app for single-origin deployment
if (String(process.env.SERVE_WEB || '').toLowerCase() === 'true') {
  const distDir = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
