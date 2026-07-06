/**
 * Koaland Prospect Intelligence OS — Local Server
 * Run: node local-server.js
 * Open: http://localhost:3000
 * API URL: http://localhost:3000  |  Token: value of DASHBOARD_ACCESS_TOKEN in .env (default: local-dev)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { STORAGE, read, write, lid, getSettings } = require('./engine/store');
const { crawlWebsite } = require('./engine/crawler');
const engine = require('./engine/engine');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.DASHBOARD_ACCESS_TOKEN || 'local-dev';
const BASE_URL = process.env.TRACKING_BASE_URL || `http://localhost:${PORT}`;
const ENGINE_CTX = { baseUrl: BASE_URL };

// ─── AUTH ────────────────────────────────────────────────────────
function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (t !== TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ─── HEALTH ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, mode: 'local', integrations: { openai: { ok: !!process.env.OPENAI_API_KEY }, sendgrid: { ok: !!process.env.SENDGRID_API_KEY } } });
});
app.post('/api/auth/check', (req, res) => { res.json({ ok: req.body.token === TOKEN }); });

// ─── SETTINGS ────────────────────────────────────────────────────
app.get('/api/settings', auth, (req, res) => res.json({ settings: getSettings() }));
app.patch('/api/settings', auth, (req, res) => {
  const s = { ...getSettings(), ...req.body };
  write('settings', s); res.json({ settings: s });
});

// ─── PROSPECTS ───────────────────────────────────────────────────
app.get('/api/prospects', auth, (req, res) => res.json({ prospects: read('prospects') }));

app.post('/api/prospects', auth, (req, res) => {
  const list = read('prospects');
  const icp = req.body.icpFitScore || 50;
  const item = {
    ...req.body, id: lid('pro'), status: req.body.status || 'research_queue',
    hotLeadScore: 0, icpFitScore: icp, auditScore: 0,
    priority: icp >= 80 ? 'A' : icp >= 60 ? 'B' : 'C',
    createdAt: new Date().toISOString(), lastActionAt: new Date().toISOString(),
  };
  list.push(item); write('prospects', list);
  res.status(201).json({ prospect: item });
});

app.get('/api/prospects/:id', auth, (req, res) => {
  const prospect = read('prospects').find(p => p.id === req.params.id);
  if (!prospect) return res.status(404).json({ error: 'Not found' });
  res.json({
    prospect,
    audits: read('audits').filter(a => a.prospectId === req.params.id),
    tasks: read('tasks').filter(t => t.prospectId === req.params.id && t.status === 'open'),
    emails: read('emails').filter(e => e.prospectId === req.params.id),
  });
});

app.patch('/api/prospects/:id', auth, (req, res) => {
  const list = read('prospects');
  const idx = list.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  list[idx] = { ...list[idx], ...req.body, lastActionAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  write('prospects', list); res.json({ prospect: list[idx] });
});

app.delete('/api/prospects/:id', auth, (req, res) => {
  write('prospects', read('prospects').filter(p => p.id !== req.params.id));
  res.json({ ok: true });
});

// ─── DISCOVERY ───────────────────────────────────────────────────
app.post('/api/discovery/search', auth, async (req, res) => {
  const { query, location, maxResults = 10 } = req.body;
  const existingUrls = new Set(read('prospects').map(p => p.website));
  if (process.env.SERP_API_KEY) {
    try {
      const results = await runSerpSearch(query, location, maxResults, process.env.SERP_API_KEY, process.env.SERP_PROVIDER || 'serpapi', existingUrls);
      return res.json({ results });
    } catch (err) { console.warn('[SERP] Error:', err.message); }
  }
  const locs = location ? Array(8).fill(location) : ['Santorini, Greece','Bodrum, Turkey','Amalfi Coast, Italy','Mykonos, Greece','Capri, Italy','Dubrovnik, Croatia','Kotor, Montenegro','Oia, Greece'];
  const hotels = [
    { n:'Villa Konak Boutique Hotel', s:'villakonakhotel', r:14 }, { n:'The Olive & Stone Hotel', s:'olivestonehotel', r:18 },
    { n:'Maison de la Mer', s:'maisondelamer', r:12 }, { n:'Elia Boutique Hotel', s:'eliaboutiquehotel', r:22 },
    { n:'Casa Primavera', s:'casaprimavera', r:10 }, { n:'Terrazzo Mare Hotel', s:'terrazzomarehotel', r:16 },
    { n:'The Grand Terrace', s:'thegrandterrace', r:28 }, { n:'Blue Lagoon Estate', s:'bluelagoonestate', r:8 },
  ];
  res.json({ results: hotels.slice(0, Math.min(maxResults, 8)).map((h, i) => {
    const w = `https://www.${h.s}.com`;
    return { hotelName:h.n, website:w, location:locs[i], snippet:`${h.n} — ${h.r} rooms, independent luxury in ${locs[i]}.`, initialIcpFit:Math.round(55+Math.random()*40), alreadyInDatabase:existingUrls.has(w) };
  })});
});

async function runSerpSearch(query, location, max, key, provider, existingUrls) {
  const OTA = ['booking.com','expedia.com','tripadvisor.com','airbnb.com','hotels.com','agoda.com'];
  const q = location ? `${query} ${location}` : query;
  let organic = [];
  if (provider === 'serper') {
    const r = await fetch('https://google.serper.dev/search', { method:'POST', headers:{'X-API-KEY':key,'Content-Type':'application/json'}, body:JSON.stringify({q,num:max*2}) });
    organic = (await r.json()).organic || [];
  } else {
    const url = provider === 'valueserp'
      ? `https://api.valueserp.com/search?q=${encodeURIComponent(q)}&api_key=${key}&num=${max*2}`
      : `https://serpapi.com/search?q=${encodeURIComponent(q)}&api_key=${key}&num=${max*2}&engine=google`;
    const d = await (await fetch(url)).json();
    organic = d.organic_results || d.results || [];
  }
  return organic.filter(r => !OTA.some(o => (r.link||'').includes(o))).slice(0, max).map(r => ({
    hotelName: (r.title||'').replace(/\s*[-|·].*/,''), website:r.link, location:location||'',
    snippet:r.snippet||'', initialIcpFit:Math.round(50+Math.random()*40), alreadyInDatabase:existingUrls.has(r.link),
  }));
}

