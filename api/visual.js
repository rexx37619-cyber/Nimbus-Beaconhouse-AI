async function requestImage({ apiKey, prompt, aspectRatio, imageSize, withImageConfig = true }) {
  const generationConfig = { responseModalities: ['IMAGE'] };
  if (withImageConfig) {
    generationConfig.responseFormat = { image: { aspectRatio, imageSize } };
  }
  return fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig })
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ ok: false, message: 'Nano Banana 2 image generation is not configured.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ ok: false, message: 'No visual prompt was provided.' });
    const aspectRatio = String(body.aspectRatio || '16:9');
    const imageSize = String(body.imageSize || '1K');

    let response = await requestImage({ apiKey, prompt, aspectRatio, imageSize, withImageConfig: true });
    let data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Some endpoint revisions reject the responseFormat image options; retry with the documented basic image modality.
      response = await requestImage({ apiKey, prompt, aspectRatio, imageSize, withImageConfig: false });
      data = await response.json().catch(() => ({}));
    }
    if (!response.ok) {
      const reason = String(data?.error?.message || '').toLowerCase();
      if (response.status === 402 || reason.includes('billing') || reason.includes('paid')) {
        return res.status(402).json({ ok: false, message: 'Nano Banana 2 is unavailable for this API key. Image generation access or billing is required.' });
      }
      return res.status(502).json({ ok: false, message: 'Nano Banana 2 image generation is temporarily unavailable.' });
    }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const img = parts.find(p => p?.inlineData?.data);
    const text = parts.filter(p => p?.text).map(p => p.text).join('\n').trim();
    if (!img?.inlineData?.data) return res.status(502).json({ ok: false, message: 'Nano Banana 2 did not return an image.' });
    return res.status(200).json({ ok: true, mimeType: img.inlineData.mimeType || 'image/png', data: img.inlineData.data, text });
  } catch {
    return res.status(502).json({ ok: false, message: 'Nano Banana 2 image generation is temporarily unavailable.' });
  }
}
