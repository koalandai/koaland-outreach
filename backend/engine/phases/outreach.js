/**
 * Outreach phase: for audit-ready prospects, generate email variants, pick the
 * strongest, and schedule the step-1 send. Whether it goes out automatically
 * or waits in the Outbox is decided by the campaign's sending.autoSend flag.
 * Prospects without a contact email get a one-time contact_research task.
 */

const { read, write, lid, getSettings } = require('../store');
const { generateVariants, pickBestVariant } = require('../email-generator');

const MAX_PER_TICK = 2;

async function run(campaign, ctx) {
  const actions = [];
  const candidates = read('prospects')
    .filter(p => p.campaignId === campaign.id && p.status === 'audit_ready')
    .slice(0, MAX_PER_TICK);

  for (const prospect of candidates) {
    if (!prospect.contactEmail) {
      if (!prospect.needsContact) {
        const tasks = read('tasks');
        tasks.push({ id: lid('tsk'), prospectId: prospect.id, type: 'contact_research', title: `Find contact for ${prospect.hotelName}`, reason: 'Audit ready but no contact email found during research.', recommendedAction: 'Check the hotel website, LinkedIn, or booking engine for a contact address, then add it to the prospect.', status: 'open', dueAt: new Date(Date.now() + 86400000).toISOString(), createdAt: new Date().toISOString() });
        write('tasks', tasks);
        const list = read('prospects');
        const idx = list.findIndex(p => p.id === prospect.id);
        if (idx !== -1) { list[idx].needsContact = true; write('prospects', list); }
        actions.push(`Outreach: ${prospect.hotelName} has no contact email, contact research task created`);
      }
      continue;
    }

    const audit = read('audits')
      .filter(a => a.prospectId === prospect.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const settings = getSettings();

    const variants = await generateVariants({ prospect, audit, settings, type: 'initial', angle: prospect.recommendedAngle });
    const best = pickBestVariant(variants);
    if (!best) { actions.push(`Outreach: no variant generated for ${prospect.hotelName}`); continue; }

    const autoSend = !!campaign.sending?.autoSend;
    const emails = read('emails');
    emails.push({
      id: lid('em'),
      prospectId: prospect.id,
      campaignId: campaign.id,
      sequenceStep: 1,
      to: prospect.contactEmail,
      subject: best.subjectOptions?.[0] || `A note on ${prospect.hotelName}`,
      body: best.body,
      type: 'initial',
      variantName: best.name,
      angle: best.angle,
      status: 'scheduled',
      approvalStatus: autoSend ? 'auto' : 'pending',
      scheduledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    write('emails', emails);

    const list = read('prospects');
    const idx = list.findIndex(p => p.id === prospect.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], status: 'email_drafted', sequenceStep: 1, lastActionAt: new Date().toISOString() };
      write('prospects', list);
    }

    actions.push(`Outreach: drafted "${best.name}" for ${prospect.hotelName} → ${autoSend ? 'auto-send queue' : 'Outbox (awaiting approval)'}`);
  }

  return actions;
}

module.exports = { run };
