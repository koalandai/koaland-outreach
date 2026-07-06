import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../middleware/auth';
import { storage } from '../services/storageService';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const [emails, prospects, audits, events] = await Promise.all([
    storage.emails.findWhere(() => true) as Promise<any[]>,
    storage.prospects.list() as Promise<any[]>,
    storage.audits.findWhere(() => true) as Promise<any[]>,
    storage.events.findWhere(() => true) as Promise<any[]>,
  ]);

  const sentEmails = emails.filter(e => !e.isTest && e.sentAt);
  const total = sentEmails.length;

  // Performance by angle
  const byAngle: Record<string, { sent: number; opened: number; clicked: number; replied: number; pdfViewed: number }> = {};
  for (const email of sentEmails) {
    const angle = email.angle || 'Unknown';
    if (!byAngle[angle]) byAngle[angle] = { sent: 0, opened: 0, clicked: 0, replied: 0, pdfViewed: 0 };
    byAngle[angle].sent++;
    if (['opened', 'clicked', 'replied'].includes(email.status)) byAngle[angle].opened++;
    if (['clicked', 'replied'].includes(email.status)) byAngle[angle].clicked++;
    if (email.status === 'replied') byAngle[angle].replied++;
  }

  // Add PDF views per angle
  const pdfEvents = events.filter(e => e.type === 'pdf_opened');
  for (const evt of pdfEvents) {
    const email = sentEmails.find(e => e.prospectId === evt.prospectId);
    if (email?.angle) {
      const angle = email.angle || 'Unknown';
      if (byAngle[angle]) byAngle[angle].pdfViewed++;
    }
  }

  // Calculate rates
  const anglePerformance = Object.entries(byAngle).map(([angle, data]) => ({
    angle,
    sent: data.sent,
    openRate: data.sent ? Math.round((data.opened / data.sent) * 100) : 0,
    clickRate: data.sent ? Math.round((data.clicked / data.sent) * 100) : 0,
    replyRate: data.sent ? Math.round((data.replied / data.sent) * 100) : 0,
    pdfViewRate: data.sent ? Math.round((data.pdfViewed / data.sent) * 100) : 0,
  })).sort((a, b) => b.openRate - a.openRate);

  // Performance by subject line (top subjects by open rate)
  const subjectPerf: Record<string, { sent: number; opened: number }> = {};
  for (const email of sentEmails) {
    const subj = email.subject;
    if (!subjectPerf[subj]) subjectPerf[subj] = { sent: 0, opened: 0 };
    subjectPerf[subj].sent++;
    if (['opened', 'clicked', 'replied'].includes(email.status)) subjectPerf[subj].opened++;
  }

  const subjectPerformance = Object.entries(subjectPerf)
    .map(([subject, data]) => ({
      subject,
      sent: data.sent,
      openRate: data.sent ? Math.round((data.opened / data.sent) * 100) : 0,
    }))
    .sort((a, b) => b.openRate - a.openRate)
    .slice(0, 10);

  // Overall conversion funnel
  const delivered = sentEmails.filter(e => ['delivered', 'opened', 'clicked', 'replied'].includes(e.status)).length;
  const opened = sentEmails.filter(e => ['opened', 'clicked', 'replied'].includes(e.status)).length;
  const clicked = sentEmails.filter(e => ['clicked', 'replied'].includes(e.status)).length;
  const replied = sentEmails.filter(e => e.status === 'replied').length;
  const pdfOpened = pdfEvents.length;
  const bounced = sentEmails.filter(e => e.status === 'bounced').length;

  // Best performing locations
  const locationPerf: Record<string, { sent: number; opened: number; replied: number }> = {};
  for (const email of sentEmails) {
    const prospect = prospects.find(p => p.id === email.prospectId);
    const location = prospect?.location || 'Unknown';
    if (!locationPerf[location]) locationPerf[location] = { sent: 0, opened: 0, replied: 0 };
    locationPerf[location].sent++;
    if (['opened', 'clicked', 'replied'].includes(email.status)) locationPerf[location].opened++;
    if (email.status === 'replied') locationPerf[location].replied++;
  }

  const locationPerformance = Object.entries(locationPerf)
    .map(([location, data]) => ({
      location,
      sent: data.sent,
      openRate: data.sent ? Math.round((data.opened / data.sent) * 100) : 0,
      replyRate: data.sent ? Math.round((data.replied / data.sent) * 100) : 0,
    }))
    .sort((a, b) => b.openRate - a.openRate)
    .slice(0, 8);

  // Top commercial themes from audits
  const themeCounts: Record<string, number> = {};
  for (const audit of audits) {
    for (const r of (audit.commercialLeakageRisks || [])) {
      const title = (r.title || '').slice(0, 40);
      if (title) themeCounts[title] = (themeCounts[title] || 0) + 1;
    }
  }
  const topThemes = Object.entries(themeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([theme, count]) => ({ theme, count }));

  // Insights
  const insights: string[] = [];
  if (anglePerformance.length >= 2) {
    const best = anglePerformance[0];
    const worst = anglePerformance[anglePerformance.length - 1];
    if (best.openRate > worst.openRate + 10) {
      insights.push(`"${best.angle}" angle is outperforming "${worst.angle}" by ${best.openRate - worst.openRate} percentage points in open rate.`);
    }
  }
  if (pdfOpened > 0 && opened > 0) {
    const pdfToReply = Math.round((replied / (pdfOpened || 1)) * 100);
    if (pdfToReply > 20) insights.push(`PDF view → reply conversion is ${pdfToReply}% — strong signal. Prioritize PDF-viewed prospects.`);
  }

  res.json({
    funnel: { total, delivered, opened, clicked, pdfOpened, replied, bounced },
    rates: {
      deliveryRate: total ? Math.round((delivered / total) * 100) : 0,
      openRate: delivered ? Math.round((opened / delivered) * 100) : 0,
      pdfViewRate: delivered ? Math.round((pdfOpened / delivered) * 100) : 0,
      replyRate: delivered ? Math.round((replied / delivered) * 100) : 0,
      bounceRate: total ? Math.round((bounced / total) * 100) : 0,
    },
    anglePerformance,
    subjectPerformance,
    locationPerformance,
    topThemes,
    insights,
    auditToEmail: audits.length ? Math.round((total / audits.length) * 100) : 0,
  });
});
