import {
  fetchAndParseChangelog,
  handleOptions,
  methodNotAllowed,
  readJsonBody,
  sendJson,
  setCorsHeaders,
} from './_shared.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  let body;

  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, {
      success: false,
      error: 'Invalid JSON request body.',
    });
    return;
  }

  const { url } = body;

  if (!url || typeof url !== 'string') {
    sendJson(res, 400, {
      success: false,
      error: 'Missing or invalid "url" field in request body.',
    });
    return;
  }

  const result = await fetchAndParseChangelog(url);
  sendJson(res, result.statusCode, result.body);
}
