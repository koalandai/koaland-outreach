export const EMAIL_STRATEGIST_SYSTEM = `You write short, premium, founder-led outbound emails for Murat at Koaland.ai. Emails must feel specific, useful, calm, and commercially intelligent.

Rules:
- Never sound like generic AI spam
- Never overclaim or exaggerate
- Use the audit finding as the reason for reaching out, make the email feel earned
- Keep emails short (under 200 words body)
- Do not include demo kit link if demoKitLink is empty
- Always end with exactly:
  Best,
  Murat
  Koaland.ai
- Never use: "Hope you are well", "I came across your website", "We are an AI company", "Just checking in", "I wanted to reach out"
- The email should feel useful before asking for anything
- No aggressive sales pressure
- No fake personalization, only use what the audit actually found
- Never use em dashes or en dashes. Use commas, colons, periods, or separate sentences instead`;

export function emailStrategistUserPrompt(data: {
  hotelName: string;
  contactName?: string;
  location?: string;
  segment?: string;
  auditSummary: string;
  topFinding: string;
  recommendedAngle: string;
  oneSentenceHook: string;
  scores: Record<string, number>;
  pdfLink: string;
  demoKitLink?: string;
  calendarLink?: string;
  emailType: 'initial' | 'followup_1' | 'followup_2' | 'followup_3' | 'pdf_opened' | 'no_pdf_open';
  behaviorSignals?: string;
}): string {
  const greeting = data.contactName ? `Hi ${data.contactName},` : `Hi,`;
  const demoSection = data.demoKitLink ? `Demo kit: ${data.demoKitLink}` : 'No demo kit available (omit from email)';

  return `Generate 3 email variants for Murat's outreach to ${data.hotelName}.

Hotel: ${data.hotelName}
Location: ${data.location || 'Unknown'}
Segment: ${data.segment || 'boutique/luxury'}
Email Type: ${data.emailType}
Recommended Angle: ${data.recommendedAngle}

Audit Summary: ${data.auditSummary}
Top Finding: ${data.topFinding}
One Sentence Hook: ${data.oneSentenceHook}

Scores (for context, do not mention numbers in email):
${Object.entries(data.scores).map(([k, v]) => `- ${k}: ${v}/100`).join('\n')}

Audit PDF Link: ${data.pdfLink}
${demoSection}
Calendar Link: ${data.calendarLink || 'Not available'}

Behavior Signals: ${data.behaviorSignals || 'None, this is initial outreach'}

Suggested greeting: ${greeting}

Return ONLY valid JSON:
{
  "variants": [
    {
      "name": "Variant name (e.g. 'AI Search Hook')",
      "angle": "angle name",
      "subjectOptions": ["subject 1", "subject 2", "subject 3"],
      "previewText": "Email preview text (30-60 chars)",
      "body": "Complete email body including signature. Use \\n for line breaks.",
      "whyThisWorks": "1 sentence on why this angle works for this hotel",
      "strengthScore": {
        "personalization": 0-100,
        "clarity": 0-100,
        "commercialHook": 0-100,
        "spamRisk": "low|medium|high",
        "ctaStrength": "soft|medium|strong",
        "lengthScore": 0-100
      }
    }
  ]
}`;
}

export const FOLLOWUP_WRITER_SYSTEM = `You write focused, brief follow-up emails for Murat at Koaland.ai based on real prospect behavior signals. Never fabricate behavior. Never be pushy. Always end with:
Best,
Murat
Koaland.ai

Never use em dashes or en dashes. Use commas, colons, periods, or separate sentences instead.`;

export function followupWriterUserPrompt(data: {
  hotelName: string;
  contactName?: string;
  emailOpened: boolean;
  pdfOpened: boolean;
  pdfOpenCount: number;
  clicked: boolean;
  daysSinceSend: number;
  topFinding: string;
  pdfLink: string;
  followupType: string;
}): string {
  return `Write a follow-up email for ${data.hotelName}.

Behavior signals:
- Email opened: ${data.emailOpened}
- PDF viewed: ${data.pdfOpened}
- PDF view count: ${data.pdfOpenCount}
- Link clicked: ${data.clicked}
- Days since initial send: ${data.daysSinceSend}

Top audit finding: ${data.topFinding}
PDF Link: ${data.pdfLink}
Follow-up type: ${data.followupType}
Contact: ${data.contactName || 'team'}

Return ONLY valid JSON:
{
  "recommendedFollowUpType": "string",
  "reason": "why this follow-up makes sense now",
  "subjectOptions": ["subject 1", "subject 2"],
  "body": "Complete email body with signature. Use \\n for line breaks.",
  "urgency": "low|medium|high"
}`;
}
