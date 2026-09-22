import { GoogleGenAI } from '@google/genai';

function scienceVisualPrompt(userPrompt = '') {
  const p = String(userPrompt).trim();
  let visualType = 'polished scientific educational illustration';
  if (/\b(joint|skeleton|bone|muscle|lung|heart|cell|organ|brain|digest|respiration|reproduction)\b/i.test(p)) visualType = 'accurate labelled anatomical or biological illustration with clear structures and leader lines';
  else if (/\b(circuit|electricity|force|energy|reaction|process|cycle|photosynthesis|respiration|digestion|food chain|food web)\b/i.test(p)) visualType = 'scientific process or experimental illustration showing real visual relationships';
  else if (/\b(difference|compare|comparison)\b/i.test(p)) visualType = 'side-by-side scientific comparison with matching labels and scale cues';
  else if (/\b(steps|sequence|flowchart)\b/i.test(p)) visualType = 'clean process diagram with numbered stages and directional arrows';
  return `Create a high-quality 16:9 Grade 7 Beaconhouse science visual. Topic/request: ${p}. Visual type: ${visualType}. Make it polished, artistic, accurate, colorful, dimensional and presentation-ready. Use meaningful imagery, depth, lighting, short labels, leader lines or arrows only where they help. Never use a generic four-box template, plain text poster, empty placeholder, wireframe, or vague icon collage. Avoid long paragraphs inside the image. Prioritize scientific correctness and clear visual relationships suitable for a Grade 7 student.`;
}

async function cloudflareImage(accountId, token, prompt) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      steps: 4,
      seed: Math.floor(Math.random() * 2147483647)
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    const message = data?.errors?.map?.(e => e?.message).filter(Boolean).join('; ') || `Cloudflare image request failed (${response.status})`;
    throw new Error(message);
  }
  const b64 = data?.result?.image;
  if (!b64) throw new Error('Cloudflare image response was empty.');
  return { data: b64, mimeType: 'image/jpeg', model: 'flux-1-schnell' };
}

async function geminiImage(apiKey, prompt) {
  const ai = new GoogleGenAI({ apiKey });
  const interaction = await ai.interactions.create({
    model: 'gemini-3.1-flash-image',
    input: prompt,
    response_format: {
      type: 'image',
      mime_type: 'image/jpeg',
      aspect_ratio: '16:9',
      image_size: '1K'
    }
  });
  const output = interaction?.output_image;
  if (!output?.data) throw new Error('Gemini image response was empty.');
  return { data: output.data, mimeType: output.mime_type || output.mimeType || 'image/jpeg', model: 'gemini-3.1-flash-image' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const prompt = String(body.prompt || body.text || '').trim();
    if (!prompt) return res.status(400).json({ ok: false, message: 'Missing visual prompt.' });

    const finalPrompt = scienceVisualPrompt(prompt);
    const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
    const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();

    if (accountId && token) {
      try {
        const image = await cloudflareImage(accountId, token, finalPrompt);
        return res.status(200).json({ ok: true, fallback: false, ...image });
      } catch (err) {
        console.warn('[Nimbus visual] Cloudflare FLUX failed:', err?.message || err);
      }
    }

    if (process.env.GEMINI_API_KEY) {
      try {
        const image = await geminiImage(process.env.GEMINI_API_KEY, finalPrompt);
        return res.status(200).json({ ok: true, fallback: false, ...image });
      } catch (err) {
        console.warn('[Nimbus visual] Gemini image failed:', err?.message || err);
      }
    }

    // Deliberately return a distinct failure instead of silently spamming one generic poster.
    return res.status(503).json({ ok: false, fallback: false, message: 'Image generation is temporarily unavailable. The AI answer is still available.' });
  } catch (err) {
    console.error('[Nimbus visual]', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Image generation failed.' });
  }
}
