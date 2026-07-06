// ─── KOALAND PROSPECT INTELLIGENCE OS ──────────────────────────
// frontend/app.js — Single-page application (no build required)

// ─── CONFIG ─────────────────────────────────────────────────────
const DEFAULT_API_URL = '';  // Set in Settings or localStorage
let API_BASE = localStorage.getItem('koaland_api_url') || DEFAULT_API_URL;
let AUTH_TOKEN = localStorage.getItem('koaland_token') || '';
let LOCAL_MODE = localStorage.getItem('koaland_local_mode') === 'true';

// ─── LOCAL DATASTORE ─────────────────────────────────────────────
const localDB = {
  get(col) { return JSON.parse(localStorage.getItem(`koaland_local_${col}`) || '[]'); },
  set(col, data) { localStorage.setItem(`koaland_local_${col}`, JSON.stringify(data)); },
  getOne(col, id) { return this.get(col).find(x => x.id === id) || null; },
  insert(col, item) { const a = this.get(col); a.push(item); this.set(col, a); return item; },
  update(col, id, upd) {
    const a = this.get(col), i = a.findIndex(x => x.id === id);
    if (i === -1) throw new Error('Not found');
    a[i] = { ...a[i], ...upd, updatedAt: new Date().toISOString() };
    this.set(col, a); return a[i];
  },
  remove(col, id) { this.set(col, this.get(col).filter(x => x.id !== id)); },
  getSettings() { return JSON.parse(localStorage.getItem('koaland_local_settings') || '{}'); },
  setSettings(upd) {
    const s = { ...this.getSettings(), ...upd };
    localStorage.setItem('koaland_local_settings', JSON.stringify(s)); return s;
  },
};

function localId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
}

// ─── MOCK DATA GENERATORS ─────────────────────────────────────────
function mockAuditResult(prospect) {
  const r = (min, max) => Math.round(min + Math.random() * (max - min));
  const scores = {
    websiteExperience: r(38, 72),
    seoReadiness: r(28, 62),
    aeoReadiness: r(18, 48),
    geoReadiness: r(15, 45),
    directBookingClarity: r(30, 65),
    luxuryBrandConsistency: r(42, 78),
    commercialUpside: r(58, 92),
    confidence: r(62, 88),
  };
  return {
    scores,
    executiveSummary: `${prospect.hotelName} presents a compelling luxury brand that is significantly underserved by its digital presence. The property's direct booking capability is undermined by poor CTA hierarchy and absent AI-readable structured data — creating systematic commercial leakage to OTA channels. The commercial upside for a properly positioned digital presence is substantial.`,
    recommendedAngle: 'Direct Booking Clarity',
    topFindings: [
      { title: 'Direct booking CTA buried below the fold', severity: 'high', evidence: 'Primary "Book Now" requires 3+ scrolls on mobile. OTA links appear above the property\'s own reservation engine.', commercialMeaning: 'Guests default to OTA bookings, costing 15–22% commission per reservation.', outreachHook: `Your guests want to book direct — ${prospect.hotelName}'s website just won't let them find the button.` },
      { title: 'No hotel schema markup', severity: 'high', evidence: 'Missing Hotel, LodgingBusiness, and amenity structured data across all key pages.', commercialMeaning: 'AI assistants cannot accurately represent the property — invisible in AI-assisted booking journeys.', outreachHook: 'ChatGPT and Google AI can\'t recommend you because they literally can\'t read your website.' },
      { title: 'Mobile experience below luxury standard', severity: 'medium', evidence: 'Mobile PageSpeed in the 40–55 range. Booking flow requires excessive taps on mobile.', commercialMeaning: '60%+ of luxury travelers research on mobile — a slow experience signals brand inconsistency.', outreachHook: 'Half your potential guests decide on their phones. Your mobile experience is losing them at the last step.' },
      { title: 'No FAQ / experience content for AI queries', severity: 'medium', evidence: 'Sparse content on amenities, dining, and experiences. No FAQ structure.', commercialMeaning: 'AI assistants find nothing to cite when guests ask about the property.', outreachHook: `When someone asks ChatGPT "best boutique hotels in ${prospect.location || 'your area'}" — you're not in the answer.` },
    ],
    commercialLeakageRisks: [
      { title: 'OTA dependency accelerating', severity: 'high', commercialMeaning: 'Commission costs compound annually as the digital gap vs competitors widens.' },
      { title: 'AI search invisibility', severity: 'high', commercialMeaning: 'No AI-readable signals = absent from a growing share of luxury travel discovery.' },
      { title: 'Competitive disadvantage growing', severity: 'medium', commercialMeaning: 'Regional competitors with stronger digital presence capture AI search and direct bookings.' },
    ],
    opportunities: [
      { type: 'Quick Win', title: 'Direct booking CTA repositioning', impact: 'High', effort: 'Low', urgency: 'Immediate', whyItMatters: 'A single CTA hierarchy fix can increase direct booking conversion by 20–35% without touching the reservation engine.' },
      { type: 'Strategic Fix', title: 'Hotel schema implementation', impact: 'High', effort: 'Medium', urgency: '30 days', whyItMatters: 'Structured data unlocks AI search visibility across Google, ChatGPT, and Perplexity.' },
      { type: 'Commercial Risk', title: 'OTA commission recapture program', impact: 'Very High', effort: 'Medium', urgency: 'This quarter', whyItMatters: 'A 10% shift from OTA to direct on 1,000 annual room nights saves €15,000–€25,000 in commissions.' },
    ],
    pdfUrl: '#local-preview-pdf',
    pdfToken: localId('tok'),
  };
}

function mockEmailVariants(prospect) {
  const n = prospect.hotelName || 'your property';
  const loc = prospect.location ? ` in ${prospect.location}` : '';
  return {
    variants: [
      {
        name: 'Precision — Direct Booking',
        angle: 'Direct Booking Clarity',
        subjectOptions: [`Quick note on ${n}'s booking flow`, `Something I noticed on ${n}'s website`, `${n} — direct booking friction`],
        body: `Hi,\n\nI was looking at ${n}'s website${loc} this week — specifically at how guests move from discovery to booking.\n\nThe property and offering are clearly premium. But the path to a direct reservation has a few friction points that are pushing guests toward OTA instead.\n\nI've put together a short audit with the two or three specific changes that would have the biggest impact on direct booking conversion. No fluff — just findings and what they mean commercially.\n\nWould it be useful to share it with you?\n\nBest,\nMurat\nKoaland.ai`,
        whyThisWorks: 'Opens with a specific observation, not a pitch. "Direct reservation" signals commercial awareness without being salesy.',
        strengthScore: { personalization: 82, clarity: 90, commercialHook: 85, lengthScore: 88, spamRisk: 'low', ctaStrength: 'soft-ask' },
      },
      {
        name: 'AI Angle — Search Visibility',
        angle: 'AI Search Readiness',
        subjectOptions: [`What ChatGPT says about ${n}`, `${n} in AI search — a quick look`, `AI travel discovery and ${n}`],
        body: `Hi,\n\nI ran ${n} through the AI search assistants that luxury travelers are increasingly using to plan stays — ChatGPT, Perplexity, Google AI Overviews.\n\nThe results were interesting. The property barely surfaces, and when it does, the description doesn't match your actual positioning.\n\nThis is fixable — and it's a gap worth closing before competitors${loc} get there first.\n\nI've documented exactly what the AI systems see (and don't see) about ${n}. Happy to share the findings.\n\nBest,\nMurat\nKoaland.ai`,
        whyThisWorks: 'The AI search angle is novel and specific — very few hotels have heard this framing. Creates genuine curiosity.',
        strengthScore: { personalization: 88, clarity: 85, commercialHook: 90, lengthScore: 85, spamRisk: 'low', ctaStrength: 'curiosity-driven' },
      },
      {
        name: 'Quiet Founder — Peer to Peer',
        angle: 'Quiet Founder Note',
        subjectOptions: [n, 'A quick note', `${n} — something worth a look`],
        body: `Hi,\n\nI run a small company that helps independent hotels strengthen their digital presence — specifically around direct bookings and AI search visibility.\n\n${n} caught my attention. The positioning is right, but the digital presence isn't fully expressing it — which means some of the value you're creating isn't converting into direct bookings.\n\nI'm not selling a platform or a retainer. I do focused, founder-led audits and then specific implementation.\n\nIf you're open to a look, I can share what I found.\n\nBest,\nMurat\nKoaland.ai`,
        whyThisWorks: '"Not selling a platform" disarms immediately. Founder-to-founder framing creates peer-level respect.',
        strengthScore: { personalization: 75, clarity: 92, commercialHook: 72, lengthScore: 92, spamRisk: 'very-low', ctaStrength: 'permission-based' },
      },
    ],
  };
}

function mockSerpResults(query, location, maxResults) {
  const locs = location
    ? [location, location, location, location, location, location, location, location]
    : ['Santorini, Greece', 'Bodrum, Turkey', 'Amalfi Coast, Italy', 'Mykonos, Greece', 'Capri, Italy', 'Dubrovnik, Croatia', 'Kotor, Montenegro', 'Oia, Greece'];
  const hotels = [
    { name: 'Villa Konak Boutique Hotel', slug: 'villakonakhotel', rooms: 14 },
    { name: 'The Olive & Stone Hotel', slug: 'olivestonehotel', rooms: 18 },
    { name: 'Maison de la Mer', slug: 'maisondelamer', rooms: 12 },
    { name: 'Elia Boutique Hotel', slug: 'eliaboutiquehotel', rooms: 22 },
    { name: 'Casa Primavera', slug: 'casaprimavera', rooms: 10 },
    { name: 'Terrazzo Mare Hotel', slug: 'terrazzomarehotel', rooms: 16 },
    { name: 'The Grand Terrace', slug: 'thegrandterrace', rooms: 28 },
    { name: 'Blue Lagoon Estate', slug: 'bluelagoonestate', rooms: 8 },
  ];
  const existingUrls = new Set(localDB.get('prospects').map(p => p.website));
  const count = Math.min(maxResults || 8, hotels.length);
  return hotels.slice(0, count).map((h, i) => {
    const loc = locs[i % locs.length];
    const website = `https://www.${h.slug}.com`;
    return {
      hotelName: h.name,
      website,
      location: loc,
      snippet: `${h.name} — a curated collection of ${h.rooms} rooms offering personalized luxury in ${loc}. Award-winning design, independent ownership, direct booking available.`,
      initialIcpFit: Math.round(55 + Math.random() * 40),
      alreadyInDatabase: existingUrls.has(website),
    };
  });
}

// ─── SEED LOCAL DATA ─────────────────────────────────────────────
function seedLocalData() {
  if (localStorage.getItem('koaland_local_seeded')) return;
  const now = new Date().toISOString();
  const p1 = localId('pro'), p2 = localId('pro'), a1 = localId('aud');

  localDB.set('prospects', [
    { id: p1, hotelName: 'Villa Ariadne Boutique Hotel', website: 'https://www.villa-ariadne.com', location: 'Santorini, Greece', segment: 'boutique', status: 'audit_ready', icpFitScore: 88, hotLeadScore: 30, commercialUpsideScore: 72, auditScore: 47, priority: 'A', source: 'manual', contactEmail: 'info@villa-ariadne.com', contactPerson: 'Eleni Papadopoulos', recommendedAngle: 'Direct Booking Clarity', notes: 'Stunning property, strong positioning but weak digital presence. Perfect ICP.', lastActionAt: now, createdAt: now },
    { id: p2, hotelName: 'Maison Bodrum', website: 'https://www.maisonbodrum.com', location: 'Bodrum, Turkey', segment: 'luxury', status: 'research_queue', icpFitScore: 79, hotLeadScore: 0, commercialUpsideScore: 0, auditScore: 0, priority: 'B', source: 'discovery', notes: 'Found via SERP. Strong brand offline, weak digital footprint.', lastActionAt: now, createdAt: now },
  ]);

  localDB.set('audits', [{
    id: a1, prospectId: p1, status: 'complete', depth: 'full',
    scores: { websiteExperience: 52, seoReadiness: 38, aeoReadiness: 22, geoReadiness: 19, directBookingClarity: 41, luxuryBrandConsistency: 67, commercialUpside: 84, confidence: 78 },
    executiveSummary: 'Villa Ariadne presents a compelling luxury brand that is significantly underserved by its digital presence. The property\'s direct booking capability is undermined by poor CTA hierarchy and absent AI-readable structured data — creating systematic OTA dependency.',
    recommendedAngle: 'Direct Booking Clarity',
    topFindings: [
      { title: 'Booking CTA buried below the fold', severity: 'high', evidence: '"Book Now" only appears after 3 scrolls on mobile. OTA links more prominent.', commercialMeaning: 'OTA path is 5× more visible than direct booking.', outreachHook: 'Your guests want to book direct — the website just won\'t let them find the button.' },
      { title: 'No hotel schema markup', severity: 'high', evidence: 'Missing Hotel and LodgingBusiness structured data sitewide.', commercialMeaning: 'AI assistants cannot represent the property accurately.', outreachHook: 'ChatGPT literally can\'t recommend you — it can\'t read your site.' },
    ],
    commercialLeakageRisks: [{ title: 'OTA dependency', severity: 'high', commercialMeaning: 'Commission costs compound at 15–22% per booking.' }],
    opportunities: [{ type: 'Quick Win', title: 'CTA repositioning', impact: 'High', effort: 'Low', urgency: 'Immediate', whyItMatters: 'Single change, 25–35% direct booking uplift potential.' }],
    pdfUrl: '#local-preview-pdf', pdfToken: localId('tok'), createdAt: now,
  }]);

  localDB.set('tasks', [{
    id: localId('tsk'), prospectId: p1, type: 'send_initial_outreach',
    title: 'Send initial outreach to Villa Ariadne',
    reason: 'Audit complete. Commercial upside: 84. Angle: Direct Booking Clarity.',
    status: 'open', dueAt: new Date(Date.now() + 86400000).toISOString(), createdAt: now,
  }]);

  localDB.set('emails', []);
  localDB.set('campaigns', []);
  localDB.set('contacts', []);
  localDB.set('events', []);
  localDB.setSettings({ senderName: 'Murat', company: 'Koaland.ai', koalandDescription: 'Commercial intelligence for brand-sensitive hotels', demoKitLink: '', calendarLink: '', testEmailAddress: '', dailySendLimit: 10, followupDelay1Days: 3, followupDelay2Days: 5 });
  localStorage.setItem('koaland_local_seeded', 'true');
}

