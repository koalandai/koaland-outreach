/**
 * Shared audit pipeline: crawl → AI analysis (GPT-4o or mock) → scores →
 * tokenized report URL → prospect update → optional outreach task.
 * Used by both the manual POST /api/audits/run endpoint and the engine's
 * audit phase (which passes createTask:false because it handles outreach itself).
 */

const { read, write, lid } = require('./store');
const { crawlWebsite } = require('./crawler');

function mockAuditResult(prospect) {
  const r = (a, b) => Math.round(a + Math.random() * (b - a));
  return {
    scores: { websiteExperience: r(38, 70), seoReadiness: r(28, 60), aeoReadiness: r(18, 48), geoReadiness: r(15, 45), directBookingClarity: r(30, 65), luxuryBrandConsistency: r(42, 78), commercialUpside: r(58, 90), confidence: r(60, 85) },
    executiveSummary: `${prospect.hotelName} audit complete. Add OPENAI_API_KEY to .env for real AI analysis.`,
    recommendedAngle: 'Direct Booking Clarity',
    topFindings: [{ title: 'Add OPENAI_API_KEY for real AI audit', severity: 'medium', evidence: 'No OpenAI key in .env', commercialMeaning: 'Real audits need OpenAI API key.', outreachHook: 'Add OPENAI_API_KEY to .env' }],
    commercialLeakageRisks: [],
    opportunities: [{ type: 'Quick Win', title: 'Configure OpenAI', impact: 'High', effort: 'Low', urgency: 'Now', whyItMatters: 'Unlocks real AI audit analysis.' }],
    oneSentenceHook: 'Add OPENAI_API_KEY to .env to unlock real AI audits.',
  };
}

async function aiAuditResult(prospect, crawl, notes) {
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o', temperature: 0.3, response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are Koaland.ai\'s digital experience auditor for brand-sensitive luxury and boutique hotels. Identify where the hotel\'s digital presence leaks commercial value, direct bookings, AI-search visibility, or brand clarity. Use ONLY the provided data. Be specific and evidence-based. Score conservatively — 90+ means genuinely excellent. Most hotels score 35-72. Think like a luxury hotel commercial director who understands digital, SEO, and AI systems.' },
      { role: 'user', content: `Audit this hotel website.\n\nURL: ${crawl.url || prospect.website}\nHotel: ${prospect.hotelName}\nLocation: ${prospect.location || 'Unknown'}\nTitle: ${crawl.title}\nMeta: ${crawl.metaDescription}\n\nHeadings:\n${crawl.headings.slice(0, 30).join('\n')}\n\nBody Text:\n${crawl.bodyText.slice(0, 4000)}\n\nCTAs: ${crawl.ctaTexts.slice(0, 15).join(' | ')}\nBooking Links: ${crawl.bookingLinks.join(' | ') || 'None found'}\nSchema Types: ${crawl.schemaTypes.join(', ') || 'None found'}\nNotes: ${notes || 'None'}\n\nReturn ONLY valid JSON:\n{\n  "scores": {"websiteExperience":0-100,"seoReadiness":0-100,"aeoReadiness":0-100,"geoReadiness":0-100,"directBookingClarity":0-100,"luxuryBrandConsistency":0-100,"commercialUpside":0-100,"confidence":0-100},\n  "executiveSummary": "2-3 sentence commercial position summary",\n  "topFindings": [{"title":"string","severity":"high|medium|low","evidence":"string","commercialMeaning":"string","outreachHook":"string"}],\n  "commercialLeakageRisks": [{"title":"string","severity":"high|medium|low","commercialMeaning":"string"}],\n  "opportunities": [{"type":"Quick Win|Strategic Fix|Commercial Risk|Future Advantage","title":"string","impact":"High|Medium|Low","effort":"High|Medium|Low","urgency":"string","whyItMatters":"string"}],\n  "recommendedAngle": "single strongest outreach angle",\n  "oneSentenceHook": "one sentence outreach hook"\n}` },
    ],
  });
  return JSON.parse(resp.choices[0].message.content);
}

/**
 * Run a full audit for a prospect.
 * @returns the stored audit record.
 */
async function runAudit({ prospectId, depth = 'full', notes = '', baseUrl = '', createTask = true }) {
  const prospects = read('prospects');
  const prospect = prospects.find(p => p.id === prospectId);
  if (!prospect) throw new Error('Prospect not found');

  let crawl = { url: prospect.website || '', title: prospect.hotelName, metaDescription: '', headings: [], bodyText: '', ctaTexts: [], bookingLinks: [], schemaTypes: [], robotsHints: 'N/A', emailsFound: [], crawledAt: new Date().toISOString() };
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
      ai = await aiAuditResult(prospect, crawl, notes);
      console.log('[Audit] GPT-4o done. Top finding:', ai.topFindings?.[0]?.title);
    } catch (err) { console.error('[Audit] OpenAI error:', err.message); }
  }
  if (!ai) ai = mockAuditResult(prospect);

  const overall = Math.round(Object.values(ai.scores).reduce((a, b) => a + b, 0) / Object.values(ai.scores).length);
  const auditIdVal = lid('aud'), pdfToken = lid('tok');
  const audit = { id: auditIdVal, prospectId, status: 'complete', depth, ...ai, pdfUrl: `${baseUrl}/api/audit/view/${pdfToken}`, pdfToken, pdfOpenCount: 0, crawledAt: crawl.crawledAt, createdAt: new Date().toISOString() };
  const audits = read('audits'); audits.push(audit); write('audits', audits);

  const list = read('prospects');
  const pIdx = list.findIndex(p => p.id === prospectId);
  if (pIdx !== -1) {
    list[pIdx] = { ...list[pIdx], status: 'audit_ready', auditScore: overall, commercialUpsideScore: ai.scores.commercialUpside, recommendedAngle: ai.recommendedAngle, lastActionAt: new Date().toISOString() };
    write('prospects', list);
  }

  if (createTask) {
    const tasks = read('tasks');
    tasks.push({ id: lid('tsk'), prospectId, type: 'send_initial_outreach', title: `Generate email for ${prospect.hotelName}`, reason: `Audit done. Upside: ${ai.scores.commercialUpside}. Angle: ${ai.recommendedAngle}.`, status: 'open', dueAt: new Date(Date.now() + 86400000).toISOString(), createdAt: new Date().toISOString() });
    write('tasks', tasks);
  }

  // campaign metric rollup for engine-managed prospects
  if (prospect.campaignId) {
    const campaigns = read('campaigns');
    const cIdx = campaigns.findIndex(c => c.id === prospect.campaignId);
    if (cIdx !== -1) {
      campaigns[cIdx].metrics = { ...campaigns[cIdx].metrics, audits: (campaigns[cIdx].metrics?.audits || 0) + 1 };
      write('campaigns', campaigns);
    }
  }

  return audit;
}

module.exports = { runAudit };
