export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const id = String(body.educational_id || '').trim();
    const valid = /^\S+@(bh|beaconite)\.edu\.pk$/i.test(id);
    if (!valid) {
      return res.status(400).json({ ok: false, message: 'Invalid Educational ID. Use an ID ending in @bh.edu.pk or @beaconite.edu.pk.' });
    }
    return res.status(200).json({ ok: true, display_name: id.split('@')[0], educational_id: id });
  } catch {
    return res.status(400).json({ ok: false, message: 'Invalid request.' });
  }
}