// ─── LOCAL API ROUTER ─────────────────────────────────────────────
async function localApi(method, path, body) {
  await new Promise(r => setTimeout(r, 60 + Math.random() * 140));

  if (path === '/api/health') return { ok: true, local: true, integrations: { openai: { ok: false }, sendgrid: { ok: false } } };
  if (path === '/api/auth/check') return { ok: true };

  if (path === '/api/settings') {
    if (method === 'GET') return { settings: localDB.getSettings() };
    if (method === 'PATCH') return { settings: localDB.setSettings(body) };
  }

  if (path === '/api/dashboard') {
    const prospects = localDB.get('prospects');
    const emails = localDB.get('emails');
    const tasks = localDB.get('tasks');
    const events = localDB.get('events');
    const audits = localDB.get('audits');
    const openTasks = tasks.filter(t => t.status === 'open');
    const statusOrder = ['research_queue','researching','research_complete','audit_in_progress','audit_ready','email_drafted','sent','delivered','opened','pdf_viewed','replied'];
    const pipelineCounts = {};
    statusOrder.forEach(s => { pipelineCounts[s] = prospects.filter(p => p.status === s).length; });
    const themes = {};
    audits.forEach(a => (a.opportunities || []).forEach(o => { themes[o.type] = (themes[o.type] || 0) + 1; }));
    return {
      summary: {
        totalProspects: prospects.length,
        aTierProspects: prospects.filter(p => p.priority === 'A').length,
        auditsGenerated: audits.length,
        emailsSent: emails.filter(e => e.status !== 'draft').length,
        emailsDelivered: emails.filter(e => ['delivered','opened','clicked'].includes(e.status)).length,
        emailsOpened: emails.filter(e => ['opened','clicked'].includes(e.status)).length,
        pdfViews: events.filter(e => e.type === 'pdf_opened').length,
        replies: emails.filter(e => e.status === 'replied').length,
        hotLeads: prospects.filter(p => (p.hotLeadScore || 0) >= 85).length,
        followUpsDue: openTasks.filter(t => new Date(t.dueAt) <= new Date()).length,
      },
      pipelineCounts,
      warmSignals: [...prospects].filter(p => (p.hotLeadScore || 0) > 0).sort((a, b) => (b.hotLeadScore || 0) - (a.hotLeadScore || 0)).slice(0, 10),
      priorityTasks: [...openTasks].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)).slice(0, 10),
      recentActivity: [...events].reverse().slice(0, 20),
      opportunityThemes: Object.entries(themes).map(([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count),
    };
  }

  if (path === '/api/analytics') {
    const emails = localDB.get('emails');
    const total = emails.length;
    const delivered = emails.filter(e => ['delivered','opened','clicked','replied'].includes(e.status)).length;
    const opened = emails.filter(e => ['opened','clicked','replied'].includes(e.status)).length;
    const replied = emails.filter(e => e.status === 'replied').length;
    const bounced = emails.filter(e => e.status === 'bounced').length;
    const rate = (n, d) => d ? Math.round((n / d) * 100) : 0;
    return {
      funnel: { total, delivered, opened, pdfOpened: 0, replied, bounced },
      rates: { deliveryRate: rate(delivered, total), openRate: rate(opened, total), pdfViewRate: 0, replyRate: rate(replied, total), bounceRate: rate(bounced, total) },
      anglePerformance: [
        { angle: 'Direct Booking Clarity', sent: 3, openRate: 67, pdfViewRate: 33, replyRate: 0 },
        { angle: 'AI Search Readiness', sent: 2, openRate: 50, pdfViewRate: 0, replyRate: 0 },
        { angle: 'Quiet Founder Note', sent: 1, openRate: 100, pdfViewRate: 0, replyRate: 0 },
      ],
      subjectPerformance: [],
      locationPerformance: [],
      topThemes: [{ theme: 'Direct Booking', count: 4 }, { theme: 'AI Search Visibility', count: 3 }, { theme: 'Commercial Leakage', count: 2 }],
      insights: [
        'AI Search angle has the highest curiosity rate — leads often ask follow-up questions about what AI systems see.',
        'Direct Booking Clarity resonates most with independent properties in competitive tourist markets.',
        'Quiet Founder Note has the highest reply rate when targeting owner-operated boutique hotels.',
      ],
    };
  }

  if (path === '/api/prospects') {
    if (method === 'GET') return { prospects: localDB.get('prospects') };
    if (method === 'POST') {
      const icp = body.icpFitScore || 50;
      const item = { ...body, id: localId('pro'), status: body.status || 'research_queue', hotLeadScore: 0, icpFitScore: icp, auditScore: 0, priority: icp >= 80 ? 'A' : icp >= 60 ? 'B' : 'C', createdAt: new Date().toISOString(), lastActionAt: new Date().toISOString() };
      localDB.insert('prospects', item);
      return { prospect: item };
    }
  }

  const pmatch = path.match(/^\/api\/prospects\/([^/]+)$/);
  if (pmatch) {
    const id = pmatch[1];
    if (method === 'GET') {
      const prospect = localDB.getOne('prospects', id);
      if (!prospect) throw new Error('Prospect not found');
      return { prospect, audits: localDB.get('audits').filter(a => a.prospectId === id), tasks: localDB.get('tasks').filter(t => t.prospectId === id && t.status === 'open'), emails: localDB.get('emails').filter(e => e.prospectId === id) };
    }
    if (method === 'PATCH') return { prospect: localDB.update('prospects', id, { ...body, lastActionAt: new Date().toISOString() }) };
    if (method === 'DELETE') { localDB.remove('prospects', id); return { ok: true }; }
  }

  if (path === '/api/discovery/search') {
    const results = mockSerpResults(body.query, body.location, body.maxResults);
    return { results };
  }

  if (path === '/api/research/prospect') {
    const p = localDB.getOne('prospects', body.prospectId);
    if (!p) throw new Error('Prospect not found');
    localDB.update('prospects', body.prospectId, { status: 'research_complete', lastActionAt: new Date().toISOString() });
    return { ok: true, crawl: { emailsFound: [], title: p.hotelName }, profile: { segment: p.segment || 'boutique', icpFit: p.icpFitScore || 65 } };
  }

  if (path === '/api/audits/run') {
    const p = localDB.getOne('prospects', body.prospectId);
    if (!p) throw new Error('Prospect not found');
    const mock = mockAuditResult(p);
    const overall = Math.round(Object.values(mock.scores).reduce((a, b) => a + b, 0) / Object.values(mock.scores).length);
    const audit = { ...mock, id: localId('aud'), prospectId: p.id, status: 'complete', depth: body.depth || 'full', createdAt: new Date().toISOString() };
    localDB.insert('audits', audit);
    localDB.update('prospects', p.id, { status: 'audit_ready', auditScore: overall, commercialUpsideScore: mock.scores.commercialUpside, recommendedAngle: mock.recommendedAngle, lastActionAt: new Date().toISOString() });
    localDB.insert('tasks', { id: localId('tsk'), prospectId: p.id, type: 'send_initial_outreach', title: `Generate email for ${p.hotelName}`, reason: `Audit complete. Commercial upside: ${mock.scores.commercialUpside}. Angle: ${mock.recommendedAngle}.`, status: 'open', dueAt: new Date(Date.now() + 86400000).toISOString(), createdAt: new Date().toISOString() });
    return audit;
  }

  const amatch = path.match(/^\/api\/audits\/([^/]+)$/);
  if (amatch) {
    if (method === 'GET') { const a = localDB.getOne('audits', amatch[1]); if (!a) throw new Error('Not found'); return a; }
  }

  if (path === '/api/emails/generate') {
    const p = localDB.getOne('prospects', body.prospectId);
    if (!p) throw new Error('Prospect not found');
    return mockEmailVariants(p);
  }

  if (path === '/api/emails/send') {
    if (body.isTest) { toast('[Local] Test email simulated — no email sent', 'info', 4000); return { ok: true }; }
    const emailId = localId('em');
    const rec = { id: emailId, to: body.to, subject: body.subject, body: body.body, type: body.type || 'initial', status: 'sent', sentAt: new Date().toISOString(), createdAt: new Date().toISOString() };
    if (body.prospectId) {
      rec.prospectId = body.prospectId;
      localDB.insert('emails', rec);
      localDB.update('prospects', body.prospectId, { status: 'sent', hotLeadScore: 5, lastActionAt: new Date().toISOString() });
      localDB.insert('events', { id: localId('evt'), type: 'email_sent', prospectId: body.prospectId, emailId, createdAt: new Date().toISOString() });
    } else {
      localDB.insert('emails', rec);
    }
    toast('[Local Mode] Email logged — no actual email sent', 'info', 4000);
    return { ok: true, emailId };
  }

  // ─── CONTACTS (local) ──────────────────────────────────────────
  if (path === '/api/contacts') {
    if (method === 'GET') return { contacts: localDB.get('contacts') };
    if (method === 'POST') {
      const c = { ...body, id: localId('con'), status: body.status || 'not_sent', createdAt: new Date().toISOString() };
      localDB.insert('contacts', c);
      return { contact: c };
    }
  }
  const cmatch2 = path.match(/^\/api\/contacts\/([^/]+)$/);
  if (cmatch2) {
    const id = cmatch2[1];
    if (method === 'PATCH') return { contact: localDB.update('contacts', id, body) };
    if (method === 'DELETE') { localDB.remove('contacts', id); return { ok: true }; }
  }

  // ─── CAMPAIGNS PATCH (local) ────────────────────────────────────
  const campPatch = path.match(/^\/api\/campaigns\/([^/]+)$/);
  if (campPatch) {
    if (method === 'PATCH') return { campaign: localDB.update('campaigns', campPatch[1], body) };
  }

  if (path === '/api/tasks' || path.startsWith('/api/tasks?')) {
    if (method === 'GET') {
      let tasks = localDB.get('tasks');
      if (path.includes('status=open')) tasks = tasks.filter(t => t.status === 'open');
      return { tasks };
    }
    if (method === 'POST') { const t = { ...body, id: localId('tsk'), createdAt: new Date().toISOString() }; localDB.insert('tasks', t); return { task: t }; }
  }

  if (path === '/api/tasks/recalculate') return { ok: true, tasksCreated: 0 };

  const tmatch = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (tmatch) {
    if (method === 'PATCH') return { task: localDB.update('tasks', tmatch[1], body) };
  }

  if (path === '/api/campaigns') {
    if (method === 'GET') return { campaigns: localDB.get('campaigns') };
    if (method === 'POST') {
      const c = { ...body, id: localId('cmp'), status: 'active', metrics: { prospects: 0, sent: 0, delivered: 0, opened: 0, replied: 0, bounced: 0 }, createdAt: new Date().toISOString() };
      localDB.insert('campaigns', c); return { campaign: c };
    }
  }

  throw new Error(`[Local] Unhandled: ${method} ${path}`);
}

// ─── LOCAL AUTH HELPERS ───────────────────────────────────────────
function handleLocalLogin() {
  localStorage.setItem('koaland_local_mode', 'true');
  LOCAL_MODE = true;
  seedLocalData();
  hideLock();
  initApp();
}

function exitLocalMode() {
  localStorage.removeItem('koaland_local_mode');
  LOCAL_MODE = false;
  API_BASE = '';
  AUTH_TOKEN = '';
  showLock();
}

function clearLocalData() {
  if (!confirm('Clear all local data? This cannot be undone.')) return;
  ['prospects', 'audits', 'emails', 'tasks', 'campaigns', 'events'].forEach(c => localDB.set(c, []));
  localStorage.removeItem('koaland_local_seeded');
  toast('Local data cleared. Reloading...', 'info');
  setTimeout(() => location.reload(), 1500);
}

// ─── STATE ───────────────────────────────────────────────────────
const state = {
  currentScreen: 'command-center',
  prospects: [],
  audits: [],
  emails: [],
  tasks: [],
  events: [],
  campaigns: [],
  settings: {},
  dashboard: null,
  analytics: null,
  status: { openai: false, sendgrid: false, pagespeed: false, serp: false },
  selectedProspect: null,
  selectedAudit: null,
  emailVariants: [],
  discoveryResults: [],
  loading: {},
};

// ─── API CLIENT ─────────────────────────────────────────────────
async function api(path, options = {}) {
  if (LOCAL_MODE) {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body
      ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body)
      : {};
    return localApi(method, path, body);
  }

  const base = API_BASE || localStorage.getItem('koaland_api_url') || '';
  if (!base) throw new Error('API URL not configured. Go to Settings.');

  const url = base.replace(/\/$/, '') + path;
  const token = AUTH_TOKEN || localStorage.getItem('koaland_token') || '';

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });

  if (res.status === 401) {
    showLock();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

const get = (path) => api(path, { method: 'GET' });
const post = (path, body) => api(path, { method: 'POST', body });
const patch = (path, body) => api(path, { method: 'PATCH', body });
const del = (path) => api(path, { method: 'DELETE' });

// ─── AUTH ────────────────────────────────────────────────────────
function showLock() {
  document.getElementById('lock-screen').style.display = 'flex';
  document.getElementById('app').classList.remove('visible');
}

function hideLock() {
  document.getElementById('lock-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
}

async function handleLogin() {
  const tokenInput = document.getElementById('lock-token');
  const apiInput = document.getElementById('lock-api');
  const errorEl = document.getElementById('lock-error');
  const token = tokenInput.value.trim();
  const apiUrl = apiInput.value.trim();

  if (!token || !apiUrl) {
    errorEl.textContent = 'Enter both API URL and access token.';
    return;
  }

  try {
    const btn = document.getElementById('lock-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Connecting...';

    AUTH_TOKEN = token;
    API_BASE = apiUrl.replace(/\/$/, '');

    const result = await post('/api/auth/check', { token });
    if (result.ok) {
      localStorage.setItem('koaland_token', token);
      localStorage.setItem('koaland_api_url', API_BASE);
      hideLock();
      initApp();
    } else {
      errorEl.textContent = 'Invalid access token.';
      AUTH_TOKEN = '';
    }
  } catch (err) {
    errorEl.textContent = err.message || 'Connection failed. Check your API URL.';
    AUTH_TOKEN = '';
  } finally {
    const btn = document.getElementById('lock-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Access Intelligence OS'; }
  }
}

// ─── ROUTER ─────────────────────────────────────────────────────
function navigate(screen, params = {}) {
  state.currentScreen = screen;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.screen === screen);
  });

  renderScreen(screen, params);
  window.history.pushState({ screen, params }, '', `#${screen}`);
}

function renderScreen(screen, params = {}) {
  const main = document.getElementById('main');
  main.innerHTML = '';

  const screens = {
    'command-center': renderCommandCenter,
    'prospect-radar': renderProspectRadar,
    'prospects': renderProspects,
    'audit-workspace': renderAuditWorkspace,
    'email-studio': renderEmailStudio,
    'campaigns': renderCampaigns,
    'followup-queue': renderFollowupQueue,
    'analytics': renderAnalytics,
    'settings': renderSettings,
    'engine': renderEngine,
    'outbox': renderOutbox,
  };

  const fn = screens[screen];
  if (fn) fn(main, params);
}

// ─── TOAST ──────────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ─── HELPERS ────────────────────────────────────────────────────
function setLoading(key, val) {
  state.loading[key] = val;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function relativeTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function scoreColor(score) {
  if (score >= 75) return 'var(--green)';
  if (score >= 50) return 'var(--orange)';
  return 'var(--red)';
}

function scoreClass(score) {
  if (score >= 75) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}

function statusBadge(status) {
  const map = {
    research_queue: ['Research Queue', 'tag-dim'],
    researching: ['Researching', 'tag-warning'],
    research_complete: ['Researched', 'tag-dim'],
    audit_in_progress: ['Auditing', 'tag-warning'],
    audit_ready: ['Audit Ready', 'tag-green'],
    email_drafted: ['Drafted', 'tag-dim'],
    sent: ['Sent', 'tag-green'],
    delivered: ['Delivered', 'tag-green'],
    opened: ['Opened', 'tag-green'],
    pdf_viewed: ['PDF Viewed', 'tag-gold'],
    replied: ['Replied', 'tag-green'],
    demo_interest: ['Demo Interest', 'tag-green'],
    follow_up_due: ['Follow-up Due', 'tag-warning'],
    closed_won: ['Won', 'tag-green'],
    closed_lost: ['Lost', 'tag-danger'],
    not_fit: ['Not Fit', 'tag-danger'],
    bounced: ['Bounced', 'tag-danger'],
    unsubscribed: ['Unsubscribed', 'tag-danger'],
  };
  const [label, cls] = map[status] || [status, 'tag-dim'];
  return `<span class="tag ${cls}">${label}</span>`;
}

function signalPill(score) {
  if (score >= 85) return `<span class="signal-pill signal-hot">● Hot ${score}</span>`;
  if (score >= 60) return `<span class="signal-pill signal-warm">● Warm ${score}</span>`;
  if (score >= 30) return `<span class="signal-pill signal-warming">● Warming ${score}</span>`;
  return `<span class="signal-pill signal-cold">● Cold ${score}</span>`;
}

function scoreBar(label, value, maxWidth = 100) {
  const color = scoreColor(value);
  const pct = Math.max(0, Math.min(100, value));
  return `
    <div class="score-bar-row">
      <span class="score-bar-label">${label}</span>
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${pct}%;background:${color};"></div>
      </div>
      <span class="score-bar-num" style="color:${color};">${value}</span>
    </div>`;
}

function icpTier(score) {
  if (score >= 80) return '<span class="icp-tier icp-A">A</span>';
  if (score >= 60) return '<span class="icp-tier icp-B">B</span>';
  if (score >= 40) return '<span class="icp-tier icp-C">C</span>';
  return '<span class="icp-tier icp-X">—</span>';
}

function taskTypeColor(type) {
  if (type.includes('hot') || type.includes('urgent')) return 'var(--red)';
  if (type.includes('pdf')) return 'var(--gold)';
  if (type.includes('open')) return 'var(--green)';
  return 'var(--dim-text)';
}

function dueLabel(dueAt) {
  if (!dueAt) return '<span class="task-due upcoming">—</span>';
  const diff = new Date(dueAt).getTime() - Date.now();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `<span class="task-due overdue">Overdue ${Math.abs(days)}d</span>`;
  if (days === 0) return `<span class="task-due today">Today</span>`;
  return `<span class="task-due upcoming">In ${days}d</span>`;
}

function activityIcon(type) {
  const icons = {
    email_sent: '✉', email_delivered: '✓', email_opened: '👁',
    email_clicked: '↗', pdf_opened: '📄', pdf_downloaded: '↓',
    pdf_viewed: '📄', reply_received: '↩', task_created: '✓',
    email_bounced: '✗', email_unsubscribed: '⊘', link_clicked_demo: '▶',
    link_clicked_calendar: '📅',
  };
  return icons[type] || '·';
}

function activityLabel(evt) {
  const labels = {
    email_sent: 'Email sent',
    email_delivered: 'Email delivered',
    email_opened: 'Email opened',
    email_clicked: 'Link clicked',
    pdf_opened: 'PDF viewed',
    pdf_downloaded: 'PDF downloaded',
    email_bounced: 'Email bounced',
    email_unsubscribed: 'Unsubscribed',
    task_created: 'Task created',
    link_clicked_demo: 'Demo kit clicked',
    link_clicked_calendar: 'Calendar clicked',
  };
  return labels[evt.type] || evt.type;
}

// ─── SCREEN 1: COMMAND CENTER ────────────────────────────────────
async function renderCommandCenter(main) {
  main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-label">Daily Operations</div>
        <div class="page-title">Command Center</div>
        <div class="page-subtitle">Your outbound intelligence cockpit for today</div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="refreshDashboard()">↻ Refresh</button>
    </div>
    <div id="cc-content"><div class="loading-state"><div class="spinner"></div> Loading dashboard...</div></div>
  `;
  await refreshDashboard();
}

async function refreshDashboard() {
  const content = document.getElementById('cc-content');
  if (!content) return;
  try {
    const data = await get('/api/dashboard');
    state.dashboard = data;
    content.innerHTML = buildCommandCenter(data);

    // Update topbar follow-up count
    const followUpEl = document.getElementById('followup-count');
    if (followUpEl) followUpEl.textContent = data.summary.followUpsDue;

    // Update nav badge
    const badge = document.querySelector('[data-screen="followup-queue"] .nav-badge');
    if (badge) badge.textContent = data.summary.followUpsDue;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div><div class="empty-state-title">Could not load dashboard</div><div class="empty-state-sub">${err.message}</div></div>`;
  }
}

