function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function extractImage(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const b = part?.inlineData || part?.inline_data;
    if (b?.data) {
      return {
        data: b.data,
        mimeType: b.mimeType || b.mime_type || 'image/png'
      };
    }
  }
  return null;
}

async function generateImage(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      responseFormat: {
        image: { aspectRatio: '16:9' }
      }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data, image: extractImage(data) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ ok: false, message: 'Visual generation is not configured.' });
  }

  try {
    const body = parseBody(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      return res.status(400).json({ ok: false, message: 'No visual prompt was provided.' });
    }

    // Deliberately pass the user's requested visual prompt directly to Gemini 2.5 Flash Image.
    const result = await generateImage(apiKey, prompt);

    if (result.response.ok && result.image) {
      return res.status(200).json({
        ok: true,
        mimeType: result.image.mimeType,
        data: result.image.data,
        source: 'gemini-2.5-flash-image'
      });
    }

    const providerMessage = result.data?.error?.message || '';
    console.error('[Nimbus visual] Gemini 2.5 Flash Image failed:', result.response.status, providerMessage);
    return res.status(503).json({
      ok: false,
      message: 'Visual generation is temporarily unavailable.'
    });
  } catch (err) {
    console.error('[Nimbus visual]', err);
    return res.status(503).json({ ok: false, message: 'Visual generation is temporarily unavailable.' });
  }
}
