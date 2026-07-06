import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../middleware/auth';
import { storage } from '../../services/storageService';
import { generateAuditHtml } from '../../services/pdfService';
import { kv } from '@vercel/kv';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  const { id } = req.query as { id: string };

  if (id === 'run') {
    // Route to run endpoint — should not happen due to vercel.json routing
    return res.status(404).json({ error: 'Use POST /api/audits/run' });
  }

  if (req.method === 'GET') {
    const audit = await storage.audits.getById(id);
    if (!audit) return res.status(404).json({ error: 'Audit not found' });
    return res.json({ audit });
  }

  if (req.method === 'POST') {
    // Regenerate PDF/HTML
    const audit = await storage.audits.getById(id) as any;
    if (!audit) return res.status(404).json({ error: 'Audit not found' });

    const prospect = await storage.prospects.getById(audit.prospectId) as any;
    if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

    const settings = await storage.settings.get();
    const trackingBaseUrl = process.env.TRACKING_BASE_URL || '';

    const reportHtml = generateAuditHtml({
      hotelName: prospect.hotelName,
      website: prospect.website,
      location: prospect.location,
      auditDate: new Date(audit.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }),
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
      pdfToken: audit.pdfToken,
    });

    await kv.set(`koaland:report:${audit.pdfToken}`, reportHtml, { ex: 60 * 60 * 24 * 90 });

    return res.json({ ok: true, pdfUrl: audit.pdfUrl });
  }

  res.status(405).json({ error: 'Method not allowed' });
});
