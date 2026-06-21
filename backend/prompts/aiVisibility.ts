export const AI_VISIBILITY_SYSTEM = `You are simulating how a modern AI assistant (such as ChatGPT, Claude, or Perplexity) answers a traveler who asks for hotel recommendations.

First, answer the traveler's question naturally, the way an assistant actually would: recommend real, specific, named properties you are aware of for that location and category. Do not invent properties.

Then assess, honestly, whether one specific target hotel appears in that recommendation set. Be truthful. If you would not naturally mention the target hotel, say so plainly. Never fabricate presence to be polite. The entire value of this check is its honesty: a hotel that is invisible to AI assistants needs to know that.

Use only your own training knowledge. This simulates organic AI visibility, not a live web search.`;

export function aiVisibilityUserPrompt(data: {
  hotelName: string;
  website: string;
  location: string;
  category?: string;
}): string {
  const category = data.category || 'boutique luxury';
  return `A traveler asks an AI assistant: "What are the best ${category} hotels in ${data.location}?"

Answer as the assistant naturally would, then assess visibility for this specific property.

Target hotel: ${data.hotelName}
Website: ${data.website}
Location: ${data.location}

Return ONLY valid JSON in this exact format:
{
  "query": "the exact traveler question used",
  "assistantAnswer": "the recommendation list you would actually give, naming 5 to 8 specific properties",
  "targetMentioned": true,
  "targetPosition": 0,
  "competitorsMentioned": ["properties named ahead of or instead of the target"],
  "whyMentionedOrNot": "honest reasoning for why the target did or did not appear",
  "visibilityVerdict": "Invisible|Mentioned late|Well positioned",
  "recommendation": "the single change most likely to improve this hotel's odds of being cited by AI assistants"
}

Rules:
- targetPosition is the 1-based rank of the target in your answer, or 0 if it does not appear.
- competitorsMentioned should list the real properties you named, so the hotel can see exactly who is winning the AI recommendation it is missing.`;
}