// ─── RESEARCH ────────────────────────────────────────────────────
app.post('/api/research/prospect', auth, async (req, res) => {
  const { prospectId } = req.body;
  const list = read('prospects');
  const prospect = list.find(p => p.id === prospectId);
  if (!prospect) return res.status(404).json({ error: 'Not found' });
  let crawl = { title: prospect.hotelName, emailsFound: [] };
  if (prospect.website) { try { crawl = await crawlWebsite(prospect.website); } catch (err) { console.warn('[Research] Crawl failed:', err.message); } }
  const idx = list.findIndex(p => p.id === prospectId);
  list[idx] = { ...list[idx], status:'research_complete', lastActionAt:new Date().toISOString() };
  if (crawl.emailsFound?.length && !list[idx].contactEmail) list[idx].contactEmail = crawl.emailsFound[0];
  write('prospects', list);
  res.json({ ok:true, crawl });
});

// ─── AUDIT ───────────────────────────────────────────────────────
const { runAudit } = require('./engine/audit-runner');

app.post('/api/audits/run', auth, async (req, res) => {
  const { prospectId, depth = 'full', notes = '' } = req.body;
  try {
    const audit = await runAudit({ prospectId, depth, notes, baseUrl: BASE_URL, createTask: true });
    res.json(audit);
  } catch (err) {
    const code = err.message === 'Prospect not found' ? 404 : 500;
    res.status(code).json({ error: err.message });
  }
});

app.get('/api/audits/:id', auth, (req, res) => {
  const a = read('audits').find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error:'Not found' });
  res.json(a);
});

