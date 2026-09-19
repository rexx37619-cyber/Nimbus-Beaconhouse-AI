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
        mimeType: blob.mimeType || blob.mime_type || 'image/png',
      };
    }
  }
  return null;
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
        return {
          data: block.data,
          mimeType: block.mime_type || block.mimeType || 'image/png',
        };
      }
    }
  }
  return null;
}

async function callInteractions(apiKey, prompt, aspectRatio, imageSize, model = 'gemini-3.1-flash-image') {
  const body = {
    model,
    input: prompt,
    response_format: {
      type: 'image',
      mime_type: 'image/png',
      aspect_ratio: aspectRatio,
      image_size: imageSize,
    },
  };
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data, image: extractInteractionImage(data), model };
}

async function callGenerateContent(apiKey, prompt, aspectRatio, imageSize, model = 'gemini-3.1-flash-image') {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      responseFormat: {
        image: {
          aspectRatio,
          imageSize,
        },
      },
    },
  };
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data, image: extractGenerateContentImage(data), model };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      message: 'Nano Banana 2 is not configured on this deployment.',
    });
  }

  try {
    const body = parseBody(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ ok: false, message: 'No visual prompt was provided.' });

    const allowedRatios = ['1:1','4:3','3:4','16:9','9:16','21:9','3:2','2:3','4:5','5:4','1:4','4:1','1:8','8:1'];
    const aspectRatio = allowedRatios.includes(String(body.aspectRatio || '16:9')) ? String(body.aspectRatio || '16:9') : '16:9';
    const imageSize = ['512','1K','2K','4K'].includes(String(body.imageSize || '1K')) ? String(body.imageSize || '1K') : '1K';

    // Primary Nano Banana 2 path: current Interactions API format documented by Google.
    let result = await callInteractions(apiKey, prompt, aspectRatio, imageSize, 'gemini-3.1-flash-image');
    if (result.response.ok && result.image) {
      return res.status(200).json({ ok: true, mimeType: result.image.mimeType, data: result.image.data, model: result.model });
    }

    // Direct GenerateContent fallback using the current documented image config.
    result = await callGenerateContent(apiKey, prompt, aspectRatio, imageSize, 'gemini-3.1-flash-image');
    if (result.response.ok && result.image) {
      return res.status(200).json({ ok: true, mimeType: result.image.mimeType, data: result.image.data, model: result.model });
    }

    // Legacy Nano Banana fallback while its endpoint remains available.
    const fallback = await callGenerateContent(apiKey, prompt, aspectRatio, imageSize, 'gemini-2.5-flash-image');
    if (fallback.response.ok && fallback.image) {
      return res.status(200).json({ ok: true, mimeType: fallback.image.mimeType, data: fallback.image.data, model: fallback.model, fallback: true });
    }

    const firstError = result?.data?.error?.message || '';
    const secondError = fallback?.data?.error?.message || '';
    const combined = String(firstError || secondError || 'Image generation request was rejected.');
    const lower = combined.toLowerCase();

    if ([401,403].includes(result?.response?.status) || [401,403].includes(fallback?.response?.status)) {
      return res.status(502).json({
        ok: false,
        message: 'Gemini image generation is not enabled for this API key. Check the API key project and image-model access.',
      });
    }
    if ([429].includes(result?.response?.status) || [429].includes(fallback?.response?.status) || lower.includes('quota') || lower.includes('resource exhausted')) {
      return res.status(429).json({
        ok: false,
        message: 'Gemini image generation is currently out of quota.',
      });
    }

    return res.status(502).json({
      ok: false,
      message: 'Nano Banana 2 could not generate this visual. Check the Gemini API key project and model access.',
    });
  } catch (error) {
    console.error('Visual generation error:', error);
    return res.status(502).json({ ok: false, message: 'Nano Banana 2 could not generate this visual right now.' });
  }
}
