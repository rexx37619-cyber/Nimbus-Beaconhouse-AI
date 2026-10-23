// Nimbus V34.4: visual generation disabled by product decision.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 return res.status(410).json({ok:false,error_code:'VISUALS_DISABLED',message:'Visual generation is currently disabled in Nimbus.'});
}
