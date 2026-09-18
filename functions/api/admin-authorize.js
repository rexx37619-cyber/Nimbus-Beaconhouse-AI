function split(value) { return String(value || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean); }
export async function onRequestPost(context) {
  try {
    const { email } = await context.request.json();
    const submitted = String(email || '').trim().toLowerCase();
    const owners = split(context.env.OWNER_EMAILS);
    if (!owners.includes(submitted)) return Response.json({ ok: false, message: 'Owner access denied.' }, { status: 403 });
    return Response.json({ ok: true, email: submitted, metrics: { monthly_revenue: Number(context.env.MONTHLY_REVENUE || 0), messages_today: 0, daily_limit: Number(context.env.NIMBUS_DAILY_LIMIT || 1500), active_models: 2 } });
  } catch { return Response.json({ ok: false, message: 'Invalid request.' }, { status: 400 }); }
}
