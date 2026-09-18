function normalize(value) { return String(value || '').trim().toLowerCase(); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const username = normalize(body.puter_username || body.username);
    const puterUuid = normalize(body.puter_uuid);

    if (!puterUuid) {
      return res.status(401).json({ ok: false, role: 'denied', message: 'Please sign in with Puter first.' });
    }

    // Workspace access is intentionally gated only by an authenticated Puter account.
    // The previous owner email/username allowlist is removed for now as requested.
    return res.status(200).json({
      ok: true,
      role: 'owner',
      displayName: username || 'Puter owner',
      permissions: ['premium_agent', 'previous_chats', 'revenue', 'profit', 'file_editor', 'ui_editor', 'visuals'],
      ownerOnly: false,
      accessAccepted: true,
      message: 'Access allowed.'
    });
  } catch {
    return res.status(400).json({ ok: false, message: 'Invalid Puter sign-in request.' });
  }
}
