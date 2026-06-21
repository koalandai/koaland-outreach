import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../middleware/auth';
import { storage } from '../../services/storageService';
import { crawlWebsite } from '../../services/crawlerService';
import { runPageSpeed } from '../../services/pagespeedService';
import { runDigitalAudit, runAiVisibilityCheck } from '../../services/openaiService';
import { generateAuditHtml } from '../../services/pdfService';
import { auditId } from '../../utils/ids';
import { generatePdfToken } from '../../utils/tokens';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prospectId, depth = 'full', competitorUrls = [], notes } = req.body as {
    prospectId: string;
    depth?: 'quick' | 'full' | 'competitive';
    competitorUrls?: string[];
    notes?: string;
  };

  if (!prospectId) return res.status(400).json({ error: 'prospectId required' });

  const prospect = await storage.prospects.getById(prospectId) as any;
  if (!prospect) return res.status(404).json({ error: 'Prospect not found' });
  if (!prospect.website) return res.status(400).json({ error: 'Prospect has no website' });

  await storage.prospects.update(prospectId, { status: 'audit_in_progress', updatedAt: new Date().toISOString() });

  // Step 1: Crawl website
  let crawl: any;
  try {
    crawl = await crawlWebsite(prospect.website);
  } catch (err: any) {
    await storage.prospects.update(prospectId, { status: 'research_complete' });
    return res.status(422).json({ error: `Crawl failed: ${err.message}` });
  }

  // Step 2: Run PageSpeed (parallel, non-blocking on failure)
  const [pagespeedMobile, pagespeedDesktop] = await Promise.allSettled([
    runPageSpeed(prospect.website, 'mobile'),
    runPageSpeed(prospect.website, 'desktop'),
  ]);

  // Step 3: Crawl competitors if competitive audit
  const competitorData: any[] = [];
  if (depth === 'competitive' && competitorUrls.length > 0) {
    for (const url of competitorUrls.slice(0, 2)) {
      try {
        const cCrawl = await crawlWebsite(url);
        competitorData.push({ url, title: cCrawl.title, headings: cCrawl.headings.slice(0, 5) });
      } catch { /* skip failed competitor */ }
    }
  }

  // Step 4: AI Audit
  let auditResult: any;
  try {
    auditResult = await runDigitalAudit({
      url: crawl.url,
      title: crawl.title,
      metaDescription: crawl.metaDescription,
      headings: crawl.headings,
      bodyText: crawl.bodyText,
      ctaTexts: crawl.ctaTexts,
      bookingLinks: crawl.bookingLinks,
      faqText: crawl.faqText,
      schemaTypes: crawl.schemaTypes,
      robotsHints: crawl.robotsHints,
      pagespeedMobile: pagespeedMobile.status === 'fulfilled' ? pagespeedMobile.value : null,
      pagespeedDesktop: pagespeedDesktop.status === 'fulfilled' ? pagespeedDesktop.value : null,
      competitorData: competitorData.length ? competitorData : undefined,
      notes,
    });
  } catch (err: any) {
    await storage.prospects.update(prospectId, { status: 'research_complete' });
    return res.status(422).json({ error: `AI audit failed: ${err.message}` });
  }

  // Step 4b: AI visibility check (non-blocking on failure)
  let aiVisibility: any = null;
  if (prospect.location) {
    try {
      aiVisibility = await runAiVisibilityCheck({
        hotelName: prospect.hotelName,
        website: prospect.website,
        location: prospect.location,
        category: prospect.category || prospect.segment,
      });
    } catch { /* visibility check is a bonus, never block the audit */ }
  }

  // Step 5: Generate PDF token and HTML
  const settings = await storage.settings.get();
  const trackingBaseUrl = process.env.TRACKING_BASE_URL || '';
  const pdfToken = generatePdfToken();

  // Step 6: Save audit
  const now = new Date().toISOString();
  const id = auditId();

  const audit = {
    id,
    prospectId,
    depth,
    scores: auditResult.scores || {},
    executiveSummary: auditResult.executiveSummary || '',
    topFindings: auditResult.topFindings || [],
    commercialLeakageRisks: auditResult.commercialLeakageRisks || [],
    opportunities: auditResult.opportunities || [],
    estimatedAnnualLeakage: auditResult.estimatedAnnualLeakage || null,
    aiVisibility,
    competitorMirror: competitorData,
    recommendedAngle: auditResult.recommendedAngle || '',
    oneSentenceHook: auditResult.oneSentenceHook || '',
    pdfToken,
    pdfUrl: `${trackingBaseUrl}/api/audit/view/${pdfToken}`,
    pdfOpenCount: 0,
    pagespeedMobile: pagespeedMobile.status === 'fulfilled' ? pagespeedMobile.value : null,
    pagespeedDesktop: pagespeedDesktop.status === 'fulfilled' ? pagespeedDesktop.value : null,
    missingInputs: auditResult.missingInputs || [],
    createdAt: now,
  };

  // Store HTML report in KV for serving
  const { kv } = await import('@vercel/kv');
  const reportHtml = generateAuditHtml({
    hotelName: prospect.hotelName,
    website: prospect.website,
    location: prospect.location,
    auditDate: new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }),
    scores: audit.scores,
    executiveSummary: audit.executiveSummary,
    topFindings: audit.topFindings,
    commercialLeakageRisks: audit.commercialLeakageRisks,
    opportunities: audit.opportunities,
    estimatedAnnualLeakage: audit.estimatedAnnualLeakage || undefined,
    aiVisibility: audit.aiVisibility || undefined,
    recommendedAngle: audit.recommendedAngle,
    demoKitLink: settings.demoKitLink || '',
    calendarLink: settings.calendarLink || '',
    trackingBaseUrl,
    pdfToken,
  });

  await kv.set(`koaland:report:${pdfToken}`, reportHtml, { ex: 60 * 60 * 24 * 90 }); // 90 day TTL

  await storage.audits.create(audit);

  // Update prospect
  const overallScore = Object.values(audit.scores as Record<string, number>).reduce((a, b) => a + b, 0) / Object.keys(audit.scores).length;
  await storage.prospects.update(prospectId, {
    status: 'audit_ready',
    recommendedAngle: audit.recommendedAngle,
    icpFitScore: audit.scores.confidence || prospect.icpFitScore,
    commercialUpsideScore: audit.scores.commercialUpside || prospect.commercialUpsideScore,
    updatedAt: now,
    lastActionAt: now,
  });

  res.json({
    auditId: id,
    scores: audit.scores,
    executiveSummary: audit.executiveSummary,
    topFindings: audit.topFindings,
    opportunities: audit.opportunities,
    commercialLeakageRisks: audit.commercialLeakageRisks,
    estimatedAnnualLeakage: audit.estimatedAnnualLeakage,
    aiVisibility: audit.aiVisibility,
    recommendedAngle: audit.recommendedAngle,
    oneSentenceHook: audit.oneSentenceHook,
    pdfUrl: audit.pdfUrl,
    pdfToken,
    pagespeedMobile: pagespeedMobile.status === 'fulfilled' ? pagespeedMobile.value : null,
  });
});
