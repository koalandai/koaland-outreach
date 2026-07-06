# KoalandAI Outreach — Orchestration Engine Design

**Date:** 2026-07-06
**Status:** Approved (user requested full build: "Proceed further actions to build the whole platform engine")

## Goal

Automate all phases of acquiring hotels: plan target campaigns → generate prospect hotels in a region → research → auto-run audits → sequenced sends → scheduled follow-ups → prioritize by behavior. Every phase must also remain manually triggerable by a team member.

## Chosen approach

A modular engine living in `backend/engine/`, driven by a tick loop inside the existing Express local server (`backend/local-server.js`), exposed through `/api/engine/*` endpoints. Modules are plain CommonJS so they can later be mounted as Vercel cron endpoints without rework. Alternatives rejected: a separate worker process (duplicates auth/storage for no benefit at this scale) and building on Vercel serverless first (slows local iteration; no KV locally).

## Core concept: Campaign as the orchestration unit

A campaign record (extends the existing `campaigns` collection):

```js
{
  id, name, status,            // draft | active | paused | completed
  region,                      // e.g. "Bodrum, Turkey"
  searchQueries: [".."],       // SERP queries the discovery phase runs
  segment,                     // boutique | luxury | resort ...
  targetProspectCount: 25,     // discovery stops when reached
  icpThreshold: 60,            // min initial ICP fit to auto-add
  sequence: [                  // sequenced sends
    { step: 1, type: "initial",    delayDays: 0 },
    { step: 2, type: "followup_1", delayDays: 3 },
    { step: 3, type: "followup_2", delayDays: 5 },
    { step: 4, type: "breakup",    delayDays: 8 }
  ],
  sending: {
    autoSend: false,           // false → emails land in Outbox for approval
    dailySendLimit: 10,
    sendWindow: { startHour: 9, endHour: 18 },  // local server time
    testMode: false            // route to settings.testEmailAddress
  },
  notes, createdAt, updatedAt,
  metrics: { prospects, audits, sent, delivered, opened, pdfViews, replied, bounced }
}
```

## Engine architecture

```
backend/engine/
  engine.js          Orchestrator: tick loop, per-campaign phase dispatch,
                     engine state (running/paused, interval, cursors), activity log
  phases/
    discovery.js     Generate prospects for a region (SERP or mock), dedupe by
                     website, ICP-score, add those >= icpThreshold with campaignId
    research.js      Crawl website, extract contact email, status → research_complete
    audit.js         Auto-run audit (shared module also used by manual endpoint)
    outreach.js      Generate variants (GPT-4o), pick best by strengthScore,
                     schedule step-1 email
    followups.js     Advance sequences by elapsed time; behavior triggers
                     (PDF viewed, opened); stop on reply/bounce/unsubscribe
  scheduler.js       Send queue: due scheduled emails, daily limit, send window,
                     approval gate, actual send (SendGrid or logged)
  audit-runner.js    Extracted audit pipeline (crawl → GPT-4o → score → report
                     token → task), shared by engine and manual API
  email-generator.js Extracted email generation (GPT-4o or template fallback)
  campaign-planner.js AI campaign planning: region + goal → proposed campaign config
```

### Tick behavior

- `setInterval` in local-server (default 60s, configurable), plus `POST /api/engine/tick` for manual "Run Now".
- Each tick iterates **active** campaigns, running phases in order with small batch caps per tick (discovery: 1 search, research: 2 prospects, audits: 1, outreach: 2, follow-ups: all due, sends: up to remaining daily budget). Caps keep ticks fast and API usage/costs bounded.
- Every engine action appends to an `engine` activity log (new storage collection `engine.json`: state + ring-buffer log of ~200 entries).
- The engine is idempotent per item: phase eligibility is derived from prospect/email status fields, never from in-memory state, so restarts are safe.

### Prospect lifecycle under the engine

`research_queue → research_complete → audit_ready → email_scheduled/pending_approval → sent → (opened/pdf_viewed) → replied | sequence_exhausted`

Data model additions on prospects: `campaignId`, `sequenceStep`, `sequenceStoppedReason`, `nextFollowupAt`, `engineManaged: true`.
On emails: `campaignId`, `sequenceStep`, `scheduledAt`, `approvalStatus` (`auto` | `pending` | `approved` | `cancelled`), plus existing `status`.

## API additions (local server)

```
GET  /api/engine/status          state, interval, today's send count, activity log
POST /api/engine/start|stop      toggle loop
POST /api/engine/tick            run one tick now (also works while stopped)
PATCH /api/engine/config         interval, global pause
POST /api/campaigns/plan         AI campaign planner (GPT-4o; heuristic fallback)
POST /api/campaigns/:id/activate | pause
GET  /api/outbox                 scheduled + pending-approval emails
POST /api/outbox/:id/approve | cancel
POST /api/simulate/:emailId/:event   local-only: simulate delivered/opened/replied/bounced
                                     (production equivalent is the SendGrid webhook)
```

Existing manual endpoints are unchanged; the audit endpoint is refactored to call `audit-runner.js`.

Local gap fixed as part of this work: `GET /api/audit/view/:token` will log a `pdf_opened` event, bump hot-lead score, and create the behavior follow-up task (production already does this; the local server didn't).

## AI usage (OpenAI key required for real output; graceful fallback without)

- **Campaign planner**: region + goal → suggested queries, angle, sequence timing, expected funnel.
- **Audit**: existing GPT-4o auditor prompt (unchanged).
- **Email generation**: existing GPT-4o strategist prompt; engine auto-picks the best variant by average `strengthScore`.
- **Follow-ups**: follow-up writer prompt fed with real behavior signals (opened, PDF views, days since send).

Key lives in `backend/.env` (`OPENAI_API_KEY=`). Without it, every phase still runs using the existing mock/template fallbacks so the pipeline is testable end to end.

## Safety defaults

- `autoSend: false` on every new campaign — nothing is emailed without human approval until the team flips autopilot on.
- Sequences stop permanently on reply, bounce, unsubscribe, or spam report.
- Daily send limit (default 10) and send window enforced globally per campaign.
- No SendGrid key → sends are logged-only (status `logged_only`), so local testing can never email a real hotel.

## Frontend (Engine section in `backend/frontend/app.js`)

- **Engine Control Room** nav item: engine on/off switch, tick interval, "Run Tick Now", live activity feed, per-campaign phase progress bars, today's send budget.
- **Campaign planner**: create/edit campaign form with "Plan with AI" that fills the form from region + goal; activate/pause buttons.
- **Outbox**: pending-approval and scheduled emails with preview, one-click approve/cancel.
- Reuses the existing dark design system, view-registration, and API helper patterns in app.js.

## Testing

End-to-end locally with mocks: create campaign → activate → tick until prospects are discovered, researched, audited, and emails queued → approve from Outbox → simulate `opened` and `pdf_opened` → verify follow-up scheduling, hot-lead scoring, and sequence stop on simulated reply. Verified through both curl and the preview browser.
