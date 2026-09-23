import { GoogleGenAI } from '@google/genai';

function parseBody(req) {
  if (!req.body) return {};
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

function escapeXml(value) {
  return String(value || '').replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  })[c]);
}

function visualPrompt(input) {
  const prompt = String(input || '').trim();
  const s = prompt.toLowerCase();
  let style = 'polished scientific educational illustration';
  if (/\b(joint|skeleton|bone|muscle|lung|heart|cell|organ|brain|respiration|digestion|reproduction)\b/.test(s)) {
    style = 'accurate anatomical or biological illustration with labelled structures';
  } else if (/\b(circuit|electricity|force|energy|reaction|photosynthesis|food chain|food web|cycle|heat|temperature)\b/.test(s)) {
    style = 'scientific process or experiment illustration showing real objects and relationships';
  } else if (/\b(compare|comparison|difference)\b/.test(s)) {
    style = 'side-by-side scientific comparison illustration';
  } else if (/\b(steps|sequence|process|cycle)\b/.test(s)) {
    style = 'clear numbered scientific process diagram';
  }
  return `Create a premium Grade 7 educational ${style} for Nimbus Beaconhouse AI. Topic: ${prompt}. Make it visually intelligent and artistic rather than a generic infographic. Use a strong focal subject, depth, accurate scientific structure, short readable labels, subtle leader lines or arrows where needed, and a clean classroom-ready composition. Do NOT use four generic boxes, placeholder circles, empty cards, wireframes, text posters, or a repeated template. Do not add unsupported scientific claims. Keep labels concise.`;
}

function noImageResponse(res, message, details) {
  console.error('[Nimbus visual]', message, details || '');
  return res.status(503).json({ ok: false, error_code: 'IMAGE_GENERATION_UNAVAILABLE', message: 'Visual generation is temporarily unavailable.' });
}

async function generateCloudflare(accountId, token, prompt) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    const msg = data?.errors?.map((e) => e?.message).filter(Boolean).join('; ') || `Cloudflare returned ${response.status}`;
    throw new Error(msg);
  }
  const b64 = data?.result?.image || data?.image || data?.result?.output?.image;
  if (!b64) throw new Error('Cloudflare returned no image data.');
  return { data: b64, mimeType: 'image/jpeg', model: 'flux-1-schnell' };
}

async function generateGemini(apiKey, prompt) {
  const ai = new GoogleGenAI({ apiKey });
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
  const image = interaction?.output_image;
  if (!image?.data) throw new Error('Gemini returned no image data.');
  return { data: image.data, mimeType: image.mime_type || image.mimeType || 'image/jpeg', model: 'gemini-3.1-flash-image' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });

  try {
    const body = parseBody(req);
    const prompt = visualPrompt(body?.prompt || body?.message || 'Grade 7 science concept');

    // Free-first: Cloudflare Workers AI + FLUX.1 schnell.
    if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
      try {
        const image = await generateCloudflare(
          process.env.CLOUDFLARE_ACCOUNT_ID,
          process.env.CLOUDFLARE_API_TOKEN,
          prompt
        );
        return res.status(200).json({ ok: true, fallback: false, ...image });
      } catch (err) {
        console.warn('[Nimbus visual] Cloudflare FLUX failed:', err?.message || err);
      }
    }

    // Optional Gemini image fallback. Current Interactions format uses JPEG output.
    if (process.env.GEMINI_API_KEY) {
      try {
        const image = await generateGemini(process.env.GEMINI_API_KEY, prompt);
        return res.status(200).json({ ok: true, fallback: false, ...image });
      } catch (err) {
        console.warn('[Nimbus visual] Gemini image failed:', err?.message || err);
      }
    }

    // Deliberately DO NOT return the old generic Study Visual SVG.
    return noImageResponse(res, 'No configured image provider returned an image.');
  } catch (err) {
    return noImageResponse(res, 'Unexpected visual route error.', err?.message || err);
  }
}
