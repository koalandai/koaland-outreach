/**
 * Research phase: crawl newly discovered prospects, capture contact emails,
 * and advance them to research_complete. Crawl failures don't block the
 * pipeline (fake mock domains will always fail), they're recorded on the
 * prospect and the audit phase falls back to metadata-only analysis.
 */

const { read, write } = require('../store');
const { crawlWebsite } = require('../crawler');

const MAX_PER_TICK = 2;

async function run(campaign, ctx) {
  const actions = [];
  const prospects = read('prospects');
  const queue = prospects.filter(p => p.campaignId === campaign.id && p.status === 'research_queue').slice(0, MAX_PER_TICK);

  for (const prospect of queue) {
    let note = '';
    let emailFound = '';
    if (prospect.website) {
      try {
        const crawl = await crawlWebsite(prospect.website);
        if (crawl.emailsFound?.length) emailFound = crawl.emailsFound[0];
        note = `crawled: "${crawl.title}" (${crawl.bodyText.length} chars)`;
      } catch (err) {
        note = `crawl failed: ${err.message}`;
      }
    } else {
      note = 'no website on record';
    }

    const list = read('prospects');
    const idx = list.findIndex(p => p.id === prospect.id);
    if (idx === -1) continue;
    list[idx] = {
      ...list[idx],
      status: 'research_complete',
      researchNote: note,
      lastActionAt: new Date().toISOString(),
    };
    if (emailFound && !list[idx].contactEmail) list[idx].contactEmail = emailFound;
    write('prospects', list);
    actions.push(`Research: ${prospect.hotelName} → research_complete (${note})`);
  }

  return actions;
}

module.exports = { run };
