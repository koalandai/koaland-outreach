import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { storage } from '../../../services/storageService';
import { eventId } from '../../../utils/ids';
import { recalculateHotLeadScore } from '../../../services/scoringService';
import { createFollowUpAfterPdfView } from '../../../services/taskService';

export default async (req: VercelRequest, res: VercelResponse) => {
  const { token } = req.query as { token: string };

  // Fetch the stored HTML report
  const html = await kv.get<string>(`koaland:report:${token}`);

  if (!html) {
    return res.status(404).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
        <h2>Report not found or expired</h2>
        <p>This audit report link may have expired. Please contact Murat at Koaland.ai.</p>
      </body></html>
    `);
  }

  // Log the view event (async, don't await to keep response fast)
  logPdfView(token).catch(console.error);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(html);
};

async function logPdfView(token: string): Promise<void> {
  // Find audit by pdfToken
  const audit = await storage.audits.findOne((a: any) => a.pdfToken === token) as any;
  if (!audit) return;

  const now = new Date().toISOString();
  const newOpenCount = (audit.pdfOpenCount || 0) + 1;

  // Update audit open count
  await storage.audits.update(audit.id, { pdfOpenCount: newOpenCount });

  // Log event
  await storage.events.create({
    id: eventId(),
    type: 'pdf_opened',
    prospectId: audit.prospectId,
    auditId: audit.id,
    payload: { openCount: newOpenCount, token },
    createdAt: now,
  });

  // Update prospect status if needed
  const prospect = await storage.prospects.getById(audit.prospectId) as any;
  if (prospect && !['pdf_viewed', 'replied', 'demo_interest', 'closed_won'].includes(prospect.status)) {
    await storage.prospects.update(audit.prospectId, {
      status: 'pdf_viewed',
      updatedAt: now,
      lastActionAt: now,
    });
  }

  // Recalculate hot lead score
  await recalculateHotLeadScore(audit.prospectId);

  // Create follow-up task
  await createFollowUpAfterPdfView(audit.prospectId, audit.id, newOpenCount);
}
