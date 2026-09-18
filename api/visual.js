function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function extractImage(data) {
  if (data?.output_image?.data) {
    return {
      data: data.output_image.data,
      mimeType: data.output_image.mime_type || 'image/png',
      text: String(data?.output_text || '').trim()
    };
  }
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const content = Array.isArray(steps[i]?.content) ? steps[i].content : [];
    for (let j = content.length - 1; j >= 0; j -= 1) {
      const part = content[j];
      if (part?.type === 'image' && part?.data) {
        const text = steps.flatMap(s => Array.isArray(s?.content) ? s.content : [])
          .filter(p => p?.type === 'text' && typeof p.text === 'string')
          .map(p => p.text)
          .join('\n')
          .trim();
        return { data: part.data, mimeType: part.mime_type || 'image/png', text };
      }
    }
  }
  return null;
}

async function callNanoBanana2(apiKey, prompt, aspectRatio = '16:9', imageSize = '1K') {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      model: 'gemini-3.1-flash-image',
      input: [{ type: 'text', text: prompt }],
      response_format: {
        type: 'image',
        mime_type: 'image/png',
        aspect_ratio: aspectRatio,
        image_size: imageSize,
        delivery: 'inline'
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ ok: false, message: 'Visual generation is not configured.' });

  try {
    const body = parseBody(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ ok: false, message: 'No visual prompt was provided.' });

    const { response, data } = await callNanoBanana2(apiKey, prompt, String(body.aspectRatio || '16:9'), String(body.imageSize || '1K'));
    if (!response.ok) {
      const reason = String(data?.error?.message || '').toLowerCase();
      const message = response.status === 402 || reason.includes('billing') || reason.includes('paid')
        ? 'Visual generation access is not enabled for this Gemini API key.'
        : 'Nano Banana 2 is temporarily unavailable.';
      return res.status(response.status === 402 ? 402 : 502).json({ ok: false, message });
    }

    const image = extractImage(data);
    if (!image?.data) return res.status(502).json({ ok: false, message: 'Nano Banana 2 returned no image.' });
    return res.status(200).json({ ok: true, mimeType: image.mimeType, data: image.data, text: image.text });
  } catch {
    return res.status(502).json({ ok: false, message: 'Nano Banana 2 is temporarily unavailable.' });
  }
}
