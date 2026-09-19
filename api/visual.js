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
    if (blob?.data) {
      return {
        data: blob.data,
        mimeType: blob.mimeType || blob.mime_type || 'image/png'
      };
    }
  }
  return null;
}

function extractInteractionImage(data) {
  const direct = data?.output_image || data?.outputImage;
  if (direct?.data) {
    return { data: direct.data, mimeType: direct.mime_type || direct.mimeType || 'image/png' };
  }
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  for (const step of steps) {
    const image = step?.output_image || step?.outputImage || step?.image;
    if (image?.data) {
      return { data: image.data, mimeType: image.mime_type || image.mimeType || 'image/png' };
    }
  }
  return null;
}

async function interactions(apiKey, prompt, aspectRatio, imageSize) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      model: 'gemini-3.1-flash-image',
      input: prompt,
      response_format: {
        type: 'image',
        mime_type: 'image/png',
        aspect_ratio: aspectRatio,
        image_size: imageSize
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  return { response, data, image: extractInteractionImage(data) };
}

async function generateContent(apiKey, model, prompt, aspectRatio, imageSize) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        responseFormat: {
          image: { aspectRatio, imageSize }
        }
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  return { response, data, image: extractGenerateContentImage(data) };
}

function safeReason(data) {
  return String(data?.error?.message || data?.message || '').slice(0, 500);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ ok: false, message: 'Nano Banana 2 is not configured yet.' });

  try {
    const body = parseBody(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ ok: false, message: 'No visual prompt was provided.' });

    const allowedRatios = ['1:1','4:3','3:4','16:9','9:16','21:9','3:2','2:3','4:5','5:4'];
    const aspectRatio = allowedRatios.includes(String(body.aspectRatio || '16:9')) ? String(body.aspectRatio || '16:9') : '16:9';
    const allowedSizes = ['512','1K','2K','4K'];
    const imageSize = allowedSizes.includes(String(body.imageSize || '2K')) ? String(body.imageSize || '2K') : '2K';

    // Current documented path for Nano Banana 2.
    const primary = await interactions(apiKey, prompt, aspectRatio, imageSize);
    if (primary.response.ok && primary.image) {
      return res.status(200).json({ ok: true, mimeType: primary.image.mimeType, data: primary.image.data, model: 'gemini-3.1-flash-image' });
    }

    // Compatibility fallback for keys/projects where the legacy Generate Content surface is enabled.
    const legacy = await generateContent(apiKey, 'gemini-3.1-flash-image', prompt, aspectRatio, imageSize);
    if (legacy.response.ok && legacy.image) {
      return res.status(200).json({ ok: true, mimeType: legacy.image.mimeType, data: legacy.image.data, model: 'gemini-3.1-flash-image' });
    }

    // Older image model fallback; still server-side and does not require Puter authentication.
    const older = await generateContent(apiKey, 'gemini-2.5-flash-image', prompt, aspectRatio, '1K');
    if (older.response.ok && older.image) {
      return res.status(200).json({ ok: true, mimeType: older.image.mimeType, data: older.image.data, model: 'gemini-2.5-flash-image' });
    }

    const reasons = [safeReason(primary.data), safeReason(legacy.data), safeReason(older.data)].filter(Boolean).join(' | ');
    const status = [primary.response, legacy.response, older.response].some(r => r.status === 401 || r.status === 403) ? 502 : 503;
    console.error('Gemini visual generation failed:', reasons || 'unknown provider error');
    return res.status(status).json({
      ok: false,
      message: 'Nano Banana 2 could not generate the visual. The Gemini API key/project needs image-model access or quota.',
      provider: 'gemini',
      retryable: true
    });
  } catch (error) {
    console.error('Visual endpoint error:', error);
    return res.status(502).json({ ok: false, message: 'Nano Banana 2 could not generate the visual. Please try again.' });
  }
}
