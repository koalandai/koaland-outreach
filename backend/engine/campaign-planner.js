/**
 * Campaign planning: defaults for every campaign, plus an AI planner that
 * turns "region + goal" into a full campaign configuration.
 * GPT-4o when OPENAI_API_KEY is set; deterministic heuristic otherwise.
 */

const DEFAULT_CAMPAIGN = {
  status: 'draft',
  region: '',
  searchQueries: [],
  segment: 'boutique',
  targetProspectCount: 15,
  icpThreshold: 60,
  sequence: [
    { step: 1, type: 'initial', delayDays: 0 },
    { step: 2, type: 'followup_1', delayDays: 3 },
    { step: 3, type: 'followup_2', delayDays: 5 },
    { step: 4, type: 'breakup', delayDays: 8 },
  ],
  sending: {
    autoSend: false,
    dailySendLimit: 10,
    sendWindow: { startHour: 9, endHour: 18 },
    testMode: false,
  },
  notes: '',
  metrics: { prospects: 0, audits: 0, sent: 0, delivered: 0, opened: 0, pdfViews: 0, replied: 0, bounced: 0 },
};

/** Deep-merge a user-supplied campaign body over the defaults. */
function withCampaignDefaults(body = {}) {
  return {
    ...DEFAULT_CAMPAIGN,
    ...body,
    sequence: Array.isArray(body.sequence) && body.sequence.length ? body.sequence : DEFAULT_CAMPAIGN.sequence,
    sending: { ...DEFAULT_CAMPAIGN.sending, ...(body.sending || {}), sendWindow: { ...DEFAULT_CAMPAIGN.sending.sendWindow, ...(body.sending?.sendWindow || {}) } },
    metrics: { ...DEFAULT_CAMPAIGN.metrics, ...(body.metrics || {}) },
  };
}

function heuristicPlan({ region, goal, segment, notes }) {
  const seg = segment || 'boutique';
  const regionName = region || 'the target region';
  return {
    ...DEFAULT_CAMPAIGN,
    name: `${regionName} — ${seg} outreach`,
    region: regionName,
    segment: seg,
    searchQueries: [
      `${seg} luxury hotels ${regionName} official site`,
      `independent ${seg} hotel ${regionName}`,
      `small luxury hotel ${regionName} direct booking`,
    ],
    notes: notes || goal || '',
    rationale: `Heuristic plan (no OPENAI_API_KEY): three discovery queries biased toward independent ${seg} properties in ${regionName}, standard 4-step sequence over 8 days with approval-gated sending.`,
    expectedFunnel: { prospects: 15, audits: 12, sent: 10, opened: 4, replies: 1 },
  };
}

async function planCampaign({ region, goal, segment, notes }) {
  if (!process.env.OPENAI_API_KEY) return heuristicPlan({ region, goal, segment, notes });

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o', temperature: 0.4, response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You plan outbound campaigns for Koaland.ai, which sells digital-experience audits and direct-booking/AI-search-visibility improvements to brand-sensitive luxury and boutique hotels. You design focused regional campaigns: realistic search queries that find independent hotel websites (never OTAs), a sensible sequence cadence, and conservative funnel expectations. Be specific to the region and segment.',
        },
        {
          role: 'user',
          content: `Plan an outbound campaign.\n\nRegion: ${region || 'Unspecified'}\nSegment: ${segment || 'boutique/luxury'}\nGoal: ${goal || 'Book audits with independent hotels'}\nNotes: ${notes || 'None'}\n\nReturn ONLY valid JSON:\n{\n  "name": "short campaign name",\n  "region": "normalized region string",\n  "segment": "boutique|luxury|resort|independent",\n  "searchQueries": ["3-5 Google queries that surface independent hotel official websites in the region"],\n  "targetProspectCount": 10-40,\n  "icpThreshold": 50-80,\n  "sequence": [{"step":1,"type":"initial","delayDays":0},{"step":2,"type":"followup_1","delayDays":2-4},{"step":3,"type":"followup_2","delayDays":4-7},{"step":4,"type":"breakup","delayDays":7-12}],\n  "sending": {"dailySendLimit": 5-15},\n  "rationale": "2-3 sentences on why this plan fits the region/segment",\n  "expectedFunnel": {"prospects":0,"audits":0,"sent":0,"opened":0,"replies":0}\n}`,
        },
      ],
    });
    const ai = JSON.parse(resp.choices[0].message.content);
    const plan = withCampaignDefaults({ ...ai, notes: notes || goal || '' });
    plan.rationale = ai.rationale || '';
    plan.expectedFunnel = ai.expectedFunnel || null;
    return plan;
  } catch (err) {
    console.error('[Planner] OpenAI error, using heuristic plan:', err.message);
    const plan = heuristicPlan({ region, goal, segment, notes });
    plan.rationale += ` (OpenAI error: ${err.message})`;
    return plan;
  }
}

module.exports = { DEFAULT_CAMPAIGN, withCampaignDefaults, planCampaign };
