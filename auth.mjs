export default async (req) => {
  if (req.method !== "POST") return Response.json({ ok:false, message:"Method not allowed." }, { status:405 });
  try {
    const { educational_id } = await req.json();
    const id = String(educational_id || "").trim();
    const valid = /^\S+@(bh|beaconite)\.edu\.pk$/i.test(id);
    if (!valid) {
      return Response.json({ ok:false, message:"Invalid Educational ID. Use an ID ending in @bh.edu.pk or @beaconite.edu.pk." }, { status:400 });
    }
    return Response.json({ ok:true, display_name:id.split("@")[0], educational_id:id });
  } catch {
    return Response.json({ ok:false, message:"Invalid request." }, { status:400 });
  }
};
