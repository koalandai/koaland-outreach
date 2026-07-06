/**
 * Send queue: delivers due scheduled emails while enforcing the campaign's
 * approval gate, daily send limit, and send window. Without a SendGrid key
 * every send is logged-only (status 'logged_only') — no real email leaves.
 * After a send it arms the prospect's next follow-up (nextFollowupAt).
 */

const { read, write, lid, getSettings } = require('./store');
const { recalcHotLeadScore } = require('./signals');

function todayKey() { return new Date().toISOString().slice(0, 10); }

function sentTodayCount(emails, campaignId) {
  return emails.filter(e =>
    e.campaignId === campaignId && !e.isTest && e.sentAt &&
    e.sentAt.slice(0, 10) === todayKey() &&
    ['sent', 'logged_only', 'delivered', 'opened', 'clicked', 'replied'].includes(e.status)
  ).length;
}

function inSendWindow(sending) {
  const w = sending?.sendWindow;
  if (!w) return true;
  const h = new Date().getHours();
  return h >= (w.startHour ?? 0) && h < (w.endHour ?? 24);
}

async function deliver(email, settings) {
  const to = email.isTest || email.testMode ? (settings.testEmailAddress || email.to) : email.to;
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[Engine Send] No SendGrid — logged only. To: ${to} Subject: ${email.subject}`);
    return 'logged_only';
  }
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  await sgMail.send({
    to,
    from: { email: process.env.SENDGRID_FROM_EMAIL || 'murat@koaland.ai', name: process.env.SENDGRID_FROM_NAME || 'Murat' },
    subject: email.subject,
    text: email.body,
    html: email.body.replace(/\n/g, '<br>'),
  });
  return 'sent';
}

async function processDueSends(ctx) {
  const actions = [];
  const settings = getSettings();
  const now = new Date();
  const campaigns = read('campaigns');
  const emails = read('emails');

  const due = emails.filter(e =>
    e.status === 'scheduled' &&
    ['auto', 'approved'].includes(e.approvalStatus) &&
    new Date(e.scheduledAt) <= now
  );

  for (const email of due) {
    const campaign = campaigns.find(c => c.id === email.campaignId);
    const sending = campaign?.sending || { dailySendLimit: settings.dailySendLimit || 10 };

    if (campaign && campaign.status !== 'active') continue;
    if (!inSendWindow(sending)) { continue; }
    if (sentTodayCount(read('emails'), email.campaignId) >= (sending.dailySendLimit ?? 10)) {
      continue; // budget exhausted — stays scheduled for tomorrow
    }

    let status;
    try {
      status = await deliver({ ...email, testMode: sending.testMode }, settings);
    } catch (err) {
      actions.push(`Send FAILED to ${email.to}: ${err.message}`);
      continue; // stays scheduled; next tick retries
    }

    const list = read('emails');
    const idx = list.findIndex(e => e.id === email.id);
    if (idx === -1) continue;
    list[idx] = { ...list[idx], status, sentAt: new Date().toISOString() };
    write('emails', list);

    // prospect status + follow-up arming
    const prospects = read('prospects');
    const pIdx = prospects.findIndex(p => p.id === email.prospectId);
    if (pIdx !== -1) {
      const prospect = prospects[pIdx];
      const step = email.sequenceStep || 1;
      const sequence = campaign?.sequence || [];
      const nextStep = sequence.find(s => s.step === step + 1);
      prospects[pIdx] = {
        ...prospect,
        status: 'sent',
        sequenceStep: step,
        nextFollowupAt: nextStep ? new Date(now.getTime() + nextStep.delayDays * 86400000).toISOString() : null,
        lastActionAt: new Date().toISOString(),
      };
      write('prospects', prospects);
      recalcHotLeadScore(email.prospectId);
    }

    const events = read('events');
    events.push({ id: lid('evt'), type: 'email_sent', prospectId: email.prospectId, emailId: email.id, campaignId: email.campaignId, createdAt: new Date().toISOString() });
    write('events', events);

    if (campaign) {
      const cIdx = campaigns.findIndex(c => c.id === campaign.id);
      campaigns[cIdx].metrics = { ...campaigns[cIdx].metrics, sent: (campaigns[cIdx].metrics?.sent || 0) + 1 };
      write('campaigns', campaigns);
    }

    actions.push(`Sent step ${email.sequenceStep} to ${email.to} (${status === 'logged_only' ? 'logged — no SendGrid key' : 'via SendGrid'}): "${email.subject}"`);
  }

  return actions;
}

module.exports = { processDueSends };
