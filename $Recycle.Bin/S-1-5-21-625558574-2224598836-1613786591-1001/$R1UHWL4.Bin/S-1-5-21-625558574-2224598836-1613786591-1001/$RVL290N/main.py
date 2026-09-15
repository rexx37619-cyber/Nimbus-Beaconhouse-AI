import os, time
from collections import defaultdict
from pathlib import Path
from typing import Optional
import tempfile
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from agent import run_agent

ROOT=Path(__file__).resolve().parent.parent
app=FastAPI(title="Nimbus Beaconhouse AI")

OWNER_EMAILS={e.strip().lower() for e in os.getenv("OWNER_EMAILS","").split(",") if e.strip()}
DAILY_LIMIT=int(os.getenv("NIMBUS_DAILY_LIMIT","1500"))
_usage=defaultdict(lambda:{"day":"","count":0})

class AuthRequest(BaseModel): educational_id:str
class OwnerRequest(BaseModel): email:str

@app.get("/")
def home(): return FileResponse(ROOT/"index.html")
@app.get("/styles.css")
def styles(): return FileResponse(ROOT/"styles.css")
@app.get("/app.js")
def js(): return FileResponse(ROOT/"app.js")
@app.get("/assets/{filename}")
def asset(filename:str): return FileResponse(ROOT/"assets"/Path(filename).name)

@app.post("/api/auth")
def auth(req:AuthRequest):
    if not req.educational_id.strip(): return {"ok":False,"message":"Educational ID is required."}
    # Demo identity gate. Replace with approved Beaconhouse/Google/Microsoft SSO for production.
    return {"ok":True,"display_name":"Beaconhouse student"}

@app.post("/api/admin/authorize")
def authorize(req:OwnerRequest):
    email=req.email.strip().lower()
    if email not in OWNER_EMAILS:
        return {"ok":False,"message":"This email is not one of the configured website owners."}
    return {"ok":True,"email":email,"metrics":{"monthly_revenue":0,"messages_today":0,"daily_limit":DAILY_LIMIT,"active_models":1}}

def check_limit(key:str):
    today=time.strftime("%Y-%m-%d",time.gmtime())
    rec=_usage[key]
    if rec["day"]!=today: rec["day"],rec["count"]=today,0
    if rec["count"]>=DAILY_LIMIT: return False,rec["count"]
    rec["count"]+=1
    return True,rec["count"]

@app.post("/api/chat")
async def chat(message:str=Form(""),model:str=Form("nimbus"),educational_id:str=Form("anonymous"),file:Optional[UploadFile]=File(None)):
    allowed,used=check_limit(educational_id.strip().lower() or "anonymous")
    if not allowed: return {"limit_reached":True,"used":used,"limit":DAILY_LIMIT,"reply":f"Daily limit reached: {DAILY_LIMIT} requests per day."}
    file_path=None; file_name=None
    try:
        if file:
            file_name=Path(file.filename or "file").name
            suffix=Path(file_name).suffix
            with tempfile.NamedTemporaryFile(delete=False,suffix=suffix) as tmp:
                # Development starter; add file-size/type limits and malware scanning for production.
                tmp.write(await file.read()); file_path=tmp.name
        reply=await run_agent(message,model,file_path,file_name)
        return {"reply":reply,"model":model,"used":used,"limit":DAILY_LIMIT}
    finally:
        if file_path: Path(file_path).unlink(missing_ok=True)
