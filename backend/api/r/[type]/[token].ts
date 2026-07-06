import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { storage } from '../../../services/storageService';
import { eventId } from '../../../utils/ids';
import { decodeTrackingToken } from '../../../utils/tokens';

const REDIRECT_TARGETS: Record<string, string> = {
  demo: '',
  calendar: '',
  website: '',
};

export default async (req: VercelRequest, res: VercelResponse) => {
  const { type, token } = req.query as { type: string; token: string };

  // Log click event
  logClickEvent(type, token, req).catch(console.error);

  // Determine redirect target
  let target = '';

  if (type === 'audit') {
    target = `${process.env.TRACKING_BASE_URL || ''}/api/audit/view/${token}`;
  } else {
    // Decode token to get target URL + metadata
    const decoded = decodeTrackingToken(token);
    if (decoded?.url) {
      target = decoded.url;
    } else {
      // Fallback: look up in KV
      const stored = await kv.get<string>(`koaland:redirect:${type}:${token}`);
      if (stored) target = stored;
    }
  }

  if (!target) {
    return res.status(404).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
        <h2>Link not found</h2>
        <p>This link may have expired. Please contact Murat at Koaland.ai.</p>
      </body></html>
    `);
  }

  res.writeHead(302, { Location: target });
  res.end();
};

async function logClickEvent(type: string, token: string, req: VercelRequest): Promise<void> {
  const settings = await storage.settings.get();
  const now = new Date().toISOString();

  // Try to find related prospect from token
  let prospectId = '';
  let auditId = '';

  if (type === 'audit') {
    const audit = await storage.audits.findOne((a: any) => a.pdfToken === token) as any;
    if (audit) {
      prospectId = audit.prospectId;
      auditId = audit.id;
    }
  } else {
    const decoded = decodeTrackingToken(token);
    if (decoded?.prospectId) prospectId = decoded.prospectId;
    if (decoded?.auditId) auditId = decoded.auditId;
  }

  await storage.events.create({
    id: eventId(),
    type: `link_clicked_${type}`,
    prospectId: prospectId || null,
    auditId: auditId || null,
    payload: {
      type,
      token,
      userAgent: req.headers['user-agent'] || '',
      ip: req.headers['x-forwarded-for'] || '',
    },
    createdAt: now,
  });

  // If demo or calendar click, mark as demo_interest
  if (['demo', 'calendar'].includes(type) && prospectId) {
    const prospect = await storage.prospects.getById(prospectId) as any;
    if (prospect && !['replied', 'demo_interest', 'closed_won'].includes(prospect.status)) {
      await storage.prospects.update(prospectId, {
        status: 'demo_interest',
        updatedAt: now,
        lastActionAt: now,
      });
    }
  }
}
