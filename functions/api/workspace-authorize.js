function split(value) {
  return String(value || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
}

export async function onRequestPost(context) {
  if (context.request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    const { email } = await context.request.json();
    const submitted = String(email || '').trim().toLowerCase();
    const owners = split(context.env.OWNER_EMAILS);
    if (!submitted) return Response.json({ ok: false, message: 'No account email was provided.' }, { status: 400 });
    if (!owners.includes(submitted)) {
      return Response.json({ ok: false, role: 'denied', message: 'This Puter account is not on the Nimbus private workspace owner list.' }, { status: 403 });
    }
    return Response.json({
      ok: true,
      role: 'owner',
      displayName: 'Workspace owner',
      permissions: ['premium_agent', 'revenue', 'profit', 'file_editor', 'ui_editor']
    });
  } catch {
    return Response.json({ ok: false, message: 'Invalid request.' }, { status: 400 });
  }
}
