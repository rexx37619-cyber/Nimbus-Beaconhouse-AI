function normalize(value) { return String(value || '').trim().toLowerCase(); }

const OWNER_EMAILS = new Set(['haadi6228@gmail.com', 'jollyzmotion@gmail.com']);
const OWNER_USERNAMES = new Set(['neat_ocean_262513', 'peaceful_balloon_864250']);

function csvSet(value) {
  return new Set(String(value || '').split(',').map(normalize).filter(Boolean));
}

function configuredSet(name, fallback) {
  const configured = csvSet(process.env[name]);
  return configured.size ? configured : fallback;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = normalize(body.email);
    const username = normalize(body.puter_username || body.username);
    const puterUuid = normalize(body.puter_uuid);

    if (!username && !email) return res.status(400).json({ ok: false, message: 'Puter account identity is required.' });
    if (!puterUuid) return res.status(400).json({ ok: false, message: 'Puter account identity could not be verified.' });

    const ownerEmails = configuredSet('OWNER_EMAILS', OWNER_EMAILS);
    const ownerUsernames = configuredSet('OWNER_PUTER_USERNAMES', OWNER_USERNAMES);
    const ownerMatch = ownerEmails.has(email) || ownerUsernames.has(username);

    if (!ownerMatch) {
      return res.status(403).json({
        ok: false,
        role: 'denied',
        message: 'Access denied. This Puter account is not one of the two Nimbus owners.'
      });
    }

    return res.status(200).json({
      ok: true,
      role: 'owner',
      displayName: username === 'neat_ocean_262513' ? 'Haadi' : username === 'peaceful_balloon_864250' ? 'Owner 2' : 'Workspace owner',
      permissions: ['premium_agent', 'previous_chats', 'revenue', 'profit', 'file_editor', 'ui_editor', 'visuals'],
      ownerOnly: true,
      accessAccepted: true
    });
  } catch {
    return res.status(400).json({ ok: false, message: 'Invalid workspace authorization request.' });
  }
}
