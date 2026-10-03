const CLOUDFLARE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4/accounts';
const MAX_PROMPT_CHARS = 2048;
const TIMEOUT_MS = 30000;

function textOf(value) {
  return String(value || '').trim();
}

function classifyVisualKind(text) {
  const s = textOf(text).toLowerCase();
  if (/\b(joint|skeleton|bone|muscle|lung|heart|cell|tissue|organ|brain|digestion|respiration|breathing|reproduction|kidney|stomach|intestine|diaphragm)\b/.test(s)) return 'scientifically accurate anatomy or biology illustration';
  if (/\b(circuit|electricity|force|energy|reaction|photosynthesis|food chain|food web|ecosystem|cycle|heat|temperature|diffusion|aerobic|anaerobic)\b/.test(s)) return 'scientifically accurate process or system illustration';
  if (/\b(algebra|equation|fraction|geometry|ratio|percentage|probability|statistics|math|maths)\b/.test(s)) return 'clear educational mathematics visualization';
  if (/\b(history|geography|map|climate|civilization|empire|timeline)\b/.test(s)) return 'educational history or geography visualization';
  return 'polished topic-specific educational illustration';
}

async function generateCloudflare(prompt) {
  const accountId = textOf(process.env.CLOUDFLARE_ACCOUNT_ID);
  const token = textOf(process.env.CLOUDFLARE_API_TOKEN);
  if (!accountId || !token) {
    const error = new Error('Cloudflare image credentials are not configured');
    error.code = 'MISSING_CLOUDFLARE_ENV';
    throw error;
  }

  const url = `${CLOUDFLARE_API_BASE}/${encodeURIComponent(accountId)}/ai/run/${CLOUDFLARE_MODEL}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: textOf(prompt).slice(0, MAX_PROMPT_CHARS)
      }),
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1200);

      let providerMessage = '';
      try {
        const parsed = detail ? JSON.parse(detail) : {};
        providerMessage =
          parsed?.errors?.[0]?.message ||
          parsed?.messages?.[0]?.message ||
          parsed?.error?.message ||
          '';
      } catch {}

      if (!providerMessage) {
        providerMessage = detail.replace(/\s+/g, ' ').slice(0, 300);
      }

      const error = new Error('Cloudflare FLUX request failed (' + response.status + ')');
      error.status = response.status;
      error.code = 'CLOUDFLARE_HTTP_' + response.status;
      error.providerMessage = providerMessage;
      throw error;
    }

    if (contentType.includes('image/')) {
      const buffer = Buffer.from(await response.arrayBuffer());
      return { data: buffer.toString('base64'), mimeType: contentType.split(';')[0] || 'image/jpeg' };
    }

    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
    const base64 = data?.result?.image || data?.image || data?.result?.data || data?.data;
    if (!base64 || typeof base64 !== 'string') throw new Error('Cloudflare response did not contain image data');
    return { data: base64, mimeType: 'image/jpeg' };
  } finally {
    clearTimeout(timer);
  }
}

function fallbackSvg(topic) {
  const safe = textOf(topic).replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><rect width="1200" height="675" fill="#f7fafc"/><rect x="60" y="60" width="1080" height="555" rx="28" fill="#fff" stroke="#d7dee8" stroke-width="3"/><text x="600" y="120" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="#18212f">Nimbus Visual Fallback</text><text x="600" y="170" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#4b5563">${safe.slice(0, 90)}</text><circle cx="600" cy="360" r="120" fill="#eef3f8" stroke="#9aa8b8" stroke-width="5"/><path d="M520 360h160M600 280v160" stroke="#667788" stroke-width="8" stroke-linecap="round"/></svg>`;
}

export function shouldVisualizeForNimbus(text) {
  return Boolean(textOf(text));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    body = body || {};

    const originalPrompt = textOf(body.prompt || body.message || '');
    if (!originalPrompt) return res.status(400).json({ ok: false, message: 'Prompt is required.', error_code: 'EMPTY_PROMPT' });

    const kind = classifyVisualKind(originalPrompt);
    const enhancedPrompt = `Create a high-quality 16:9 ${kind} for Grade 6-8 students. Exact topic: ${originalPrompt}. Make the image strongly specific to that topic, scientifically or academically accurate, visually rich, clear and classroom-ready. Image-first composition with a strong focal subject and meaningful relationships. Use arrows or simple callouts only when they genuinely clarify the concept. Avoid readable paragraphs, poster layouts, UI screens, worksheets, generic four-box templates, empty panels, unrelated objects, stock infographic templates and placeholder art.`;

    try {
      const generated = await generateCloudflare(enhancedPrompt);
      return res.status(200).json({
        ok: true,
        skipped: false,
        fallback: false,
        model: 'flux-1-schnell',
        mimeType: generated.mimeType,
        data: generated.data
      });
    } catch (error) {
      console.error('[Nimbus visual]', error?.message || error);
      const svg = fallbackSvg(originalPrompt);
      return res.status(200).json({
        ok: false,
        skipped: false,
        fallback: false,
        model: 'flux-1-schnell',
        error_code: error?.code || 'FLUX_REQUEST_FAILED',
        provider_status: Number(error?.status || 0) || null,
      provider_message: textOf(error?.providerMessage).slice(0, 300) || null
      });
    }
  } catch (error) {
    console.error('[Nimbus visual]', error?.message || error);
    return res.status(200).json({ ok: false, message: 'Visual generation could not be completed.', error_code: 'VISUAL_REQUEST_FAILED' });
  }
}
