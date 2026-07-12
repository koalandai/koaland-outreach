export const HOTEL_RESEARCH_SYSTEM = `You are Koaland's hotel research analyst. You analyze only provided public data, crawled website content and SERP snippets. Do not invent facts or make up information. Extract the hotel's segment, positioning, visible offers, likely target audience, and public commercial signals. If something is unknown or not evident from the data provided, return null or "not enough public evidence". Be specific, evidence-based, and commercially literate. Think like a luxury hotel consultant, not a generic digital marketer. Never use em dashes or en dashes in any output. Use commas, colons, periods, or separate sentences instead.`;

export function hotelResearchUserPrompt(data: {
  url: string;
  title: string;
  metaDescription: string;
  headings: string[];
  bodyText: string;
  ctaTexts: string[];
  bookingLinks: string[];
  schemaTypes: string[];
  serpSnippet?: string;
}): string {
  return `Analyze the following public data for a hotel website and return a structured hotel profile.

URL: ${data.url}
Title: ${data.title}
Meta Description: ${data.metaDescription}

Headings:
${data.headings.slice(0, 20).join('\n')}

Body Text Sample:
${data.bodyText.slice(0, 3000)}

CTA Texts Found: ${data.ctaTexts.join(', ')}
Booking Links Found: ${data.bookingLinks.join(', ')}
Schema Types Found: ${data.schemaTypes.join(', ')}
SERP Snippet: ${data.serpSnippet || 'Not available'}

Return ONLY valid JSON in this exact format:
{
  "hotelProfile": {
    "hotelName": "string",
    "location": "string or null",
    "country": "string or null",
    "segment": "luxury|boutique|independent|resort|business|budget|unknown",
    "positioningSummary": "1-2 sentence description of how the hotel positions itself publicly",
    "visibleExperiences": ["array of experiences/amenities visible on the site"],
    "targetAudiences": ["array of apparent target guest segments"],
    "bookingPathSummary": "description of direct booking clarity or lack thereof",
    "contactQuality": "good|limited|none",
    "likelyIcpFit": 0-100,
    "icpFitReason": "why this hotel is or is not a fit for Koaland",
    "commercialUpsideScore": 0-100,
    "missingInputs": ["list of data that would improve this analysis"]
  }
}`;
}

export const HOTEL_RESEARCH_SCHEMA = {
  type: 'object',
  required: ['hotelProfile'],
  properties: {
    hotelProfile: {
      type: 'object',
      required: ['hotelName', 'segment', 'likelyIcpFit'],
      properties: {
        hotelName: { type: 'string' },
        location: { type: ['string', 'null'] },
        country: { type: ['string', 'null'] },
        segment: { type: 'string' },
        positioningSummary: { type: 'string' },
        visibleExperiences: { type: 'array', items: { type: 'string' } },
        targetAudiences: { type: 'array', items: { type: 'string' } },
        bookingPathSummary: { type: 'string' },
        contactQuality: { type: 'string' },
        likelyIcpFit: { type: 'number' },
        icpFitReason: { type: 'string' },
        commercialUpsideScore: { type: 'number' },
        missingInputs: { type: 'array', items: { type: 'string' } },
      }
    }
  }
};
