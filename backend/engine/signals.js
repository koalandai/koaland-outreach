/**
 * Behavior signal ingestion + hot-lead scoring.
 * recordEvent() is the single entry point for everything the outside world
 * tells us: email delivered/opened/clicked/replied/bounced/unsubscribed and
 * audit-report views (pdf_opened). Locally these arrive from the audit-view
 * route and the /api/simulate endpoint; in production the SendGrid webhook
 * plays the same role.
 */

const { read, write, lid, getSettings } = require('./store');

const EMAIL_STATUS_RANK = { scheduled: 0, logged_only: 1, sent: 1, delivered: 2, opened: 3, clicked: 4, replied: 5, bounced: 5, unsubscribed: 5 };
const PROSPECT_STATUS_FOR = { delivered: 'delivered', opened: 'opened', clicked: 'opened', pdf_opened: 'pdf_viewed', replied: 'replied', bounced: 'bounced', unsubscribed: 'unsubscribed' };

function recalcHotLeadScore(prospectId) {
  const w = getSettings().hotLeadScoreWeights;
  const emails = read('emails').filter(e => e.prospectId === prospectId && !e.isTest);
  const audits = read('audits').filter(a => a.prospectId === prospectId);
  const prospects = read('prospects');
  const idx = prospects.findIndex(p => p.id === prospectId);
  if (idx === -1) return 0;

  let score = 0;
  for (const email of emails) {
    if (['delivered', 'opened', 'clicked', 'replied'].includes(email.status)) score += w.delivered;
    if (['opened', 'clicked', 'replied'].includes(email.status)) score += w.opened;
    if (['clicked', 'replied'].includes(email.status)) score += w.clicked;
    if (email.status === 'replied') score += w.replied;
    if (email.status === 'bounced') score += w.bounced;
    if (email.status === 'unsubscribed') score += w.unsubscribed;
  }
  for (const audit of audits) {
    if ((audit.pdfOpenCount || 0) >= 1) score += w.pdfOpened;
    if ((audit.pdfOpenCount || 0) >= 2) score += w.pdfOpenedAgain;
  }
  if ((prospects[idx].icpFitScore || 0) >= 80) score += w.icpFitHigh;

  prospects[idx] = { ...prospects[idx], hotLeadScore: score, lastActionAt: new Date().toISOString() };
  write('prospects', prospects);
  return score;
}

