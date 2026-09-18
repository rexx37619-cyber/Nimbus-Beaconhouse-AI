export async function onRequestPost(context) {
  try {
    const { educational_id } = await context.request.json();
    const id = String(educational_id || '').trim();
    const valid = /^\S+@(bh|beaconite)\.edu\.pk$/i.test(id);
    if (!valid) {
      return Response.json({ ok: false, message: 'Invalid Educational ID. Use an ID ending in @bh.edu.pk or @beaconite.edu.pk.' }, { status: 400 });
    }
    return Response.json({ ok: true, display_name: id.split('@')[0], educational_id: id });
  } catch {
    return Response.json({ ok: false, message: 'Invalid request.' }, { status: 400 });
  }
}
