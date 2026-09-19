function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function extractImage(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const blob = part?.inlineData || part?.inline_data;
    if (blob?.data) return { data: blob.data, mimeType: blob.mimeType || blob.mime_type || 'image/png' };
  }
  return null;
}

async function generate(apiKey, prompt, aspectRatio, imageSize) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      responseFormat: { image: { aspectRatio, imageSize } }
    }
  };
  const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body)
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
    const aspectRatio = ['1:1','4:3','3:4','16:9','9:16','21:9','3:2','2:3','4:5','5:4'].includes(String(body.aspectRatio || '16:9')) ? String(body.aspectRatio || '16:9') : '16:9';
    const imageSize = ['512','1K','2K','4K'].includes(String(body.imageSize || '1K')) ? String(body.imageSize || '1K') : '1K';
    const { response, data } = await generate(apiKey, prompt, aspectRatio, imageSize);
    const image = extractImage(data);
    if (response.ok && image) return res.status(200).json({ ok: true, mimeType: image.mimeType, data: image.data });
    const reason = String(data?.error?.message || '').toLowerCase();
    if (response.status === 401 || response.status === 403) return res.status(502).json({ ok: false, message: 'Image generation access is not enabled for this API key.' });
    if (reason.includes('billing') || reason.includes('quota')) return res.status(402).json({ ok: false, message: 'Image generation quota is unavailable right now.' });
    return res.status(502).json({ ok: false, message: 'Nano Banana 2 is temporarily unavailable.' });
  } catch {
    return res.status(502).json({ ok: false, message: 'Nano Banana 2 is temporarily unavailable.' });
  }
}
