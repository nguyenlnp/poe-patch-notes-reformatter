import {
  handleOptions,
  methodNotAllowed,
  parseRawPatchText,
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

  const result = parseRawPatchText(body.text);
  sendJson(res, result.statusCode, result.body);
}
