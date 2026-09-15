# Nimbus — Beaconhouse AI starter

## Included
Modern New Chat layout, model switcher, file attachment UI, Nimbus agent stage, Beaconhouse educational-ID login flow, and FastAPI integration.

## EXACT place for your Python agent
Open `backend/agent.py`.

Paste your existing Python agent there. Keep or adapt the single function:
`async def run_agent(message, model, file_path=None, file_name=None) -> str`

Example:
```python
async def run_agent(message, model, file_path=None, file_name=None):
    result = your_existing_agent(prompt=message, model=model, file_path=file_path)
    return str(result)
```

If your existing agent is synchronous:
1. change the function to `def run_agent(...)`
2. remove `await` before `run_agent(...)` in `backend/main.py`

## Install and run
From the project folder:
`pip install fastapi uvicorn python-multipart`

Then:
`cd backend`
`uvicorn main:app --reload`

Open:
`http://127.0.0.1:8000`

## Authentication
The frontend asks only for an Educational/Beaconite ID and never asks for a password. The `/api/auth` function is deliberately a DEMO. For a real Beaconhouse deployment, replace it with your approved school SSO/identity provider. Do not attempt to imitate or bypass the real student login system.

## Multiple models
Edit `S.models` in `app.js`. Each model ID is passed to `/api/chat`; your Python agent can route the request to the correct model.

## Logos
The package uses clean placeholder N/B marks so it works without missing image files. Put your approved Nimbus and Beaconhouse logo images in `assets/`, then replace the two placeholder marks in `index.html` with `<img>` tags.

## Beaconhouse knowledge
This starter panel contains only high-level public information. Build a reviewed/approved school knowledge base for production rather than connecting Nimbus to private student systems.

Official references used for the starter:
- https://student.beaconhouse.net/
- https://www.beaconhouse.net/
- https://www.beaconhouse.net/academic/
- https://www.beaconhouse.net/about-us/


## NEW: Owner workspace
The Owner workspace is linked from the left sidebar. It is intended for only you and your friend.

Set these server environment variables:

    ADMIN_EMAILS="you@example.com,friend@example.com"
    NIMBUS_DAILY_LIMIT="1500"

The included endpoint uses an email allowlist as a DEVELOPMENT gate. It is NOT sufficient proof of identity for production because anyone could type an allowed email. Production must replace `/api/admin/authorize` with verified Google Workspace, Microsoft Entra, Beaconhouse SSO, or another approved identity provider.

The dashboard is ready to display monthly revenue, messages, usage and active models once connected to your real database/payment provider.

## 1,500 RPD
The backend counts requests per educational ID and blocks further requests after 1,500 requests in a UTC day. The starter keeps counts in memory, so they reset if the server restarts and do not synchronize across multiple servers.

For production, put the limit counter in Redis or your database. Also enforce billing/revenue metrics server-side.

## Uploaded logos
Your supplied images are now included as:
- `assets/nimbus-logo.png`
- `assets/beaconhouse-logo.png`
