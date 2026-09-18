export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ ok: false, message: 'Visual generation is temporarily unavailable.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ ok: false, message: 'No visual prompt was provided.' });
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          responseFormat: { image: { aspectRatio: String(body.aspectRatio || '16:9'), imageSize: String(body.imageSize || '1K') } }
        }
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ ok: false, message: 'Visual generation is temporarily unavailable.' });
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const img = parts.find(p => p?.inlineData?.data);
    if (!img?.inlineData?.data) return res.status(200).json({ ok: true, text: parts.filter(p => p?.text).map(p => p.text).join('\n') });
    return res.status(200).json({ ok: true, mimeType: img.inlineData.mimeType || 'image/png', data: img.inlineData.data, text: parts.filter(p => p?.text).map(p => p.text).join('\n') });
  } catch {
    return res.status(200).json({ ok: false, message: 'Visual generation is temporarily unavailable.' });
  }
}
