import {currentUser,currentQuota,jsonError} from '../lib/nimbus-pin-core.js';
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return jsonError(res,405,'METHOD_NOT_ALLOWED','Use GET.');
 try{const user=await currentUser(req);if(!user)return jsonError(res,401,'NIMBUS_SIGN_IN_REQUIRED','Sign in first.');const q=await currentQuota(user.id);return res.status(200).json(q)}
 catch{return jsonError(res,503,'QUOTA_DB_UNAVAILABLE','Daily usage temporarily unavailable.');}}
