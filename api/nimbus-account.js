/* Nimbus V34.6.6: passwordless educational ID entry lives in sessionStorage.
   Retired Supabase endpoints intentionally cannot access previous private accounts. */
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 return res.status(410).json({ok:false,error_code:'ACCOUNTS_DISABLED_ID_ONLY',message:'Nimbus now uses browser-local educational ID access.'});
}
