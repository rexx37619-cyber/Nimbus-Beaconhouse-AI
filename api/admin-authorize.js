function split(value) { return String(value || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean); }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const submitted = String(body.email || '').trim().toLowerCase();
    const owners = split(process.env.OWNER_EMAILS);
    if (!owners.includes(submitted)) return res.status(403).json({ ok: false, message: 'Owner access denied.' });
    return res.status(200).json({ ok: true, email: submitted, metrics: { monthly_revenue: Number(process.env.MONTHLY_REVENUE || 0), messages_today: 0, daily_limit: Number(process.env.NIMBUS_DAILY_LIMIT || 1500), active_models: 2 } });
  } catch { return res.status(400).json({ ok: false, message: 'Invalid request.' }); }
}
