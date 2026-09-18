function split(value) { return String(value || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean); }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const submitted = String(body.email || '').trim().toLowerCase();
    const owners = split(process.env.OWNER_EMAILS);
    if (!submitted) return res.status(400).json({ ok: false, message: 'No account email was provided.' });
    if (!owners.includes(submitted)) return res.status(403).json({ ok: false, role: 'denied', message: 'This Puter account is not on the Nimbus private workspace owner list.' });
    return res.status(200).json({ ok: true, role: 'owner', displayName: 'Workspace owner', permissions: ['premium_agent', 'revenue', 'profit', 'file_editor', 'ui_editor'], ownerOnly: true });
  } catch { return res.status(400).json({ ok: false, message: 'Invalid request.' }); }
}
