export default async (req) => {
  if (req.method !== 'POST') return Response.json({ ok:false, message:'Method not allowed.' }, { status:405 });
  try {
    const { email } = await req.json();
    const submitted = String(email || '').trim().toLowerCase();
    const split = (value) => String(value || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    const owners = split(process.env.OWNER_EMAILS);
    const workers = split(process.env.WORKER_EMAILS);
    if (!submitted) return Response.json({ ok:false, message:'No account email was provided.' }, { status:400 });
    const role = owners.includes(submitted) ? 'owner' : workers.includes(submitted) ? 'worker' : 'denied';
    if (role === 'denied') {
      return Response.json({ ok:false, role:'denied', message:'This Puter account is not on the Nimbus workspace access list.' }, { status:403 });
    }
    return Response.json({
      ok:true,
      role,
      displayName: role === 'owner' ? 'Workspace owner' : 'Nimbus worker',
      permissions: role === 'owner'
        ? ['premium_agent','revenue','profit','file_editor','ui_editor']
        : ['premium_agent']
    });
  } catch {
    return Response.json({ ok:false, message:'Invalid request.' }, { status:400 });
  }
};
