# Nimbus — Vercel build

Current deployment target: Vercel. The repository uses root `api/` Node.js functions and static HTML/CSS/JS.

## Core environment variables
- `GEMINI_API_KEY` — public Nimbus chat + Nano Banana 2 image generation.
- `OWNER_EMAILS` — `haadi6228@gmail.com,jollyzmotion@gmail.com`
- `OWNER_PUTER_USERNAMES` — optional; defaults to `neat_ocean_262513,peaceful_balloon_864250`
- `NIMBUS_DAILY_LIMIT` — default 1500

Do not add `GITHUB_TOKEN`.

## Workspace
Private workspace access is limited to the two approved Puter usernames and owner emails. There is no worker role.

## Visuals
Nano Banana 2 uses Google Gemini 3.1 Flash Image (`gemini-3.1-flash-image`) through `/api/visual`. Study-help requests can automatically receive a 16:9 visual diagram/flowchart alongside keyword-focused text.

## Academic response mode
Nimbus is instructed to provide keywords, factual points, structure, labels and visual support rather than polished submission-ready school prose. When asked to rewrite, it says the student must rephrase it themselves and then supplies keywords and structure.

## Model/agent UI
The public site and private workspace use dropdown-based model selection, code blocks with language labels, copy buttons and previous-chat history.
