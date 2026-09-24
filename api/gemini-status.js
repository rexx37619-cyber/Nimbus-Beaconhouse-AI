export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false });
  }

  const key = String(process.env.GEMINI_API_KEY || '').trim();

  if (!key) {
    return res.status(200).json({
      ok: false,
      key_status: 'missing'
    });
  }

  const models = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite'
  ];

  const results = [];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key
          },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: 'Reply with one word: hello' }]
            }],
            generationConfig: {
              maxOutputTokens: 20
            }
          })
        }
      );

      const raw = await response.text();

      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {}

      results.push({
        model,
        http: response.status,
        status: data?.error?.status || 'OK',
        message: response.ok
          ? 'OK'
          : String(data?.error?.message || '').slice(0, 300)
      });
    } catch (error) {
      results.push({
        model,
        http: 0,
        status: 'NETWORK_ERROR',
        message: String(error?.message || error).slice(0, 300)
      });
    }
  }

  return res.status(200).json({
    ok: true,
    key_status: 'set',
    results
  });
}
