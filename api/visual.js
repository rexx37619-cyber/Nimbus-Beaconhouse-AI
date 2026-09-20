function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function extractImage(data) {
  const direct = data?.output_image?.data || data?.outputImage?.data;
  if (direct) return { data: direct, mimeType: data?.output_image?.mime_type || data?.outputImage?.mimeType || 'image/png' };
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  for (const step of steps) {
    const content = Array.isArray(step?.content) ? step.content : [];
    for (const item of content) {
      if ((item?.type === 'image' || item?.type === 'output_image') && item?.data) return { data: item.data, mimeType: item.mime_type || item.mimeType || 'image/png' };
      if (item?.inline_data?.data || item?.inlineData?.data) return { data: item.inline_data?.data || item.inlineData?.data, mimeType: item.inline_data?.mime_type || item.inlineData?.mimeType || 'image/png' };
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ ok: false, message: 'Diagram generation is not configured.' });
  try {
    const body = parseBody(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ ok: false, message: 'No diagram request was provided.' });

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        model: 'gemini-3.1-flash-lite-image',
        input: prompt,
        response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: '16:9', image_size: '1K' }
      })
    });
    const data = await response.json().catch(() => ({}));
    const image = extractImage(data);
    if (response.ok && image) {
      return res.status(200).json({ ok: true, mimeType: image.mimeType, data: image.data, source: 'gemini-3.1-flash-lite-image', modelLabel: 'Nimbus 3.1 Lor Image' });
    }
    console.error('[Nimbus 3.1 Lor Image] provider error', response.status, data?.error?.message || 'No image returned');
    return res.status(503).json({ ok: false, message: 'Diagram generation is temporarily unavailable.' });
  } catch (err) {
    console.error('[Nimbus 3.1 Lor Image]', err);
    return res.status(503).json({ ok: false, message: 'Diagram generation is temporarily unavailable.' });
  }
}
