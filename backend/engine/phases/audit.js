/**
 * Audit phase: auto-run one audit per tick per campaign for prospects that
 * finished research. One per tick keeps API cost and tick duration bounded.
 * createTask:false, the engine's outreach phase drafts the email itself.
 */

const { read } = require('../store');
const { runAudit } = require('../audit-runner');

async function run(campaign, ctx) {
  const actions = [];
  const prospect = read('prospects').find(p => p.campaignId === campaign.id && p.status === 'research_complete');
  if (!prospect) return actions;

  const audit = await runAudit({ prospectId: prospect.id, baseUrl: ctx.baseUrl || '', createTask: false });
  const overall = Math.round(Object.values(audit.scores).reduce((a, b) => a + b, 0) / Object.values(audit.scores).length);
  actions.push(`Audit: ${prospect.hotelName} scored ${overall}/100 (upside ${audit.scores.commercialUpside}, angle: ${audit.recommendedAngle})`);
  return actions;
}

module.exports = { run };
