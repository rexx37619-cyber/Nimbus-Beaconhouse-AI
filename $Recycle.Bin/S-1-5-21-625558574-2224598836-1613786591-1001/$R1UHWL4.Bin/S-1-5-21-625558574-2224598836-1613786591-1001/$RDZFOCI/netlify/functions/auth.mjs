export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ok:false,message:"Method not allowed."},{status:405});
  }
  try {
    const {educational_id} = await req.json();
    const id = String(educational_id || "").trim();
    if (!id) {
      return Response.json({ok:false,message:"Educational ID is required."},{status:400});
    }
    // Development gate only. Replace with approved Beaconhouse SSO/identity.
    return Response.json({ok:true,display_name:id.slice(0,1).toUpperCase(),educational_id:id});
  } catch {
    return Response.json({ok:false,message:"Invalid request."},{status:400});
  }
};
