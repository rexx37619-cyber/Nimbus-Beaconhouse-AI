import { GoogleGenAI } from '@google/genai';

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function extractImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (part?.inlineData?.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png'
      };
    }
  }
  return null;
}

async function generateWithSdk(apiKey, model, prompt, imageSize = '1K') {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: ['IMAGE'],
      responseFormat: {
        image: {
          aspectRatio: '16:9',
          imageSize
        }
      }
    }
  });

  const image = extractImage(response);
  if (!image) {
    throw new Error(`No inline image returned by ${model}`);
  }
  return image;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ ok: false, message: 'Gemini image API key is not configured.' });
  }

  try {
    const body = parseBody(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      return res.status(400).json({ ok: false, message: 'No diagram request was provided.' });
    }

    // Official Google GenAI SDK path. Lite first, then full Flash Image for compatibility.
    const attempts = [
      { model: 'gemini-3.1-flash-lite-image', size: '1K', label: 'Nimbus 3.1 Lor Image' },
      { model: 'gemini-3.1-flash-image', size: '2K', label: 'Nimbus 3.1 Lor Image' }
    ];

    let lastError = null;
    for (const attempt of attempts) {
      try {
        const image = await generateWithSdk(apiKey, attempt.model, prompt, attempt.size);
        return res.status(200).json({
          ok: true,
          mimeType: image.mimeType,
          data: image.data,
          source: attempt.model,
          modelLabel: attempt.label
        });
      } catch (err) {
        lastError = err;
        console.warn(`[Nimbus Visual] ${attempt.model} failed:`, err?.message || err);
      }
    }

    console.error('[Nimbus Visual] All official Gemini SDK image attempts failed:', lastError?.message || lastError);
    return res.status(503).json({
      ok: false,
      message: 'Diagram generation is temporarily unavailable.'
    });
  } catch (err) {
    console.error('[Nimbus Visual] Handler failed:', err);
    return res.status(503).json({ ok: false, message: 'Diagram generation is temporarily unavailable.' });
  }
}