function createTask(prospectId, type, title, reason, recommendedAction, dueInDays) {
  const tasks = read('tasks');
  // one open task per type per prospect, don't spam the queue
  if (tasks.some(t => t.prospectId === prospectId && t.type === type && t.status === 'open')) return null;
  const task = {
    id: lid('tsk'), prospectId, type, title, reason, recommendedAction,
    status: 'open', dueAt: new Date(Date.now() + dueInDays * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  };
  tasks.push(task); write('tasks', tasks);
  return task;
}

function stopSequence(prospectId, reason) {
  const prospects = read('prospects');
  const idx = prospects.findIndex(p => p.id === prospectId);
  if (idx === -1) return;
  prospects[idx] = { ...prospects[idx], sequenceStoppedReason: reason, nextFollowupAt: null };
  write('prospects', prospects);
  // cancel any still-unsent scheduled emails for this prospect
  const emails = read('emails');
  let changed = false;
  for (const e of emails) {
    if (e.prospectId === prospectId && e.status === 'scheduled') { e.status = 'cancelled'; e.approvalStatus = 'cancelled'; changed = true; }
  }
  if (changed) write('emails', emails);
}

/**
 * Record a behavior event.
 * @param {object} p
 * @param {string} p.type delivered|opened|clicked|replied|bounced|unsubscribed|pdf_opened
 * @param {string} [p.emailId]
 * @param {string} [p.prospectId]
 * @param {string} [p.auditToken] for pdf_opened
 * @returns {{ok: boolean, message: string}}
 */
function recordEvent({ type, emailId, prospectId, auditToken }) {
  let email = null;
  if (emailId) {
    const emails = read('emails');
    email = emails.find(e => e.id === emailId);
    if (!email) return { ok: false, message: 'Email not found' };
    prospectId = prospectId || email.prospectId;
    // only upgrade email status (sent → opened, never opened → delivered)
    if (type !== 'pdf_opened' && (EMAIL_STATUS_RANK[type] ?? 0) > (EMAIL_STATUS_RANK[email.status] ?? 0)) {
      email.status = type;
      write('emails', emails);
    }
  }

  let audit = null;
  let pdfOpenCount = 0;
  if (type === 'pdf_opened' && auditToken) {
    const audits = read('audits');
    audit = audits.find(a => a.pdfToken === auditToken);
    if (!audit) return { ok: false, message: 'Audit not found' };
    prospectId = prospectId || audit.prospectId;
    audit.pdfOpenCount = (audit.pdfOpenCount || 0) + 1;
    pdfOpenCount = audit.pdfOpenCount;
    write('audits', audits);
  }

  if (!prospectId) return { ok: false, message: 'No prospect resolved for event' };

  const events = read('events');
  events.push({ id: lid('evt'), type: type === 'pdf_opened' ? 'pdf_opened' : `email_${type}`, prospectId, emailId: emailId || null, createdAt: new Date().toISOString() });
  write('events', events);

  const prospects = read('prospects');
  const idx = prospects.findIndex(p => p.id === prospectId);
  if (idx === -1) return { ok: false, message: 'Prospect not found' };
  const prospect = prospects[idx];
  const newStatus = PROSPECT_STATUS_FOR[type];
  // prospect status only moves forward through engagement states
  const order = ['sent', 'delivered', 'opened', 'pdf_viewed', 'replied'];
  if (newStatus && (['replied', 'bounced', 'unsubscribed'].includes(newStatus) || order.indexOf(newStatus) > order.indexOf(prospect.status))) {
    prospects[idx] = { ...prospect, status: newStatus };
    write('prospects', prospects);
  }

  // behavior-driven tasks and sequence control
  if (type === 'pdf_opened') {
    if (pdfOpenCount >= 2) {
      createTask(prospectId, 'followup_hot_pdf', `⚡ HOT, ${prospect.hotelName} viewed the audit ${pdfOpenCount} times`, `Prospect viewed the audit report ${pdfOpenCount} times, strong buying signal.`, 'Reach out today. Mention the report resonated. Offer a short call.', 0);
    } else {
      createTask(prospectId, 'followup_after_pdf_view', `Follow up with ${prospect.hotelName}, audit viewed`, 'Prospect viewed the audit report, signal of interest.', 'Follow up within 24 hours. Reference the report and ask for their reaction.', 1);
    }
    // pull the next automated follow-up forward to ride the interest
    const list = read('prospects');
    const i2 = list.findIndex(p => p.id === prospectId);
    if (i2 !== -1 && list[i2].nextFollowupAt) {
      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      if (list[i2].nextFollowupAt > tomorrow) { list[i2].nextFollowupAt = tomorrow; write('prospects', list); }
    }
  }
  if (type === 'replied') {
    stopSequence(prospectId, 'replied');
    createTask(prospectId, 'reply_received', `Reply from ${prospect.hotelName}, respond today`, 'Prospect replied to outreach.', 'Read the reply and respond personally within a few hours.', 0);
  }
  if (type === 'bounced') {
    stopSequence(prospectId, 'bounced');
    createTask(prospectId, 'contact_research', `Find better contact for ${prospect.hotelName}, email bounced`, 'The email bounced, contact address likely wrong or inactive.', 'Check LinkedIn, the hotel website, or the booking engine for a better address.', 1);
  }
  if (type === 'unsubscribed') stopSequence(prospectId, 'unsubscribed');

  recalcHotLeadScore(prospectId);
  return { ok: true, message: `${type} recorded for ${prospect.hotelName}` };
}

module.exports = { recordEvent, recalcHotLeadScore, stopSequence };
