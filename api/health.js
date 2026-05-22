import { handleOptions, methodNotAllowed, sendJson, setCorsHeaders } from './_shared.js';

export default function handler(req, res) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  sendJson(res, 200, {
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
