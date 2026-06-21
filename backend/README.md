# Koaland Prospect Intelligence OS

Commercial radar for brand-sensitive hotels.  
Research → Audit → Score → Generate PDF → Generate Email → Send → Track → Follow up → Prioritize

---

## What this is

A full-stack outbound intelligence cockpit for Murat at Koaland.ai.  
**Frontend:** open `frontend/index.html` in any browser — no build step, no npm.  
**Backend:** deployed to Vercel as serverless functions.  
**Storage:** Vercel KV (Redis) for all persistent data.  

---

## Prerequisites

- A [Vercel](https://vercel.com) account (free tier works)
- A Vercel KV database (add from Vercel dashboard → Storage → Create KV)
- An OpenAI API key
- A SendGrid account and API key with a verified sender email
- Optional: Google PageSpeed API key (free), SERP API key

---

## Deployment Steps

### 1. Clone & install

```bash
cd koaland-os
npm install
```

### 2. Deploy to Vercel

```bash
npx vercel
```

Follow the prompts. Note your deployment URL (e.g. `https://koaland-os-xxx.vercel.app`).

### 3. Add environment variables in Vercel dashboard

Go to your project → Settings → Environment Variables and add:

```
DASHBOARD_ACCESS_TOKEN    your_secret_password_here
OPENAI_API_KEY            sk-...
SENDGRID_API_KEY          SG....
SENDGRID_FROM_EMAIL       murat@koaland.ai
SENDGRID_FROM_NAME        Murat
PAGESPEED_API_KEY         AIza...   (optional)
SERP_API_KEY              ...       (optional)
SERP_PROVIDER             serpapi   (or: valueserp / serper)
TRACKING_BASE_URL         https://your-app.vercel.app
```

### 4. Add Vercel KV Storage

In Vercel dashboard → Storage → Create Database → KV.  
Connect it to your project. The env vars `KV_REST_API_URL` and `KV_REST_API_TOKEN` are added automatically.

### 5. Redeploy after adding env vars

```bash
npx vercel --prod
```

### 6. Connect SendGrid Webhook

In SendGrid dashboard → Settings → Mail Settings → Event Webhook:
- HTTP POST URL: `https://your-app.vercel.app/api/webhooks/sendgrid`
- Events to track: Delivered, Opened, Clicked, Bounced, Spam Reports, Unsubscribes
- Click "Test Your Integration" to verify

---

## Opening the Frontend

1. Double-click `frontend/index.html` — it opens in your browser
2. On the lock screen, enter:
   - **API Base URL**: `https://your-app.vercel.app`
   - **Access Token**: the value of `DASHBOARD_ACCESS_TOKEN` you set
3. Click "Access Intelligence OS"

The app stores both values in `localStorage` so you only need to enter them once.

---

## Feature Guide

### Prospect Radar
Search for luxury/boutique hotels using a natural language query like "luxury boutique hotels in Bodrum". Results are filtered to remove OTA sites and scored for ICP fit. Add promising hotels directly to your research queue.

### Audit Workspace
Select a prospect → click "Run Audit". The system:
1. Crawls their website (headers, CTAs, booking links, FAQs, schema)
2. Runs Google PageSpeed for mobile and desktop
3. Sends all data to GPT-4o for structured analysis
4. Generates scores across 7 dimensions
5. Creates a branded HTML audit report
6. Returns a tracking URL — when the prospect opens it, you get notified

### Email Studio
After running an audit, go to Email Studio → select the prospect → Generate Variants. The AI writes 3 email variants based on the strongest audit finding. Pick a subject line, review the body, send test or live.

### Tracking
Every audit PDF link is a tracking URL (`/api/audit/view/:token`). When the prospect opens it:
- Event is logged
- Hot lead score updates
- Follow-up task created automatically within 24 hours

### Follow-up Queue
Tasks are created automatically based on behavior:
- Email opened, no PDF view after 2 days → follow-up
- PDF viewed → 24h task created
- PDF viewed 2+ times → marked hot, urgent task
- Email bounced → contact research task

### SendGrid Webhook
SendGrid sends real-time events (opens, clicks, bounces) to `/api/webhooks/sendgrid`. These update email status, prospect status, hot lead score, and create follow-up tasks automatically.

---

## Migrating Storage to Supabase

The storage layer is fully abstracted in `services/storageService.ts`.  
To migrate to Supabase:

1. Install `@supabase/supabase-js`
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to env vars
3. Replace the Vercel KV calls in `storageService.ts` with Supabase table operations
4. The data models stay identical — just change the persistence backend
5. The rest of the codebase (API endpoints, services) requires no changes

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DASHBOARD_ACCESS_TOKEN` | ✓ | Password to access the dashboard |
| `OPENAI_API_KEY` | ✓ | GPT-4o for audit analysis and email generation |
| `SENDGRID_API_KEY` | ✓ | Email sending |
| `SENDGRID_FROM_EMAIL` | ✓ | Verified sender email |
| `SENDGRID_FROM_NAME` | ✓ | Sender name (Murat) |
| `KV_REST_API_URL` | ✓ | Vercel KV — auto-added when you connect KV |
| `KV_REST_API_TOKEN` | ✓ | Vercel KV — auto-added when you connect KV |
| `TRACKING_BASE_URL` | ✓ | Your Vercel deployment URL (for PDF tracking links) |
| `PAGESPEED_API_KEY` | optional | Google PageSpeed Insights API key (free) |
| `SERP_API_KEY` | optional | SERP provider API key for Prospect Radar |
| `SERP_PROVIDER` | optional | `serpapi`, `valueserp`, or `serper` |
| `SENDGRID_WEBHOOK_PUBLIC_KEY` | optional | For webhook signature verification |
| `APP_ALLOWED_ORIGIN` | optional | CORS origin restriction (default: `*`) |

---

## Architecture

```
frontend/index.html        Opens locally in any browser
  └── app.js               Single-file SPA, no build required
  └── styles.css           Premium dark-espresso design system

api/                       Vercel serverless functions (TypeScript)
  ├── health.ts            GET  /api/health
  ├── auth/check.ts        POST /api/auth/check
  ├── prospects/           GET/POST/PATCH/DELETE
  ├── discovery/search.ts  POST /api/discovery/search
  ├── research/prospect.ts POST /api/research/prospect
  ├── audits/run.ts        POST /api/audits/run
  ├── audits/[id].ts       GET/POST /api/audits/:id
  ├── audit/view/[token]   GET — serves branded HTML report + logs view
  ├── audit/download/[token] GET — serves report with print trigger
  ├── emails/generate.ts   POST /api/emails/generate
  ├── emails/send.ts       POST /api/emails/send
  ├── emails/[id].ts       GET/PATCH
  ├── webhooks/sendgrid.ts POST — receives SendGrid events
  ├── r/[type]/[token].ts  GET — tracking redirects
  ├── tasks/               GET/POST/PATCH
  ├── campaigns/           GET/POST
  ├── dashboard.ts         GET /api/dashboard
  ├── analytics.ts         GET /api/analytics
  └── settings.ts          GET/PATCH /api/settings

services/
  ├── storageService.ts    Vercel KV abstraction (swap for Supabase)
  ├── openaiService.ts     GPT-4o calls for all AI features
  ├── sendgridService.ts   Email sending
  ├── crawlerService.ts    Website crawler (Cheerio)
  ├── pagespeedService.ts  Google PageSpeed API
  ├── serpService.ts       SERP search (SerpApi/ValueSerp/Serper)
  ├── pdfService.ts        Branded HTML audit report generator
  ├── scoringService.ts    Hot lead scoring
  └── taskService.ts       Follow-up task creation logic

prompts/
  ├── hotelResearch.ts     Hotel profile extraction
  ├── digitalAuditor.ts    Full digital experience audit
  ├── emailStrategist.ts   Email generation + follow-up writing
  └── ...

storage/                   Initial empty JSON files (reference only)
```

---

## Email Signature

All generated emails end with:
```
Best,
Murat
Koaland.ai
```

This is enforced in the AI system prompt and cannot be overridden by the email generation.

---

## Demo Kit Link

Leave `demoKitLink` empty in Settings → the email AI is instructed to omit any demo kit CTA. When you have a link, add it in Settings → Brand → Demo Kit Link and it will be included automatically in future generated emails and audit reports.

---

Built for Murat at Koaland.ai · Commercial intelligence for brand-sensitive hotels