function buildCommandCenter(data) {
  const s = data.summary;

  const metricsHtml = `
    <div class="grid-5 mb-16">
      ${metric('Prospects', s.totalProspects)}
      ${metric('A-Tier', s.aTierProspects, 'gold')}
      ${metric('Audits', s.auditsGenerated)}
      ${metric('Emails Sent', s.emailsSent)}
      ${metric('Opened', s.emailsOpened, s.emailsOpened > 0 ? 'green' : '')}
      ${metric('PDF Views', s.pdfViews, s.pdfViews > 0 ? 'gold' : '')}
      ${metric('Replies', s.replies, s.replies > 0 ? 'green' : '')}
      ${metric('Hot Leads', s.hotLeads, s.hotLeads > 0 ? 'danger' : '')}
      ${metric('Follow-ups Due', s.followUpsDue, s.followUpsDue > 0 ? 'warm' : '')}
      ${metric('Delivered', s.emailsDelivered)}
    </div>`;

  const priorityQueueHtml = `
    <div class="card">
      <div class="card-title">⚡ Today's Priority Queue</div>
      ${data.priorityTasks.length === 0
        ? `<div class="empty-state" style="padding:30px"><div class="empty-state-title" style="font-size:15px;">Queue is clear</div><div class="empty-state-sub">No urgent tasks at the moment.</div></div>`
        : data.priorityTasks.slice(0, 8).map(task => buildTaskCard(task)).join('')
      }
    </div>`;

  const pipelineHtml = `
    <div class="card">
      <div class="card-title">Pipeline</div>
      <div class="pipeline-strip">
        ${Object.entries(data.pipelineCounts).map(([status, count]) =>
          `<div class="pipeline-stage" onclick="navigate('prospects')">
            <div class="pipeline-count">${count}</div>
            <div class="pipeline-name">${status.replace(/_/g,' ')}</div>
          </div>`
        ).join('')}
      </div>
    </div>`;

  const warmSignalsHtml = `
    <div class="card">
      <div class="card-title">🔥 Warm Signal Engine</div>
      ${data.warmSignals.length === 0
        ? `<div class="text-dim" style="padding:20px;text-align:center;">No warm signals yet. Send emails to start tracking.</div>`
        : data.warmSignals.map(p => `
          <div class="warm-signal-row" onclick="openProspectDetail('${p.id}')">
            <div class="warm-signal-hotel">
              <div class="warm-signal-name">${p.hotelName}</div>
              <div class="warm-signal-meta">${p.location || ''} · ${statusBadge(p.status)} · ${relativeTime(p.lastActionAt)}</div>
            </div>
            ${signalPill(p.hotLeadScore)}
          </div>`
        ).join('')}
    </div>`;

  const activityHtml = `
    <div class="card">
      <div class="card-title">Recent Activity</div>
      ${data.recentActivity.length === 0
        ? `<div class="text-dim" style="padding:20px;text-align:center;">No activity yet.</div>`
        : data.recentActivity.map(evt => `
          <div class="activity-item">
            <div class="activity-icon">${activityIcon(evt.type)}</div>
            <div>
              <div class="activity-text">${activityLabel(evt)}</div>
              <div class="activity-time">${relativeTime(evt.createdAt)}</div>
            </div>
          </div>`
        ).join('')}
    </div>`;

  const themesHtml = data.opportunityThemes.length ? `
    <div class="card">
      <div class="card-title">Opportunity Themes</div>
      <div class="theme-cloud">
        ${data.opportunityThemes.map(t =>
          `<div class="theme-tag">${t.theme}<span class="ct">${t.count}</span></div>`
        ).join('')}
      </div>
    </div>` : '';

  return `
    ${metricsHtml}
    <div class="grid-2" style="margin-bottom:16px;">
      ${priorityQueueHtml}
      ${warmSignalsHtml}
    </div>
    ${pipelineHtml}
    <div class="grid-2 mt-16" style="margin-top:16px;">
      ${activityHtml}
      ${themesHtml}
    </div>
  `;
}

function metric(label, value, accent = '') {
  return `
    <div class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value ${accent}">${value ?? 0}</div>
    </div>`;
}

function buildTaskCard(task) {
  const typeColor = taskTypeColor(task.type);
  return `
    <div class="task-card">
      <div class="task-card-type" style="background:${typeColor};margin-top:4px;"></div>
      <div class="task-card-body">
        <div class="task-card-title">${task.title}</div>
        <div class="task-card-reason">${task.reason}</div>
        <div class="task-card-actions">
          <button class="btn btn-secondary btn-xs" onclick="openEmailStudioFor('${task.prospectId}')">Open Email Studio</button>
          <button class="btn btn-gold btn-xs" onclick="markTaskDone('${task.id}')">Mark Done</button>
          <button class="btn btn-secondary btn-xs" onclick="postponeTask('${task.id}')">+1 Day</button>
        </div>
      </div>
      ${dueLabel(task.dueAt)}
    </div>`;
}

async function markTaskDone(id) {
  try {
    await patch(`/api/tasks/${id}`, { status: 'done' });
    toast('Task marked done', 'success');
    refreshDashboard();
  } catch (err) { toast(err.message, 'error'); }
}

async function postponeTask(id) {
  try {
    const dueAt = new Date(Date.now() + 86400000).toISOString();
    await patch(`/api/tasks/${id}`, { dueAt });
    toast('Task postponed 1 day', 'info');
    refreshDashboard();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── SCREEN 2: PROSPECT RADAR ────────────────────────────────────
function renderProspectRadar(main) {
  main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-label">Discovery</div>
        <div class="page-title">Prospect Radar</div>
        <div class="page-subtitle">Find and qualify new luxury & boutique hotel prospects</div>
      </div>
    </div>
    <div class="search-row">
      <input id="radar-query" type="text" placeholder='e.g. "luxury boutique hotels in Bodrum"' style="flex:2;" />
      <input id="radar-location" type="text" placeholder="Location (optional)" style="flex:1;" />
      <select id="radar-segment" style="width:160px;flex:none;">
        <option value="">All segments</option>
        <option>Luxury</option><option>Boutique</option>
        <option>Independent</option><option>Resort</option>
      </select>
      <input id="radar-max" type="number" value="10" min="3" max="20" style="width:80px;flex:none;" placeholder="Max" />
      <button class="btn btn-primary" onclick="runRadarSearch()" id="radar-btn">
        Search Prospects
      </button>
    </div>
    <div id="radar-results"></div>
  `;
}

async function runRadarSearch() {
  const query = document.getElementById('radar-query').value.trim();
  const location = document.getElementById('radar-location').value.trim();
  const maxResults = parseInt(document.getElementById('radar-max').value) || 10;
  const results = document.getElementById('radar-results');
  const btn = document.getElementById('radar-btn');

  if (!query) { toast('Enter a search query', 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Searching...';
  results.innerHTML = '<div class="loading-state"><div class="spinner"></div> Scanning for prospects...</div>';

  try {
    const data = await post('/api/discovery/search', { query, location, maxResults });
    state.discoveryResults = data.results;

    if (data.results.length === 0) {
      results.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◎</div><div class="empty-state-title">No prospects found</div><div class="empty-state-sub">Try a broader search query or different location.</div></div>`;
      return;
    }

    results.innerHTML = `
      <div class="flex-center gap-12 mb-16" style="margin-bottom:12px;">
        <span class="text-dim">${data.results.length} prospects found for <strong style="color:var(--ivory)">"${query}"</strong></span>
      </div>
      <div class="radar-results-grid">
        ${data.results.map(r => buildRadarCard(r)).join('')}
      </div>`;
  } catch (err) {
    results.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div><div class="empty-state-title">Search failed</div><div class="empty-state-sub">${err.message}</div></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Search Prospects';
  }
}

function buildRadarCard(r) {
  const scoreColor_ = r.initialIcpFit >= 70 ? 'var(--green)' : r.initialIcpFit >= 50 ? 'var(--orange)' : 'var(--dim-text)';
  return `
    <div class="radar-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div class="radar-card-name">${r.hotelName || 'Unknown Hotel'}</div>
        <span style="color:${scoreColor_};font-size:11px;font-weight:600;">ICP ${r.initialIcpFit}</span>
      </div>
      <div class="radar-card-meta">${r.website || ''}</div>
      <div class="radar-card-snippet">${(r.snippet || '').slice(0, 120)}${r.snippet?.length > 120 ? '...' : ''}</div>
      ${r.alreadyInDatabase ? `<div class="tag tag-dim" style="margin-bottom:10px;">Already in database</div>` : ''}
      <div class="radar-card-actions">
        ${r.alreadyInDatabase
          ? `<span class="text-dim" style="font-size:11px;">In database</span>`
          : `<button class="btn btn-primary btn-xs" onclick="addFromRadar(${JSON.stringify(r).replace(/"/g,'&quot;')})">Add to Queue</button>`
        }
        ${r.website ? `<a href="${r.website}" target="_blank" class="btn btn-secondary btn-xs">Visit ↗</a>` : ''}
      </div>
    </div>`;
}

async function addFromRadar(r) {
  try {
    const data = await post('/api/prospects', {
      hotelName: r.hotelName,
      website: r.website,
      location: r.location || '',
      icpFitScore: r.initialIcpFit || 0,
      source: 'discovery',
      status: 'research_queue',
      notes: `Found via SERP: "${r.snippet?.slice(0, 200) || ''}"`,
    });
    toast(`${r.hotelName} added to queue`, 'success');
    // Refresh radar results to show "in database"
    runRadarSearch();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ─── SCREEN 3: PROSPECTS ─────────────────────────────────────────
async function renderProspects(main, params = {}) {
  main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-label">Intelligence Database</div>
        <div class="page-title">Prospects</div>
        <div class="page-subtitle">Manage your luxury & boutique hotel prospect pipeline</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm" onclick="exportProspects()">↓ Export CSV</button>
        <button class="btn btn-primary btn-sm" onclick="openAddProspectModal()">+ Add Prospect</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px;padding:16px 24px;">
      <div class="flex gap-12" style="flex-wrap:wrap;">
        <select id="filter-status" onchange="loadProspects()" style="width:160px;flex:none;">
          <option value="">All statuses</option>
          <option value="research_queue">Research Queue</option>
          <option value="audit_ready">Audit Ready</option>
          <option value="sent">Sent</option>
          <option value="opened">Opened</option>
          <option value="pdf_viewed">PDF Viewed</option>
          <option value="replied">Replied</option>
          <option value="hot">Hot Leads</option>
          <option value="bounced">Bounced</option>
        </select>
        <input id="filter-search" type="text" placeholder="Search hotel name..." oninput="loadProspects()" style="flex:1;min-width:180px;" />
        <select id="filter-priority" onchange="loadProspects()" style="width:120px;flex:none;">
          <option value="">All tiers</option>
          <option value="A">A-tier</option>
          <option value="B">B-tier</option>
          <option value="C">C-tier</option>
        </select>
      </div>
    </div>
    <div id="prospects-table"><div class="loading-state"><div class="spinner"></div> Loading prospects...</div></div>
  `;
  await loadProspects();
}

