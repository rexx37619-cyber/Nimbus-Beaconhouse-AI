'use strict';
// Nimbus V29 - Pollinations image provider (separate from legacy FLUX endpoint).
// This file is server-only. Never expose POLLINATIONS_API_KEY in browser scripts.
const PROVIDER = 'https://gen.pollinations.ai';
const MODEL = 'gpt-image-2';
const MAX_IMAGE_BYTES = 9 * 1024 * 1024;
const TIMEOUT_MS = 55000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ok:false, error_code:'METHOD_NOT_ALLOWED'});
  }
  const key = String(process.env.POLLINATIONS_API_KEY || '').trim();
  if (!key) {
    return res.status(503).json({ok:false, model:MODEL, error_code:'MISSING_POLLINATIONS_API_KEY', message:'Pollinations API key is not configured on the server.'});
  }
  let data = req.body || {};
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return res.status(400).json({ok:false,error_code:'INVALID_REQUEST_JSON'}); }
  }
  const prompt = String(data.prompt || '').trim();
  if (!prompt || prompt.length > 3500) {
    return res.status(400).json({ok:false, error_code:'INVALID_VISUAL_PROMPT'});
  }

  // Long prompts cause URL-length issues with Pollinations' GET image endpoint.
  // Keep key academic content early; no secret values are sent in the URL.
  const visualPrompt = (prompt.slice(0, 1500) + ' Landscape educational illustration, suitable for student understanding.').trim();
  const url = `${PROVIDER}/image/${encodeURIComponent(visualPrompt)}?model=${encodeURIComponent(MODEL)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const result = await fetch(url, {
      method:'GET',
      headers:{Authorization:`Bearer ${key}`, Accept:'image/png,image/jpeg,image/webp'},
      signal:controller.signal,
      redirect:'error'
    });
    if (!result.ok) {
      // Do not echo provider errors: they may contain request paths or personal details.
      return res.status(502).json({
        ok:false, model:MODEL, fallback:false,
        error_code:'POLLINATIONS_REQUEST_FAILED', provider_status:result.status
      });
    }
    const contentType = (result.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/png','image/jpeg','image/webp'].includes(contentType)) {
      return res.status(502).json({ok:false, model:MODEL,error_code:'POLLINATIONS_NOT_IMAGE'});
    }
    const contentLength = Number(result.headers.get('content-length') || 0);
    if (contentLength > MAX_IMAGE_BYTES) {
      return res.status(502).json({ok:false, model:MODEL,error_code:'POLLINATIONS_IMAGE_TOO_LARGE'});
    }
    const bytes = Buffer.from(await result.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
      return res.status(502).json({ok:false,model:MODEL,error_code:'POLLINATIONS_INVALID_IMAGE_SIZE'});
    }
    return res.status(200).json({
      ok:true, skipped:false, fallback:false, model:MODEL,
      data:bytes.toString('base64'), mimeType:contentType
    });
  } catch (error) {
    return res.status(502).json({
      ok:false, model:MODEL, fallback:false,
      error_code:error?.name === 'AbortError' ? 'POLLINATIONS_TIMEOUT' : 'POLLINATIONS_CONNECTION_ERROR'
    });
  } finally {
    clearTimeout(timeout);
  }
};
