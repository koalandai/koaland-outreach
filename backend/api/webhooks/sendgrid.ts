import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../services/storageService';
import { eventId } from '../../utils/ids';
import { recalculateHotLeadScore } from '../../services/scoringService';
import { createFollowUpAfterOpen, createContactResearchTask } from '../../services/taskService';

// SendGrid event types
type SgEventType = 'processed' | 'delivered' | 'open' | 'click' | 'bounce' | 'dropped' | 'spamreport' | 'unsubscribe' | 'group_unsubscribe';

interface SgEvent {
  event: SgEventType;
  timestamp: number;
  email: string;
  sg_message_id?: string;
  url?: string;
  // Custom args we set when sending
  koaland_email_id?: string;
  koaland_prospect_id?: string;
  koaland_audit_id?: string;
  koaland_campaign_id?: string;
}

const STATUS_MAP: Record<SgEventType, string> = {
  processed: 'sent',
  delivered: 'delivered',
  open: 'opened',
  click: 'clicked',
  bounce: 'bounced',
  dropped: 'bounced',
  spamreport: 'spamreport',
  unsubscribe: 'unsubscribed',
  group_unsubscribe: 'unsubscribed',
};

const EVENT_TYPE_MAP: Record<SgEventType, string> = {
  processed: 'email_sent',
  delivered: 'email_delivered',
  open: 'email_opened',
  click: 'email_clicked',
  bounce: 'email_bounced',
  dropped: 'email_bounced',
  spamreport: 'email_spam',
  unsubscribe: 'email_unsubscribed',
  group_unsubscribe: 'email_unsubscribed',
};

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).end();

  // Acknowledge immediately (SendGrid expects 2xx quickly)
  res.status(200).json({ ok: true });

  const events: SgEvent[] = Array.isArray(req.body) ? req.body : [req.body];

  for (const sgEvent of events) {
    try {
      await processEvent(sgEvent);
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  }
};

async function processEvent(sgEvent: SgEvent): Promise<void> {
  const emailId = sgEvent.koaland_email_id;
  const prospectId = sgEvent.koaland_prospect_id;
  const auditId = sgEvent.koaland_audit_id;
  const campaignId = sgEvent.koaland_campaign_id;

  if (!emailId || !prospectId) return;

  const email = await storage.emails.getById(emailId) as any;
  if (!email) return;

  const newStatus = STATUS_MAP[sgEvent.event];
  const now = new Date(sgEvent.timestamp * 1000).toISOString();

  // Update email record
  const patch: any = { status: newStatus };

  switch (sgEvent.event) {
    case 'delivered':
      patch.deliveredAt = now;
      break;
    case 'open':
      patch.openedAt = patch.openedAt || now;
      patch.openCount = (email.openCount || 0) + 1;
      break;
    case 'click':
      patch.clickedAt = patch.clickedAt || now;
      patch.clickCount = (email.clickCount || 0) + 1;
      break;
  }

  await storage.emails.update(emailId, patch);

  // Log event
  await storage.events.create({
    id: eventId(),
    type: EVENT_TYPE_MAP[sgEvent.event] || sgEvent.event,
    prospectId,
    auditId: auditId || null,
    emailId,
    campaignId: campaignId || null,
    payload: { event: sgEvent.event, url: sgEvent.url, email: sgEvent.email },
    createdAt: now,
  });

  // Update prospect status
  const prospect = await storage.prospects.getById(prospectId) as any;
  if (prospect) {
    const statusMap: Record<string, string> = {
      delivered: 'delivered',
      open: 'opened',
      click: 'opened',
    };

    const newProspectStatus = statusMap[sgEvent.event];
    if (newProspectStatus) {
      const currentRank = getStatusRank(prospect.status);
      const newRank = getStatusRank(newProspectStatus);
      if (newRank > currentRank) {
        await storage.prospects.update(prospectId, {
          status: newProspectStatus,
          lastActionAt: now,
          updatedAt: now,
        });
      }
    }

    // Handle negative events
    if (sgEvent.event === 'bounce' || sgEvent.event === 'dropped') {
      await storage.prospects.update(prospectId, { status: 'bounced', updatedAt: now });
      await createContactResearchTask(prospectId);
    }

    if (sgEvent.event === 'spamreport' || sgEvent.event === 'unsubscribe' || sgEvent.event === 'group_unsubscribe') {
      await storage.prospects.update(prospectId, { status: 'unsubscribed', updatedAt: now });
    }

    if (sgEvent.event === 'open') {
      await createFollowUpAfterOpen(prospectId, emailId);
    }
  }

  // Recalculate hot lead score
  await recalculateHotLeadScore(prospectId);
}

function getStatusRank(status: string): number {
  const ranks: Record<string, number> = {
    research_queue: 0, researching: 1, research_complete: 2,
    audit_in_progress: 3, audit_ready: 4, email_drafted: 5,
    sent: 6, delivered: 7, opened: 8, pdf_viewed: 9,
    clicked: 8, replied: 10, demo_interest: 11,
  };
  return ranks[status] || 0;
}
