function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function extractGenerateContentImage(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const blob = part?.inlineData || part?.inline_data;
    if (blob?.data) return { data: blob.data, mimeType: blob.mimeType || blob.mime_type || 'image/png' };
  }
  return null;
}

function extractInteractionImage(data) {
  const image = data?.output_image || data?.outputImage;
  if (image?.data) return { data: image.data, mimeType: image.mime_type || image.mimeType || 'image/png' };
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  for (const step of steps) {
    const candidate = step?.output_image || step?.outputImage;
    if (candidate?.data) return { data: candidate.data, mimeType: candidate.mime_type || candidate.mimeType || 'image/png' };
  }
  return null;
}

async function generateInteractions(apiKey, prompt, aspectRatio, imageSize) {
  const body = {
    model: 'gemini-3.1-flash-image',
    input: [{ type: 'text', text: prompt }],
    response_format: { type: 'image', aspect_ratio: aspectRatio, image_size: imageSize },
  };
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data, image: extractInteractionImage(data) };
}

async function generateContent(apiKey, prompt, aspectRatio, imageSize) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      responseFormat: { image: { aspectRatio, imageSize } },
    },
  };
  const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data, image: extractGenerateContentImage(data) };
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

    const allowedRatios = ['1:1','4:3','3:4','16:9','9:16','21:9','3:2','2:3','4:5','5:4'];
    const aspectRatio = allowedRatios.includes(String(body.aspectRatio || '16:9')) ? String(body.aspectRatio || '16:9') : '16:9';
    const imageSize = ['512','1K','2K','4K'].includes(String(body.imageSize || '1K')) ? String(body.imageSize || '1K') : '1K';

    // Current Nano Banana 2 path: Gemini 3.1 Flash Image via Interactions API.
    let first = await generateInteractions(apiKey, prompt, aspectRatio, imageSize);
    if (first.response.ok && first.image) {
      return res.status(200).json({ ok: true, mimeType: first.image.mimeType, data: first.image.data, model: 'gemini-3.1-flash-image' });
    }

    // Compatibility fallback to the GenerateContent REST endpoint.
    let second = await generateContent(apiKey, prompt, aspectRatio, imageSize);
    if (second.response.ok && second.image) {
      return res.status(200).json({ ok: true, mimeType: second.image.mimeType, data: second.image.data, model: 'gemini-3.1-flash-image' });
    }

    const errorText = String(second.data?.error?.message || first.data?.error?.message || '').toLowerCase();
    const status = second.response.status || first.response.status || 502;
    if (status === 401 || status === 403) {
      return res.status(502).json({ ok: false, message: 'Nano Banana 2 is not enabled for the configured Gemini API key.' });
    }
    if (status === 429 || errorText.includes('quota') || errorText.includes('resource exhausted')) {
      return res.status(429).json({ ok: false, message: 'Nano Banana 2 is temporarily out of quota.' });
    }
    return res.status(502).json({ ok: false, message: 'Nano Banana 2 could not generate the visual right now.' });
  } catch {
    return res.status(502).json({ ok: false, message: 'Nano Banana 2 could not generate the visual right now.' });
  }
}
