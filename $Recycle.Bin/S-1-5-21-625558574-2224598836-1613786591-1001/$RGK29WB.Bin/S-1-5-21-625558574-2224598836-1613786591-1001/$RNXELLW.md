# Nimbus — Beaconhouse Intelligence (public deployment)

This version removes the model switcher and focuses on a Gemini-style educational chat workspace: New Chat, previous chats, Clear Chat, attachments, account menu, and a private Owner Workspace.

## Nimbus agent
Put your Nimbus/Gemini logic in `backend/agent.py`. It exposes `run_agent(...)` for the website. `backend/main.py` is the web/API server and should not be replaced.

## Public hosting
Use one Render Web Service. No terminal process needs to stay open on your PC after deployment.

Build command:
`pip install -r requirements.txt`

Start command:
`cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`

Environment variables:
- `GEMINI_API_KEY` — your new Gemini API key
- `OWNER_EMAILS` — exactly the two owner emails, comma separated
- `NIMBUS_DAILY_LIMIT=1500`

Example:
`OWNER_EMAILS=you@example.com,friend@example.com`

## Owner security
The included owner workspace uses a server-side email allowlist. That authorizes the two configured addresses, but simply typing an allowed address is not cryptographic proof that the person owns the inbox. Before treating this as a real admin panel, use verified Google/Microsoft/Beaconhouse SSO or email OTP/magic-link authentication.

## Student authentication
The Educational ID screen is a demo gate. For a real Beaconhouse student service, connect it to an approved identity provider rather than collecting school passwords.

## 1,500 RPD
The starter counts requests by educational ID in memory. It resets when the service restarts and does not synchronize across multiple servers. For a real public service, use a database/Redis-backed counter and add abuse/rate-limit controls.
