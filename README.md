# Koaland AI, Outreach (Intelligence OS)

Outbound cockpit for prospect discovery, auditing, email generation, follow-ups, and a self-driving acquisition engine. Built for brand-sensitive boutique and luxury hotels.

## Run it locally (2 commands)

```bash
cd backend
npm install
node local-server.js
```

Open http://localhost:3000 and sign in with token `local-dev` (the endpoint and token are prefilled when you run locally, so just click **Access Intelligence OS**).

That is the whole setup. It runs out of the box in safe mock mode: no API keys required, and nothing leaves your machine.

## Mock mode vs live mode

The cockpit degrades gracefully. With no keys set it produces deterministic mock output so every screen is usable. Add a key to `backend/.env` to flip that feature to real, then restart the server:

| Feature | Env var | Blank (default) |
|---|---|---|
| AI audits + email generation (GPT-4o) | `OPENAI_API_KEY` | deterministic mock text |
| Real email sending | `SENDGRID_API_KEY` | logged only, nothing sent |
| Prospect discovery (Google SERP) | `SERP_API_KEY` | mock hotels generated |

Copy `backend/.env.example` to `backend/.env` and fill in what you want live. `.env` is git-ignored.

## Layout

- `backend/`: the live app. `local-server.js` (Express dev server), `frontend/` (the cockpit UI it serves), `engine/` (the acquisition engine), `api/` (Vercel serverless routes), `prompts/`, `services/`.
- `docs/`: plans and specs.
- `legacy/`: the pre-engine standalone dashboard, kept for reference only (see `legacy/NOTE.md`). Nothing in the build uses it.

## The acquisition engine

`backend/README.md` documents the self-driving engine: plan a campaign for a region, then it discovers, researches, audits, drafts best-variant emails to an approval Outbox, sends on a schedule, and pulls follow-ups forward from prospect behavior. Safety defaults keep human approval on and block real sends until `SENDGRID_API_KEY` is set.
