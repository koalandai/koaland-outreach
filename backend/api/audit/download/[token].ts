import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { storage } from '../../../services/storageService';
import { eventId } from '../../../utils/ids';

export default async (req: VercelRequest, res: VercelResponse) => {
  const { token } = req.query as { token: string };

  const html = await kv.get<string>(`koaland:report:${token}`);
  if (!html) return res.status(404).json({ error: 'Report not found or expired' });

  // Log download event
  const audit = await storage.audits.findOne((a: any) => a.pdfToken === token) as any;
  if (audit) {
    await storage.events.create({
      id: eventId(),
      type: 'pdf_downloaded',
      prospectId: audit.prospectId,
      auditId: audit.id,
      payload: { token },
      createdAt: new Date().toISOString(),
    });
  }

  // Serve HTML with print trigger for PDF download
  const printHtml = html.replace(
    '</body>',
    `<script>window.addEventListener('load', () => { setTimeout(() => window.print(), 800); });</script></body>`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(printHtml);
};
