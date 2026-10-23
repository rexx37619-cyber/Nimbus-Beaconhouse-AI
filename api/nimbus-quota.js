import {readRpd,fail} from './nimbus-secure-core.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return fail(res,405,'METHOD_NOT_ALLOWED');
 try{const r=await readRpd(req,res);if(!r.ok)return fail(res,r.http,r.error_code);return res.status(200).json(r)}
 catch{return fail(res,503,'QUOTA_SERVICE_UNAVAILABLE')}
}
