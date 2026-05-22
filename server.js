import express from 'express';
import cors from 'cors';
import { parseHtml, parseText } from './server/parser.js';

const app = express();
const PORT = 3001;

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '5mb' }));

// ─── URL Validation ─────────────────────────────────────────────────────────

const ALLOWED_HOSTS = [
  'www.pathofexile.com',
  'pathofexile.com',
  'www.pathofexile2.com',
  'pathofexile2.com',
];

function validatePoeUrl(urlString) {
  try {
    const url = new URL(urlString);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol.' };
    }

    if (!ALLOWED_HOSTS.includes(url.hostname)) {
      return {
        valid: false,
        error: `URL must be from pathofexile.com. Received host: ${url.hostname}`,
      };
    }

    if (!url.pathname.startsWith('/forum/view-thread/')) {
      return {
        valid: false,
        error: 'URL must be a forum thread link (e.g., /forum/view-thread/XXXX).',
      };
    }

    return { valid: true, url: url.toString() };
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }
}

// ─── POST /api/fetch-changelog ──────────────────────────────────────────────

app.post('/api/fetch-changelog', async (req, res) => {
  const { url } = req.body;

  // Validate input
  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "url" field in request body.',
    });
  }

  // Validate URL domain and path
  const validation = validatePoeUrl(url);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error,
    });
  }

  // Fetch the forum page
  let html;
  try {
    const response = await fetch(validation.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000), // 15-second timeout
    });

    if (!response.ok) {
      const blockedHint = response.status === 403
        ? ' pathofexile.com blocked the automated request. Open the thread in your browser and paste the raw patch notes text instead.'
        : '';
      return res.status(502).json({
        success: false,
        error: `Failed to fetch the forum page. Server responded with status ${response.status} ${response.statusText}.${blockedHint}`,
      });
    }

    html = await response.text();
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        error: 'Request to pathofexile.com timed out. Please try again later.',
      });
    }
    return res.status(502).json({
      success: false,
      error: `Failed to fetch the forum page: ${err.message}. If pathofexile.com is blocking automated requests from this machine, open the thread in your browser and paste the raw patch notes text instead.`,
    });
  }

  // Parse the HTML
  try {
    const result = parseHtml(html);
    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    return res.status(422).json({
      success: false,
      error: `Failed to parse the changelog: ${err.message}`,
    });
  }
});

// ─── POST /api/parse-text ───────────────────────────────────────────────────

app.post('/api/parse-text', async (req, res) => {
  const { text } = req.body;

  // Validate input
  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "text" field in request body.',
    });
  }

  if (text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'The provided text is empty.',
    });
  }

  // Parse the text
  try {
    const result = parseText(text);
    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    return res.status(422).json({
      success: false,
      error: `Failed to parse the text: ${err.message}`,
    });
  }
});

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start Server ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ Changelog proxy server running at http://localhost:${PORT}`);
  console.log(`   POST /api/fetch-changelog  — Fetch & parse a PoE forum thread`);
  console.log(`   POST /api/parse-text       — Parse raw patch notes text`);
  console.log(`   GET  /api/health           — Health check`);
});
