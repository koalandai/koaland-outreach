/**
 * Discovery phase: generate prospect hotels for a campaign's region.
 * Uses a real SERP provider when SERP_API_KEY is set; otherwise a region-seeded
 * mock generator so the pipeline is fully testable offline. Mock prospects get
 * an info@ contact email (their domains are fake, so research can't find one) —
 * harmless because without a SendGrid key all sends are logged-only.
 */

const { read, write, lid } = require('../store');

const MAX_NEW_PER_TICK = 5;

const MOCK_NAME_TEMPLATES = [
  'Villa {R} Boutique Hotel', 'The {R} Stone House', 'Maison {R}', '{R} Cove Suites',
  'Casa {R}', 'The Old Harbour {R}', '{R} Terrace Hotel', 'Azure {R} Residences',
  '{R} Garden Retreat', 'Palazzo {R}', 'The {R} Courtyard', '{R} Cliff House',
];

function regionWord(region) {
  return (region || 'Riviera').split(',')[0].trim().split(/\s+/).slice(-1)[0].replace(/[^A-Za-z]/g, '') || 'Riviera';
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30);
}

function mockDiscoveryResults(campaign, existingUrls) {
  const word = regionWord(campaign.region);
  const results = [];
  for (const tpl of MOCK_NAME_TEMPLATES) {
    const name = tpl.replace('{R}', word);
    const slug = slugify(name);
    const website = `https://www.${slug}.com`;
    if (existingUrls.has(website)) continue;
    results.push({
      hotelName: name,
      website,
      location: campaign.region,
      snippet: `${name} — independent ${campaign.segment || 'boutique'} property in ${campaign.region}.`,
      initialIcpFit: Math.round(50 + Math.random() * 45),
      contactEmail: `info@${slug}.com`,
      source: 'engine_discovery_mock',
    });
  }
  return results;
}

async function serpDiscoveryResults(campaign, query, existingUrls) {
  const OTA = ['booking.com', 'expedia.com', 'tripadvisor.com', 'airbnb.com', 'hotels.com', 'agoda.com'];
  const key = process.env.SERP_API_KEY;
  const provider = process.env.SERP_PROVIDER || 'serpapi';
  let organic = [];
  if (provider === 'serper') {
    const r = await fetch('https://google.serper.dev/search', { method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ q: query, num: 20 }) });
    organic = (await r.json()).organic || [];
  } else {
    const url = provider === 'valueserp'
      ? `https://api.valueserp.com/search?q=${encodeURIComponent(query)}&api_key=${key}&num=20`
      : `https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${key}&num=20&engine=google`;
    const d = await (await fetch(url)).json();
    organic = d.organic_results || d.results || [];
  }
  return organic
    .filter(r => r.link && !OTA.some(o => r.link.includes(o)) && !existingUrls.has(r.link))
    .map(r => ({
      hotelName: (r.title || '').replace(/\s*[-|·].*/, '').trim() || r.link,
      website: r.link,
      location: campaign.region,
      snippet: r.snippet || '',
      initialIcpFit: Math.round(50 + Math.random() * 40),
      source: 'engine_discovery_serp',
    }));
}

async function run(campaign, ctx) {
  const actions = [];
  const prospects = read('prospects');
  const campaignProspects = prospects.filter(p => p.campaignId === campaign.id);
  const target = campaign.targetProspectCount || 15;
  if (campaignProspects.length >= target) return actions;

  const queries = campaign.searchQueries?.length ? campaign.searchQueries : [`${campaign.segment || 'boutique'} hotels ${campaign.region}`];
  const cursor = campaign.discoveryCursor || 0;
  const query = queries[cursor % queries.length];
  const existingUrls = new Set(prospects.map(p => p.website));

  let results;
  if (process.env.SERP_API_KEY) {
    results = await serpDiscoveryResults(campaign, query, existingUrls);
  } else {
    results = mockDiscoveryResults(campaign, existingUrls);
  }

  const threshold = campaign.icpThreshold ?? 60;
  const room = Math.min(MAX_NEW_PER_TICK, target - campaignProspects.length);
  const accepted = results.filter(r => r.initialIcpFit >= threshold).slice(0, room);

  if (accepted.length) {
    const now = new Date().toISOString();
    for (const r of accepted) {
      prospects.push({
        id: lid('pro'),
        hotelName: r.hotelName,
        website: r.website,
        location: r.location,
        segment: campaign.segment || 'boutique',
        contactEmail: r.contactEmail || '',
        snippet: r.snippet,
        status: 'research_queue',
        campaignId: campaign.id,
        engineManaged: true,
        source: r.source,
        icpFitScore: r.initialIcpFit,
        hotLeadScore: 0,
        auditScore: 0,
        priority: r.initialIcpFit >= 80 ? 'A' : r.initialIcpFit >= 60 ? 'B' : 'C',
        createdAt: now,
        lastActionAt: now,
      });
    }
    write('prospects', prospects);
    actions.push(`Discovery: added ${accepted.length} prospect(s) for "${query}" (${campaignProspects.length + accepted.length}/${target})`);
  } else if (results.length) {
    actions.push(`Discovery: ${results.length} result(s) for "${query}" but none passed ICP threshold ${threshold}`);
  }

  // rotate the query cursor so the next tick tries the next query
  const campaigns = read('campaigns');
  const idx = campaigns.findIndex(c => c.id === campaign.id);
  if (idx !== -1) {
    campaigns[idx].discoveryCursor = cursor + 1;
    campaigns[idx].metrics = { ...campaigns[idx].metrics, prospects: prospects.filter(p => p.campaignId === campaign.id).length };
    write('campaigns', campaigns);
  }

  return actions;
}

module.exports = { run };
