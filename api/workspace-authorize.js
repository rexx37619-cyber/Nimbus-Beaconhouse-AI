function normalize(value) { return String(value || '').trim().toLowerCase(); }

const FALLBACK_OWNERS = new Set([
  'haadi6228@gmail.com',
  'jollyzmotion@gmail.com'
]);

function getOwners() {
  const configured = String(process.env.OWNER_EMAILS || '')
    .split(',')
    .map(normalize)
    .filter(Boolean);
  return new Set(configured.length ? configured : [...FALLBACK_OWNERS]);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = normalize(body.email);
    const puterUuid = normalize(body.puter_uuid);
    if (!email) return res.status(400).json({ ok: false, message: 'Puter email access is required for owner verification.' });
    if (!puterUuid) return res.status(400).json({ ok: false, message: 'Puter account identity is required.' });

    const owners = getOwners();
    if (!owners.has(email)) {
      return res.status(403).json({
        ok: false,
        role: 'denied',
        message: 'This Puter account is not one of the two Nimbus workspace owners.'
      });
    }

    return res.status(200).json({
      ok: true,
      role: 'owner',
      displayName: 'Workspace owner',
      permissions: ['premium_agent', 'previous_chats', 'revenue', 'profit', 'file_editor', 'ui_editor'],
      ownerOnly: true
    });
  } catch {
    return res.status(400).json({ ok: false, message: 'Invalid workspace authorization request.' });
  }
}
