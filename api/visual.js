import { GoogleGenAI } from '@google/genai';

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function extractGeneratedContentImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    const data = part?.inlineData?.data || part?.inline_data?.data;
    if (data) return {
      data,
      mimeType: part?.inlineData?.mimeType || part?.inline_data?.mime_type || 'image/jpeg'
    };
  }
  return null;
}

function extractInteractionImage(interaction) {
  const direct = interaction?.output_image?.data;
  if (direct) {
    return {
      data: direct,
      mimeType: interaction.output_image.mime_type || 'image/jpeg'
    };
  }

  const steps = Array.isArray(interaction?.steps) ? interaction.steps : [];
  for (const step of steps) {
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
    for (const block of step.content) {
      const data = block?.data || block?.inlineData?.data || block?.inline_data?.data;
      if (block?.type === 'image' && data) {
        return {
          data,
          mimeType: block.mime_type || block.mimeType || 'image/jpeg'
        };
      }
    }
  }
  return null;
}

function safeProviderMessage(err) {
  const text = String(err?.message || err || 'Unknown provider error');
  return text
    .replace(/AIza[0-9A-Za-z_-]+/g, '[redacted-key]')
    .slice(0, 320);
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
      code: 'MISSING_GEMINI_API_KEY',
      message: 'Gemini image generation is not configured.'
    });
  }

  try {
    const body = parseBody(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      return res.status(400).json({ ok: false, code: 'EMPTY_PROMPT', message: 'No visual request was provided.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    let firstError = null;

    // Official current Google image-generation path for Nano Banana 2.
    try {
      const interaction = await ai.interactions.create({
        model: 'gemini-3.1-flash-image',
        input: prompt,
        response_format: {
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: '16:9',
          image_size: '2K'
        }
      });

      const image = extractInteractionImage(interaction);
      if (image) {
        return res.status(200).json({
          ok: true,
          mimeType: image.mimeType,
          data: image.data,
          source: 'gemini-3.1-flash-image',
          modelLabel: 'Nimbus 3.1 Lor Image'
        });
      }
      firstError = new Error('Interactions API returned no image output.');
    } catch (err) {
      firstError = err;
      console.warn('[Nimbus Visual] Interactions image attempt failed:', safeProviderMessage(err));
    }

    // Official legacy Generate Content compatibility path.
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: prompt,
        config: {
          responseModalities: ['IMAGE'],
          responseFormat: {
            image: {
              aspectRatio: '16:9',
              imageSize: '2K'
            }
          }
        }
      });

      const image = extractGeneratedContentImage(response);
      if (image) {
        return res.status(200).json({
          ok: true,
          mimeType: image.mimeType,
          data: image.data,
          source: 'gemini-3.1-flash-image-generateContent',
          modelLabel: 'Nimbus 3.1 Lor Image'
        });
      }
      firstError = firstError || new Error('Generate Content returned no image output.');
    } catch (err) {
      console.warn('[Nimbus Visual] Generate Content compatibility attempt failed:', safeProviderMessage(err));
      firstError = firstError || err;
    }

    // Stable legacy image-model compatibility route.
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
        config: {
          responseModalities: ['IMAGE'],
          responseFormat: {
            image: {
              aspectRatio: '16:9'
            }
          }
        }
      });

      const image = extractGeneratedContentImage(response);
      if (image) {
        return res.status(200).json({
          ok: true,
          mimeType: image.mimeType,
          data: image.data,
          source: 'gemini-2.5-flash-image',
          modelLabel: 'Nimbus 3.1 Lor Image'
        });
      }
    } catch (err) {
      console.warn('[Nimbus Visual] 2.5 compatibility attempt failed:', safeProviderMessage(err));
      firstError = firstError || err;
    }

    const providerHint = safeProviderMessage(firstError);
    console.error('[Nimbus Visual] Image generation failed:', providerHint);
    return res.status(503).json({
      ok: false,
      code: 'GEMINI_IMAGE_NO_OUTPUT',
      message: `Gemini did not return an image. ${providerHint}`
    });
  } catch (err) {
    console.error('[Nimbus Visual] Handler failed:', safeProviderMessage(err));
    return res.status(500).json({
      ok: false,
      code: 'VISUAL_HANDLER_ERROR',
      message: 'The visual service could not complete the request.'
    });
  }
}