app.get('/api/audit/view/:token', (req, res) => {
  const audit = read('audits').find(a => a.pdfToken === req.params.token);
  if (!audit) return res.status(404).send('<h1>Audit not found</h1>');
  recordEvent({ type: 'pdf_opened', auditToken: req.params.token });
  const p = read('prospects').find(x => x.id === audit.prospectId) || { hotelName:'Hotel' };
  const rows = Object.entries(audit.scores||{}).map(([k,v])=>`<tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);text-transform:capitalize;color:#8B9BB4">${k.replace(/([A-Z])/g,' $1')}</td><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:700;color:${v>=70?'#34D399':v>=50?'#FBBF24':'#F87171'}">${v}/100</td></tr>`).join('');
  res.send(`<!DOCTYPE html><html><head><title>${p.hotelName} — Koaland Audit</title><meta charset="UTF-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif;background:#070D1A;color:#E8EDF5}header{background:#0F1829;padding:32px 48px;border-bottom:1px solid rgba(255,255,255,0.06)}.brand{font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#4F8EF7;margin-bottom:10px}h1{font-size:26px;font-weight:600}main{max-width:760px;margin:48px auto;padding:0 24px}h2{font-size:15px;font-weight:600;color:#8B9BB4;letter-spacing:1px;text-transform:uppercase;margin:32px 0 14px}p{color:#8B9BB4;line-height:1.75;font-size:14px}table{width:100%;border-collapse:collapse;background:#0F1829;border-radius:12px;overflow:hidden;margin-bottom:24px}.angle{background:#162035;border:1px solid rgba(79,142,247,0.2);padding:16px 20px;border-radius:10px;color:#7CB3FF;font-size:14px}</style></head><body><header><div class="brand">Koaland.ai · Digital Experience Audit</div><h1>${p.hotelName}</h1></header><main><h2>Executive Summary</h2><p>${audit.executiveSummary}</p><h2>Scorecard</h2><table><tbody>${rows}</tbody></table><h2>Recommended Angle</h2><div class="angle">${audit.recommendedAngle}</div><h2>Outreach Hook</h2><p>${audit.oneSentenceHook}</p></main></body></html>`);
});

// ─── EMAIL GENERATION ────────────────────────────────────────────
const { generateVariants } = require('./engine/email-generator');
const { recordEvent } = require('./engine/signals');

app.post('/api/emails/generate', auth, async (req, res) => {
  const { prospectId, type = 'initial', angle = '' } = req.body;
  const prospect = read('prospects').find(p => p.id === prospectId);
  if (!prospect) return res.status(404).json({ error: 'Not found' });
  const latestAudit = read('audits').filter(a => a.prospectId === prospectId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const variants = await generateVariants({ prospect, audit: latestAudit, settings: getSettings(), type, angle });
  res.json({ variants });
});

// ─── EMAIL SEND ──────────────────────────────────────────────────
app.post('/api/emails/send', auth, async (req, res) => {
  const { prospectId, to, subject, body, type='initial', isTest=false } = req.body;
  const emailId = lid('em');
  if (process.env.SENDGRID_API_KEY) {
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({ to:isTest?(process.env.TEST_EMAIL||to):to, from:{ email:process.env.SENDGRID_FROM_EMAIL||'murat@koaland.ai', name:process.env.SENDGRID_FROM_NAME||'Murat' }, subject, text:body, html:body.replace(/\n/g,'<br>') });
      console.log(`[Email] Sent to ${to}`);
    } catch (err) { console.error('[Email] SendGrid error:', err.message); return res.status(500).json({ error:err.message }); }
  } else { console.log(`[Email] No SendGrid. Logged: To:${to} Subject:${subject}`); }

  if (!isTest) {
    const prospect = prospectId ? read('prospects').find(p => p.id === prospectId) : null;
    const campaign = prospect?.campaignId ? read('campaigns').find(c => c.id === prospect.campaignId) : null;
    const step = req.body.sequenceStep || (prospect?.sequenceStep || 0) + 1 || 1;
    const emails = read('emails');
    emails.push({ id:emailId, prospectId: prospectId || null, campaignId: prospect?.campaignId || null, sequenceStep: step, to, subject, body, type, status:process.env.SENDGRID_API_KEY?'sent':'logged_only', approvalStatus:'manual', sentAt:new Date().toISOString(), createdAt:new Date().toISOString() });
    write('emails', emails);
    if (prospectId && prospect) {
      const list = read('prospects'); const pIdx = list.findIndex(p=>p.id===prospectId);
      if (pIdx!==-1) {
        const nextStep = (campaign?.sequence || []).find(s => s.step === step + 1);
        list[pIdx] = { ...list[pIdx], status:'sent', sequenceStep: step, nextFollowupAt: nextStep ? new Date(Date.now() + nextStep.delayDays * 86400000).toISOString() : list[pIdx].nextFollowupAt || null, lastActionAt:new Date().toISOString() };
        write('prospects', list);
      }
      const events = read('events'); events.push({ id:lid('evt'), type:'email_sent', prospectId, emailId, createdAt:new Date().toISOString() }); write('events',events);
      const { recalcHotLeadScore } = require('./engine/signals');
      recalcHotLeadScore(prospectId);
      if (campaign) {
        const campaigns = read('campaigns');
        const cIdx = campaigns.findIndex(c => c.id === campaign.id);
        if (cIdx !== -1) { campaigns[cIdx].metrics = { ...campaigns[cIdx].metrics, sent: (campaigns[cIdx].metrics?.sent || 0) + 1 }; write('campaigns', campaigns); }
      }
    }
  }
  res.json({ ok:true, emailId, sent:!!process.env.SENDGRID_API_KEY });
});

