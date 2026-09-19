function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function extractGenerateContentImage(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const b = part?.inlineData || part?.inline_data;
    if (b?.data) return { data: b.data, mimeType: b.mimeType || b.mime_type || 'image/png' };
  }
  return null;
}

function extractInteractionImage(data) {
  if (data?.output_image?.data) {
    return { data: data.output_image.data, mimeType: data.output_image.mime_type || 'image/png' };
  }
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  for (const step of steps) {
    if (step?.type === 'image' && step?.data) {
      return { data: step.data, mimeType: step.mime_type || step.mimeType || 'image/png' };
    }
    if (step?.type === 'model_output' && Array.isArray(step.content)) {
      for (const item of step.content) {
        if (item?.type === 'image' && item?.data) {
          return { data: item.data, mimeType: item.mime_type || item.mimeType || 'image/png' };
        }
        if (item?.inlineData?.data) {
          return { data: item.inlineData.data, mimeType: item.inlineData.mimeType || 'image/png' };
        }
      }
    }
  }
  return null;
}

async function callInteractions(apiKey, prompt) {
  const payload = {
    model: 'gemini-3.1-flash-image',
    input: [{ type: 'text', text: prompt }],
    response_format: {
      type: 'image',
      mime_type: 'image/png',
      aspect_ratio: '16:9',
      image_size: '2K'
    }
  };
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(payload)
  });
  const d = await r.json().catch(() => ({}));
  return { r, d, img: extractInteractionImage(d) };
}

async function callGenerateContent(apiKey, prompt) {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      responseFormat: {
        image: { aspectRatio: '16:9', imageSize: '2K' }
      }
    }
  };
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(payload)
  });
  const d = await r.json().catch(() => ({}));
  return { r, d, img: extractGenerateContentImage(d) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ ok: false, message: 'Visual generation is not configured.' });

  try {
    const body = parseBody(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ ok: false, message: 'No visual prompt was provided.' });

    const primary = await callInteractions(key, prompt);
    if (primary.r.ok && primary.img) {
      return res.status(200).json({ ok: true, mimeType: primary.img.mimeType, data: primary.img.data, source: 'nano-banana-2' });
    }
    console.warn('[Nimbus visual] Interactions failed', primary.r.status, primary.d?.error?.message || '');

    const fallback = await callGenerateContent(key, prompt);
    if (fallback.r.ok && fallback.img) {
      return res.status(200).json({ ok: true, mimeType: fallback.img.mimeType, data: fallback.img.data, source: 'nano-banana-2-generate-content' });
    }
    console.error('[Nimbus visual] image generation failed', fallback.r.status, fallback.d?.error?.message || '');
    return res.status(503).json({ ok: false, message: 'Visual generation is unavailable right now.' });
  } catch (err) {
    console.error('[Nimbus visual]', err);
    return res.status(503).json({ ok: false, message: 'Visual generation is unavailable right now.' });
  }
}
