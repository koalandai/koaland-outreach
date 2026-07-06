# Orchestration Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the full hotel-acquisition pipeline (campaign planning → regional prospect generation → research → audits → sequenced sends → scheduled follow-ups) inside the local Express server, with manual override and a human-approval Outbox.

**Architecture:** Modular CommonJS engine in `backend/engine/` driven by a tick loop in `backend/local-server.js`. Phase eligibility is derived from persisted status fields (idempotent, restart-safe). GPT-4o where `OPENAI_API_KEY` exists, deterministic fallbacks otherwise.

**Tech Stack:** Node.js + Express, plain CommonJS modules, file-JSON storage, OpenAI SDK, Cheerio, vanilla-JS SPA frontend (no build).

## Global Constraints

- No new npm dependencies; no build step anywhere.
- All emails end exactly with `Best,\nMurat\nKoaland.ai`.
- `autoSend` defaults to `false`; sequences stop on replied/bounced/unsubscribed.
- Without SendGrid key, sends get status `logged_only` — never a real email.
- Verification is curl-based against the running server (repo has no test framework; keep it that way).
- Storage collections: existing + new `engine.json` (`{ state, log }` shape, not an array).

---

### Task 1: Extract shared store + crawler; engine core with tick loop

**Files:**
- Create: `backend/engine/store.js` — `read(name)`, `write(name, data)`, `lid(prefix)`, `getSettings()`, `DEFAULT_SETTINGS` (move from local-server.js; `engine` collection defaults to `{state:{},log:[]}`, `settings` to `{}`, else `[]`)
- Create: `backend/engine/crawler.js` — `crawlWebsite(url)` (moved verbatim from local-server.js)
- Create: `backend/engine/engine.js`
- Modify: `backend/local-server.js` (require the modules, delete inlined copies, add `/api/engine/*` routes, boot-resume)

**Interfaces (engine.js produces):**
- `getState()` → `{ running, intervalMs, lastTickAt, lastTickSummary, log }` (log = last 200 entries, newest first)
- `start(ctx)` / `stop()` / `configure({ intervalMs })` — persist to `engine.json` state
- `tick(ctx)` → `{ at, campaigns: n, actions: [string] }`; ctx = `{ baseUrl }`
- `logActivity(level, phase, message, campaignId?)` — ring buffer, cap 200
- Tick order per active campaign: discovery → research → audit → outreach → followups, then global `scheduler.processDueSends(ctx)`. Phases required lazily so Tasks 2-5 can land incrementally (missing phase module = skipped).

**Routes:** `GET /api/engine/status`, `POST /api/engine/start|stop|tick`, `PATCH /api/engine/config`. On server boot: if persisted `state.running`, resume interval.

- [ ] Implement modules; wire routes
- [ ] Verify: restart server; `curl POST /api/engine/start` → status shows running; `POST /api/engine/tick` returns summary with 0 campaigns; restart server → still running
- [ ] Commit

### Task 2: Campaign model + AI campaign planner

**Files:**
- Create: `backend/engine/campaign-planner.js` — `planCampaign({ region, goal, segment, notes })` → full campaign config (GPT-4o `json_object`; heuristic fallback builds 3 region queries + default sequence/sending)
- Modify: `backend/local-server.js` campaigns routes

**Campaign defaults (`DEFAULT_CAMPAIGN` in campaign-planner.js, exported):** as per design doc — `status:'draft'`, `targetProspectCount:15`, `icpThreshold:60`, 4-step sequence (0/3/5/8 days), `sending:{ autoSend:false, dailySendLimit:10, sendWindow:{startHour:9,endHour:18}, testMode:false }`, `metrics` zeroed.

**Routes:** `POST /api/campaigns/plan` (returns proposal, does not save), `POST /api/campaigns` deep-merges defaults, `POST /api/campaigns/:id/activate|pause`, `GET /api/campaigns` enriched with live prospect counts per campaign.

- [ ] Implement; verify plan endpoint returns queries/sequence without key (fallback), campaign create + activate works via curl
- [ ] Commit

### Task 3: Discovery + research phases

**Files:**
- Create: `backend/engine/phases/discovery.js` — `run(campaign, ctx)` → actions[]
- Create: `backend/engine/phases/research.js` — `run(campaign, ctx)` → actions[]

**Discovery:** skip if engine-managed prospect count ≥ `targetProspectCount`. Rotate `campaign.discoveryCursor` over `searchQueries`. SERP when `SERP_API_KEY` set (reuse `runSerpSearch` — move it into discovery.js); else region-seeded mock generator (12 name templates × region slug, unique websites, `contactEmail: info@<slug>.com`, icpFit 50–95). Dedupe by website across ALL prospects. Add up to 5/tick with `{ status:'research_queue', campaignId, engineManaged:true, source:'engine_discovery', priority }` via same shape as manual POST /api/prospects.

**Research:** up to 2 prospects `status==='research_queue' && campaignId===campaign.id` per tick. Crawl (try/catch); merge `contactEmail` if found and empty; set `status:'research_complete'`, `researchNote` on failure.

- [ ] Implement both; verify with an activated campaign: 2 ticks produce prospects then research_complete statuses
- [ ] Commit

### Task 4: Auto-audit phase (shared audit runner)

**Files:**
- Create: `backend/engine/audit-runner.js` — `runAudit({ prospectId, depth, notes, baseUrl, createTask=true })` → audit object. Extracted verbatim from local-server's POST /api/audits/run body (crawl → GPT-4o or mock → scores → audit record with pdfToken/pdfUrl `${baseUrl}/api/audit/view/${token}` → prospect update → optional `send_initial_outreach` task).
- Create: `backend/engine/phases/audit.js` — `run(campaign, ctx)`: 1 prospect/tick `research_complete` → `runAudit({ createTask:false })` (engine handles outreach itself)
- Modify: `backend/local-server.js` — POST /api/audits/run becomes a thin wrapper calling `runAudit({ createTask:true })`

