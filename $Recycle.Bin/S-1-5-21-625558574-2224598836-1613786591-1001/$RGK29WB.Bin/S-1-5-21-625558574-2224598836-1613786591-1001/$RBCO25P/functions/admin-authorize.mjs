export default async (req)=>{
  if(req.method!=="POST") return Response.json({ok:false,message:"Method not allowed."},{status:405});

  try{
    const {email}=await req.json();
    const submitted=String(email||"").trim().toLowerCase();
    const owners=String(process.env.OWNER_EMAILS||"")
      .split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);

    if(!submitted || !owners.includes(submitted)){
      return Response.json({ok:false,message:"This email is not authorized."},{status:403});
    }

    return Response.json({
      ok:true,
      email:submitted,
      metrics:{
        monthly_revenue:Number(process.env.MONTHLY_REVENUE||0),
        messages_today:Number(process.env.MESSAGES_TODAY||0),
        daily_limit:Number(process.env.NIMBUS_DAILY_LIMIT||1500),
        active_models:1
      }
    });
  }catch{
    return Response.json({ok:false,message:"Invalid request."},{status:400});
  }
};
