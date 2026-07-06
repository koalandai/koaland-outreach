/**
 * Email generation shared by the manual Email Studio endpoint and the engine's
 * outreach/follow-up phases. GPT-4o when OPENAI_API_KEY is set; premium
 * hand-written templates otherwise. Every body ends exactly with the Koaland
 * signature — enforced in the system prompt and in the templates.
 */

const SIGNATURE = 'Best,\nMurat\nKoaland.ai';

const TYPE_GUIDANCE = {
  initial: 'This is the FIRST touch. Lead with the specific audit finding as the earned reason for writing.',
  followup_1: 'This is follow-up #1. Reference the earlier note lightly, add ONE new specific finding or angle. Never guilt-trip.',
  followup_2: 'This is follow-up #2. Be even shorter. Offer one concrete, giveable insight. Calm, zero pressure.',
  breakup: 'This is the final note. Graciously close the loop, leave the door open, no bitterness, under 90 words.',
};

function fallbackVariants(prospect, type) {
  const n = prospect.hotelName, loc = prospect.location ? ` in ${prospect.location}` : '';
  if (type === 'followup_1' || type === 'followup_2') {
    const shorter = type === 'followup_2';
    return [{
      name: shorter ? 'Second Nudge — One Insight' : 'First Follow-up — New Angle',
      angle: 'Follow-up',
      subjectOptions: [`Re: ${n} — one more thing`, `${n} — a specific finding`, 'One thing I should have led with'],
      body: shorter
        ? `Hi,\n\nOne finding from my look at ${n} worth sharing regardless: the property's positioning isn't reaching AI travel assistants — that's a growing share of luxury discovery${loc}.\n\nIf it's not a priority right now, no problem at all.\n\n${SIGNATURE}`
        : `Hi,\n\nFollowing up on my note about ${n}. One specific thing I noticed since: the direct booking path takes more steps than the OTA route — that gap quietly moves reservations to commission channels.\n\nHappy to share the two changes that matter most.\n\n${SIGNATURE}`,
      whyThisWorks: 'Adds a new specific observation instead of "just checking in".',
      strengthScore: { personalization: 78, clarity: 90, commercialHook: 80, lengthScore: 92, spamRisk: 'low', ctaStrength: 'soft-ask' },
    }];
  }
  if (type === 'breakup') {
    return [{
      name: 'Graceful Close',
      angle: 'Breakup',
      subjectOptions: [`Closing the loop on ${n}`, 'Last note from me', `${n} — I'll leave it here`],
      body: `Hi,\n\nI'll stop here — clearly the timing isn't right, and that's completely fine.\n\nThe audit findings for ${n} stay valid for a while; if direct bookings or AI search visibility become a priority later, I'm easy to find.\n\nWishing you a strong season${loc}.\n\n${SIGNATURE}`,
      whyThisWorks: 'Graceful exit preserves the relationship and often triggers a reply.',
      strengthScore: { personalization: 70, clarity: 95, commercialHook: 60, lengthScore: 95, spamRisk: 'very-low', ctaStrength: 'none' },
    }];
  }
  return [
    { name: 'Direct Booking Hook', angle: 'Direct Booking Clarity', subjectOptions: [`Quick note on ${n}'s booking flow`, `${n} — direct booking observation`, `Something I noticed on ${n}'s website`], body: `Hi,\n\nI was looking at ${n}'s website${loc} this week — specifically at how guests move from discovery to a direct booking.\n\nThe property is clearly premium. But the path to a direct reservation has friction points pushing guests toward OTA instead.\n\nI've mapped the specific changes that would have the biggest impact on direct booking conversion.\n\nWould it be useful to share?\n\n${SIGNATURE}`, whyThisWorks: 'Specific observation, not a pitch. Signals commercial intelligence.', strengthScore: { personalization: 80, clarity: 90, commercialHook: 84, lengthScore: 90, spamRisk: 'low', ctaStrength: 'soft-ask' } },
    { name: 'AI Search Angle', angle: 'AI Search Readiness', subjectOptions: [`What ChatGPT says about ${n}`, `${n} — AI search visibility`, `AI travel and ${n}`], body: `Hi,\n\nI ran ${n} through the AI search assistants luxury travelers now use — ChatGPT, Perplexity, Google AI.\n\nThe property barely surfaces, and when it does, the description doesn't match your actual positioning.\n\nThis is fixable — and worth closing before competitors${loc} get there first.\n\nHappy to share what AI systems see (and don't see).\n\n${SIGNATURE}`, whyThisWorks: 'Novel angle — very few hotels have heard this framing.', strengthScore: { personalization: 86, clarity: 85, commercialHook: 90, lengthScore: 88, spamRisk: 'low', ctaStrength: 'curiosity-driven' } },
    { name: 'Quiet Founder Note', angle: 'Quiet Founder Note', subjectOptions: [n, 'A quick note', `${n} — a quick look`], body: `Hi,\n\nI run a small company helping independent hotels with direct bookings and AI search visibility.\n\n${n} caught my attention. The positioning is right, but the digital presence isn't fully expressing it — meaning some value isn't converting into direct bookings.\n\nNot selling a platform. I do focused, founder-led audits.\n\nIf you're open to a look, I can share what I found.\n\n${SIGNATURE}`, whyThisWorks: '"Not selling a platform" disarms immediately. Peer-to-peer framing.', strengthScore: { personalization: 74, clarity: 93, commercialHook: 70, lengthScore: 94, spamRisk: 'very-low', ctaStrength: 'permission-based' } },
  ];
}