- [ ] Implement; verify manual audit endpoint still works identically AND tick audits an engine prospect
- [ ] Commit

### Task 5: Outreach + scheduler + outbox + follow-ups + signals

**Files:**
- Create: `backend/engine/email-generator.js` — `generateVariants({ prospect, audit, settings, type, angle, behaviorSignals })` (extracted from local-server email-generate route; follow-up types get behavior signals appended to the user prompt; template fallbacks per type incl. followup/breakup templates), `pickBestVariant(variants)` (highest mean of numeric strengthScore fields)
- Create: `backend/engine/phases/outreach.js` — up to 2 `audit_ready` engine prospects/tick: no `contactEmail` → one-time `contact_research` task + `needsContact` flag; else generate → best variant → email record `{ status:'scheduled', approvalStatus: autoSend?'auto':'pending', sequenceStep:1, scheduledAt: now, campaignId, variantName }`, prospect → `email_drafted`, `sequenceStep:1`
- Create: `backend/engine/scheduler.js` — `processDueSends(ctx)`: due = `status==='scheduled' && approvalStatus in ('auto','approved') && scheduledAt<=now`; enforce per-campaign daily limit (count today's non-test sent/logged_only) and sendWindow hours; send via SendGrid or mark `logged_only`; `testMode` reroutes to `settings.testEmailAddress`; on send: prospect → `sent`, `nextFollowupAt = now + sequence[next].delayDays`, event `email_sent`, campaign `metrics.sent++`, hot-lead recalc
- Create: `backend/engine/phases/followups.js` — engine prospects with `sequenceStep>=1 && nextFollowupAt<=now && !sequenceStoppedReason`: stop-check email statuses (replied/bounced/unsubscribed → set reason); no next step → `sequenceStoppedReason:'exhausted'`; else build behaviorSignals from events+emails, generate follow-up (same approval gating), `sequenceStep++`, clear `nextFollowupAt` (scheduler resets after send)
- Create: `backend/engine/signals.js` — `recordEvent({ type, emailId?, prospectId?, auditToken? })` handling delivered/opened/clicked/replied/bounced/unsubscribed/pdf_opened: email+prospect status transitions, event log, `recalcHotLeadScore(prospectId)` (weights from settings), behavior tasks (pdf_opened → 24h follow-up task + pull `nextFollowupAt` to +1d; ≥2 views → due-now hot task; replied → respond task + stop; bounced → contact_research + stop)
- Modify: `backend/local-server.js` — outbox routes (`GET /api/outbox`, `POST /api/outbox/:id/approve|cancel`, `POST /api/outbox/approve-all`), simulate route (`POST /api/simulate/email/:emailId/:event`), audit-view route calls `recordEvent({type:'pdf_opened', auditToken})`, email-generate + send routes use email-generator (send route also updates campaign metrics + nextFollowupAt when prospect is engine-managed)

- [ ] Implement all five modules + routes
- [ ] Verify E2E via curl: activate campaign → ticks → outbox shows pending → approve-all → tick → logged_only sends, prospects `sent` with `nextFollowupAt`; simulate `opened` + open audit-view URL → task created, hot score up; backdate `nextFollowupAt` → tick → follow-up scheduled; simulate `replied` → sequence stopped
- [ ] Commit

### Task 6: Engine UI (control room, campaign planner, outbox)

**Files:**
- Modify: `backend/frontend/index.html` — nav: new "ENGINE" section with `engine` (Control Room) and `outbox` (Outbox) items following existing `nav-item`/`data-screen`/`onclick="navigate(...)"` pattern
- Modify: `backend/frontend/app.js` — register `engine: renderEngine`, `outbox: renderOutbox` in `renderScreen`; new `renderEngine(main)` (status card with start/stop/Run-Tick-Now, interval input, activity feed, campaign cards with phase progress + activate/pause + "New Campaign / Plan with AI" modal calling `/api/campaigns/plan` then `/api/campaigns`), `renderOutbox(main)` (pending + scheduled emails, preview, approve/cancel/approve-all); reuse `api`/`get`/`post`/`patch`, `toast`, `statusBadge`, `scoreBar` helpers; extend `statusBadge` map with `email_scheduled` if used
- Modify: `backend/frontend/styles.css` only if a needed class is missing (prefer existing classes)

- [ ] Implement; verify in preview browser: engine toggles, tick renders activity, campaign create via AI plan, outbox approve flow
- [ ] Commit

### Task 7: End-to-end verification + docs

- [ ] Fresh campaign through full lifecycle in the preview UI; screenshot Control Room + Outbox
- [ ] Update `backend/README.md` with an "Orchestration Engine" section (endpoints, campaign config, safety defaults, .env keys)
- [ ] Create `backend/.env.example` (`OPENAI_API_KEY=`, `SENDGRID_*`, `SERP_*`, `DASHBOARD_ACCESS_TOKEN`, `TRACKING_BASE_URL`)
- [ ] Final commit

## Self-review notes

- Spec coverage: all five user features map to Tasks 2 (campaign planning), 3 (prospect generation), 4 (auto audits), 5 (sequenced sends + follow-ups), 6 (team-member manual control + approval). Manual audit trigger preserved in Task 4.
- Types consistent: `run(campaign, ctx) → string[]` for all phases; `ctx={baseUrl}` everywhere; email `approvalStatus` enum used identically in scheduler/outbox/UI.
- No test framework introduced — curl verification matches repo conventions (global constraint).
