function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function extractInteractionImage(data) {
  if (data?.output_image?.data) {
    return {
      data: data.output_image.data,
      mimeType: data.output_image.mime_type || data.output_image.mimeType || 'image/png',
    };
  }
  for (const step of Array.isArray(data?.steps) ? data.steps : []) {
    for (const block of Array.isArray(step?.content) ? step.content : []) {
      if (block?.type === 'image' && block?.data) {
        return { data: block.data, mimeType: block.mime_type || block.mimeType || 'image/png' };
      }
    }
  }
  return null;
}

async function generateImage(apiKey, prompt, aspectRatio, imageSize) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'gemini-3.1-flash-image',
      input: prompt,
      response_format: {
        type: 'image',
        mime_type: 'image/png',
        aspect_ratio: aspectRatio,
        image_size: imageSize,
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data, image: extractInteractionImage(data) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ ok: false, code: 'missing_key', message: 'Visual generation is not configured.' });

  try {
    const body = parseBody(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ ok: false, code: 'bad_request', message: 'No visual prompt was provided.' });
    const allowedRatios = new Set(['1:1','4:3','3:4','16:9','9:16','21:9','3:2','2:3','4:5','5:4','1:4','4:1','1:8','8:1']);
    const aspectRatio = allowedRatios.has(String(body.aspectRatio || '16:9')) ? String(body.aspectRatio || '16:9') : '16:9';
    const imageSize = new Set(['512','1K','2K','4K']).has(String(body.imageSize || '1K')) ? String(body.imageSize || '1K') : '1K';

    const result = await generateImage(apiKey, prompt, aspectRatio, imageSize);
    if (result.response.ok && result.image) {
      return res.status(200).json({ ok: true, mimeType: result.image.mimeType, data: result.image.data, model: 'gemini-3.1-flash-image' });
    }

    const apiMessage = String(result.data?.error?.message || '');
    const lower = apiMessage.toLowerCase();
    const status = result.response.status;
    if (status === 401 || status === 403 || /permission|unauthorized|forbidden|not enabled|not allowed/.test(lower)) {
      return res.status(502).json({ ok: false, code: 'model_access', message: 'Nano Banana 2 image generation is not enabled for this Gemini API key/project.' });
    }
    if (status === 429 || /quota|resource exhausted|rate limit|billing|payment|limit: 0/.test(lower)) {
      return res.status(429).json({ ok: false, code: 'quota_or_billing', message: 'Nano Banana 2 is unavailable on this Gemini API project right now.' });
    }
    return res.status(502).json({ ok: false, code: 'provider_error', message: 'Nano Banana 2 image generation was rejected by the Gemini API.' });
  } catch (error) {
    console.error('Visual generation error:', error);
    return res.status(502).json({ ok: false, code: 'server_error', message: 'The visual generator is temporarily unavailable.' });
  }
}
