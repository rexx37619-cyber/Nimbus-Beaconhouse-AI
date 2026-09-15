import os
import time
from pathlib import Path
from collections import defaultdict
from typing import Optional
import tempfile

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from agent import run_agent

app = FastAPI(title="Nimbus Beaconhouse AI")
ROOT = Path(__file__).resolve().parent.parent

# CHANGE THESE IN YOUR .env / hosting environment.
# Example: ADMIN_EMAILS="you@example.com,friend@example.com"
ADMIN_EMAILS = {
    e.strip().lower()
    for e in os.getenv("ADMIN_EMAILS", "owner@example.com,friend@example.com").split(",")
    if e.strip()
}
DAILY_LIMIT = int(os.getenv("NIMBUS_DAILY_LIMIT", "1500"))

# Simple in-process development limiter. Use Redis/database for multi-server production.
_usage = defaultdict(lambda: {"day": "", "count": 0})

class AuthRequest(BaseModel):
    educational_id: str

class AdminRequest(BaseModel):
    email: str

@app.get("/")
def home():
    return FileResponse(ROOT / "index.html")

@app.get("/assets/{filename}")
def asset(filename: str):
    safe = Path(filename).name
    path = ROOT / "assets" / safe
    return FileResponse(path)

@app.post("/api/auth")
def auth(req: AuthRequest):
    if not req.educational_id.strip():
        return {"ok": False, "message": "Educational ID is required."}
    # DEMO ONLY: replace with an approved Beaconhouse SSO/identity service.
    return {"ok": True, "display_name": req.educational_id[:1].upper(), "demo": True}

def allowed_admin(email: str) -> bool:
    return email.strip().lower() in ADMIN_EMAILS

@app.post("/api/admin/authorize")
def admin_authorize(req: AdminRequest):
    email = req.email.strip().lower()
    if not allowed_admin(email):
        return {"ok": False, "message": "This email is not authorized for the owner workspace."}
    # This proves only that the submitted email is on the server allowlist.
    # For production, replace this with Google/Microsoft/Beaconhouse SSO verification.
    return {
        "ok": True,
        "email": email,
        "metrics": {
            "monthly_revenue": 0,
            "messages_today": 0,
            "active_models": 3,
        },
    }

def check_limit(key: str):
    today = time.strftime("%Y-%m-%d", time.gmtime())
    record = _usage[key]
    if record["day"] != today:
        record["day"] = today
        record["count"] = 0
    if record["count"] >= DAILY_LIMIT:
        return False, record["count"]
    record["count"] += 1
    return True, record["count"]

@app.post("/api/chat")
async def chat(
    message: str = Form(""),
    model: str = Form("nimbus"),
    educational_id: str = Form("anonymous"),
    file: Optional[UploadFile] = File(None),
):
    allowed, used = check_limit(educational_id.strip().lower() or "anonymous")
    if not allowed:
        return {
            "reply": f"Daily limit reached: {DAILY_LIMIT} requests per day.",
            "limit_reached": True,
            "used": used,
            "limit": DAILY_LIMIT,
        }

    file_path = None
    file_name = None
    try:
        if file:
            file_name = file.filename
            suffix = Path(file.filename or "").suffix
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(await file.read())
                file_path = tmp.name
        reply = await run_agent(
            message=message,
            model=model,
            file_path=file_path,
            file_name=file_name,
        )
        return {"reply": str(reply), "model": model, "used": used, "limit": DAILY_LIMIT}
    finally:
        if file_path:
            Path(file_path).unlink(missing_ok=True)
