import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../middleware/auth';
import { storage } from '../../services/storageService';
import { generateEmailVariants, generateFollowUp } from '../../services/openaiService';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prospectId, auditId, type = 'initial', angle } = req.body as {
    prospectId: string;
    auditId?: string;
    type?: string;
    angle?: string;
  };

  if (!prospectId) return res.status(400).json({ error: 'prospectId required' });

  const prospect = await storage.prospects.getById(prospectId) as any;
  if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

  const settings = await storage.settings.get();
  const trackingBaseUrl = process.env.TRACKING_BASE_URL || '';

  let audit: any = null;
  if (auditId) {
    audit = await storage.audits.getById(auditId);
  } else {
    // Get latest audit for prospect
    const audits = await storage.audits.findWhere((a: any) => a.prospectId === prospectId) as any[];
    audit = audits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
  }

  const pdfLink = audit
    ? `${trackingBaseUrl}/api/audit/view/${audit.pdfToken}`
    : '[No audit PDF available]';

  // Build behavior signals for follow-up emails
  let behaviorSignals = '';
  if (type !== 'initial') {
    const emails = await storage.emails.findWhere((e: any) => e.prospectId === prospectId) as any[];
    const lastEmail = emails[emails.length - 1];
    if (lastEmail) {
      const daysSince = lastEmail.sentAt
        ? Math.floor((Date.now() - new Date(lastEmail.sentAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      behaviorSignals = `Email sent ${daysSince} days ago. Status: ${lastEmail.status}. PDF open count: ${audit?.pdfOpenCount || 0}.`;
    }
  }

  let variants: any[];

  if (type.startsWith('followup') || type === 'pdf_opened') {
    const emails = await storage.emails.findWhere((e: any) => e.prospectId === prospectId) as any[];
    const lastEmail = emails[emails.length - 1] as any;
    const daysSince = lastEmail?.sentAt
      ? Math.floor((Date.now() - new Date(lastEmail.sentAt).getTime()) / (1000 * 60 * 60 * 24))
      : 3;

    const followUp = await generateFollowUp({
      hotelName: prospect.hotelName,
      contactName: prospect.contactPerson,
      emailOpened: ['opened', 'clicked', 'replied'].includes(lastEmail?.status || ''),
      pdfOpened: (audit?.pdfOpenCount || 0) > 0,
      pdfOpenCount: audit?.pdfOpenCount || 0,
      clicked: lastEmail?.status === 'clicked',
      daysSinceSend: daysSince,
      topFinding: audit?.topFindings?.[0]?.title || 'Digital experience opportunities identified',
      pdfLink,
      followupType: type,
    });

    variants = [{
      name: 'Follow-up',
      angle: followUp.recommendedFollowUpType || type,
      subjectOptions: followUp.subjectOptions || [],
      previewText: '',
      body: followUp.body || '',
      whyThisWorks: followUp.reason || '',
      strengthScore: { personalization: 70, clarity: 80, commercialHook: 70, spamRisk: 'low', ctaStrength: 'soft', lengthScore: 85 },
    }];
  } else {
    // Prefer the AI-visibility verdict as the hook when the hotel is missing from AI answers.
    // It is the most striking, concrete opener available and the email strategist accepts it directly.
    let aiHook = '';
    const av = audit?.aiVisibility;
    if (av && av.targetMentioned === false) {
      const comps = (av.competitorsMentioned || []).slice(0, 2).join(' and ');
      aiHook = comps
        ? `When asked for the best hotels in ${prospect.location}, AI assistants recommend ${comps}, not ${prospect.hotelName}.`
        : `${prospect.hotelName} does not appear when AI assistants are asked for the best hotels in ${prospect.location}.`;
    }

    variants = await generateEmailVariants({
      hotelName: prospect.hotelName,
      contactName: prospect.contactPerson,
      location: prospect.location,
      segment: prospect.segment,
      auditSummary: audit?.executiveSummary || 'Digital experience audit completed.',
      topFinding: (av && av.targetMentioned === false && aiHook) ? aiHook : (audit?.topFindings?.[0]?.title || 'Key opportunities identified'),
      recommendedAngle: angle || audit?.recommendedAngle || prospect.recommendedAngle || 'Digital experience',
      oneSentenceHook: aiHook || audit?.oneSentenceHook || '',
      scores: audit?.scores || {},
      pdfLink,
      demoKitLink: settings.demoKitLink || '',
      calendarLink: settings.calendarLink || '',
      emailType: type as any,
      behaviorSignals,
    });
  }

  res.json({ variants, prospectId, auditId: audit?.id });
});