// ─── OUTBOX (engine-scheduled emails awaiting approval/send) ─────
app.get('/api/outbox', auth, (req, res) => {
  const prospects = read('prospects');
  const campaigns = read('campaigns');
  const items = read('emails')
    .filter(e => e.status === 'scheduled')
    .map(e => ({
      ...e,
      prospectName: prospects.find(p => p.id === e.prospectId)?.hotelName || '—',
      campaignName: campaigns.find(c => c.id === e.campaignId)?.name || '—',
    }))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  res.json({
    pending: items.filter(e => e.approvalStatus === 'pending'),
    queued: items.filter(e => ['auto', 'approved'].includes(e.approvalStatus)),
  });
});

app.post('/api/outbox/approve-all', auth, (req, res) => {
  const emails = read('emails');
  let count = 0;
  for (const e of emails) {
    if (e.status === 'scheduled' && e.approvalStatus === 'pending') { e.approvalStatus = 'approved'; e.approvedAt = new Date().toISOString(); count++; }
  }
  write('emails', emails);
  engine.logActivity('info', 'outbox', `${count} email(s) approved for sending`);
  res.json({ ok: true, approved: count });
});

app.post('/api/outbox/:id/approve', auth, (req, res) => {
  const emails = read('emails');
  const idx = emails.findIndex(e => e.id === req.params.id && e.status === 'scheduled');
  if (idx === -1) return res.status(404).json({ error: 'Scheduled email not found' });
  emails[idx] = { ...emails[idx], approvalStatus: 'approved', approvedAt: new Date().toISOString() };
  write('emails', emails);
  res.json({ email: emails[idx] });
});

app.post('/api/outbox/:id/cancel', auth, (req, res) => {
  const emails = read('emails');
  const idx = emails.findIndex(e => e.id === req.params.id && e.status === 'scheduled');
  if (idx === -1) return res.status(404).json({ error: 'Scheduled email not found' });
  emails[idx] = { ...emails[idx], status: 'cancelled', approvalStatus: 'cancelled' };
  write('emails', emails);
  res.json({ email: emails[idx] });
});

