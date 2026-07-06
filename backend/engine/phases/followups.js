/**
 * Follow-up phase: advances each prospect's sequence when nextFollowupAt is
 * due. Feeds real behavior signals (opens, report views, days elapsed) into
 * the generator so follow-ups reference reality, never fabricate it.
 * Sequences that got a reply/bounce/unsubscribe were already stopped by
 * signals.js; this phase double-checks before writing anything.
 */

const { read, write, lid, getSettings } = require('../store');
const { generateVariants, pickBestVariant } = require('../email-generator');

function behaviorSignalsFor(prospectId) {
  const emails = read('emails').filter(e => e.prospectId === prospectId && !e.isTest);
  const audits = read('audits').filter(a => a.prospectId === prospectId);
  const lastSent = emails.filter(e => e.sentAt).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0];
  const daysSince = lastSent ? Math.floor((Date.now() - new Date(lastSent.sentAt)) / 86400000) : 0;
  const opened = emails.some(e => ['opened', 'clicked', 'replied'].includes(e.status));
  const pdfViews = audits.reduce((sum, a) => sum + (a.pdfOpenCount || 0), 0);
  return {
    text: `Email opened: ${opened}. Audit report views: ${pdfViews}. Days since last send: ${daysSince}.`,
    opened, pdfViews, daysSince,
  };
}

async function run(campaign, ctx) {
  const actions = [];
  const now = new Date();
  const due = read('prospects').filter(p =>
    p.campaignId === campaign.id &&
    p.engineManaged &&
    (p.sequenceStep || 0) >= 1 &&
    !p.sequenceStoppedReason &&
    p.nextFollowupAt && new Date(p.nextFollowupAt) <= now
  );

  for (const prospect of due) {
    const emails = read('emails').filter(e => e.prospectId === prospect.id && !e.isTest);

    // safety: stop-signals win even if signals.js missed them
    const stopped = emails.find(e => ['replied', 'bounced', 'unsubscribed'].includes(e.status));
    if (stopped) {
      const list = read('prospects');
      const idx = list.findIndex(p => p.id === prospect.id);
      if (idx !== -1) { list[idx] = { ...list[idx], sequenceStoppedReason: stopped.status, nextFollowupAt: null }; write('prospects', list); }
      actions.push(`Follow-up: sequence stopped for ${prospect.hotelName} (${stopped.status})`);
      continue;
    }

    // don't stack follow-ups while one is still waiting to go out
    if (emails.some(e => e.status === 'scheduled')) continue;

    const nextStep = (campaign.sequence || []).find(s => s.step === (prospect.sequenceStep || 1) + 1);
    if (!nextStep) {
      const list = read('prospects');
      const idx = list.findIndex(p => p.id === prospect.id);
      if (idx !== -1) { list[idx] = { ...list[idx], sequenceStoppedReason: 'exhausted', nextFollowupAt: null }; write('prospects', list); }
      actions.push(`Follow-up: sequence exhausted for ${prospect.hotelName}`);
      continue;
    }

    const audit = read('audits')
      .filter(a => a.prospectId === prospect.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const signals = behaviorSignalsFor(prospect.id);
    const settings = getSettings();

    const variants = await generateVariants({ prospect, audit, settings, type: nextStep.type, behaviorSignals: signals.text });
    const best = pickBestVariant(variants);
    if (!best) { actions.push(`Follow-up: no variant generated for ${prospect.hotelName}`); continue; }

    const autoSend = !!campaign.sending?.autoSend;
    const list = read('emails');
    list.push({
      id: lid('em'),
      prospectId: prospect.id,
      campaignId: campaign.id,
      sequenceStep: nextStep.step,
      to: prospect.contactEmail,
      subject: best.subjectOptions?.[0] || `Re: ${prospect.hotelName}`,
      body: best.body,
      type: nextStep.type,
      variantName: best.name,
      angle: best.angle,
      behaviorSignals: signals.text,
      status: 'scheduled',
      approvalStatus: autoSend ? 'auto' : 'pending',
      scheduledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    write('emails', list);

    const prospects = read('prospects');
    const idx = prospects.findIndex(p => p.id === prospect.id);
    if (idx !== -1) {
      prospects[idx] = { ...prospects[idx], sequenceStep: nextStep.step, nextFollowupAt: null, lastActionAt: new Date().toISOString() };
      write('prospects', prospects);
    }

    actions.push(`Follow-up: drafted ${nextStep.type} (step ${nextStep.step}) for ${prospect.hotelName} — ${signals.text} → ${autoSend ? 'auto-send queue' : 'Outbox'}`);
  }

  return actions;
}

module.exports = { run };
