// V34.5: Legacy unverified Educational ID sign-in is no longer a valid account flow.
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 return res.status(410).json({ok:false,error_code:'LEGACY_LOGIN_RETIRED',message:'Use verified Nimbus sign-in at /api/nimbus-account.'});
}