// ─── BEHAVIOR SIMULATION (local stand-in for the SendGrid webhook) ─
app.post('/api/simulate/email/:emailId/:event', auth, (req, res) => {
  const allowed = ['delivered', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed'];
  if (!allowed.includes(req.params.event)) return res.status(400).json({ error: `event must be one of ${allowed.join(', ')}` });
  const result = recordEvent({ type: req.params.event, emailId: req.params.emailId });
  if (!result.ok) return res.status(404).json({ error: result.message });
  engine.logActivity('info', 'signal', `Simulated ${req.params.event}: ${result.message}`);
  res.json(result);
});

// ─── TASKS ───────────────────────────────────────────────────────
app.get('/api/tasks', auth, (req, res) => { let t=read('tasks'); if(req.query.status) t=t.filter(x=>x.status===req.query.status); res.json({ tasks:t }); });
app.post('/api/tasks', auth, (req, res) => { const tasks=[...read('tasks'),{...req.body,id:lid('tsk'),createdAt:new Date().toISOString()}]; write('tasks',tasks); res.json({ task:tasks[tasks.length-1] }); });
app.post('/api/tasks/recalculate', auth, (req, res) => res.json({ ok:true, tasksCreated:0 }));
app.patch('/api/tasks/:id', auth, (req, res) => {
  const tasks=read('tasks'); const idx=tasks.findIndex(t=>t.id===req.params.id);
  if(idx===-1) return res.status(404).json({error:'Not found'});
  tasks[idx]={...tasks[idx],...req.body,updatedAt:new Date().toISOString()}; write('tasks',tasks); res.json({ task:tasks[idx] });
});

// ─── CAMPAIGNS ───────────────────────────────────────────────────
const { withCampaignDefaults, planCampaign } = require('./engine/campaign-planner');

app.get('/api/campaigns', auth, (req, res) => {
  const prospects = read('prospects');
  const campaigns = read('campaigns').map(c => ({
    ...c,
    liveCounts: {
      prospects: prospects.filter(p => p.campaignId === c.id).length,
      auditReady: prospects.filter(p => p.campaignId === c.id && ['audit_ready', 'email_drafted', 'sent', 'delivered', 'opened', 'pdf_viewed', 'replied'].includes(p.status)).length,
      contacted: prospects.filter(p => p.campaignId === c.id && ['sent', 'delivered', 'opened', 'pdf_viewed', 'replied'].includes(p.status)).length,
      replied: prospects.filter(p => p.campaignId === c.id && p.status === 'replied').length,
    },
  }));
  res.json({ campaigns });
});

app.post('/api/campaigns/plan', auth, async (req, res) => {
  try { res.json({ plan: await planCampaign(req.body || {}) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/campaigns', auth, (req, res) => {
  const campaign = { ...withCampaignDefaults(req.body), id: lid('cmp'), createdAt: new Date().toISOString() };
  if (!campaign.name) campaign.name = `${campaign.region || 'New'} campaign`;
  const campaigns = [...read('campaigns'), campaign];
  write('campaigns', campaigns); res.status(201).json({ campaign });
});

app.post('/api/campaigns/:id/activate', auth, (req, res) => {
  const list = read('campaigns');
  const idx = list.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  list[idx] = { ...list[idx], status: 'active', activatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  write('campaigns', list);
  engine.logActivity('info', 'campaign', `Campaign activated: ${list[idx].name}`, list[idx].id);
  res.json({ campaign: list[idx] });
});

app.post('/api/campaigns/:id/pause', auth, (req, res) => {
  const list = read('campaigns');
  const idx = list.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  list[idx] = { ...list[idx], status: 'paused', updatedAt: new Date().toISOString() };
  write('campaigns', list);
  engine.logActivity('info', 'campaign', `Campaign paused: ${list[idx].name}`, list[idx].id);
  res.json({ campaign: list[idx] });
});

app.patch('/api/campaigns/:id', auth, (req, res) => {
  const list = read('campaigns');
  const idx = list.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  list[idx] = { ...list[idx], ...req.body, updatedAt: new Date().toISOString() };
  write('campaigns', list); res.json({ campaign: list[idx] });
});

// ─── CONTACTS ────────────────────────────────────────────────────
app.get('/api/contacts', auth, (req, res) => {
  let contacts = read('contacts');
  if (req.query.campaignId) contacts = contacts.filter(c => c.campaignId === req.query.campaignId);
  res.json({ contacts });
});
app.post('/api/contacts', auth, (req, res) => {
  const list = [...read('contacts'), { ...req.body, id: lid('con'), status: req.body.status || 'not_sent', createdAt: new Date().toISOString() }];
  write('contacts', list); res.status(201).json({ contact: list[list.length - 1] });
});
app.patch('/api/contacts/:id', auth, (req, res) => {
  const list = read('contacts');
  const idx = list.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  list[idx] = { ...list[idx], ...req.body, updatedAt: new Date().toISOString() };
  write('contacts', list); res.json({ contact: list[idx] });
});
app.delete('/api/contacts/:id', auth, (req, res) => {
  write('contacts', read('contacts').filter(c => c.id !== req.params.id));
  res.json({ ok: true });
});

// ─── DASHBOARD ───────────────────────────────────────────────────
app.get('/api/dashboard', auth, (req, res) => {
  const prospects=read('prospects'),emails=read('emails'),tasks=read('tasks'),events=read('events'),audits=read('audits');
  const openTasks=tasks.filter(t=>t.status==='open');
  const statusOrder=['research_queue','researching','research_complete','audit_in_progress','audit_ready','email_drafted','sent','delivered','opened','pdf_viewed','replied'];
  const pipelineCounts={}; statusOrder.forEach(s=>{pipelineCounts[s]=prospects.filter(p=>p.status===s).length;});
  const themes={}; audits.forEach(a=>(a.opportunities||[]).forEach(o=>{themes[o.type]=(themes[o.type]||0)+1;}));
  res.json({
    summary:{ totalProspects:prospects.length, aTierProspects:prospects.filter(p=>p.priority==='A').length, auditsGenerated:audits.length, emailsSent:emails.filter(e=>e.status!=='draft').length, emailsDelivered:emails.filter(e=>['delivered','opened','clicked'].includes(e.status)).length, emailsOpened:emails.filter(e=>['opened','clicked'].includes(e.status)).length, pdfViews:events.filter(e=>e.type==='pdf_opened').length, replies:emails.filter(e=>e.status==='replied').length, hotLeads:prospects.filter(p=>(p.hotLeadScore||0)>=85).length, followUpsDue:openTasks.filter(t=>new Date(t.dueAt)<=new Date()).length },
    pipelineCounts,
    warmSignals:[...prospects].filter(p=>(p.hotLeadScore||0)>0).sort((a,b)=>(b.hotLeadScore||0)-(a.hotLeadScore||0)).slice(0,10),
    priorityTasks:[...openTasks].sort((a,b)=>new Date(a.dueAt)-new Date(b.dueAt)).slice(0,10),
    recentActivity:[...events].reverse().slice(0,20),
    opportunityThemes:Object.entries(themes).map(([theme,count])=>({theme,count})).sort((a,b)=>b.count-a.count),
  });
});

// ─── ANALYTICS ───────────────────────────────────────────────────
app.get('/api/analytics', auth, (req, res) => {
  const emails=read('emails'); const total=emails.length;
  const delivered=emails.filter(e=>['delivered','opened','clicked','replied'].includes(e.status)).length;
  const opened=emails.filter(e=>['opened','clicked','replied'].includes(e.status)).length;
  const replied=emails.filter(e=>e.status==='replied').length;
  const bounced=emails.filter(e=>e.status==='bounced').length;
  const rate=(n,d)=>d?Math.round((n/d)*100):0;
  res.json({ funnel:{total,delivered,opened,pdfOpened:0,replied,bounced}, rates:{deliveryRate:rate(delivered,total),openRate:rate(opened,total),pdfViewRate:0,replyRate:rate(replied,total),bounceRate:rate(bounced,total)}, anglePerformance:[], subjectPerformance:[], locationPerformance:[], topThemes:[], insights:['Send emails and run audits to see analytics.'] });
});

// ─── STATIC FRONTEND ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'frontend')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));

// ─── ENGINE ──────────────────────────────────────────────────────
app.get('/api/engine/status', auth, (req, res) => {
  const state = engine.getState();
  const todayStr = new Date().toISOString().slice(0, 10);
  const sentToday = read('emails').filter(e => !e.isTest && e.sentAt && e.sentAt.slice(0, 10) === todayStr && ['sent', 'logged_only', 'delivered', 'opened', 'clicked', 'replied'].includes(e.status)).length;
  res.json({ ...state, sentToday });
});
app.post('/api/engine/start', auth, (req, res) => res.json({ state: engine.start(ENGINE_CTX) }));
app.post('/api/engine/stop', auth, (req, res) => res.json({ state: engine.stop() }));
app.post('/api/engine/tick', auth, async (req, res) => {
  try { res.json({ summary: await engine.tick(ENGINE_CTX) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.patch('/api/engine/config', auth, (req, res) => res.json({ state: engine.configure(req.body, ENGINE_CTX) }));

// ─── START ───────────────────────────────────────────────────────
engine.resumeIfRunning(ENGINE_CTX);

app.listen(PORT, () => {
  console.log('\n' + '═'.repeat(56));
  console.log('  Koaland Prospect Intelligence OS — Local Server');
  console.log('═'.repeat(56));
  console.log(`  URL:      http://localhost:${PORT}`);
  console.log(`  Token:    ${TOKEN}`);
  console.log(`  Storage:  ${STORAGE}`);
  console.log(`  OpenAI:   ${process.env.OPENAI_API_KEY ? '✓ real AI audits & emails' : '✗ not set — add OPENAI_API_KEY to .env'}`);
  console.log(`  SendGrid: ${process.env.SENDGRID_API_KEY ? '✓ real email sending' : '✗ not set — emails logged only'}`);
  console.log('═'.repeat(56));
  console.log(`\n  Open: http://localhost:${PORT}`);
  console.log(`  Or open frontend/index.html and enter:`);
  console.log(`    API URL: http://localhost:${PORT}`);
  console.log(`    Token:   ${TOKEN}\n`);
});
