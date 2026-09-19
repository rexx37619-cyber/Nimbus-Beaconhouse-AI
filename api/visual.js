function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function toDataUrl(buf, mime='image/png') {
  return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
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

async function callPollinations(apiKey, prompt) {
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=nanobanana-2&width=1536&height=864`;
  const r = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!r.ok) return { ok: false, status: r.status };
  const mime = r.headers.get('content-type') || 'image/png';
  const bytes = await r.arrayBuffer();
  if (!bytes.byteLength) return { ok: false, status: 204 };
  return { ok: true, mimeType: mime.split(';')[0], data: Buffer.from(bytes).toString('base64') };
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
      responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } }
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
  const body = parseBody(req);
  const prompt = String(body.prompt || '').trim();
  if (!prompt) return res.status(400).json({ ok: false, message: 'No visual prompt was provided.' });

  // Keep the original prompt as much as possible; do not inject style instructions.
  // The user requested a direct image request, not a generated template.
  const pollinationsKey = process.env.POLLINATIONS_API_KEY;
  if (pollinationsKey) {
    try {
      const p = await callPollinations(pollinationsKey, prompt);
      if (p.ok) return res.status(200).json({ ok: true, mimeType: p.mimeType, data: p.data, source: 'pollinations' });
    } catch (e) {
      console.warn('[Nimbus visual] Pollinations fallback failed:', e?.message || e);
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(503).json({ ok: false, message: 'Visual generation is unavailable right now.' });
  try {
    const primary = await callInteractions(geminiKey, prompt);
    if (primary.r.ok && primary.img) {
      return res.status(200).json({ ok: true, mimeType: primary.img.mimeType, data: primary.img.data, source: 'nano-banana-2' });
    }
    const fallback = await callGenerateContent(geminiKey, prompt);
    if (fallback.r.ok && fallback.img) {
      return res.status(200).json({ ok: true, mimeType: fallback.img.mimeType, data: fallback.img.data, source: 'nano-banana-2-generate-content' });
    }
  } catch (err) {
    console.error('[Nimbus visual]', err);
  }
  return res.status(503).json({ ok: false, message: 'Visual generation is unavailable right now.' });
}
