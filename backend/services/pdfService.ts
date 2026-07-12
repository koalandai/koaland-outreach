/**
 * PDF Service
 * Generates branded audit reports as styled HTML pages.
 * The page is served at /api/audit/view/:token with full print CSS.
 * Users can print-to-PDF from their browser for a clean, branded PDF.
 * The tracking URL logs the view event regardless of print/save behavior.
 */

export interface AuditReportData {
  hotelName: string;
  website: string;
  location?: string;
  auditDate: string;
  scores: Record<string, number>;
  executiveSummary: string;
  topFindings: Array<{
    title: string;
    category: string;
    severity: string;
    evidence: string;
    commercialMeaning: string;
    estimatedRevenueImpact?: string;
    suggestedFix: string;
  }>;
  commercialLeakageRisks: Array<{
    title: string;
    severity: string;
    evidence: string;
    commercialMeaning: string;
    estimatedRevenueImpact?: string;
  }>;
  opportunities: Array<{
    title: string;
    impact: string;
    effort: string;
    urgency: string;
    type: string;
    whyItMatters: string;
  }>;
  estimatedAnnualLeakage?: {
    low: number;
    high: number;
    currency: string;
    basis: string;
  };
  aiVisibility?: {
    query: string;
    assistantAnswer: string;
    targetMentioned: boolean;
    targetPosition: number;
    competitorsMentioned: string[];
    whyMentionedOrNot: string;
    visibilityVerdict: string;
    recommendation: string;
  };
  recommendedAngle: string;
  demoKitLink?: string;
  calendarLink?: string;
  trackingBaseUrl: string;
  pdfToken: string;
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Strong with specific opportunities';
  if (score >= 60) return 'Functional but leaky';
  if (score >= 40) return 'Underdeveloped';
  return 'Critical gap';
}

function scoreColor(score: number): string {
  if (score >= 75) return '#78B88A';
  if (score >= 60) return '#C59B4A';
  return '#B76E65';
}

function severityBadge(severity: string): string {
  const colors: Record<string, string> = {
    high: '#B76E65', medium: '#C59B4A', low: '#78B88A'
  };
  return `<span style="background:${colors[severity] || '#888'};color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;font-family:sans-serif;text-transform:uppercase;letter-spacing:1px;">${severity}</span>`;
}

function impactBadge(level: string): string {
  const colors: Record<string, string> = {
    high: '#315C46', medium: '#B99A61', low: '#888'
  };
  return `<span style="background:${colors[level] || '#888'};color:#fff;padding:2px 6px;border-radius:3px;font-size:11px;font-family:sans-serif;">${level}</span>`;
}

