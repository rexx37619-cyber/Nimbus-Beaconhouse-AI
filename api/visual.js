function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function normalizePrompt(prompt) {
  return `Create a polished, artistic, scientifically grounded educational visual for Nimbus Beaconhouse AI.

Requirements:
- Match the requested topic exactly.
- Prefer a real scientific illustration, anatomical cutaway, labeled structure, experiment setup, process scene, comparison graphic, or meaningful concept map as appropriate.
- Do NOT create the old generic four-box study template.
- Do NOT make a plain text poster.
- Use short, readable labels only when labels are useful.
- Keep the visual suitable for a Grade 7 Beaconhouse student.
- Accurate science is more important than decorative effects.
- 16:9 educational composition, clean hierarchy, polished depth and lighting.

Student request/context:
${String(prompt || '').trim().slice(0, 7000)}`;
}

async function generateCloudflare(accountId, token, prompt) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: normalizePrompt(prompt),
      steps: 4
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success !== true) {
    const detail = data?.errors?.map?.(e => e?.message).filter(Boolean).join('; ');
    throw new Error(detail || `Cloudflare FLUX request failed (${response.status})`);
  }

  const encoded = data?.result?.image || data?.image || data?.result?.output?.image;
  if (!encoded) throw new Error('Cloudflare FLUX returned no image data.');
  return { data: encoded, mimeType: 'image/jpeg', model: 'flux-1-schnell' };
}

function svgFallback(title = 'Study Visual', topic = 'Study topic') {
  const esc = x => String(x).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[c]));
  const safe = String(topic || '').replace(/\s+/g, ' ').slice(0, 90);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 576">
  <defs><linearGradient id="bg" x1="0" x2="1"><stop stop-color="#f8fafc"/><stop offset="1" stop-color="#eef2ff"/></linearGradient></defs>
  <rect width="1024" height="576" rx="28" fill="url(#bg)"/>
  <rect x="42" y="34" width="940" height="508" rx="30" fill="#fff" stroke="#cbd5e1"/>
  <text x="70" y="95" font-family="Arial" font-size="16" font-weight="800" fill="#6d5dfc">NIMBUS STUDY VISUAL</text>
  <text x="70" y="135" font-family="Arial" font-size="30" font-weight="900" fill="#0f172a">${esc(title)}</text>
  <text x="70" y="170" font-family="Arial" font-size="14" fill="#64748b">Temporary visual fallback — the live image provider did not return an image.</text>
  <text x="512" y="292" text-anchor="middle" font-family="Arial" font-size="22" font-weight="800" fill="#0f172a">${esc(safe)}</text>
  <text x="512" y="325" text-anchor="middle" font-family="Arial" font-size="14" fill="#64748b">Please retry visual generation.</text>
  </svg>`;
  return Buffer.from(svg).toString('base64');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });

  try {
    const body = parseBody(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ ok: false, message: 'No visual prompt was provided.' });

    const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
    const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();

    if (accountId && token) {
      try {
        const image = await generateCloudflare(accountId, token, prompt);
        return res.status(200).json({ ok: true, ...image });
      } catch (error) {
        console.error('[Nimbus visual] Cloudflare FLUX failed:', error?.message || error);
      }
    } else {
      console.error('[Nimbus visual] CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is missing.');
    }

    const fallback = svgFallback('Study Visual', prompt);
    return res.status(200).json({
      ok: true,
      fallback: true,
      mimeType: 'image/svg+xml',
      data: fallback,
      model: 'nimbus-local-fallback'
    });
  } catch (error) {
    console.error('[Nimbus visual handler]', error);
    const fallback = svgFallback('Study Visual', 'Educational concept');
    return res.status(200).json({
      ok: true,
      fallback: true,
      mimeType: 'image/svg+xml',
      data: fallback,
      model: 'nimbus-local-fallback'
    });
  }
}
