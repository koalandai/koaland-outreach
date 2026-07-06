import { storage } from './storageService';
import { taskId } from '../utils/ids';

export interface Task {
  id: string;
  prospectId: string;
  type: string;
  title: string;
  reason: string;
  recommendedAction: string;
  dueAt: string;
  status: 'open' | 'done' | 'postponed' | 'cancelled';
  createdAt: string;
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function createTask(data: Omit<Task, 'id' | 'createdAt' | 'status'>): Promise<Task> {
  const task: Task = {
    ...data,
    id: taskId(),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  return storage.tasks.create(task);
}

export async function createFollowUpAfterOpen(prospectId: string, emailId: string): Promise<Task> {
  const prospect = await storage.prospects.getById(prospectId) as any;
  return createTask({
    prospectId,
    type: 'followup_after_open',
    title: `Follow up with ${prospect?.hotelName || 'prospect'} — email opened, no PDF view`,
    reason: 'Email was opened but prospect has not viewed the audit PDF yet.',
    recommendedAction: 'Send a short follow-up highlighting one specific finding from the audit.',
    dueAt: daysFromNow(2),
  });
}

export async function createFollowUpAfterPdfView(prospectId: string, auditId: string, openCount: number): Promise<Task> {
  const prospect = await storage.prospects.getById(prospectId) as any;
  const urgency = openCount >= 2 ? '⚡ HOT — ' : '';
  return createTask({
    prospectId,
    type: openCount >= 2 ? 'followup_hot_pdf' : 'followup_after_pdf_view',
    title: `${urgency}Follow up with ${prospect?.hotelName || 'prospect'} — PDF viewed${openCount >= 2 ? ` ${openCount} times` : ''}`,
    reason: openCount >= 2
      ? `Prospect viewed the audit PDF ${openCount} times — strong buying signal.`
      : 'Prospect viewed the audit PDF — signal of interest.',
    recommendedAction: openCount >= 2
      ? 'Reach out today. Mention you noticed the PDF resonated. Offer a short call.'
      : 'Follow up within 24 hours. Reference the PDF and ask if they had a specific reaction.',
    dueAt: daysFromNow(openCount >= 2 ? 0 : 1),
  });
}

export async function createNoOpenFollowUp(prospectId: string, emailId: string): Promise<Task> {
  const prospect = await storage.prospects.getById(prospectId) as any;
  return createTask({
    prospectId,
    type: 'followup_no_open',
    title: `Soft follow-up for ${prospect?.hotelName || 'prospect'} — email not opened`,
    reason: 'Email was sent 3+ days ago and has not been opened.',
    recommendedAction: 'Send a gentle follow-up with a different subject line. Try a specific finding hook.',
    dueAt: daysFromNow(0),
  });
}

export async function createContactResearchTask(prospectId: string): Promise<Task> {
  const prospect = await storage.prospects.getById(prospectId) as any;
  return createTask({
    prospectId,
    type: 'contact_research',
    title: `Find better contact for ${prospect?.hotelName || 'prospect'} — email bounced`,
    reason: 'The email bounced. The contact address is likely incorrect or inactive.',
    recommendedAction: 'Research LinkedIn, hotel website, or booking engine for a better contact address.',
    dueAt: daysFromNow(1),
  });
}

export async function createSendInitialTask(prospectId: string): Promise<Task> {
  const prospect = await storage.prospects.getById(prospectId) as any;
  return createTask({
    prospectId,
    type: 'send_initial_email',
    title: `Send initial email to ${prospect?.hotelName || 'prospect'}`,
    reason: 'Audit is complete and email has been drafted. Ready to send.',
    recommendedAction: 'Review the drafted email in Email Studio and send.',
    dueAt: daysFromNow(0),
  });
}

export async function recalculateTasks(): Promise<void> {
  const now = new Date();
  const emails = await storage.emails.findWhere((e: any) => e.status === 'sent' || e.status === 'delivered');
  const settings = await storage.settings.get();

  for (const email of emails as any[]) {
    const sentAt = email.sentAt ? new Date(email.sentAt) : null;
    if (!sentAt) continue;

    const daysSinceSent = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24);
    const existingTasks = await storage.tasks.findWhere(
      (t: any) => t.prospectId === email.prospectId && t.status === 'open'
    );

    const hasNoOpenTask = !existingTasks.some((t: any) => t.type === 'followup_no_open');

    if (daysSinceSent >= (settings.followupDelay1Days || 3) && hasNoOpenTask) {
      await createNoOpenFollowUp(email.prospectId, email.id);
    }
  }
}