async function generateVariants({ prospect, audit, settings, type = 'initial', angle = '', behaviorSignals = '' }) {
  if (process.env.OPENAI_API_KEY && audit) {
    try {
      console.log(`[Email] Calling GPT-4o (${type})...`);
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const topFinding = audit.topFindings?.[0];
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o', temperature: 0.5, response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `You write short, premium, founder-led outbound emails for Murat at Koaland.ai. Rules: Never generic. Under 200 words. Always end exactly:\n${SIGNATURE}\nNever: "Hope you are well", "I came across", "Just checking in". Specific, calm, commercially useful.` },
          { role: 'user', content: `Generate 3 email variants for ${prospect.hotelName}.\nLocation: ${prospect.location || 'Unknown'}\nSegment: ${prospect.segment || 'boutique/luxury'}\nType: ${type} — ${TYPE_GUIDANCE[type] || TYPE_GUIDANCE.initial}\nAngle: ${angle || audit.recommendedAngle}\nAudit Summary: ${audit.executiveSummary}\nTop Finding: ${topFinding?.title} — ${topFinding?.outreachHook}\nHook: ${audit.oneSentenceHook}\nScores (no numbers in email): ${Object.entries(audit.scores || {}).map(([k, v]) => `${k}:${v}`).join(', ')}\nBehavior signals: ${behaviorSignals || 'None — no engagement data yet.'}\n${settings.demoKitLink ? `Demo Kit: ${settings.demoKitLink}` : 'No demo kit — omit CTA.'}\n${settings.calendarLink ? `Calendar: ${settings.calendarLink}` : ''}\n\nReturn ONLY valid JSON:\n{"variants":[{"name":"string","angle":"string","subjectOptions":["s1","s2","s3"],"body":"full body with signature","whyThisWorks":"1 sentence","strengthScore":{"personalization":0-100,"clarity":0-100,"commercialHook":0-100,"lengthScore":0-100,"spamRisk":"low|medium|high","ctaStrength":"string"}}]}` },
        ],
      });
      const result = JSON.parse(resp.choices[0].message.content);
      if (result.variants?.length) {
        console.log('[Email] Generated', result.variants.length, 'variants');
        return result.variants;
      }
    } catch (err) { console.error('[Email] OpenAI error:', err.message); }
  }
  return fallbackVariants(prospect, type);
}

/** Highest mean of the numeric strengthScore fields wins. */
function pickBestVariant(variants) {
  if (!variants?.length) return null;
  const score = v => {
    const nums = Object.values(v.strengthScore || {}).filter(x => typeof x === 'number');
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  };
  return [...variants].sort((a, b) => score(b) - score(a))[0];
}

module.exports = { generateVariants, pickBestVariant, SIGNATURE };
