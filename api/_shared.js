import { parseHtml, parseText } from '../server/parser.js';

const ALLOWED_HOSTS = [
  'www.pathofexile.com',
  'pathofexile.com',
  'www.pathofexile2.com',
  'pathofexile2.com',
];

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function handleOptions(req, res) {
  if (req.method !== 'OPTIONS') return false;
  setCorsHeaders(res);
  res.statusCode = 204;
  res.end();
  return true;
}

export function methodNotAllowed(res, allowedMethods) {
  res.setHeader('Allow', allowedMethods.join(', '));
  sendJson(res, 405, {
    success: false,
    error: `Method not allowed. Use ${allowedMethods.join(' or ')}.`,
  });
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    return req.body.trim() ? JSON.parse(req.body) : {};
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  return rawBody ? JSON.parse(rawBody) : {};
}

export function validatePoeUrl(urlString) {
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

export async function fetchAndParseChangelog(urlString) {
  const validation = validatePoeUrl(urlString);

  if (!validation.valid) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: validation.error,
      },
    };
  }

  let html;

  try {
    const response = await fetch(validation.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const blockedHint = response.status === 403
        ? ' pathofexile.com blocked the automated request. Open the thread in your browser and paste the raw patch notes text instead.'
        : '';

      return {
        statusCode: 502,
        body: {
          success: false,
          error: `Failed to fetch the forum page. Server responded with status ${response.status} ${response.statusText}.${blockedHint}`,
        },
      };
    }

    html = await response.text();
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    return {
      statusCode: isTimeout ? 504 : 502,
      body: {
        success: false,
        error: isTimeout
          ? 'Request to pathofexile.com timed out. Please try again later.'
          : `Failed to fetch the forum page: ${err.message}. If pathofexile.com is blocking automated requests from this environment, open the thread in your browser and paste the raw patch notes text instead.`,
      },
    };
  }

  try {
    return {
      statusCode: 200,
      body: {
        success: true,
        data: parseHtml(html),
      },
    };
  } catch (err) {
    return {
      statusCode: 422,
      body: {
        success: false,
        error: `Failed to parse the changelog: ${err.message}`,
      },
    };
  }
}

export function parseRawPatchText(text) {
  if (!text || typeof text !== 'string') {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: 'Missing or invalid "text" field in request body.',
      },
    };
  }

  if (text.trim().length === 0) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: 'The provided text is empty.',
      },
    };
  }

  try {
    return {
      statusCode: 200,
      body: {
        success: true,
        data: parseText(text),
      },
    };
  } catch (err) {
    return {
      statusCode: 422,
      body: {
        success: false,
        error: `Failed to parse the text: ${err.message}`,
      },
    };
  }
}