async function loadProspects() {
  const tableEl = document.getElementById('prospects-table');
  if (!tableEl) return;

  try {
    const data = await get('/api/prospects');
    state.prospects = data.prospects || [];

    const statusFilter = document.getElementById('filter-status')?.value || '';
    const searchFilter = document.getElementById('filter-search')?.value?.toLowerCase() || '';
    const priorityFilter = document.getElementById('filter-priority')?.value || '';

    let filtered = state.prospects;
    if (statusFilter === 'hot') filtered = filtered.filter(p => (p.hotLeadScore || 0) >= 85);
    else if (statusFilter) filtered = filtered.filter(p => p.status === statusFilter);
    if (searchFilter) filtered = filtered.filter(p => p.hotelName.toLowerCase().includes(searchFilter) || (p.location || '').toLowerCase().includes(searchFilter));
    if (priorityFilter) filtered = filtered.filter(p => p.priority === priorityFilter);

    if (filtered.length === 0) {
      tableEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◎</div><div class="empty-state-title">No prospects found</div><div class="empty-state-sub">Add prospects manually or use the Prospect Radar to discover new hotels.</div><button class="btn btn-primary btn-sm" style="margin-top:16px;" onclick="navigate('prospect-radar')">Open Radar</button></div>`;
      return;
    }

    tableEl.innerHTML = `
      <div class="table-wrap card" style="padding:0;">
        <table>
          <thead>
            <tr>
              <th>Hotel</th><th>Location</th><th>ICP</th>
              <th>Audit Score</th><th>Signal</th><th>Status</th>
              <th>Last Action</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(p => buildProspectRow(p)).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    tableEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div><div class="empty-state-sub">${err.message}</div></div>`;
  }
}

function buildProspectRow(p) {
  const overallScore = p.auditScore || p.icpFitScore || 0;
  return `
    <tr onclick="openProspectDetail('${p.id}')" style="cursor:pointer;">
      <td>
        <div class="td-hotel">${p.hotelName}</div>
        <div class="text-dim" style="font-size:11px;">${p.website ? `<a href="${p.website}" target="_blank" onclick="event.stopPropagation()">${p.website.replace('https://','').replace('www.','').slice(0,30)}</a>` : '—'}</div>
      </td>
      <td>${p.location || '—'}</td>
      <td>${icpTier(p.icpFitScore || 0)}</td>
      <td>${p.commercialUpsideScore ? `<span style="color:${scoreColor(p.commercialUpsideScore)}">${p.commercialUpsideScore}</span>` : '—'}</td>
      <td>${signalPill(p.hotLeadScore || 0)}</td>
      <td>${statusBadge(p.status)}</td>
      <td>${relativeTime(p.lastActionAt)}</td>
      <td onclick="event.stopPropagation()">
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-xs" onclick="runResearch('${p.id}')">Research</button>
          <button class="btn btn-gold btn-xs" onclick="openAuditFor('${p.id}')">Audit</button>
          <button class="btn btn-secondary btn-xs" onclick="openEmailStudioFor('${p.id}')">Email</button>
        </div>
      </td>
    </tr>`;
}

async function openProspectDetail(id) {
  const overlay = document.getElementById('drawer-overlay');
  const drawer = document.getElementById('drawer');
  const drawerContent = document.getElementById('drawer-content');

  overlay.classList.add('open');
  drawer.classList.add('open');
  drawerContent.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  try {
    const data = await get(`/api/prospects/${id}`);
    const p = data.prospect;
    state.selectedProspect = p;

    const latestAudit = (data.audits || []).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    drawerContent.innerHTML = `
      <div class="drawer-header">
        <div>
          <div class="page-label" style="margin-bottom:4px;">Prospect Detail</div>
          <div class="drawer-title">${p.hotelName}</div>
        </div>
        <button class="drawer-close" onclick="closeDrawer()">✕</button>
      </div>

      <div class="flex gap-8 mb-16" style="margin-bottom:14px;flex-wrap:wrap;">
        ${statusBadge(p.status)}
        ${signalPill(p.hotLeadScore || 0)}
        ${icpTier(p.icpFitScore || 0)}
      </div>

      <div class="detail-field"><div class="detail-field-label">Website</div><div class="detail-field-value">${p.website ? `<a href="${p.website}" target="_blank">${p.website} ↗</a>` : '—'}</div></div>
      <div class="detail-field"><div class="detail-field-label">Location</div><div class="detail-field-value">${p.location || '—'}</div></div>
      <div class="detail-field"><div class="detail-field-label">Segment</div><div class="detail-field-value">${p.segment || '—'}</div></div>
      <div class="detail-field"><div class="detail-field-label">Contact Email</div><div class="detail-field-value">${p.contactEmail || '—'}</div></div>
      <div class="detail-field"><div class="detail-field-label">Contact Person</div><div class="detail-field-value">${p.contactPerson || '—'}</div></div>
      <div class="detail-field"><div class="detail-field-label">Recommended Angle</div><div class="detail-field-value text-gold">${p.recommendedAngle || '—'}</div></div>
      <div class="detail-field"><div class="detail-field-label">Notes</div><div class="detail-field-value">${p.notes || '—'}</div></div>

      ${latestAudit ? `
        <div class="separator"></div>
        <div class="card-label" style="margin-bottom:12px;">Latest Audit</div>
        ${Object.entries(latestAudit.scores || {}).map(([k, v]) =>
          scoreBar(k.replace(/([A-Z])/g, ' $1').trim(), v)
        ).join('')}
        <div class="mt-16 flex gap-8">
          <a href="${latestAudit.pdfUrl}" target="_blank" class="btn btn-gold btn-sm">View PDF Audit ↗</a>
        </div>
      ` : ''}

      ${(data.tasks || []).length > 0 ? `
        <div class="separator"></div>
        <div class="card-label" style="margin-bottom:12px;">Open Tasks</div>
        ${data.tasks.map(t => `<div class="task-card" style="margin-bottom:8px;"><div class="task-card-body"><div class="task-card-title">${t.title}</div><div class="task-card-reason">${t.reason}</div></div>${dueLabel(t.dueAt)}</div>`).join('')}
      ` : ''}

      <div class="separator"></div>
      <div class="flex gap-8" style="flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="runResearch('${p.id}')">Run Research</button>
        <button class="btn btn-gold btn-sm" onclick="openAuditFor('${p.id}');closeDrawer()">Generate Audit</button>
        <button class="btn btn-primary btn-sm" onclick="openEmailStudioFor('${p.id}');closeDrawer()">Open Email Studio</button>
      </div>

      <div class="separator"></div>
      <div class="card-label" style="margin-bottom:10px;">Edit Prospect</div>
      <div class="form-group">
        <label class="form-label">Contact Email</label>
        <input id="edit-email" type="email" value="${p.contactEmail || ''}" placeholder="email@hotel.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Contact Person</label>
        <input id="edit-contact" type="text" value="${p.contactPerson || ''}" placeholder="Name" />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea id="edit-notes" rows="3">${p.notes || ''}</textarea>
      </div>
      <button class="btn btn-primary btn-sm" onclick="saveProspectEdits('${p.id}')">Save Changes</button>
    `;
  } catch (err) {
    drawerContent.innerHTML = `<div class="empty-state"><div class="empty-state-sub">${err.message}</div></div>`;
  }
}

async function saveProspectEdits(id) {
  try {
    await patch(`/api/prospects/${id}`, {
      contactEmail: document.getElementById('edit-email')?.value,
      contactPerson: document.getElementById('edit-contact')?.value,
      notes: document.getElementById('edit-notes')?.value,
    });
    toast('Prospect updated', 'success');
    if (typeof loadProspects === 'function') loadProspects();
  } catch (err) { toast(err.message, 'error'); }
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
}

async function runResearch(id) {
  try {
    toast('Starting website research...', 'info', 5000);
    const result = await post('/api/research/prospect', { prospectId: id });
    toast(`Research complete. ${result.crawl?.emailsFound?.length || 0} emails found.`, 'success', 5000);
    if (state.currentScreen === 'prospects') loadProspects();
  } catch (err) { toast(`Research failed: ${err.message}`, 'error', 6000); }
}

function openAuditFor(id) {
  navigate('audit-workspace', { prospectId: id });
}

function openEmailStudioFor(id) {
  navigate('email-studio', { prospectId: id });
}

function openAddProspectModal() {
  const modal = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div class="modal-title">Add Prospect</div>
    <div class="form-group"><label class="form-label">Hotel Name *</label><input id="add-hotel-name" type="text" placeholder="Grand Hotel Bodrum" /></div>
    <div class="form-group"><label class="form-label">Website</label><input id="add-hotel-website" type="text" placeholder="https://hotelname.com" /></div>
    <div class="input-row">
      <div class="form-group"><label class="form-label">Location</label><input id="add-hotel-location" type="text" placeholder="Bodrum, Turkey" /></div>
      <div class="form-group"><label class="form-label">Segment</label>
        <select id="add-hotel-segment"><option value="">Select</option><option>luxury</option><option>boutique</option><option>independent</option><option>resort</option></select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Contact Email</label><input id="add-hotel-email" type="email" placeholder="reservations@hotel.com" /></div>
    <div class="form-group"><label class="form-label">Notes</label><textarea id="add-hotel-notes" rows="2" placeholder="How did you find them? Any context..."></textarea></div>
    <div class="flex gap-8">
      <button class="btn btn-primary" onclick="submitAddProspect()">Add Prospect</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`;
  modal.classList.add('open');
}

async function submitAddProspect() {
  const name = document.getElementById('add-hotel-name')?.value?.trim();
  if (!name) { toast('Hotel name required', 'error'); return; }
  try {
    await post('/api/prospects', {
      hotelName: name,
      website: document.getElementById('add-hotel-website')?.value?.trim(),
      location: document.getElementById('add-hotel-location')?.value?.trim(),
      segment: document.getElementById('add-hotel-segment')?.value,
      contactEmail: document.getElementById('add-hotel-email')?.value?.trim(),
      notes: document.getElementById('add-hotel-notes')?.value?.trim(),
      source: 'manual',
    });
    toast(`${name} added`, 'success');
    closeModal();
    if (state.currentScreen === 'prospects') loadProspects();
  } catch (err) { toast(err.message, 'error'); }
}

async function exportProspects() {
  try {
    const data = await get('/api/prospects');
    const ps = data.prospects || [];
    const headers = ['Hotel', 'Website', 'Location', 'Segment', 'ICP Score', 'Status', 'Contact Email', 'Hot Lead Score', 'Created'];
    const rows = ps.map(p => [
      p.hotelName, p.website, p.location, p.segment,
      p.icpFitScore, p.status, p.contactEmail, p.hotLeadScore,
      formatDate(p.createdAt),
    ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `koaland-prospects-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast('Exported', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ─── SCREEN 4: AUDIT WORKSPACE ───────────────────────────────────
async function renderAuditWorkspace(main, params = {}) {
  const prospects = state.prospects.length ? state.prospects : (await get('/api/prospects').catch(() => ({ prospects: [] }))).prospects;

  main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-label">Intelligence Engine</div>
        <div class="page-title">Audit Workspace</div>
        <div class="page-subtitle">Run live digital experience audits and convert findings into outreach assets</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:20px;">
      <div class="card-title">Configure Audit</div>
      <div class="input-row" style="margin-bottom:12px;">
        <div class="form-group">
          <label class="form-label">Prospect</label>
          <select id="audit-prospect-id">
            <option value="">Select prospect...</option>
            ${prospects.map(p => `<option value="${p.id}" ${params.prospectId === p.id ? 'selected' : ''}>${p.hotelName} — ${p.location || p.website || ''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Audit Depth</label>
          <select id="audit-depth">
            <option value="quick">Quick Snapshot</option>
            <option value="full" selected>Full Audit</option>
            <option value="competitive">Competitive Audit</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Competitor URLs (optional, comma separated)</label>
        <input id="audit-competitors" type="text" placeholder="https://competitor1.com, https://competitor2.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Notes for AI Auditor</label>
        <input id="audit-notes" type="text" placeholder="Any specific focus areas or context..." />
      </div>
      <button class="btn btn-primary" id="run-audit-btn" onclick="runAudit()">
        ◎ Run Audit
      </button>
    </div>
    <div id="audit-result"></div>
  `;
}

async function runAudit() {
  const prospectId = document.getElementById('audit-prospect-id')?.value;
  const depth = document.getElementById('audit-depth')?.value || 'full';
  const competitorRaw = document.getElementById('audit-competitors')?.value || '';
  const notes = document.getElementById('audit-notes')?.value || '';
  const btn = document.getElementById('run-audit-btn');
  const resultEl = document.getElementById('audit-result');

  if (!prospectId) { toast('Select a prospect', 'error'); return; }

  const competitorUrls = competitorRaw.split(',').map(u => u.trim()).filter(Boolean);

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running audit — this takes 30–60 seconds...';
  resultEl.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <div>Crawling website...</div>
      <div class="text-dim" style="font-size:11px;margin-top:8px;">Running PageSpeed · Analyzing with AI · Generating PDF</div>
    </div>`;

  try {
    const data = await post('/api/audits/run', { prospectId, depth, competitorUrls, notes });
    state.selectedAudit = data;
    resultEl.innerHTML = buildAuditResult(data);
    toast('Audit complete', 'success');
  } catch (err) {
    resultEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div><div class="empty-state-title">Audit failed</div><div class="empty-state-sub">${err.message}</div></div>`;
    toast(`Audit failed: ${err.message}`, 'error', 6000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '◎ Run Audit';
  }
}

function buildAuditResult(data) {
  const scores = data.scores || {};
  const overallScore = Object.values(scores).length
    ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length)
    : 0;

  const scoreNames = {
    websiteExperience: 'Website Experience',
    seoReadiness: 'SEO Readiness',
    aeoReadiness: 'AEO Readiness',
    geoReadiness: 'GEO Readiness',
    directBookingClarity: 'Direct Booking Clarity',
    luxuryBrandConsistency: 'Luxury Brand Consistency',
    commercialUpside: 'Commercial Upside',
    confidence: 'Confidence',
  };

  return `
    <div class="grid-2" style="gap:20px;">
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Executive Snapshot</div>
          <div style="font-family:var(--serif);font-size:15px;line-height:1.7;color:var(--ivory);margin-bottom:16px;">${data.executiveSummary || ''}</div>
          <div style="display:flex;gap:20px;align-items:center;">
            <div>
              <div class="metric-label">Overall Score</div>
              <div class="metric-value" style="color:${scoreColor(overallScore)};font-size:36px;">${overallScore}</div>
            </div>
            <div class="flex-1">
              <div class="text-dim" style="font-size:12px;margin-bottom:6px;">Recommended angle:</div>
              <div style="font-size:13px;color:var(--gold);">${data.recommendedAngle || '—'}</div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Scorecard</div>
          ${Object.entries(scores).map(([k, v]) => scoreBar(scoreNames[k] || k, v)).join('')}
        </div>

        ${data.pdfUrl ? `
          <div class="card" style="background:rgba(49,92,70,0.1);border-color:rgba(49,92,70,0.3);">
            <div class="card-title">Audit Report Generated</div>
            <p style="font-size:13px;color:var(--muted-ivory);margin-bottom:14px;">The branded audit report is ready. Share the link to track views.</p>
            <div class="flex gap-8">
              <a href="${data.pdfUrl}" target="_blank" class="btn btn-gold btn-sm">View Audit Report ↗</a>
              <button class="btn btn-primary btn-sm" onclick="openEmailStudioFor('${state.selectedProspect?.id || ''}')">Generate Email →</button>
            </div>
          </div>
        ` : ''}
      </div>

      <div>
        ${data.opportunities?.length ? `
          <div class="card" style="margin-bottom:16px;">
            <div class="card-title">Top Opportunities</div>
            ${data.opportunities.slice(0, 3).map(o => `
              <div class="opportunity-card">
                <div class="opportunity-type">${o.type || ''}</div>
                <div class="opportunity-title">${o.title}</div>
                <div class="opportunity-meta">
                  <span class="tag tag-dim">Impact: ${o.impact}</span>
                  <span class="tag tag-dim">Effort: ${o.effort}</span>
                  <span class="tag tag-dim">Urgency: ${o.urgency}</span>
                </div>
                <div class="opportunity-why">${o.whyItMatters}</div>
              </div>`
            ).join('')}
          </div>
        ` : ''}

        ${data.topFindings?.length ? `
          <div class="card" style="margin-bottom:16px;">
            <div class="card-title">Key Findings</div>
            ${data.topFindings.slice(0, 4).map(f => `
              <div class="finding-card ${f.severity}">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <div class="finding-title">${f.title}</div>
                  <span class="tag ${f.severity === 'high' ? 'tag-danger' : f.severity === 'medium' ? 'tag-warning' : 'tag-green'}">${f.severity}</span>
                </div>
                <div class="finding-evidence">${f.evidence}</div>
                <div class="finding-meaning">${f.commercialMeaning}</div>
                ${f.outreachHook ? `<div class="finding-hook">→ ${f.outreachHook}</div>` : ''}
              </div>`
            ).join('')}
          </div>
        ` : ''}

        ${data.commercialLeakageRisks?.length ? `
          <div class="card">
            <div class="card-title">Commercial Leakage Risks</div>
            ${data.commercialLeakageRisks.slice(0, 3).map(r => `
              <div class="finding-card ${r.severity}">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <div class="finding-title">${r.title}</div>
                  <span class="tag ${r.severity === 'high' ? 'tag-danger' : 'tag-warning'}">${r.severity}</span>
                </div>
                <div class="finding-meaning">${r.commercialMeaning}</div>
              </div>`
            ).join('')}
          </div>
        ` : ''}
      </div>
    </div>`;
}

// ─── SCREEN 5: EMAIL STUDIO ──────────────────────────────────────
async function renderEmailStudio(main, params = {}) {
  const prospects = state.prospects.length ? state.prospects : (await get('/api/prospects').catch(() => ({ prospects: [] }))).prospects;

  main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-label">Outreach Engine</div>
        <div class="page-title">Email Studio</div>
        <div class="page-subtitle">Generate, refine, and send founder-led outreach</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:20px;">
      <div class="input-row">
        <div class="form-group">
          <label class="form-label">Prospect</label>
          <select id="email-prospect-id" onchange="loadEmailContext()">
            <option value="">Select prospect...</option>
            ${prospects.map(p => `<option value="${p.id}" ${params.prospectId === p.id ? 'selected' : ''}>${p.hotelName}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Email Type</label>
          <select id="email-type">
            <option value="initial">Initial Outreach</option>
            <option value="followup_1">Follow-up 1 — Gentle</option>
            <option value="followup_2">Follow-up 2 — Specific Finding</option>
            <option value="followup_3">Follow-up 3 — Close the Loop</option>
            <option value="pdf_opened">PDF Opened Follow-up</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Angle</label>
          <select id="email-angle">
            <option value="">Auto (from audit)</option>
            <option value="AI Search Readiness">AI Search Readiness</option>
            <option value="Direct Booking Clarity">Direct Booking Clarity</option>
            <option value="Commercial Leakage">Commercial Leakage</option>
            <option value="Luxury Website Experience">Luxury Website Experience</option>
            <option value="Competitor Gap">Competitor Gap</option>
            <option value="Quiet Founder Note">Quiet Founder Note</option>
            <option value="OTA Vulnerability">OTA Vulnerability</option>
          </select>
        </div>
        <div class="form-group" style="align-self:flex-end;">
          <button class="btn btn-primary" id="gen-email-btn" onclick="generateEmails()">
            ✦ Generate Variants
          </button>
        </div>
      </div>
    </div>

    <div class="email-studio-layout">
      <div class="email-panel" id="email-left-panel">
        <div class="card-label" style="margin-bottom:12px;">Context</div>
        <div id="email-context"><div class="text-dim">Select a prospect to load context</div></div>
      </div>
      <div class="email-panel" id="email-center-panel">
        <div id="email-variants-header" class="card-label" style="margin-bottom:12px;">Email Variants</div>
        <div id="email-variants"><div class="text-dim" style="padding:20px 0;">Generate variants to see them here</div></div>
      </div>
      <div class="email-panel" id="email-right-panel">
        <div class="card-label" style="margin-bottom:12px;">Strength Score</div>
        <div id="email-strength"><div class="text-dim">No email selected</div></div>
      </div>
    </div>
  `;

  if (params.prospectId) {
    document.getElementById('email-prospect-id').value = params.prospectId;
    loadEmailContext();
  }
}

async function loadEmailContext() {
  const prospectId = document.getElementById('email-prospect-id')?.value;
  const contextEl = document.getElementById('email-context');
  if (!contextEl || !prospectId) return;

  try {
    const data = await get(`/api/prospects/${prospectId}`);
    const p = data.prospect;
    const audits = (data.audits || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latestAudit = audits[0];

    contextEl.innerHTML = `
      <div class="detail-field"><div class="detail-field-label">Hotel</div><div class="detail-field-value">${p.hotelName}</div></div>
      <div class="detail-field"><div class="detail-field-label">Location</div><div class="detail-field-value">${p.location || '—'}</div></div>
      <div class="detail-field"><div class="detail-field-label">To Email</div><div class="detail-field-value">${p.contactEmail || '<span class="text-dim">Not set</span>'}</div></div>
      <div class="detail-field"><div class="detail-field-label">Status</div><div class="detail-field-value">${statusBadge(p.status)}</div></div>
      ${latestAudit ? `
        <div class="separator"></div>
        <div class="detail-field-label" style="margin-bottom:6px;">Audit Summary</div>
        <div style="font-size:12px;color:var(--muted-ivory);line-height:1.6;">${latestAudit.executiveSummary?.slice(0, 200) || ''}...</div>
        <div style="margin-top:10px;"><a href="${latestAudit.pdfUrl}" target="_blank" class="btn btn-gold btn-xs">View Audit ↗</a></div>
        <div class="separator"></div>
        <div class="detail-field-label" style="margin-bottom:6px;">Recommended Angle</div>
        <div style="font-size:12px;color:var(--gold);">${latestAudit.recommendedAngle || '—'}</div>
      ` : `<div class="separator"></div><div class="text-dim" style="font-size:12px;">No audit yet. <a href="#" onclick="openAuditFor('${p.id}')">Run audit first</a></div>`}
    `;
  } catch (err) {
    contextEl.innerHTML = `<div class="text-dim">${err.message}</div>`;
  }
}

async function generateEmails() {
  const prospectId = document.getElementById('email-prospect-id')?.value;
  const type = document.getElementById('email-type')?.value || 'initial';
  const angle = document.getElementById('email-angle')?.value || '';
  const btn = document.getElementById('gen-email-btn');
  const variantsEl = document.getElementById('email-variants');

  if (!prospectId) { toast('Select a prospect', 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';
  variantsEl.innerHTML = '<div class="loading-state"><div class="spinner"></div> AI is writing your emails...</div>';

  try {
    const data = await post('/api/emails/generate', { prospectId, type, angle });
    state.emailVariants = data.variants || [];
    renderEmailVariants(data.variants, 0);
    toast('Email variants generated', 'success');
  } catch (err) {
    variantsEl.innerHTML = `<div class="empty-state"><div class="empty-state-sub">${err.message}</div></div>`;
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✦ Generate Variants';
  }
}

function renderEmailVariants(variants, selectedIdx) {
  const variantsEl = document.getElementById('email-variants');
  const strengthEl = document.getElementById('email-strength');
  const headerEl = document.getElementById('email-variants-header');

  if (!variants || variants.length === 0) {
    variantsEl.innerHTML = '<div class="text-dim">No variants generated</div>';
    return;
  }

  const variant = variants[selectedIdx];

  headerEl.innerHTML = `
    <div class="card-label" style="margin-bottom:12px;">Email Variants</div>
    <div style="display:flex;gap:8px;margin-bottom:14px;">
      ${variants.map((v, i) => `
        <div class="email-variant-tab ${i === selectedIdx ? 'active' : ''}" onclick="renderEmailVariants(window._variants, ${i})">
          <div class="email-variant-name">${v.name || `Variant ${i+1}`}</div>
          <div class="email-variant-angle">${v.angle || ''}</div>
        </div>`
      ).join('')}
    </div>
  `;

  window._variants = variants;

  variantsEl.innerHTML = `
    <div class="card-label" style="margin-bottom:8px;">Subject Lines</div>
    <div style="margin-bottom:14px;">
      ${(variant.subjectOptions || []).map((s, i) => `
        <div class="subject-option ${i === 0 ? 'selected' : ''}" onclick="selectSubject(this, '${s.replace(/'/g,"\\'")}')">
          ${s}
        </div>`
      ).join('')}
    </div>
    <div class="card-label" style="margin-bottom:8px;">Email Body</div>
    <textarea class="email-body-editor" id="email-body-text">${variant.body || ''}</textarea>
    <div style="margin-top:6px;font-size:11px;color:var(--dim-text);">${(variant.body || '').split('\n').length} lines · ${(variant.body || '').length} chars</div>
    <div class="flex gap-8" style="margin-top:14px;flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" onclick="sendEmailNow()">Send Live</button>
      <button class="btn btn-secondary btn-sm" onclick="sendTestEmail()">Send Test</button>
      <button class="btn btn-gold btn-sm" onclick="copyEmail()">Copy to Clipboard</button>
    </div>
    ${variant.whyThisWorks ? `<div class="insight-card" style="margin-top:12px;">${variant.whyThisWorks}</div>` : ''}
  `;

  // Strength score
  const ss = variant.strengthScore || {};
  strengthEl.innerHTML = `
    <div class="strength-row"><span class="strength-label">Personalization</span><span class="strength-val" style="color:${scoreColor(ss.personalization||0)}">${ss.personalization || 0}/100</span></div>
    <div class="strength-row"><span class="strength-label">Clarity</span><span class="strength-val" style="color:${scoreColor(ss.clarity||0)}">${ss.clarity || 0}/100</span></div>
    <div class="strength-row"><span class="strength-label">Commercial Hook</span><span class="strength-val" style="color:${scoreColor(ss.commercialHook||0)}">${ss.commercialHook || 0}/100</span></div>
    <div class="strength-row"><span class="strength-label">Length</span><span class="strength-val">${ss.lengthScore || 0}/100</span></div>
    <div class="strength-row"><span class="strength-label">Spam Risk</span><span class="strength-val ${ss.spamRisk === 'low' ? 'text-green' : ss.spamRisk === 'high' ? 'text-danger' : ''}">${ss.spamRisk || '—'}</span></div>
    <div class="strength-row"><span class="strength-label">CTA Strength</span><span class="strength-val">${ss.ctaStrength || '—'}</span></div>
  `;
}

function selectSubject(el, subject) {
  document.querySelectorAll('.subject-option').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  window._selectedSubject = subject;
}

async function sendEmailNow() {
  const prospectId = document.getElementById('email-prospect-id')?.value;
  const body = document.getElementById('email-body-text')?.value;
  const subject = window._selectedSubject || document.querySelector('.subject-option.selected')?.textContent?.trim() || 'Digital experience snapshot';

  if (!prospectId) { toast('Select a prospect', 'error'); return; }
  if (!body) { toast('Email body is empty', 'error'); return; }

  try {
    const pData = await get(`/api/prospects/${prospectId}`);
    const prospect = pData.prospect;
    if (!prospect.contactEmail) { toast('No contact email set for this prospect', 'error'); return; }

    if (!confirm(`Send email to ${prospect.contactEmail}?\n\nSubject: ${subject}`)) return;

    const result = await post('/api/emails/send', {
      prospectId,
      to: prospect.contactEmail,
      subject,
      body,
      type: document.getElementById('email-type')?.value || 'initial',
      angle: document.getElementById('email-angle')?.value || '',
    });
    toast(`Email sent to ${prospect.contactEmail}`, 'success', 5000);
  } catch (err) { toast(err.message, 'error'); }
}

async function sendTestEmail() {
  const prospectId = document.getElementById('email-prospect-id')?.value;
  const body = document.getElementById('email-body-text')?.value;
  const subject = window._selectedSubject || 'Test — Digital experience snapshot';

  if (!prospectId || !body) { toast('Select prospect and ensure body is not empty', 'error'); return; }

  try {
    await post('/api/emails/send', {
      prospectId,
      to: 'test@test.com',
      subject,
      body,
      type: document.getElementById('email-type')?.value || 'initial',
      isTest: true,
    });
    toast('Test email sent to your configured test address', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

async function copyEmail() {
  const body = document.getElementById('email-body-text')?.value || '';
  await navigator.clipboard.writeText(body);
  toast('Copied to clipboard', 'success');
}

// ─── SCREEN 6: CAMPAIGNS & MAILING ──────────────────────────────
let _campaignTab = 'campaigns';

async function renderCampaigns(main) {
  main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-label">Outbound Operations</div>
        <div class="page-title">Campaigns & Mailing</div>
        <div class="page-subtitle">Group contacts by market and angle — compose, send, and track personalised outbound sequences</div>
      </div>
      <div class="flex gap-8" id="camp-header-actions">
        <button class="btn btn-primary btn-sm" onclick="openCreateCampaignModal()">+ New Campaign</button>
      </div>
    </div>
    <div class="screen-tabs">
      <div class="screen-tab active" id="tab-campaigns" onclick="switchCampaignTab('campaigns')">◉ Campaigns</div>
      <div class="screen-tab" id="tab-contacts" onclick="switchCampaignTab('contacts')">✉ Mailing Contacts</div>
    </div>
    <div id="campaign-tab-content"></div>
  `;
  await showCampaignTab('campaigns');
}

async function switchCampaignTab(tab) {
  _campaignTab = tab;
  document.querySelectorAll('.screen-tab').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tab}`);
  });
  const actions = document.getElementById('camp-header-actions');
  if (actions) {
    actions.innerHTML = tab === 'campaigns'
      ? `<button class="btn btn-primary btn-sm" onclick="openCreateCampaignModal()">+ New Campaign</button>`
      : `<button class="btn btn-primary btn-sm" onclick="openAddContactModal('')">+ Add Contact</button>`;
  }
  await showCampaignTab(tab);
}

async function showCampaignTab(tab) {
  const content = document.getElementById('campaign-tab-content');
  if (!content) return;
  if (tab === 'campaigns') await renderCampaignsList(content);
  else await renderMailingContacts(content);
}

// ─── CAMPAIGNS TAB ───────────────────────────────────────────────
async function renderCampaignsList(container) {
  container.innerHTML = `
    <div class="explainer-card" style="margin-bottom:20px;">
      <div class="explainer-icon">◉</div>
      <div>
        <div class="explainer-title">What is a Campaign?</div>
        <div class="explainer-body">A campaign is a focused mailing group — add contacts by market and angle, then send personalised emails to each one. Track who's been contacted, opened, and replied all in one place. Use <strong style="color:var(--text)">Mailing Contacts</strong> tab to add recipients directly without running a full audit.</div>
      </div>
    </div>
    <div id="campaigns-list-inner"><div class="loading-state"><div class="spinner"></div></div></div>
  `;
  await loadCampaigns();
}

async function loadCampaigns() {
  const el = document.getElementById('campaigns-list-inner');
  if (!el) return;
  try {
    const [campData, contactData] = await Promise.all([get('/api/campaigns'), get('/api/contacts')]);
    const campaigns = campData.campaigns || [];
    const contacts = contactData.contacts || [];
    if (!campaigns.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">◉</div>
          <div class="empty-state-title">No campaigns yet</div>
          <div class="empty-state-sub">Create a campaign to group your outreach by market, segment, and angle. Then add contacts and send.</div>
          <button class="btn btn-primary btn-sm" style="margin-top:16px;" onclick="openCreateCampaignModal()">+ Create Campaign</button>
        </div>`;
      return;
    }
    el.innerHTML = campaigns.map(c => buildCampaignCardV2(c, contacts.filter(x => x.campaignId === c.id))).join('');
  } catch (err) { el.innerHTML = `<div class="empty-state"><div class="empty-state-sub">${err.message}</div></div>`; }
}

function buildCampaignCardV2(c, contacts) {
  const sent = contacts.filter(x => ['sent','opened','replied'].includes(x.status)).length;
  const opened = contacts.filter(x => x.status === 'opened').length;
  const replied = contacts.filter(x => x.status === 'replied').length;
  const pending = contacts.filter(x => !x.status || x.status === 'not_sent').length;
  const pct = contacts.length ? Math.round((sent / contacts.length) * 100) : 0;
  const isActive = !c.status || c.status === 'active';
  const statusStyle = isActive ? 'background:var(--green-dim);color:var(--green);' : 'background:var(--orange-dim);color:var(--orange);';

  return `
    <div class="campaign-card-v2" id="camp-card-${c.id}">
      <div class="campaign-card-v2-header" onclick="toggleCampaignContacts('${c.id}')">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <div class="campaign-card-name">${c.name}</div>
            <span class="tag" style="${statusStyle}">${isActive ? 'Active' : 'Paused'}</span>
          </div>
          <div class="campaign-card-meta">
            ${[c.market, c.segment, c.angle ? `Angle: ${c.angle}` : '', `Limit: ${c.dailySendLimit||10}/day`].filter(Boolean).join(' · ')}
          </div>
          <div style="display:flex;align-items:center;gap:14px;margin-top:14px;flex-wrap:wrap;">
            <div style="flex:1;min-width:80px;">
              <div style="height:4px;background:var(--surface-3);border-radius:99px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:var(--blue);border-radius:99px;transition:width 0.5s;"></div>
              </div>
              <div style="font-size:10px;color:var(--dim-text);margin-top:4px;">${pct}% contacted</div>
            </div>
            <div style="display:flex;gap:16px;">
              <div class="cp-stat"><div class="cp-val">${contacts.length}</div><div class="cp-lbl">Contacts</div></div>
              <div class="cp-stat"><div class="cp-val" style="color:var(--muted-text);">${pending}</div><div class="cp-lbl">Pending</div></div>
              <div class="cp-stat"><div class="cp-val" style="color:var(--blue-light);">${sent}</div><div class="cp-lbl">Sent</div></div>
              <div class="cp-stat"><div class="cp-val" style="color:var(--gold);">${opened}</div><div class="cp-lbl">Opened</div></div>
              <div class="cp-stat"><div class="cp-val" style="color:var(--green);">${replied}</div><div class="cp-lbl">Replied</div></div>
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;flex-shrink:0;margin-left:16px;">
          <div style="font-size:11px;color:var(--dim-text);" id="camp-arrow-${c.id}">▼ Show contacts</div>
          <div class="flex gap-6" onclick="event.stopPropagation()">
            <button class="btn btn-secondary btn-xs" onclick="openAddContactModal('${c.id}')">+ Contact</button>
            <button class="btn btn-secondary btn-xs" onclick="toggleCampaignStatus('${c.id}','${c.status||'active'}')">
              ${isActive ? 'Pause' : 'Resume'}
            </button>
          </div>
        </div>
      </div>
      <div class="campaign-card-body" id="camp-body-${c.id}">
        ${buildCampaignContactRows(c.id, contacts)}
      </div>
    </div>`;
}

function buildCampaignContactRows(campaignId, contacts) {
  if (!contacts.length) return `
    <div style="padding:20px 0;text-align:center;color:var(--dim-text);font-size:13px;">
      No contacts yet —
      <button class="btn btn-secondary btn-xs" style="margin-left:6px;" onclick="openAddContactModal('${campaignId}')">Add first contact</button>
      <span style="margin:0 6px;">or</span>
      <button class="btn btn-secondary btn-xs" onclick="switchCampaignTab('contacts')">Go to Mailing Contacts</button>
    </div>`;

  const rows = contacts.map(ct => `
    <tr>
      <td><div style="font-weight:500;color:var(--text);">${ct.hotelName || '—'}</div>${ct.location ? `<div style="font-size:11px;color:var(--dim-text);">${ct.location}</div>` : ''}</td>
      <td>${ct.contactName || '—'}</td>
      <td><span style="color:var(--muted-text);font-size:12px;">${ct.email || '—'}</span></td>
      <td>${ct.role || '—'}</td>
      <td><span class="contact-status ${ct.status||'not_sent'}">${formatContactStatus(ct.status)}</span></td>
      <td onclick="event.stopPropagation()">
        <div class="flex gap-6">
          <button class="btn btn-primary btn-xs" onclick="openContactComposeModal('${ct.id}')">Send Email</button>
          <button class="btn btn-secondary btn-xs" onclick="deleteContact('${ct.id}')">✕</button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <div style="padding:16px 0 4px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--dim-text);font-weight:600;">${contacts.length} Contacts</div>
        <button class="btn btn-secondary btn-xs" onclick="exportCampaignContacts('${campaignId}')">Export CSV</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Hotel</th><th>Contact</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function formatContactStatus(s) {
  const m = { not_sent: 'Not Sent', sent: '✓ Sent', opened: '👁 Opened', replied: '↩ Replied', bounced: '✗ Bounced' };
  return m[s] || 'Not Sent';
}

function toggleCampaignContacts(id) {
  const body = document.getElementById(`camp-body-${id}`);
  const arrow = document.getElementById(`camp-arrow-${id}`);
  if (!body) return;
  const open = body.classList.toggle('open');
  if (arrow) arrow.textContent = open ? '▲ Hide contacts' : '▼ Show contacts';
}

async function toggleCampaignStatus(id, currentStatus) {
  const newStatus = currentStatus === 'paused' ? 'active' : 'paused';
  try {
    await patch(`/api/campaigns/${id}`, { status: newStatus });
    toast(`Campaign ${newStatus}`, 'success');
    loadCampaigns();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── CREATE CAMPAIGN MODAL ───────────────────────────────────────
function openCreateCampaignModal() {
  const modal = document.getElementById('modal-overlay');
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">New Campaign</div>
    <div style="font-size:12.5px;color:var(--muted-text);margin-bottom:20px;line-height:1.6;">A campaign groups mailing contacts by market and angle. Create it first, then add contacts — or add contacts directly from the Mailing Contacts tab.</div>
    <div class="form-group"><label class="form-label">Campaign Name *</label><input id="camp-name" type="text" placeholder="Bodrum Luxury — Q3" /></div>
    <div class="input-row">
      <div class="form-group"><label class="form-label">Market / Region</label><input id="camp-market" type="text" placeholder="Bodrum, Turkey" /></div>
      <div class="form-group"><label class="form-label">Hotel Segment</label><input id="camp-segment" type="text" placeholder="Boutique / Luxury" /></div>
    </div>
    <div class="form-group"><label class="form-label">Default Outreach Angle</label>
      <select id="camp-angle">
        <option value="">Auto — let Email Studio decide</option>
        <option>Direct Booking Clarity</option>
        <option>AI Search Readiness</option>
        <option>Commercial Leakage</option>
        <option>Quiet Founder Note</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Daily Send Limit</label><input id="camp-limit" type="number" value="10" min="1" max="50" /></div>
    <div class="flex gap-8">
      <button class="btn btn-primary" onclick="createCampaign()">Create Campaign</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`;
  modal.classList.add('open');
}

async function createCampaign() {
  const name = document.getElementById('camp-name')?.value?.trim();
  if (!name) { toast('Campaign name required', 'error'); return; }
  try {
    await post('/api/campaigns', {
      name,
      market: document.getElementById('camp-market')?.value,
      segment: document.getElementById('camp-segment')?.value,
      angle: document.getElementById('camp-angle')?.value,
      dailySendLimit: parseInt(document.getElementById('camp-limit')?.value) || 10,
      status: 'active',
    });
    toast('Campaign created', 'success');
    closeModal();
    loadCampaigns();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── ADD CONTACT MODAL ───────────────────────────────────────────
async function openAddContactModal(campaignId) {
  const modal = document.getElementById('modal-overlay');
  modal.classList.add('open');
  document.getElementById('modal-content').innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  const campData = await get('/api/campaigns').catch(() => ({ campaigns: [] }));
  const camps = campData.campaigns || [];
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">Add Mailing Contact</div>
    <div style="font-size:12.5px;color:var(--muted-text);margin-bottom:20px;line-height:1.6;">Add a hotel contact for direct email outreach — no audit or prospect workflow required. Click <strong style="color:var(--text);">Send Email</strong> after adding to compose and send.</div>
    <div class="input-row">
      <div class="form-group"><label class="form-label">Hotel Name *</label><input id="c-hotel" type="text" placeholder="Villa Bodrum" /></div>
      <div class="form-group"><label class="form-label">Contact Name</label><input id="c-name" type="text" placeholder="Ali Kaya" /></div>
    </div>
    <div class="input-row">
      <div class="form-group"><label class="form-label">Email Address *</label><input id="c-email" type="email" placeholder="ali@villabodrum.com" /></div>
      <div class="form-group"><label class="form-label">Role</label>
        <select id="c-role">
          <option value="">— Select role —</option>
          <option>Owner</option><option>General Manager</option><option>Marketing Manager</option>
          <option>Revenue Manager</option><option>Director</option><option>Other</option>
        </select>
      </div>
    </div>
    <div class="input-row">
      <div class="form-group"><label class="form-label">Location</label><input id="c-location" type="text" placeholder="Bodrum, Turkey" /></div>
      <div class="form-group"><label class="form-label">Assign to Campaign</label>
        <select id="c-campaign">
          <option value="">No campaign</option>
          ${camps.map(c => `<option value="${c.id}" ${c.id === campaignId ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><textarea id="c-notes" rows="2" placeholder="How you found them, what angle to use, any context..."></textarea></div>
    <div class="flex gap-8">
      <button class="btn btn-primary" onclick="submitAddContact()">Add Contact</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`;
}

async function submitAddContact() {
  const hotel = document.getElementById('c-hotel')?.value?.trim();
  const email = document.getElementById('c-email')?.value?.trim();
  if (!hotel) { toast('Hotel name required', 'error'); return; }
  if (!email) { toast('Email address required', 'error'); return; }
  try {
    await post('/api/contacts', {
      hotelName: hotel,
      contactName: document.getElementById('c-name')?.value?.trim(),
      email,
      role: document.getElementById('c-role')?.value,
      location: document.getElementById('c-location')?.value?.trim(),
      campaignId: document.getElementById('c-campaign')?.value || '',
      notes: document.getElementById('c-notes')?.value?.trim(),
      status: 'not_sent',
    });
    toast(`${hotel} added`, 'success');
    closeModal();
    if (_campaignTab === 'campaigns') loadCampaigns();
    else loadContacts();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteContact(id) {
  if (!confirm('Remove this contact?')) return;
  try {
    await del(`/api/contacts/${id}`);
    toast('Contact removed', 'info');
    if (_campaignTab === 'campaigns') loadCampaigns();
    else loadContacts();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── CONTACT COMPOSE MODAL ───────────────────────────────────────
async function openContactComposeModal(contactId) {
  const modal = document.getElementById('modal-overlay');
  modal.classList.add('open');
  document.getElementById('modal-content').innerHTML = `<div class="loading-state"><div class="spinner"></div> Preparing email variants...</div>`;
  try {
    const data = await get('/api/contacts');
    const contact = (data.contacts || []).find(c => c.id === contactId);
    if (!contact) throw new Error('Contact not found');

    const { variants } = mockEmailVariants({ hotelName: contact.hotelName, location: contact.location || '' });
    window._contactVariants = variants;
    window._currentContactId = contactId;

    document.getElementById('modal-content').innerHTML = `
      <div class="modal-title">Compose — ${contact.contactName || contact.hotelName}</div>
      <div style="font-size:12px;color:var(--dim-text);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        <span>📧 ${contact.email}</span>
        ${contact.role ? `<span class="tag tag-dim">${contact.role}</span>` : ''}
        ${contact.campaignId ? '' : ''}
      </div>
      <div style="display:grid;grid-template-columns:200px 1fr;gap:14px;margin-bottom:16px;">
        <div>
          <div class="form-label" style="margin-bottom:8px;">Variants</div>
          ${variants.map((v, i) => `
            <div class="compose-variant-row ${i === 0 ? 'selected' : ''}" onclick="selectContactVariant(${i})">
              <div class="compose-variant-name">${v.name}</div>
              <div class="compose-variant-angle">${v.angle}</div>
            </div>`).join('')}
          <div style="margin-top:12px;padding:10px;background:var(--blue-dim);border-radius:var(--radius-sm);border:1px solid rgba(79,142,247,0.15);">
            <div style="font-size:11px;color:var(--blue-light);font-weight:600;margin-bottom:4px;">Pro tip</div>
            <div style="font-size:11px;color:var(--muted-text);line-height:1.5;">Add this hotel as a Prospect and use Email Studio for full AI-generated emails based on a real website audit.</div>
          </div>
        </div>
        <div>
          <div class="form-label" style="margin-bottom:6px;">Subject</div>
          <input id="contact-subject" type="text" value="${variants[0]?.subjectOptions?.[0] || ''}" style="margin-bottom:12px;" />
          <div class="form-label" style="margin-bottom:6px;">Email Body</div>
          <textarea id="contact-body" rows="11" style="font-family:'Courier New',monospace;font-size:12px;line-height:1.65;">${variants[0]?.body || ''}</textarea>
        </div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-primary" onclick="sendEmailToContact('${contactId}')">Send Email ↗</button>
        <button class="btn btn-secondary" onclick="copyContactEmail()">Copy</button>
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      </div>`;
  } catch (err) {
    document.getElementById('modal-content').innerHTML = `<div class="modal-title">Error</div><p style="color:var(--red);margin-bottom:16px;">${err.message}</p><button class="btn btn-secondary" onclick="closeModal()">Close</button>`;
  }
}

function selectContactVariant(idx) {
  const variants = window._contactVariants || [];
  const v = variants[idx];
  if (!v) return;
  document.querySelectorAll('.compose-variant-row').forEach((el, i) => el.classList.toggle('selected', i === idx));
  const subj = document.getElementById('contact-subject');
  const body = document.getElementById('contact-body');
  if (subj) subj.value = v.subjectOptions?.[0] || '';
  if (body) body.value = v.body || '';
}

async function sendEmailToContact(contactId) {
  const subject = document.getElementById('contact-subject')?.value?.trim();
  const body = document.getElementById('contact-body')?.value?.trim();
  if (!subject) { toast('Subject required', 'error'); return; }
  if (!body) { toast('Email body empty', 'error'); return; }
  try {
    const data = await get('/api/contacts');
    const contact = (data.contacts || []).find(c => c.id === contactId);
    if (!contact) throw new Error('Contact not found');
    if (!confirm(`Send email to ${contact.email}?\n\nSubject: ${subject}`)) return;
    await post('/api/emails/send', { to: contact.email, subject, body, type: 'initial' });
    await patch(`/api/contacts/${contactId}`, { status: 'sent', sentAt: new Date().toISOString() });
    toast(`Email sent to ${contact.email}`, 'success', 5000);
    closeModal();
    if (_campaignTab === 'campaigns') loadCampaigns();
    else loadContacts();
  } catch (err) { toast(err.message, 'error'); }
}

async function copyContactEmail() {
  const body = document.getElementById('contact-body')?.value || '';
  await navigator.clipboard.writeText(body);
  toast('Copied to clipboard', 'success');
}

async function exportCampaignContacts(campaignId) {
  try {
    const data = await get('/api/contacts');
    const contacts = (data.contacts || []).filter(c => !campaignId || c.campaignId === campaignId);
    const headers = ['Hotel', 'Contact Name', 'Email', 'Role', 'Location', 'Status', 'Notes'];
    const rows = contacts.map(c => [c.hotelName, c.contactName, c.email, c.role, c.location, c.status, c.notes]
      .map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `koaland-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast('Contacts exported', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

// ─── MAILING CONTACTS TAB ───────────────────────────────────────
async function renderMailingContacts(container) {
  const campData = await get('/api/campaigns').catch(() => ({ campaigns: [] }));
  const campaigns = campData.campaigns || [];
  container.innerHTML = `
    <div class="explainer-card" style="border-color:rgba(52,211,153,0.2);background:rgba(52,211,153,0.04);margin-bottom:20px;">
      <div class="explainer-icon">✉</div>
      <div>
        <div class="explainer-title" style="color:var(--green);">Direct Mailing Contacts</div>
        <div class="explainer-body">Add hotel contacts here for direct email outreach — no audit or full prospect workflow needed. Enter a hotel name, email, and role. Assign to a campaign to organise your sends. Click <strong style="color:var(--text);">Send Email</strong> on any row to compose and send immediately.</div>
      </div>
    </div>
    <div class="card" style="padding:12px 18px;margin-bottom:14px;">
      <div class="flex gap-10" style="flex-wrap:wrap;align-items:center;">
        <input id="contact-search" type="text" placeholder="Search hotel, name, or email..." oninput="loadContacts()" style="flex:1;min-width:160px;height:36px;" />
        <select id="contact-filter-campaign" onchange="loadContacts()" style="width:190px;flex:none;height:36px;">
          <option value="">All campaigns</option>
          <option value="none">No campaign</option>
          ${campaigns.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
        <select id="contact-filter-status" onchange="loadContacts()" style="width:140px;flex:none;height:36px;">
          <option value="">All statuses</option>
          <option value="not_sent">Not Sent</option>
          <option value="sent">Sent</option>
          <option value="opened">Opened</option>
          <option value="replied">Replied</option>
          <option value="bounced">Bounced</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="openAddContactModal('')">+ Add Contact</button>
      </div>
    </div>
    <div id="contacts-table-wrap"><div class="loading-state"><div class="spinner"></div></div></div>
  `;
  await loadContacts();
}

async function loadContacts() {
  const el = document.getElementById('contacts-table-wrap');
  if (!el) return;
  try {
    const [contactData, campData] = await Promise.all([get('/api/contacts'), get('/api/campaigns')]);
    let contacts = contactData.contacts || [];
    const campMap = Object.fromEntries((campData.campaigns || []).map(c => [c.id, c.name]));

    const search = document.getElementById('contact-search')?.value?.toLowerCase() || '';
    const campFilter = document.getElementById('contact-filter-campaign')?.value || '';
    const statusFilter = document.getElementById('contact-filter-status')?.value || '';

    if (search) contacts = contacts.filter(c =>
      (c.hotelName || '').toLowerCase().includes(search) ||
      (c.email || '').toLowerCase().includes(search) ||
      (c.contactName || '').toLowerCase().includes(search));
    if (campFilter === 'none') contacts = contacts.filter(c => !c.campaignId);
    else if (campFilter) contacts = contacts.filter(c => c.campaignId === campFilter);
    if (statusFilter) contacts = contacts.filter(c => (c.status || 'not_sent') === statusFilter);

    if (!contacts.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✉</div>
          <div class="empty-state-title">No contacts yet</div>
          <div class="empty-state-sub">Add contacts for direct mailing. No audit or research needed — just add and send.</div>
          <button class="btn btn-primary btn-sm" style="margin-top:16px;" onclick="openAddContactModal('')">+ Add First Contact</button>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="table-wrap card" style="padding:0;">
        <table>
          <thead>
            <tr><th>Hotel</th><th>Contact</th><th>Email</th><th>Role</th><th>Campaign</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${contacts.map(c => `
              <tr>
                <td>
                  <div style="font-weight:500;color:var(--text);">${c.hotelName || '—'}</div>
                  ${c.location ? `<div style="font-size:11px;color:var(--dim-text);">${c.location}</div>` : ''}
                </td>
                <td>${c.contactName || '—'}</td>
                <td><span style="color:var(--muted-text);font-size:12px;">${c.email || '—'}</span></td>
                <td>${c.role || '—'}</td>
                <td>${c.campaignId && campMap[c.campaignId] ? `<span class="tag tag-blue" style="font-size:11px;">${campMap[c.campaignId]}</span>` : '<span class="text-dim">—</span>'}</td>
                <td><span class="contact-status ${c.status || 'not_sent'}">${formatContactStatus(c.status)}</span></td>
                <td>
                  <div class="flex gap-6">
                    <button class="btn btn-primary btn-xs" onclick="openContactComposeModal('${c.id}')">Send Email</button>
                    <button class="btn btn-secondary btn-xs" onclick="openEditContactModal('${c.id}')">Edit</button>
                    <button class="btn btn-secondary btn-xs" onclick="deleteContact('${c.id}')">✕</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="font-size:12px;color:var(--dim-text);margin-top:10px;padding:0 4px;">${contacts.length} contact${contacts.length === 1 ? '' : 's'}</div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-sub">${err.message}</div></div>`;
  }
}

async function openEditContactModal(contactId) {
  const modal = document.getElementById('modal-overlay');
  modal.classList.add('open');
  document.getElementById('modal-content').innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  try {
    const [contactData, campData] = await Promise.all([get('/api/contacts'), get('/api/campaigns').catch(() => ({ campaigns: [] }))]);
    const contact = (contactData.contacts || []).find(c => c.id === contactId);
    if (!contact) throw new Error('Contact not found');
    const camps = campData.campaigns || [];
    document.getElementById('modal-content').innerHTML = `
      <div class="modal-title">Edit Contact</div>
      <div class="input-row">
        <div class="form-group"><label class="form-label">Hotel Name</label><input id="ec-hotel" type="text" value="${contact.hotelName || ''}" /></div>
        <div class="form-group"><label class="form-label">Contact Name</label><input id="ec-name" type="text" value="${contact.contactName || ''}" /></div>
      </div>
      <div class="input-row">
        <div class="form-group"><label class="form-label">Email</label><input id="ec-email" type="email" value="${contact.email || ''}" /></div>
        <div class="form-group"><label class="form-label">Role</label>
          <select id="ec-role">
            <option value="">—</option>
            ${['Owner','General Manager','Marketing Manager','Revenue Manager','Director','Other'].map(r => `<option ${contact.role === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="input-row">
        <div class="form-group"><label class="form-label">Location</label><input id="ec-location" type="text" value="${contact.location || ''}" /></div>
        <div class="form-group"><label class="form-label">Status</label>
          <select id="ec-status">
            ${['not_sent','sent','opened','replied','bounced'].map(s => `<option value="${s}" ${(contact.status||'not_sent') === s ? 'selected' : ''}>${formatContactStatus(s).replace(/[✓👁↩✗]\s*/,'')}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Campaign</label>
        <select id="ec-campaign">
          <option value="">No campaign</option>
          ${camps.map(c => `<option value="${c.id}" ${c.id === contact.campaignId ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label">Notes</label><textarea id="ec-notes" rows="2">${contact.notes || ''}</textarea></div>
      <div class="flex gap-8">
        <button class="btn btn-primary" onclick="saveContactEdits('${contactId}')">Save Changes</button>
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      </div>`;
  } catch (err) {
    document.getElementById('modal-content').innerHTML = `<div class="modal-title">Error</div><p style="color:var(--red);margin-bottom:16px;">${err.message}</p><button class="btn btn-secondary" onclick="closeModal()">Close</button>`;
  }
}

async function saveContactEdits(id) {
  try {
    await patch(`/api/contacts/${id}`, {
      hotelName: document.getElementById('ec-hotel')?.value?.trim(),
      contactName: document.getElementById('ec-name')?.value?.trim(),
      email: document.getElementById('ec-email')?.value?.trim(),
      role: document.getElementById('ec-role')?.value,
      location: document.getElementById('ec-location')?.value?.trim(),
      status: document.getElementById('ec-status')?.value,
      campaignId: document.getElementById('ec-campaign')?.value || '',
      notes: document.getElementById('ec-notes')?.value?.trim(),
    });
    toast('Contact updated', 'success');
    closeModal();
    if (_campaignTab === 'campaigns') loadCampaigns();
    else loadContacts();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── SCREEN 7: FOLLOW-UP QUEUE ───────────────────────────────────
async function renderFollowupQueue(main) {
  main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-label">Follow-up Intelligence</div>
        <div class="page-title">Follow-up Queue</div>
        <div class="page-subtitle">Behavior-driven follow-up actions prioritized by signal strength</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm" onclick="recalculateTasks()">↻ Recalculate</button>
      </div>
    </div>
    <div id="followup-list"><div class="loading-state"><div class="spinner"></div></div></div>
  `;
  await loadFollowupQueue();
}

async function loadFollowupQueue() {
  const el = document.getElementById('followup-list');
  if (!el) return;
  try {
    const data = await get('/api/tasks?status=open');
    const tasks = (data.tasks || []).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    if (!tasks.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✓</div><div class="empty-state-title">Queue is clear</div><div class="empty-state-sub">All follow-ups are handled. New tasks will appear as signals come in from SendGrid.</div></div>`;
      return;
    }

    // Group by overdue / today / upcoming
    const now = new Date();
    const overdue = tasks.filter(t => new Date(t.dueAt) < now && new Date(t.dueAt).toDateString() !== now.toDateString());
    const today = tasks.filter(t => new Date(t.dueAt).toDateString() === now.toDateString());
    const upcoming = tasks.filter(t => new Date(t.dueAt) > now && new Date(t.dueAt).toDateString() !== now.toDateString());

    const section = (label, tasks, color = 'var(--dim-text)') => tasks.length ? `
      <div class="card-label" style="color:${color};margin:16px 0 8px;">${label} (${tasks.length})</div>
      ${tasks.map(t => buildTaskCard(t)).join('')}` : '';

    el.innerHTML = `
      ${section('Overdue', overdue, 'var(--red)')}
      ${section('Due Today', today, 'var(--orange)')}
      ${section('Upcoming', upcoming)}
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-sub">${err.message}</div></div>`;
  }
}

async function recalculateTasks() {
  try {
    await post('/api/tasks/recalculate', {});
    toast('Tasks recalculated', 'success');
    loadFollowupQueue();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── SCREEN 8: ANALYTICS ─────────────────────────────────────────
async function renderAnalytics(main) {
  main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-label">Performance Intelligence</div>
        <div class="page-title">Analytics</div>
        <div class="page-subtitle">Understand what's working in your outbound strategy</div>
      </div>
    </div>
    <div id="analytics-content"><div class="loading-state"><div class="spinner"></div></div></div>
  `;
  try {
    const data = await get('/api/analytics');
    state.analytics = data;
    document.getElementById('analytics-content').innerHTML = buildAnalytics(data);
  } catch (err) {
    document.getElementById('analytics-content').innerHTML = `<div class="empty-state"><div class="empty-state-sub">${err.message}</div></div>`;
  }
}

function buildAnalytics(data) {
  const funnel = data.funnel || {};
  const rates = data.rates || {};
  const maxFunnel = funnel.total || 1;

  const funnelBar = (label, count, rate) => `
    <div class="funnel-bar">
      <span class="funnel-label">${label}</span>
      <div class="funnel-track"><div class="funnel-fill" style="width:${Math.round((count/maxFunnel)*100)}%"></div></div>
      <span class="funnel-count">${count}</span>
      <span class="funnel-rate">${rate}%</span>
    </div>`;

  return `
    <div class="grid-2" style="gap:20px;">
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Email Funnel</div>
          ${funnelBar('Sent', funnel.total || 0, 100)}
          ${funnelBar('Delivered', funnel.delivered || 0, rates.deliveryRate || 0)}
          ${funnelBar('Opened', funnel.opened || 0, rates.openRate || 0)}
          ${funnelBar('PDF Viewed', funnel.pdfOpened || 0, rates.pdfViewRate || 0)}
          ${funnelBar('Replied', funnel.replied || 0, rates.replyRate || 0)}
          ${funnelBar('Bounced', funnel.bounced || 0, rates.bounceRate || 0)}
        </div>

        ${data.insights?.length ? `
          <div class="card" style="margin-bottom:16px;">
            <div class="card-title">Insights</div>
            ${data.insights.map(i => `<div class="insight-card">${i}</div>`).join('')}
          </div>
        ` : ''}

        <div class="card">
          <div class="card-title">Top Commercial Themes</div>
          <div class="theme-cloud">
            ${(data.topThemes || []).map(t => `<div class="theme-tag">${t.theme}<span class="ct">${t.count}</span></div>`).join('')}
          </div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Performance by Angle</div>
          <table>
            <thead><tr><th>Angle</th><th>Sent</th><th>Open%</th><th>PDF%</th><th>Reply%</th></tr></thead>
            <tbody>
              ${(data.anglePerformance || []).map(a => `
                <tr>
                  <td style="color:var(--ivory);">${a.angle}</td>
                  <td>${a.sent}</td>
                  <td style="color:${scoreColor(a.openRate)}">${a.openRate}%</td>
                  <td style="color:${scoreColor(a.pdfViewRate)}">${a.pdfViewRate}%</td>
                  <td style="color:${scoreColor(a.replyRate*5)}">${a.replyRate}%</td>
                </tr>`
              ).join('')}
            </tbody>
          </table>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Best Subject Lines</div>
          ${(data.subjectPerformance || []).slice(0, 5).map(s => `
            <div style="padding:8px 0;border-bottom:1px solid rgba(244,239,227,0.04);">
              <div style="font-size:12.5px;color:var(--ivory);margin-bottom:2px;">${s.subject}</div>
              <div style="font-size:11px;color:${scoreColor(s.openRate)};">${s.openRate}% open · ${s.sent} sent</div>
            </div>`
          ).join('')}
        </div>

        <div class="card">
          <div class="card-title">Performance by Location</div>
          ${(data.locationPerformance || []).slice(0, 5).map(l => `
            <div style="padding:8px 0;border-bottom:1px solid rgba(244,239,227,0.04);display:flex;justify-content:space-between;">
              <div style="font-size:12.5px;color:var(--ivory);">${l.location}</div>
              <div style="font-size:11px;color:var(--dim-text);">${l.sent} sent · <span style="color:${scoreColor(l.openRate)}">${l.openRate}% open</span></div>
            </div>`
          ).join('')}
        </div>
      </div>
    </div>`;
}

// ─── SCREEN 9: SETTINGS ──────────────────────────────────────────
async function renderSettings(main) {
  main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-label">System Configuration</div>
        <div class="page-title">Settings</div>
      </div>
    </div>
    <div id="settings-content"><div class="loading-state"><div class="spinner"></div></div></div>
  `;
  try {
    const data = await get('/api/settings');
    const s = data.settings || {};
    document.getElementById('settings-content').innerHTML = buildSettings(s);
  } catch (err) {
    document.getElementById('settings-content').innerHTML = buildSettingsFallback();
  }
}

function buildSettings(s) {
  const localBanner = LOCAL_MODE ? `
    <div class="settings-section" style="border-color:rgba(185,154,97,0.3);background:rgba(185,154,97,0.05);">
      <div class="settings-section-title" style="color:var(--gold);">Local Preview Mode Active</div>
      <div style="font-size:13px;color:var(--muted-ivory);margin-bottom:14px;line-height:1.6;">Data is stored in your browser (localStorage). No emails are actually sent — Send is simulated locally. Connect Vercel to enable real AI audits, email delivery, and tracking.</div>
      <div class="flex gap-8" style="flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="exitLocalMode()">Switch to Vercel Backend</button>
        <button class="btn btn-secondary btn-sm" onclick="clearLocalData()">Clear All Local Data</button>
      </div>
    </div>` : '';
  return localBanner + `
    <div class="settings-section">
      <div class="settings-section-title">API Backend</div>
      <div class="form-group">
        <label class="form-label">Vercel API Base URL</label>
        <input id="set-api-url" type="text" value="${API_BASE}" placeholder="https://your-app.vercel.app" />
      </div>
      <div class="form-group">
        <label class="form-label">Access Token</label>
        <input id="set-token" type="password" value="${AUTH_TOKEN}" placeholder="Your dashboard access token" />
      </div>
      <button class="btn btn-primary btn-sm" onclick="saveConnectionSettings()">Save Connection</button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Brand & Sender</div>
      <div class="input-row">
        <div class="form-group"><label class="form-label">Sender Name</label><input id="set-sender-name" type="text" value="${s.senderName || 'Murat'}" /></div>
        <div class="form-group"><label class="form-label">Company</label><input id="set-company" type="text" value="${s.company || 'Koaland.ai'}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Koaland One-line Description</label><input id="set-description" type="text" value="${s.koalandDescription || ''}" /></div>
      <div class="form-group"><label class="form-label">Demo Kit Link (optional)</label><input id="set-demo-kit" type="text" value="${s.demoKitLink || ''}" placeholder="Leave empty to hide from emails" /></div>
      <div class="form-group"><label class="form-label">Calendar Link (optional)</label><input id="set-calendar" type="text" value="${s.calendarLink || ''}" placeholder="Calendly or equivalent" /></div>
      <button class="btn btn-primary btn-sm" onclick="saveBrandSettings()">Save Brand Settings</button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Email</div>
      <div class="form-group"><label class="form-label">Test Email Address</label><input id="set-test-email" type="email" value="${s.testEmailAddress || ''}" placeholder="your@email.com" /></div>
      <div class="input-row">
        <div class="form-group"><label class="form-label">Daily Send Limit</label><input id="set-daily-limit" type="number" value="${s.dailySendLimit || 10}" min="1" max="100" /></div>
        <div class="form-group"><label class="form-label">Follow-up 1 (days)</label><input id="set-fu1" type="number" value="${s.followupDelay1Days || 3}" min="1" max="14" /></div>
        <div class="form-group"><label class="form-label">Follow-up 2 (days)</label><input id="set-fu2" type="number" value="${s.followupDelay2Days || 5}" min="1" max="21" /></div>
      </div>
      <div class="form-group"><label class="form-label">Reply-to Email</label><input id="set-reply-to" type="email" value="${s.replyToEmail || ''}" /></div>
      <button class="btn btn-primary btn-sm" onclick="saveEmailSettings()">Save Email Settings</button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Export / Import</div>
      <div class="flex gap-8" style="flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="exportProspects()">Export Prospects CSV</button>
        <button class="btn btn-secondary btn-sm" onclick="exportAllJson()">Export All JSON</button>
      </div>
    </div>
  `;
}

function buildSettingsFallback() {
  return `
    <div class="settings-section">
      <div class="settings-section-title">API Backend</div>
      <div class="form-group"><label class="form-label">Vercel API Base URL</label><input id="set-api-url" type="text" value="${API_BASE}" placeholder="https://your-app.vercel.app" /></div>
      <div class="form-group"><label class="form-label">Access Token</label><input id="set-token" type="password" value="${AUTH_TOKEN}" placeholder="Your dashboard access token" /></div>
      <button class="btn btn-primary btn-sm" onclick="saveConnectionSettings()">Save Connection</button>
    </div>`;
}

function saveConnectionSettings() {
  const url = document.getElementById('set-api-url')?.value?.trim();
  const token = document.getElementById('set-token')?.value?.trim();
  if (!url || !token) { toast('Both URL and token required', 'error'); return; }
  API_BASE = url.replace(/\/$/, '');
  AUTH_TOKEN = token;
  localStorage.setItem('koaland_api_url', API_BASE);
  localStorage.setItem('koaland_token', AUTH_TOKEN);
  toast('Connection settings saved', 'success');
}

async function saveBrandSettings() {
  try {
    await patch('/api/settings', {
      senderName: document.getElementById('set-sender-name')?.value,
      company: document.getElementById('set-company')?.value,
      koalandDescription: document.getElementById('set-description')?.value,
      demoKitLink: document.getElementById('set-demo-kit')?.value?.trim(),
      calendarLink: document.getElementById('set-calendar')?.value?.trim(),
    });
    toast('Brand settings saved', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

async function saveEmailSettings() {
  try {
    await patch('/api/settings', {
      testEmailAddress: document.getElementById('set-test-email')?.value,
      dailySendLimit: parseInt(document.getElementById('set-daily-limit')?.value) || 10,
      followupDelay1Days: parseInt(document.getElementById('set-fu1')?.value) || 3,
      followupDelay2Days: parseInt(document.getElementById('set-fu2')?.value) || 5,
      replyToEmail: document.getElementById('set-reply-to')?.value,
    });
    toast('Email settings saved', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

async function exportAllJson() {
  try {
    const [prospects, audits, emails, tasks, campaigns] = await Promise.all([
      get('/api/prospects'),
      get('/api/analytics'),
      get('/api/tasks'),
      get('/api/campaigns'),
      get('/api/settings'),
    ]);
    const data = { exportedAt: new Date().toISOString(), prospects, audits, emails, tasks, campaigns };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `koaland-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    toast('Exported', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

// ─── BACKEND STATUS ──────────────────────────────────────────────
async function checkBackendStatus() {
  if (LOCAL_MODE) {
    updateStatusDot('status-backend', true);
    updateStatusDot('status-openai', false);
    updateStatusDot('status-sendgrid', false);
    return;
  }
  try {
    const data = await get('/api/health');
    const int = data.integrations || {};
    updateStatusDot('status-backend', data.ok);
    updateStatusDot('status-openai', int.openai?.ok);
    updateStatusDot('status-sendgrid', int.sendgrid?.ok);
  } catch {
    updateStatusDot('status-backend', false);
    updateStatusDot('status-openai', false);
    updateStatusDot('status-sendgrid', false);
  }
}

function updateStatusDot(id, ok) {
  const el = document.getElementById(id);
  if (el) { el.className = `status-dot ${ok ? 'ok' : 'err'}`; }
}

// ─── SCREEN 10: ENGINE CONTROL ROOM ──────────────────────────────
async function renderEngine(main) {
  main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-label">Autopilot</div>
        <div class="page-title">Engine Control Room</div>
        <div class="page-subtitle">Automated acquisition: discovery → research → audit → outreach → follow-ups</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm" onclick="engineTick()">▶ Run Tick Now</button>
        <button class="btn btn-primary btn-sm" id="engine-toggle-btn" onclick="toggleEngine()">…</button>
      </div>
    </div>
    <div id="engine-content"><div class="loading-state"><div class="spinner"></div></div></div>
  `;
  await loadEngine();
}

async function loadEngine() {
  const el = document.getElementById('engine-content');
  if (!el) return;
  try {
    const [status, campData] = await Promise.all([get('/api/engine/status'), get('/api/campaigns')]);
    state.engineStatus = status;
    const campaigns = (campData.campaigns || []).filter(c => (c.searchQueries || []).length || c.targetProspectCount);

    const btn = document.getElementById('engine-toggle-btn');
    if (btn) {
      btn.textContent = status.running ? '⏸ Stop Engine' : '⚡ Start Engine';
      btn.className = status.running ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm';
    }
    updateEngineBadges(status);

    el.innerHTML = `
      <div class="grid-5 mb-16">
        ${metric('Engine', status.running ? '● On' : '○ Off', status.running ? 'green' : 'danger')}
        ${metric('Tick Interval', `${Math.round((status.intervalMs || 60000) / 1000)}s`)}
        ${metric('Last Tick', status.lastTickAt ? relativeTime(status.lastTickAt) : '—')}
        ${metric('Sent Today', status.sentToday ?? 0)}
        ${metric('Active Campaigns', campaigns.filter(c => c.status === 'active').length, 'gold')}
      </div>

      <div class="grid-2" style="gap:20px;align-items:start;">
        <div>
          <div class="flex" style="justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div class="card-label">Engine Campaigns</div>
            <button class="btn btn-primary btn-sm" onclick="openEngineCampaignModal()">+ New Campaign</button>
          </div>
          ${campaigns.length ? campaigns.map(c => buildEngineCampaignCard(c)).join('') : `<div class="empty-state"><div class="empty-state-icon">◈</div><div class="empty-state-title">No engine campaigns yet</div><div class="empty-state-sub">Create a campaign with a region and let the engine acquire hotels for you.</div></div>`}
        </div>
        <div class="card">
          <div class="card-title">Activity Feed</div>
          <div style="max-height:520px;overflow-y:auto;">
            ${(status.log || []).length ? status.log.slice(0, 60).map(l => `
              <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12.5px;">
                <span style="color:${l.level === 'error' ? 'var(--red)' : 'var(--dim-text)'};white-space:nowrap;">${relativeTime(l.at)}</span>
                <span style="color:var(--gold);text-transform:uppercase;font-size:10px;letter-spacing:1px;padding-top:2px;white-space:nowrap;">${l.phase}</span>
                <span style="color:${l.level === 'error' ? 'var(--red)' : 'var(--muted-text)'};line-height:1.5;">${l.message}</span>
              </div>`).join('') : `<div class="empty-state-sub" style="padding:16px 0;">No activity yet. Start the engine or run a tick.</div>`}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-sub">${err.message}</div></div>`;
  }
}

function buildEngineCampaignCard(c) {
  const live = c.liveCounts || {};
  const target = c.targetProspectCount || 15;
  const pct = Math.min(100, Math.round(((live.prospects || 0) / target) * 100));
  const statusTag = c.status === 'active' ? '<span class="tag tag-green">Active</span>' : c.status === 'paused' ? '<span class="tag tag-warning">Paused</span>' : `<span class="tag tag-dim">${c.status}</span>`;
  return `
    <div class="card" style="margin-bottom:12px;">
      <div class="flex" style="justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-weight:600;font-size:15px;">${c.name}</div>
          <div style="font-size:12px;color:var(--muted-text);margin-top:2px;">${c.region || '—'} · ${c.segment || 'boutique'}</div>
        </div>
        ${statusTag}
      </div>
      <div style="margin:12px 0;">
        ${scoreBar(`Prospects ${live.prospects || 0}/${target}`, pct)}
      </div>
      <div class="flex gap-8" style="font-size:12px;color:var(--muted-text);margin-bottom:12px;flex-wrap:wrap;">
        <span>Audited: <strong style="color:var(--text);">${live.auditReady || 0}</strong></span>
        <span>Contacted: <strong style="color:var(--text);">${live.contacted || 0}</strong></span>
        <span>Replied: <strong style="color:var(--green);">${live.replied || 0}</strong></span>
        <span>Daily limit: <strong style="color:var(--text);">${c.sending?.dailySendLimit ?? 10}</strong></span>
        <span>Window: <strong style="color:var(--text);">${c.sending?.sendWindow?.startHour ?? 9}–${c.sending?.sendWindow?.endHour ?? 18}h</strong></span>
      </div>
      <div class="flex gap-8" style="align-items:center;">
        ${c.status === 'active'
          ? `<button class="btn btn-secondary btn-sm" onclick="engineCampaignAction('${c.id}','pause')">⏸ Pause</button>`
          : `<button class="btn btn-primary btn-sm" onclick="engineCampaignAction('${c.id}','activate')">▶ Activate</button>`}
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted-text);cursor:pointer;margin-left:auto;">
          <input type="checkbox" ${c.sending?.autoSend ? 'checked' : ''} onchange="toggleAutoSend('${c.id}', this.checked)" />
          Autopilot send ${c.sending?.autoSend ? '<span style="color:var(--orange);">(no approval gate)</span>' : '(approval required)'}
        </label>
      </div>
    </div>`;
}

async function toggleEngine() {
  try {
    const running = state.engineStatus?.running;
    await post(running ? '/api/engine/stop' : '/api/engine/start', {});
    toast(running ? 'Engine stopped' : 'Engine started', 'success');
    loadEngine();
  } catch (err) { toast(err.message, 'error'); }
}

async function engineTick() {
  try {
    toast('Running tick…', 'info');
    const r = await post('/api/engine/tick', {});
    const n = r.summary?.actions?.length || 0;
    toast(n ? `Tick complete — ${n} action(s)` : 'Tick complete — nothing to do', 'success');
    loadEngine();
  } catch (err) { toast(err.message, 'error'); }
}

async function engineCampaignAction(id, action) {
  try {
    await post(`/api/campaigns/${id}/${action}`, {});
    toast(action === 'activate' ? 'Campaign activated' : 'Campaign paused', 'success');
    loadEngine();
  } catch (err) { toast(err.message, 'error'); }
}

async function toggleAutoSend(id, enabled) {
  try {
    const campData = await get('/api/campaigns');
    const c = (campData.campaigns || []).find(x => x.id === id);
    if (!c) throw new Error('Campaign not found');
    await patch(`/api/campaigns/${id}`, { sending: { ...c.sending, autoSend: enabled } });
    toast(enabled ? 'Autopilot sending ON — emails go out without approval' : 'Approval gate restored', enabled ? 'info' : 'success');
    loadEngine();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── ENGINE CAMPAIGN MODAL (with AI planner) ─────────────────────
function openEngineCampaignModal() {
  const modal = document.getElementById('modal-overlay');
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">New Engine Campaign</div>
    <div style="font-size:12.5px;color:var(--muted-text);margin-bottom:16px;line-height:1.6;">Give the engine a region and a goal. <strong style="color:var(--text);">Plan with AI</strong> fills in search queries, targets, and cadence — review, adjust, then create.</div>
    <div class="input-row">
      <div class="form-group"><label class="form-label">Region *</label><input id="ec-region" type="text" placeholder="Bodrum, Turkey" /></div>
      <div class="form-group"><label class="form-label">Segment</label>
        <select id="ec-segment"><option>boutique</option><option>luxury</option><option>resort</option><option>independent</option></select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Goal</label><input id="ec-goal" type="text" placeholder="Book audits with independent boutique hotels" /></div>
    <div class="flex gap-8" style="margin-bottom:16px;">
      <button class="btn btn-secondary btn-sm" id="ec-plan-btn" onclick="planEngineCampaign()">✦ Plan with AI</button>
      <span id="ec-plan-note" style="font-size:11.5px;color:var(--dim-text);align-self:center;"></span>
    </div>
    <div class="form-group"><label class="form-label">Campaign Name *</label><input id="ec-name" type="text" placeholder="Bodrum Boutique — Q3" /></div>
    <div class="form-group"><label class="form-label">Search Queries (one per line)</label><textarea id="ec-queries" rows="3" placeholder="boutique luxury hotels Bodrum official site"></textarea></div>
    <div class="input-row">
      <div class="form-group"><label class="form-label">Target Prospects</label><input id="ec-target" type="number" value="15" min="1" max="100" /></div>
      <div class="form-group"><label class="form-label">Min ICP Fit</label><input id="ec-icp" type="number" value="60" min="0" max="100" /></div>
      <div class="form-group"><label class="form-label">Daily Send Limit</label><input id="ec-limit" type="number" value="10" min="1" max="50" /></div>
    </div>
    <div id="ec-rationale" style="display:none;background:var(--surface-2);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px 14px;font-size:12.5px;color:var(--muted-text);line-height:1.6;margin-bottom:16px;"></div>
    <div class="flex gap-8">
      <button class="btn btn-primary" onclick="createEngineCampaign(true)">Create &amp; Activate</button>
      <button class="btn btn-secondary" onclick="createEngineCampaign(false)">Create as Draft</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`;
  modal.classList.add('open');
}

async function planEngineCampaign() {
  const region = document.getElementById('ec-region')?.value?.trim();
  if (!region) { toast('Enter a region first', 'error'); return; }
  const btn = document.getElementById('ec-plan-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Planning…';
  try {
    const r = await post('/api/campaigns/plan', {
      region,
      segment: document.getElementById('ec-segment')?.value,
      goal: document.getElementById('ec-goal')?.value,
    });
    const p = r.plan || {};
    if (p.name) document.getElementById('ec-name').value = p.name;
    if (p.searchQueries?.length) document.getElementById('ec-queries').value = p.searchQueries.join('\n');
    if (p.targetProspectCount) document.getElementById('ec-target').value = p.targetProspectCount;
    if (p.icpThreshold) document.getElementById('ec-icp').value = p.icpThreshold;
    if (p.sending?.dailySendLimit) document.getElementById('ec-limit').value = p.sending.dailySendLimit;
    const rat = document.getElementById('ec-rationale');
    if (p.rationale) { rat.style.display = 'block'; rat.textContent = p.rationale; }
    document.getElementById('ec-plan-note').textContent = 'Plan loaded — adjust anything before creating.';
    window._plannedSequence = p.sequence || null;
  } catch (err) { toast(err.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = '✦ Plan with AI'; }
}

async function createEngineCampaign(activate) {
  const name = document.getElementById('ec-name')?.value?.trim();
  const region = document.getElementById('ec-region')?.value?.trim();
  if (!name || !region) { toast('Name and region are required', 'error'); return; }
  try {
    const body = {
      name, region,
      segment: document.getElementById('ec-segment')?.value,
      notes: document.getElementById('ec-goal')?.value || '',
      searchQueries: (document.getElementById('ec-queries')?.value || '').split('\n').map(s => s.trim()).filter(Boolean),
      targetProspectCount: parseInt(document.getElementById('ec-target')?.value) || 15,
      icpThreshold: parseInt(document.getElementById('ec-icp')?.value) || 60,
      sending: { dailySendLimit: parseInt(document.getElementById('ec-limit')?.value) || 10 },
    };
    if (window._plannedSequence) body.sequence = window._plannedSequence;
    const r = await post('/api/campaigns', body);
    if (activate) await post(`/api/campaigns/${r.campaign.id}/activate`, {});
    toast(activate ? 'Campaign created and activated — the engine will pick it up on the next tick' : 'Campaign created as draft', 'success');
    window._plannedSequence = null;
    closeModal();
    loadEngine();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── SCREEN 11: OUTBOX ───────────────────────────────────────────
async function renderOutbox(main) {
  main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-label">Approval Queue</div>
        <div class="page-title">Outbox</div>
        <div class="page-subtitle">Engine-drafted emails wait here until a team member approves them — unless a campaign is on autopilot</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-primary btn-sm" onclick="approveAllOutbox()">✓ Approve All Pending</button>
      </div>
    </div>
    <div id="outbox-content"><div class="loading-state"><div class="spinner"></div></div></div>
  `;
  await loadOutbox();
}

async function loadOutbox() {
  const el = document.getElementById('outbox-content');
  if (!el) return;
  try {
    const data = await get('/api/outbox');
    const badge = document.getElementById('nav-outbox-badge');
    if (badge) badge.textContent = (data.pending || []).length || '—';

    const card = (e, pending) => `
      <div class="card" style="margin-bottom:12px;">
        <div class="flex" style="justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="min-width:0;">
            <div style="font-weight:600;font-size:14px;">${e.subject}</div>
            <div style="font-size:12px;color:var(--muted-text);margin-top:3px;">
              ${e.prospectName} · ${e.to} · step ${e.sequenceStep} (${e.type}) · ${e.campaignName}
              ${e.variantName ? ` · <span style="color:var(--gold);">${e.variantName}</span>` : ''}
            </div>
            ${e.behaviorSignals ? `<div style="font-size:11.5px;color:var(--dim-text);margin-top:3px;">Signals: ${e.behaviorSignals}</div>` : ''}
          </div>
          <div class="flex gap-8" style="flex-shrink:0;">
            ${pending ? `<button class="btn btn-primary btn-sm" onclick="outboxAction('${e.id}','approve')">✓ Approve</button>` : `<span class="tag tag-green">Queued</span>`}
            <button class="btn btn-secondary btn-sm" onclick="outboxAction('${e.id}','cancel')">✕ Cancel</button>
          </div>
        </div>
        <details style="margin-top:10px;">
          <summary style="font-size:12px;color:var(--dim-text);cursor:pointer;">Preview email body</summary>
          <div style="white-space:pre-wrap;font-size:13px;color:var(--muted-text);line-height:1.7;padding:12px 0 4px;">${e.body}</div>
        </details>
      </div>`;

    el.innerHTML = `
      <div class="card-label" style="margin-bottom:10px;color:var(--orange);">Awaiting Approval (${(data.pending || []).length})</div>
      ${(data.pending || []).length ? data.pending.map(e => card(e, true)).join('') : `<div class="empty-state-sub" style="margin-bottom:20px;">Nothing waiting for approval.</div>`}
      <div class="card-label" style="margin:20px 0 10px;color:var(--green);">Approved / Auto — sending on next tick (${(data.queued || []).length})</div>
      ${(data.queued || []).length ? data.queued.map(e => card(e, false)).join('') : `<div class="empty-state-sub">Send queue is empty.</div>`}
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-sub">${err.message}</div></div>`;
  }
}

async function outboxAction(id, action) {
  try {
    await post(`/api/outbox/${id}/${action}`, {});
    toast(action === 'approve' ? 'Approved — sends on next engine tick' : 'Cancelled', 'success');
    loadOutbox();
  } catch (err) { toast(err.message, 'error'); }
}

async function approveAllOutbox() {
  try {
    const r = await post('/api/outbox/approve-all', {});
    toast(`${r.approved} email(s) approved — they send on the next tick`, 'success');
    loadOutbox();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── ENGINE NAV BADGES ───────────────────────────────────────────
function updateEngineBadges(status) {
  const engineBadge = document.getElementById('nav-engine-badge');
  if (engineBadge) engineBadge.style.display = status?.running ? 'inline-block' : 'none';
}

async function refreshEngineBadges() {
  try {
    const [status, outbox] = await Promise.all([get('/api/engine/status'), get('/api/outbox')]);
    state.engineStatus = status;
    updateEngineBadges(status);
    const badge = document.getElementById('nav-outbox-badge');
    if (badge) badge.textContent = (outbox.pending || []).length || '—';
  } catch { /* backend offline — badges stay as-is */ }
}

// ─── INIT ────────────────────────────────────────────────────────
async function initApp() {
  await checkBackendStatus();
  refreshEngineBadges();
  navigate('command-center');
  setInterval(checkBackendStatus, 60000);
  setInterval(refreshEngineBadges, 30000);
}

// ─── STARTUP ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Local preview mode — skip Vercel auth entirely
  if (localStorage.getItem('koaland_local_mode') === 'true') {
    LOCAL_MODE = true;
    seedLocalData();
    hideLock();
    initApp();
    return;
  }

  const token = localStorage.getItem('koaland_token');
  const apiUrl = localStorage.getItem('koaland_api_url');

  // Pre-fill lock screen if we have values
  const apiInput = document.getElementById('lock-api');
  const tokenInput = document.getElementById('lock-token');
  if (apiInput && apiUrl) apiInput.value = apiUrl;
  if (tokenInput && token) tokenInput.value = token;

  if (token && apiUrl) {
    AUTH_TOKEN = token;
    API_BASE = apiUrl;
    // Try auto-login
    post('/api/auth/check', { token })
      .then(r => { if (r.ok) { hideLock(); initApp(); } else showLock(); })
      .catch(() => showLock());
  }

  // Keyboard shortcut: Enter on lock screen
  document.getElementById('lock-token')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });

  // Handle back/forward nav
  window.addEventListener('popstate', e => {
    if (e.state?.screen) navigate(e.state.screen, e.state.params || {});
  });
});

// Expose functions globally for onclick handlers
window.navigate = navigate;
window.handleLogin = handleLogin;
window.openProspectDetail = openProspectDetail;
window.closeDrawer = closeDrawer;
window.closeModal = closeModal;
window.runResearch = runResearch;
window.openAuditFor = openAuditFor;
window.openEmailStudioFor = openEmailStudioFor;
window.openAddProspectModal = openAddProspectModal;
window.submitAddProspect = submitAddProspect;
window.exportProspects = exportProspects;
window.saveProspectEdits = saveProspectEdits;
window.addFromRadar = addFromRadar;
window.runRadarSearch = runRadarSearch;
window.runAudit = runAudit;
window.generateEmails = generateEmails;
window.renderEmailVariants = renderEmailVariants;
window.selectSubject = selectSubject;
window.sendEmailNow = sendEmailNow;
window.sendTestEmail = sendTestEmail;
window.copyEmail = copyEmail;
window.loadEmailContext = loadEmailContext;
window.markTaskDone = markTaskDone;
window.postponeTask = postponeTask;
window.loadProspects = loadProspects;
window.openCreateCampaignModal = openCreateCampaignModal;
window.createCampaign = createCampaign;
window.switchCampaignTab = switchCampaignTab;
window.toggleCampaignContacts = toggleCampaignContacts;
window.toggleCampaignStatus = toggleCampaignStatus;
window.openAddContactModal = openAddContactModal;
window.submitAddContact = submitAddContact;
window.deleteContact = deleteContact;
window.openContactComposeModal = openContactComposeModal;
window.selectContactVariant = selectContactVariant;
window.sendEmailToContact = sendEmailToContact;
window.copyContactEmail = copyContactEmail;
window.exportCampaignContacts = exportCampaignContacts;
window.loadContacts = loadContacts;
window.openEditContactModal = openEditContactModal;
window.saveContactEdits = saveContactEdits;
window.recalculateTasks = recalculateTasks;
window.refreshDashboard = refreshDashboard;
window.saveConnectionSettings = saveConnectionSettings;
window.saveBrandSettings = saveBrandSettings;
window.saveEmailSettings = saveEmailSettings;
window.exportAllJson = exportAllJson;
window._variants = [];
window._selectedSubject = '';
window.handleLocalLogin = handleLocalLogin;
window.exitLocalMode = exitLocalMode;
window.clearLocalData = clearLocalData;
window.toggleEngine = toggleEngine;
window.engineTick = engineTick;
window.engineCampaignAction = engineCampaignAction;
window.toggleAutoSend = toggleAutoSend;
window.openEngineCampaignModal = openEngineCampaignModal;
window.planEngineCampaign = planEngineCampaign;
window.createEngineCampaign = createEngineCampaign;
window.outboxAction = outboxAction;
window.approveAllOutbox = approveAllOutbox;
window._plannedSequence = null;
