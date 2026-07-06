export const DIGITAL_AUDITOR_SYSTEM = `You are Koaland.ai's digital experience auditor for brand-sensitive luxury and boutique hotels. Your job is not to produce generic SEO advice. Your job is to identify where the hotel's public digital experience may be leaking commercial value, direct booking demand, AI-search visibility, or brand clarity.

Use ONLY the provided data. Be specific, evidence-based, and commercially literate. Score conservatively. A 90+ score means genuinely excellent with minimal gaps. Most hotels should score in the 40-75 range. Use careful language like "may", "could", "public evidence suggests" when you cannot definitively prove something.

When you estimate revenue impact in euros, be conservative and always state the assumptions you used (assumed room count, ADR, OTA share, occupancy). Prefer ranges over single numbers. If you genuinely cannot estimate from the available data, say "Not estimable from public data" rather than guessing. Never present a euro figure as a precise fact: it is an illustrative estimate to make the cost of inaction tangible.

Think like a luxury hotel commercial director who also understands digital, SEO, and AI systems.`;

export function digitalAuditorUserPrompt(data: {
  url: string;
  title: string;
  metaDescription: string;
  headings: string[];
  bodyText: string;
  ctaTexts: string[];
  bookingLinks: string[];
  faqText: string;
  schemaTypes: string[];
  robotsHints: string;
  pagespeedMobile?: any;
  pagespeedDesktop?: any;
  serpBrandResults?: any;
  serpCategoryResults?: any;
  competitorData?: any[];
  notes?: string;
}): string {
  return `Perform a comprehensive digital experience audit for this luxury/boutique hotel website.

URL: ${data.url}
Title: ${data.title}
Meta Description: ${data.metaDescription}

Headings:
${data.headings.slice(0, 30).join('\n')}

Body Text Sample:
${data.bodyText.slice(0, 4000)}

CTA Texts: ${data.ctaTexts.join(' | ')}
Booking Links: ${data.bookingLinks.join(' | ')}
FAQ Text Found: ${data.faqText.slice(0, 1000) || 'None detected'}
Schema Types: ${data.schemaTypes.join(', ')}
Robots/Sitemap: ${data.robotsHints}

PageSpeed Mobile: ${data.pagespeedMobile ? JSON.stringify(data.pagespeedMobile, null, 2) : 'Not available'}
PageSpeed Desktop: ${data.pagespeedDesktop ? JSON.stringify(data.pagespeedDesktop, null, 2) : 'Not available'}

SERP Brand Query Results: ${data.serpBrandResults ? JSON.stringify(data.serpBrandResults) : 'Not available'}
SERP Category Query Results: ${data.serpCategoryResults ? JSON.stringify(data.serpCategoryResults) : 'Not available'}

Competitors: ${data.competitorData ? JSON.stringify(data.competitorData) : 'None provided'}

Notes: ${data.notes || 'None'}

Return ONLY valid JSON in this exact format:
{
  "scores": {
    "websiteExperience": 0-100,
    "seoReadiness": 0-100,
    "aeoReadiness": 0-100,
    "geoReadiness": 0-100,
    "directBookingClarity": 0-100,
    "luxuryBrandConsistency": 0-100,
    "commercialUpside": 0-100,
    "confidence": 0-100
  },
  "executiveSummary": "2-3 sentence summary of the hotel's digital commercial position",
  "topFindings": [
    {
      "title": "Finding title",
      "category": "website|seo|aeo|geo|direct_booking|commercial",
      "severity": "low|medium|high",
      "evidence": "Specific evidence from the data",
      "commercialMeaning": "What this means commercially for the hotel",
      "estimatedRevenueImpact": "Conservative euro estimate or range with the assumption stated, or 'Not estimable from public data'",
      "suggestedFix": "What would improve this",
      "outreachHook": "How Murat can use this as an outreach hook"
    }
  ],
  "commercialLeakageRisks": [
    {
      "title": "Risk title",
      "severity": "low|medium|high",
      "evidence": "Specific evidence",
      "commercialMeaning": "Commercial consequence",
      "estimatedRevenueImpact": "Conservative euro estimate or range with the assumption stated, or 'Not estimable from public data'",
      "suggestedFix": "Suggested fix",
      "outreachHook": "Outreach angle"
    }
  ],
  "estimatedAnnualLeakage": {
    "low": 0,
    "high": 0,
    "currency": "EUR",
    "basis": "Plain-language assumptions behind this range: state the assumed room count, ADR, occupancy, and OTA share you used. If not estimable, set low and high to 0 and explain why here."
  },
  "opportunities": [
    {
      "title": "Opportunity title",
      "impact": "low|medium|high",
      "effort": "low|medium|high",
      "urgency": "low|medium|high",
      "type": "Quick Win|Strategic Fix|Commercial Risk|Future Advantage",
      "whyItMatters": "Why this matters commercially"
    }
  ],
  "recommendedAngle": "The single strongest outreach angle for Murat",
  "oneSentenceHook": "One sentence that captures the core finding for outreach",
  "missingInputs": ["Data that would improve the audit"]
}`;
}
