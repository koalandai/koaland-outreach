/**
 * Koaland Prospect Intelligence OS — Local Server
 * Run: node local-server.js
 * Open: http://localhost:3000
 * API URL: http://localhost:3000  |  Token: value of DASHBOARD_ACCESS_TOKEN in .env (default: local-dev)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

let cheerio; try { cheerio = require('cheerio'); } catch { cheerio = null; }
let nanoid; try { ({ nanoid } = require('nanoid')); } catch { nanoid = () => Math.random().toString(36).slice(2, 14); }

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.DASHBOARD_ACCESS_TOKEN || 'local-dev';
const STORAGE = path.join(__dirname, 'storage');

// ─── FILE STORAGE ────────────────────────────────────────────────
function read(name) {
  const file = path.join(STORAGE, `${name}.json`);
  if (!fs.existsSync(file)) return name === 'settings' ? {} : [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8') || (name === 'settings' ? '{}' : '[]')); }
  catch { return name === 'settings' ? {} : []; }
}
function write(name, data) {
  if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE, { recursive: true });
  fs.writeFileSync(path.join(STORAGE, `${name}.json`), JSON.stringify(data, null, 2));
}
function lid(prefix) { return `${prefix}_${nanoid(12)}`; }

const DEFAULT_SETTINGS = {
  senderName: 'Murat', company: 'Koaland.ai',
  koalandDescription: 'Commercial intelligence for brand-sensitive hotels',
  demoKitLink: '', calendarLink: '', testEmailAddress: '',
  dailySendLimit: 10, followupDelay1Days: 3, followupDelay2Days: 5,
};
function getSettings() { return { ...DEFAULT_SETTINGS, ...read('settings') }; }

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
app.post('/api/audits/run', auth, async (req, res) => {
  const { prospectId, depth='full', notes='' } = req.body;
  const prospects = read('prospects');
  const prospect = prospects.find(p => p.id === prospectId);
  if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

  let crawl = { url:prospect.website||'', title:prospect.hotelName, metaDescription:'', headings:[], bodyText:'', ctaTexts:[], bookingLinks:[], schemaTypes:[], robotsHints:'N/A', emailsFound:[], crawledAt:new Date().toISOString() };
  if (prospect.website) {
    try {
      console.log(`[Audit] Crawling ${prospect.website}...`);
      crawl = await crawlWebsite(prospect.website);
      console.log(`[Audit] Done: "${crawl.title}" (${crawl.bodyText.length} chars)`);
    } catch (err) { console.warn('[Audit] Crawl failed:', err.message); }
  }
  if (crawl.emailsFound?.length) {
    const pIdx = prospects.findIndex(p => p.id === prospectId);
    if (pIdx !== -1 && !prospects[pIdx].contactEmail) { prospects[pIdx].contactEmail = crawl.emailsFound[0]; write('prospects', prospects); }
  }

  let ai = null;
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('[Audit] Calling GPT-4o...');
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const resp = await openai.chat.completions.create({
        model:'gpt-4o', temperature:0.3, response_format:{ type:'json_object' },
        messages:[
          { role:'system', content:'You are Koaland.ai\'s digital experience auditor for brand-sensitive luxury and boutique hotels. Identify where the hotel\'s digital presence leaks commercial value, direct bookings, AI-search visibility, or brand clarity. Use ONLY the provided data. Be specific and evidence-based. Score conservatively — 90+ means genuinely excellent. Most hotels score 35-72. Think like a luxury hotel commercial director who understands digital, SEO, and AI systems.' },
          { role:'user', content:`Audit this hotel website.\n\nURL: ${crawl.url||prospect.website}\nHotel: ${prospect.hotelName}\nLocation: ${prospect.location||'Unknown'}\nTitle: ${crawl.title}\nMeta: ${crawl.metaDescription}\n\nHeadings:\n${crawl.headings.slice(0,30).join('\n')}\n\nBody Text:\n${crawl.bodyText.slice(0,4000)}\n\nCTAs: ${crawl.ctaTexts.slice(0,15).join(' | ')}\nBooking Links: ${crawl.bookingLinks.join(' | ')||'None found'}\nSchema Types: ${crawl.schemaTypes.join(', ')||'None found'}\nNotes: ${notes||'None'}\n\nReturn ONLY valid JSON:\n{\n  "scores": {"websiteExperience":0-100,"seoReadiness":0-100,"aeoReadiness":0-100,"geoReadiness":0-100,"directBookingClarity":0-100,"luxuryBrandConsistency":0-100,"commercialUpside":0-100,"confidence":0-100},\n  "executiveSummary": "2-3 sentence commercial position summary",\n  "topFindings": [{"title":"string","severity":"high|medium|low","evidence":"string","commercialMeaning":"string","outreachHook":"string"}],\n  "commercialLeakageRisks": [{"title":"string","severity":"high|medium|low","commercialMeaning":"string"}],\n  "opportunities": [{"type":"Quick Win|Strategic Fix|Commercial Risk|Future Advantage","title":"string","impact":"High|Medium|Low","effort":"High|Medium|Low","urgency":"string","whyItMatters":"string"}],\n  "recommendedAngle": "single strongest outreach angle",\n  "oneSentenceHook": "one sentence outreach hook"\n}` }
        ],
      });
      ai = JSON.parse(resp.choices[0].message.content);
      console.log('[Audit] GPT-4o done. Top finding:', ai.topFindings?.[0]?.title);
    } catch (err) { console.error('[Audit] OpenAI error:', err.message); }
  }

  if (!ai) {
    const r = (a,b) => Math.round(a + Math.random()*(b-a));
    ai = { scores:{ websiteExperience:r(38,70), seoReadiness:r(28,60), aeoReadiness:r(18,48), geoReadiness:r(15,45), directBookingClarity:r(30,65), luxuryBrandConsistency:r(42,78), commercialUpside:r(58,90), confidence:r(60,85) }, executiveSummary:`${prospect.hotelName} audit complete. Add OPENAI_API_KEY to .env for real AI analysis.`, recommendedAngle:'Direct Booking Clarity', topFindings:[{ title:'Add OPENAI_API_KEY for real AI audit', severity:'medium', evidence:'No OpenAI key in .env', commercialMeaning:'Real audits need OpenAI API key.', outreachHook:'Add OPENAI_API_KEY to .env' }], commercialLeakageRisks:[], opportunities:[{ type:'Quick Win', title:'Configure OpenAI', impact:'High', effort:'Low', urgency:'Now', whyItMatters:'Unlocks real AI audit analysis.' }], oneSentenceHook:'Add OPENAI_API_KEY to .env to unlock real AI audits.' };
  }

  const overall = Math.round(Object.values(ai.scores).reduce((a,b)=>a+b,0)/Object.values(ai.scores).length);
  const auditId = lid('aud'), pdfToken = lid('tok');
  const audit = { id:auditId, prospectId, status:'complete', depth, ...ai, pdfUrl:`http://localhost:${PORT}/api/audit/view/${pdfToken}`, pdfToken, crawledAt:crawl.crawledAt, createdAt:new Date().toISOString() };
  const audits = read('audits'); audits.push(audit); write('audits', audits);

  const pIdx = prospects.findIndex(p => p.id === prospectId);
  if (pIdx !== -1) { prospects[pIdx]={ ...prospects[pIdx], status:'audit_ready', auditScore:overall, commercialUpsideScore:ai.scores.commercialUpside, recommendedAngle:ai.recommendedAngle, lastActionAt:new Date().toISOString() }; write('prospects', prospects); }

  const tasks = read('tasks');
  tasks.push({ id:lid('tsk'), prospectId, type:'send_initial_outreach', title:`Generate email for ${prospect.hotelName}`, reason:`Audit done. Upside: ${ai.scores.commercialUpside}. Angle: ${ai.recommendedAngle}.`, status:'open', dueAt:new Date(Date.now()+86400000).toISOString(), createdAt:new Date().toISOString() });
  write('tasks', tasks);
  res.json(audit);
});

app.get('/api/audits/:id', auth, (req, res) => {
  const a = read('audits').find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error:'Not found' });
  res.json(a);
});

app.get('/api/audit/view/:token', (req, res) => {
  const audit = read('audits').find(a => a.pdfToken === req.params.token);
  if (!audit) return res.status(404).send('<h1>Audit not found</h1>');
  const p = read('prospects').find(x => x.id === audit.prospectId) || { hotelName:'Hotel' };
  const rows = Object.entries(audit.scores||{}).map(([k,v])=>`<tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);text-transform:capitalize;color:#8B9BB4">${k.replace(/([A-Z])/g,' $1')}</td><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:700;color:${v>=70?'#34D399':v>=50?'#FBBF24':'#F87171'}">${v}/100</td></tr>`).join('');
  res.send(`<!DOCTYPE html><html><head><title>${p.hotelName} — Koaland Audit</title><meta charset="UTF-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif;background:#070D1A;color:#E8EDF5}header{background:#0F1829;padding:32px 48px;border-bottom:1px solid rgba(255,255,255,0.06)}.brand{font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#4F8EF7;margin-bottom:10px}h1{font-size:26px;font-weight:600}main{max-width:760px;margin:48px auto;padding:0 24px}h2{font-size:15px;font-weight:600;color:#8B9BB4;letter-spacing:1px;text-transform:uppercase;margin:32px 0 14px}p{color:#8B9BB4;line-height:1.75;font-size:14px}table{width:100%;border-collapse:collapse;background:#0F1829;border-radius:12px;overflow:hidden;margin-bottom:24px}.angle{background:#162035;border:1px solid rgba(79,142,247,0.2);padding:16px 20px;border-radius:10px;color:#7CB3FF;font-size:14px}</style></head><body><header><div class="brand">Koaland.ai · Digital Experience Audit</div><h1>${p.hotelName}</h1></header><main><h2>Executive Summary</h2><p>${audit.executiveSummary}</p><h2>Scorecard</h2><table><tbody>${rows}</tbody></table><h2>Recommended Angle</h2><div class="angle">${audit.recommendedAngle}</div><h2>Outreach Hook</h2><p>${audit.oneSentenceHook}</p></main></body></html>`);
});

// ─── EMAIL GENERATION ────────────────────────────────────────────
app.post('/api/emails/generate', auth, async (req, res) => {
  const { prospectId, type='initial', angle='' } = req.body;
  const prospect = read('prospects').find(p => p.id === prospectId);
  if (!prospect) return res.status(404).json({ error:'Not found' });
  const latestAudit = read('audits').filter(a => a.prospectId === prospectId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];
  const cfg = getSettings();

  if (process.env.OPENAI_API_KEY && latestAudit) {
    try {
      console.log('[Email] Calling GPT-4o...');
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const topFinding = latestAudit.topFindings?.[0];
      const resp = await openai.chat.completions.create({
        model:'gpt-4o', temperature:0.5, response_format:{ type:'json_object' },
        messages:[
          { role:'system', content:'You write short, premium, founder-led outbound emails for Murat at Koaland.ai. Rules: Never generic. Under 200 words. Always end exactly:\nBest,\nMurat\nKoaland.ai\nNever: "Hope you are well", "I came across", "Just checking in". Specific, calm, commercially useful.' },
          { role:'user', content:`Generate 3 email variants for ${prospect.hotelName}.\nLocation: ${prospect.location||'Unknown'}\nSegment: ${prospect.segment||'boutique/luxury'}\nType: ${type}, Angle: ${angle||latestAudit.recommendedAngle}\nAudit Summary: ${latestAudit.executiveSummary}\nTop Finding: ${topFinding?.title} — ${topFinding?.outreachHook}\nHook: ${latestAudit.oneSentenceHook}\nScores (no numbers in email): ${Object.entries(latestAudit.scores||{}).map(([k,v])=>`${k}:${v}`).join(', ')}\n${cfg.demoKitLink?`Demo Kit: ${cfg.demoKitLink}`:'No demo kit — omit CTA.'}\n${cfg.calendarLink?`Calendar: ${cfg.calendarLink}`:''}\n\nReturn ONLY valid JSON:\n{"variants":[{"name":"string","angle":"string","subjectOptions":["s1","s2","s3"],"body":"full body with signature","whyThisWorks":"1 sentence","strengthScore":{"personalization":0-100,"clarity":0-100,"commercialHook":0-100,"lengthScore":0-100,"spamRisk":"low|medium|high","ctaStrength":"string"}}]}` }
        ],
      });
      const result = JSON.parse(resp.choices[0].message.content);
      console.log('[Email] Generated', result.variants?.length, 'variants');
      return res.json({ variants: result.variants || [] });
    } catch (err) { console.error('[Email] OpenAI error:', err.message); }
  }

  const n = prospect.hotelName, loc = prospect.location ? ` in ${prospect.location}` : '';
  res.json({ variants:[
    { name:'Direct Booking Hook', angle:'Direct Booking Clarity', subjectOptions:[`Quick note on ${n}'s booking flow`,`${n} — direct booking observation`,`Something I noticed on ${n}'s website`], body:`Hi,\n\nI was looking at ${n}'s website${loc} this week — specifically at how guests move from discovery to a direct booking.\n\nThe property is clearly premium. But the path to a direct reservation has friction points pushing guests toward OTA instead.\n\nI've mapped the specific changes that would have the biggest impact on direct booking conversion.\n\nWould it be useful to share?\n\nBest,\nMurat\nKoaland.ai`, whyThisWorks:'Specific observation, not a pitch. Signals commercial intelligence.', strengthScore:{ personalization:80, clarity:90, commercialHook:84, lengthScore:90, spamRisk:'low', ctaStrength:'soft-ask' } },
    { name:'AI Search Angle', angle:'AI Search Readiness', subjectOptions:[`What ChatGPT says about ${n}`,`${n} — AI search visibility`,`AI travel and ${n}`], body:`Hi,\n\nI ran ${n} through the AI search assistants luxury travelers now use — ChatGPT, Perplexity, Google AI.\n\nThe property barely surfaces, and when it does, the description doesn't match your actual positioning.\n\nThis is fixable — and worth closing before competitors${loc} get there first.\n\nHappy to share what AI systems see (and don't see).\n\nBest,\nMurat\nKoaland.ai`, whyThisWorks:'Novel angle — very few hotels have heard this framing.', strengthScore:{ personalization:86, clarity:85, commercialHook:90, lengthScore:88, spamRisk:'low', ctaStrength:'curiosity-driven' } },
    { name:'Quiet Founder Note', angle:'Quiet Founder Note', subjectOptions:[n,'A quick note',`${n} — a quick look`], body:`Hi,\n\nI run a small company helping independent hotels with direct bookings and AI search visibility.\n\n${n} caught my attention. The positioning is right, but the digital presence isn't fully expressing it — meaning some value isn't converting into direct bookings.\n\nNot selling a platform. I do focused, founder-led audits.\n\nIf you're open to a look, I can share what I found.\n\nBest,\nMurat\nKoaland.ai`, whyThisWorks:'"Not selling a platform" disarms immediately. Peer-to-peer framing.', strengthScore:{ personalization:74, clarity:93, commercialHook:70, lengthScore:94, spamRisk:'very-low', ctaStrength:'permission-based' } },
  ]});
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
    const emails = read('emails');
    emails.push({ id:emailId, prospectId: prospectId || null, to, subject, body, type, status:process.env.SENDGRID_API_KEY?'sent':'logged_only', sentAt:new Date().toISOString(), createdAt:new Date().toISOString() });
    write('emails', emails);
    if (prospectId) {
      const list = read('prospects'); const pIdx = list.findIndex(p=>p.id===prospectId);
      if (pIdx!==-1) { list[pIdx]={...list[pIdx],status:'sent',hotLeadScore:5,lastActionAt:new Date().toISOString()}; write('prospects',list); }
      const events = read('events'); events.push({ id:lid('evt'), type:'email_sent', prospectId, emailId, createdAt:new Date().toISOString() }); write('events',events);
    }
  }
  res.json({ ok:true, emailId, sent:!!process.env.SENDGRID_API_KEY });
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
app.get('/api/campaigns', auth, (req, res) => res.json({ campaigns: read('campaigns') }));
app.post('/api/campaigns', auth, (req, res) => {
  const campaigns = [...read('campaigns'), { ...req.body, id: lid('cmp'), status: req.body.status || 'active', metrics: { prospects:0, sent:0, delivered:0, opened:0, replied:0, bounced:0 }, createdAt: new Date().toISOString() }];
  write('campaigns', campaigns); res.json({ campaign: campaigns[campaigns.length - 1] });
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

// ─── CRAWLER ────────────────────────────────────────────────────
async function crawlWebsite(url) {
  if (!cheerio) throw new Error('cheerio not available');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  let html;
  try {
    const resp = await fetch(url, { signal:ctrl.signal, headers:{ 'User-Agent':'Mozilla/5.0 (compatible; KoalandBot/1.0)', 'Accept':'text/html', 'Accept-Language':'en-US,en;q=0.9' } });
    clearTimeout(t);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    html = await resp.text();
  } catch (err) { clearTimeout(t); throw err; }

  const $ = cheerio.load(html);
  $('script,style,noscript,iframe').remove();
  const title=$('title').first().text().trim();
  const metaDescription=$('meta[name="description"]').attr('content')?.trim()||'';
  const headings=[]; $('h1,h2,h3').each((_,el)=>{ const t2=$(el).text().trim(); if(t2) headings.push(t2); });
  const bodyText=$('body').text().replace(/\s+/g,' ').trim();
  const ctaTexts=[]; $('a,button,[class*="cta"],[class*="btn"]').each((_,el)=>{ const t2=$(el).text().trim(); if(t2&&t2.length<80) ctaTexts.push(t2); });
  const bkw=['book','reserve','reservation','booking','rates','availability'];
  const bookingLinks=[]; $('a[href]').each((_,el)=>{ const h=$(el).attr('href')||'',t2=$(el).text().toLowerCase(); if(bkw.some(k=>t2.includes(k)||h.toLowerCase().includes(k))){ try{bookingLinks.push(h.startsWith('http')?h:new URL(h,url).href);}catch{} } });
  const emailRegex=/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const emailsFound=[...new Set(html.match(emailRegex)||[])].filter(e=>!e.includes('example.com'));
  const schemaTypes=[]; $('script[type="application/ld+json"]').each((_,el)=>{ try{const d=JSON.parse($(el).html()||'{}');if(d['@type'])schemaTypes.push(d['@type']);}catch{} });
  return { url, title, metaDescription, headings:[...new Set(headings)].slice(0,50), bodyText:bodyText.slice(0,8000), ctaTexts:[...new Set(ctaTexts)].slice(0,20), bookingLinks:[...new Set(bookingLinks)].slice(0,10), contactLinks:[], emailsFound, faqText:'', schemaTypes:[...new Set(schemaTypes)], robotsHints:'N/A', navLinks:[], hasSitemap:false, crawledAt:new Date().toISOString() };
}

// ─── START ───────────────────────────────────────────────────────
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
