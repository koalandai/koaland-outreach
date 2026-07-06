import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../middleware/auth';
import { storage } from '../../services/storageService';
import { sendEmail } from '../../services/sendgridService';
import { emailId, eventId } from '../../utils/ids';
import { createSendInitialTask } from '../../services/taskService';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prospectId, auditId, to, subject, body, type = 'initial', campaignId, isTest } = req.body as {
    prospectId: string;
    auditId?: string;
    to: string;
    subject: string;
    body: string;
    type?: string;
    campaignId?: string;
    isTest?: boolean;
  };

  if (!prospectId || !to || !subject || !body) {
    return res.status(400).json({ error: 'prospectId, to, subject, and body are required' });
  }

  const prospect = await storage.prospects.getById(prospectId) as any;
  if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

  const now = new Date().toISOString();
  const id = emailId();

  const customArgs: Record<string, string> = {
    koaland_email_id: id,
    koaland_prospect_id: prospectId,
  };
  if (auditId) customArgs.koaland_audit_id = auditId;
  if (campaignId) customArgs.koaland_campaign_id = campaignId;

  let sendResult: any;
  try {
    sendResult = await sendEmail({
      to: isTest ? (process.env.SENDGRID_FROM_EMAIL || to) : to,
      subject: isTest ? `[TEST] ${subject}` : subject,
      htmlBody: body,
      textBody: body,
      customArgs,
    });
  } catch (err: any) {
    return res.status(422).json({ error: `SendGrid error: ${err.message}` });
  }

  // Save email record
  const email = await storage.emails.create({
    id,
    prospectId,
    auditId: auditId || null,
    campaignId: campaignId || null,
    to: isTest ? (process.env.SENDGRID_FROM_EMAIL || to) : to,
    subject,
    body,
    type,
    angle: req.body.angle || '',
    status: 'sent',
    sendgridMessageId: sendResult.sendgridMessageId,
    sentAt: now,
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    openCount: 0,
    clickCount: 0,
    isTest: isTest || false,
    createdAt: now,
  });

  // Log send event
  await storage.events.create({
    id: eventId(),
    type: 'email_sent',
    prospectId,
    auditId: auditId || null,
    emailId: id,
    campaignId: campaignId || null,
    payload: { to, subject, isTest },
    createdAt: now,
  });

  // Update prospect status
  if (!isTest) {
    const statusesToUpdate = ['research_queue', 'researching', 'research_complete', 'audit_ready', 'audit_in_progress'];
    if (statusesToUpdate.includes(prospect.status)) {
      await storage.prospects.update(prospectId, {
        status: 'sent',
        lastActionAt: now,
        updatedAt: now,
      });
    }
  }

  res.status(201).json({
    emailId: id,
    sendgridMessageId: sendResult.sendgridMessageId,
    status: 'sent',
    isTest: isTest || false,
  });
});
