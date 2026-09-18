function normalize(value) { return String(value || '').trim().toLowerCase(); }
const FALLBACK_OWNERS = new Set(['haadi6228@gmail.com', 'jollyzmotion@gmail.com']);
function getOwners() {
  const configured = String(process.env.OWNER_EMAILS || '').split(',').map(normalize).filter(Boolean);
  return new Set(configured.length ? configured : [...FALLBACK_OWNERS]);
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = normalize(body.email);
    if (!getOwners().has(email)) return res.status(403).json({ ok: false, message: 'Owner access denied.' });
    return res.status(200).json({
      ok: true,
      email,
      metrics: {
        monthly_revenue: Number(process.env.MONTHLY_REVENUE || 0),
        messages_today: 0,
        daily_limit: Number(process.env.NIMBUS_DAILY_LIMIT || 1500),
        active_models: 2
      }
    });
  } catch {
    return res.status(400).json({ ok: false, message: 'Invalid request.' });
  }
}