function scoreRow(label: string, score: number): string {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid rgba(44,36,23,0.08);font-size:14px;color:#6B5F4E;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid rgba(44,36,23,0.08);text-align:right;">
        <span style="color:${scoreColor(score)};font-size:16px;font-weight:bold;">${score}</span>
        <span style="color:#999;font-size:11px;margin-left:4px;">/100</span>
        <span style="margin-left:12px;font-size:11px;color:#999;">${scoreLabel(score)}</span>
      </td>
    </tr>`;
}

function fmtMoney(n: number, currency: string): string {
  const sym = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency + ' ';
  return sym + Math.round(n).toLocaleString('en-US');
}

function revenueImpactLine(impact?: string): string {
  if (!impact || /not estimable/i.test(impact)) return '';
  return `<p style="margin:4px 0;font-size:13px;color:#8A5A2B;"><strong>Estimated revenue impact:</strong> ${impact}</p>`;
}

export function generateAuditHtml(data: AuditReportData): string {
  const overallScore = Math.round(
    Object.values(data.scores).reduce((a, b) => a + b, 0) / Object.keys(data.scores).length
  );

  const findingsHtml = data.topFindings.slice(0, 5).map(f => `
    <div style="margin-bottom:24px;padding:20px;background:#F9F6F0;border-left:3px solid ${scoreColor(f.severity === 'high' ? 20 : f.severity === 'medium' ? 55 : 80)};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <strong style="font-size:15px;color:#2C2417;">${f.title}</strong>
        ${severityBadge(f.severity)}
      </div>
      <p style="margin:4px 0 8px 0;font-size:13px;color:#6B5F4E;"><strong>Evidence:</strong> ${f.evidence}</p>
      <p style="margin:4px 0;font-size:13px;color:#2C2417;"><strong>Commercial meaning:</strong> ${f.commercialMeaning}</p>
      ${revenueImpactLine(f.estimatedRevenueImpact)}
    </div>`).join('');

  // Idea #2: euro anchoring banner for the executive snapshot
  const leak = data.estimatedAnnualLeakage;
  const leakageBanner = (leak && (leak.low > 0 || leak.high > 0))
    ? `<div style="margin:0 0 24px 0;padding:22px 24px;background:#1D1209;color:#F4EFE3;border-radius:2px;">
        <div style="font-family:'Inter',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C59B4A;margin-bottom:8px;">Estimated annual revenue at risk</div>
        <div style="font-size:34px;color:#E0B873;line-height:1;">${fmtMoney(leak.low, leak.currency)} to ${fmtMoney(leak.high, leak.currency)}</div>
        <div style="font-family:'Inter',sans-serif;font-size:11px;color:#CFC6B6;margin-top:10px;line-height:1.6;">${leak.basis}</div>
      </div>`
    : '';

  // Idea #1: AI visibility test ("we asked an AI assistant for hotels in your area")
  const av = data.aiVisibility;
  const aiVisibilityHtml = av ? `
    <div class="section">
      <div class="section-label">AI Visibility Test</div>
      <h2 style="font-size:22px;">Are you in the AI recommendation?</h2>
      <p style="font-size:13px;color:#6B5F4E;font-style:italic;">We asked an AI assistant the question your future guests now ask it:</p>
      <p style="font-size:16px;color:#2C2417;margin:8px 0 18px;">"${av.query}"</p>
      <div style="padding:20px;background:${av.targetMentioned ? '#F1F6F1' : '#FBEDEA'};border-left:3px solid ${av.targetMentioned ? '#78B88A' : '#B76E65'};margin-bottom:16px;">
        <div style="font-size:15px;font-weight:600;color:${av.targetMentioned ? '#315C46' : '#9E4A40'};margin-bottom:6px;">
          ${av.targetMentioned ? `Mentioned (position ${av.targetPosition})` : 'Not mentioned in the AI answer'} · ${av.visibilityVerdict}
        </div>
        <p style="margin:4px 0;font-size:13px;color:#3D3021;">${av.whyMentionedOrNot}</p>
      </div>
      ${av.competitorsMentioned && av.competitorsMentioned.length ? `
        <p style="font-size:13px;color:#2C2417;margin-bottom:6px;"><strong>Recommended ahead of you:</strong></p>
        <p style="font-size:13px;color:#6B5F4E;margin-bottom:16px;">${av.competitorsMentioned.slice(0, 8).join(' · ')}</p>` : ''}
      <p style="font-size:13px;color:#2C2417;"><strong>What would change this:</strong> ${av.recommendation}</p>
      <p style="font-size:11px;color:#999;font-style:italic;margin-top:12px;">Simulated from an AI assistant's organic knowledge. It illustrates how AI search currently perceives the property, not a live web ranking.</p>
    </div>` : '';

  // Idea #3: 90-day visibility roadmap, sequenced from the opportunities
  const horizons: Array<{ label: string; window: string; match: (t: string, u: string) => boolean }> = [
    { label: 'Quick Wins', window: 'First 30 days', match: (t) => /quick win/i.test(t) },
    { label: 'Strategic Fixes', window: 'Days 30 to 60', match: (t) => /strategic fix|commercial risk/i.test(t) },
    { label: 'Future Advantage', window: 'Days 60 to 90', match: (t) => /future advantage/i.test(t) },
  ];
  const used = new Set<number>();
  const roadmapStages = horizons.map(h => {
    const items = data.opportunities
      .map((o, i) => ({ o, i }))
      .filter(({ o, i }) => !used.has(i) && h.match(o.type, o.urgency));
    items.forEach(({ i }) => used.add(i));
    return { ...h, items: items.map(x => x.o) };
  });
  // any opportunity not bucketed lands in the nearest empty horizon by order
  data.opportunities.forEach((o, i) => {
    if (used.has(i)) return;
    const target = roadmapStages.find(s => s.items.length === 0) || roadmapStages[1];
    target.items.push(o); used.add(i);
  });
  const roadmapHtml = data.opportunities.length ? `
    <div class="section">
      <div class="section-label">90-Day Visibility Roadmap</div>
      <h2 style="font-size:22px;">A sequenced path, not a to-do list</h2>
      ${roadmapStages.filter(s => s.items.length).map((s, idx) => `
        <div style="margin-bottom:18px;padding-left:18px;border-left:2px solid ${idx === 0 ? '#78B88A' : idx === 1 ? '#C59B4A' : '#315C46'};">
          <div style="font-family:'Inter',sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#B99A61;">${s.window} · ${s.label}</div>
          ${s.items.map(o => `<p style="margin:6px 0 0;font-size:14px;color:#2C2417;">• ${o.title}</p>`).join('')}
        </div>`).join('')}
    </div>` : '';

  const opportunitiesHtml = data.opportunities.slice(0, 3).map((o, i) => `
    <div style="margin-bottom:20px;padding:20px;background:#F4EFE3;border:1px solid rgba(179,154,97,0.2);">
      <div style="font-size:12px;color:#B99A61;font-family:sans-serif;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Opportunity ${i + 1} · ${o.type}</div>
      <strong style="font-size:15px;color:#2C2417;">${o.title}</strong>
      <p style="margin:8px 0 0 0;font-size:13px;color:#6B5F4E;">${o.whyItMatters}</p>
      <div style="margin-top:10px;font-size:12px;font-family:sans-serif;">
        Impact: ${impactBadge(o.impact)} &nbsp; Effort: ${impactBadge(o.effort)} &nbsp; Urgency: ${impactBadge(o.urgency)}
      </div>
    </div>`).join('');

  const leakageHtml = data.commercialLeakageRisks.slice(0, 4).map(r => `
    <div style="margin-bottom:16px;padding:16px;background:#FDF8F0;border-left:3px solid #B76E65;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <strong style="font-size:14px;color:#2C2417;">${r.title}</strong>
        ${severityBadge(r.severity)}
      </div>
      <p style="margin:4px 0;font-size:13px;color:#6B5F4E;">${r.commercialMeaning}</p>
      ${revenueImpactLine(r.estimatedRevenueImpact)}
    </div>`).join('');

  const ctaSection = data.demoKitLink
    ? `<p style="margin:16px 0 0 0;">View the Koaland.ai demo kit: <a href="${data.demoKitLink}" style="color:#315C46;">${data.demoKitLink}</a></p>`
    : `<p style="margin:16px 0 0 0;color:#6B5F4E;font-style:italic;">If this snapshot is useful, we can walk you through how these public signals become a commercial decision layer inside Koaland.ai.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Digital Experience Snapshot, ${data.hotelName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 16px;
    color: #2C2417;
    background: #F4EFE3;
    line-height: 1.7;
  }
  .page { max-width: 800px; margin: 0 auto; background: #FFFDF8; }
  .cover {
    background: #0E1110;
    color: #F4EFE3;
    padding: 60px 60px 80px;
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: -100px;
    right: -100px;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(49,92,70,0.3) 0%, transparent 70%);
    pointer-events: none;
  }
  .brand-line { color: #B99A61; font-family: 'Inter', sans-serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 40px; }
  .cover h1 { font-size: 36px; font-weight: 400; line-height: 1.2; margin-bottom: 12px; color: #F4EFE3; }
  .cover .subtitle { color: #CFC6B6; font-size: 18px; font-style: italic; margin-bottom: 40px; }
  .cover-meta { font-family: 'Inter', sans-serif; font-size: 12px; color: #78B88A; letter-spacing: 1px; }
  .section { padding: 40px 60px; border-bottom: 1px solid rgba(44,36,23,0.08); }
  .section-label { font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #B99A61; margin-bottom: 16px; }
  h2 { font-size: 24px; font-weight: 400; color: #1D1209; margin-bottom: 16px; }
  h3 { font-size: 18px; font-weight: 600; color: #2C2417; margin-bottom: 12px; }
  p { margin-bottom: 12px; color: #3D3021; }
  .overall-score {
    text-align: center;
    padding: 30px;
    background: #0E1110;
    color: #F4EFE3;
    margin-bottom: 30px;
  }
  .overall-score .number { font-size: 64px; font-weight: 400; color: #78B88A; line-height: 1; }
  .overall-score .label { font-family: 'Inter', sans-serif; font-size: 11px; letter-spacing: 2px; color: #B99A61; text-transform: uppercase; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; }
  .footer {
    background: #0E1110;
    color: #CFC6B6;
    padding: 40px 60px;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    text-align: center;
  }
  .footer .brand { font-size: 18px; font-family: 'Cormorant Garamond', serif; color: #F4EFE3; margin-bottom: 8px; }
  .footer .tagline { color: #78B88A; font-size: 11px; letter-spacing: 1px; }

  @media print {
    body { background: white; }
    .page { max-width: 100%; }
    .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .footer { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- COVER -->
  <div class="cover">
    <div class="brand-line">Koaland.ai · Prospect Intelligence OS</div>
    <h1>Digital Experience Snapshot</h1>
    <div class="subtitle">For ${data.hotelName}</div>
    <div class="cover-meta">
      ${data.location ? `${data.location} &nbsp;·&nbsp; ` : ''}
      Prepared by Koaland.ai &nbsp;·&nbsp; ${data.auditDate}
    </div>
  </div>

  <!-- EXECUTIVE SNAPSHOT -->
  <div class="section">
    <div class="section-label">Executive Snapshot</div>
    <div class="overall-score">
      <div class="number">${overallScore}</div>
      <div class="label">Overall Commercial Readiness Score</div>
    </div>
    <p>${data.executiveSummary}</p>
    ${leakageBanner}
  </div>

  <!-- SCORECARD -->
  <div class="section">
    <div class="section-label">Digital Experience Scorecard</div>
    <table>
      ${scoreRow('Website Experience', data.scores.websiteExperience || 0)}
      ${scoreRow('SEO Readiness', data.scores.seoReadiness || 0)}
      ${scoreRow('AEO Readiness (AI Answer Engines)', data.scores.aeoReadiness || 0)}
      ${scoreRow('GEO Readiness (AI Search)', data.scores.geoReadiness || 0)}
      ${scoreRow('Direct Booking Clarity', data.scores.directBookingClarity || 0)}
      ${scoreRow('Luxury Brand Consistency', data.scores.luxuryBrandConsistency || 0)}
      ${scoreRow('Commercial Upside', data.scores.commercialUpside || 0)}
    </table>
  </div>

  ${aiVisibilityHtml}

  <!-- TOP OPPORTUNITIES -->
  <div class="section">
    <div class="section-label">Top 3 Opportunities</div>
    ${opportunitiesHtml || '<p>No specific opportunities identified from available data.</p>'}
  </div>

  ${roadmapHtml}

  <!-- KEY FINDINGS -->
  <div class="section">
    <div class="section-label">Key Findings</div>
    ${findingsHtml || '<p>No specific findings identified from available data.</p>'}
  </div>

  <!-- COMMERCIAL LEAKAGE -->
  <div class="section">
    <div class="section-label">Commercial Leakage Risks</div>
    ${leakageHtml || '<p>No specific leakage risks identified from available data.</p>'}
  </div>

  <!-- NEXT STEP -->
  <div class="section">
    <div class="section-label">Suggested Next Step</div>
    <h2 style="font-size:20px;">Where to start</h2>
    <p style="font-size:17px;font-style:italic;color:#315C46;">${data.recommendedAngle}</p>
    ${ctaSection}
    ${data.calendarLink ? `<p style="margin-top:12px;"><a href="${data.calendarLink}" style="color:#315C46;">Schedule a short call →</a></p>` : ''}
  </div>

  <!-- ABOUT -->
  <div class="section">
    <div class="section-label">About Koaland.ai</div>
    <p>Koaland.ai is a commercial decision engine for brand-sensitive hotels. It observes digital and commercial signals, identifies real tradeoffs, and turns noisy data into clear decisions and next actions, so commercial teams can move faster and with more confidence.</p>
    <p>This snapshot was generated from publicly available data. It is intended to identify potential signal areas, not to diagnose internal operations.</p>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="brand">Koaland.ai</div>
    <div class="tagline">Commercial intelligence for brand-sensitive hotels</div>
    <div style="margin-top:16px;color:#555;">Prepared exclusively for ${data.hotelName} · ${data.auditDate}</div>
  </div>

</div>
</body>
</html>`;
}
