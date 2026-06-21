import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../middleware/auth';
import { storage } from '../services/storageService';
import { getScoreLabel } from '../services/scoringService';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const [prospects, audits, emails, events, tasks] = await Promise.all([
    storage.prospects.list() as Promise<any[]>,
    storage.audits.findWhere(() => true) as Promise<any[]>,
    storage.emails.findWhere(() => true) as Promise<any[]>,
    storage.events.findWhere(() => true) as Promise<any[]>,
    storage.tasks.findWhere((t: any) => t.status === 'open') as Promise<any[]>,
  ]);

  // Summary metrics
  const totalProspects = prospects.length;
  const aTierProspects = prospects.filter(p => p.priority === 'A' || p.icpFitScore >= 80).length;
  const auditsGenerated = audits.length;
  const emailsSent = emails.filter(e => !e.isTest).length;
  const emailsDelivered = emails.filter(e => ['delivered', 'opened', 'clicked', 'replied'].includes(e.status)).length;
  const emailsOpened = emails.filter(e => ['opened', 'clicked', 'replied'].includes(e.status)).length;
  const pdfViews = events.filter(e => e.type === 'pdf_opened').length;
  const replies = prospects.filter(p => p.status === 'replied').length;
  const followUpsDue = tasks.filter(t => new Date(t.dueAt) <= new Date()).length;
  const hotLeads = prospects.filter(p => (p.hotLeadScore || 0) >= 85).length;

  // Pipeline counts by status
  const pipelineCounts: Record<string, number> = {};
  const pipelineStatuses = [
    'research_queue', 'research_complete', 'audit_ready', 'email_drafted',
    'sent', 'delivered', 'opened', 'pdf_viewed', 'replied', 'demo_interest', 'follow_up_due',
    'closed_won', 'closed_lost', 'not_fit', 'bounced', 'unsubscribed'
  ];
  for (const status of pipelineStatuses) {
    pipelineCounts[status] = prospects.filter(p => p.status === status).length;
  }

  // Warm signals (hot leads ranked)
  const warmSignals = prospects
    .filter(p => (p.hotLeadScore || 0) > 0 && !['closed_won', 'closed_lost', 'not_fit', 'bounced', 'unsubscribed'].includes(p.status))
    .sort((a, b) => (b.hotLeadScore || 0) - (a.hotLeadScore || 0))
    .slice(0, 10)
    .map(p => ({
      id: p.id,
      hotelName: p.hotelName,
      status: p.status,
      hotLeadScore: p.hotLeadScore || 0,
      label: getScoreLabel(p.hotLeadScore || 0),
      location: p.location,
      lastActionAt: p.lastActionAt,
    }));

  // Priority queue (top tasks)
  const priorityTasks = tasks
    .filter(t => t.status === 'open')
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 10);

  // Recent activity (last 20 events)
  const recentActivity = events
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)
    .map(e => ({
      id: e.id,
      type: e.type,
      prospectId: e.prospectId,
      createdAt: e.createdAt,
      payload: e.payload,
    }));

  // Opportunity themes (from audit findings)
  const themeCounts: Record<string, number> = {};
  for (const audit of audits) {
    for (const finding of (audit.topFindings || [])) {
      const theme = categorizeTheme(finding.title || '');
      if (theme) themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    }
  }

  const opportunityThemes = Object.entries(themeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([theme, count]) => ({ theme, count }));

  res.json({
    summary: {
      totalProspects,
      aTierProspects,
      auditsGenerated,
      emailsSent,
      emailsDelivered,
      emailsOpened,
      pdfViews,
      replies,
      followUpsDue,
      hotLeads,
    },
    pipelineCounts,
    warmSignals,
    priorityTasks,
    recentActivity,
    opportunityThemes,
  });
});

function categorizeTheme(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('ai') || t.includes('aeo') || t.includes('geo') || t.includes('answer')) return 'AI Search Invisibility';
  if (t.includes('booking') || t.includes('direct')) return 'Direct Booking Clarity';
  if (t.includes('faq') || t.includes('answer')) return 'Weak FAQ/AEO';
  if (t.includes('luxury') || t.includes('brand') || t.includes('positioning')) return 'Luxury Positioning';
  if (t.includes('ota') || t.includes('expedia') || t.includes('booking.com')) return 'OTA Vulnerability';
  if (t.includes('speed') || t.includes('mobile') || t.includes('performance')) return 'Slow Booking Path';
  if (t.includes('seo') || t.includes('search') || t.includes('visibility')) return 'AI Search Invisibility';
  if (t.includes('local') || t.includes('destination') || t.includes('location')) return 'Missing Local Content';
  return '';
}
