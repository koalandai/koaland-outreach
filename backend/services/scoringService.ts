import { storage } from './storageService';

export interface HotLeadScoreResult {
  score: number;
  label: 'Cold' | 'Warming' | 'Warm' | 'Hot';
  signals: string[];
}

export function getScoreLabel(score: number): 'Cold' | 'Warming' | 'Warm' | 'Hot' {
  if (score >= 85) return 'Hot';
  if (score >= 60) return 'Warm';
  if (score >= 30) return 'Warming';
  return 'Cold';
}

export async function recalculateHotLeadScore(prospectId: string): Promise<HotLeadScoreResult> {
  const settings = await storage.settings.get();
  const w = settings.hotLeadScoreWeights;

  const emails = await storage.emails.findWhere((e: any) => e.prospectId === prospectId) as any[];
  const audits = await storage.audits.findWhere((a: any) => a.prospectId === prospectId) as any[];
  const prospect = await storage.prospects.getById(prospectId) as any;

  let score = 0;
  const signals: string[] = [];

  for (const email of emails) {
    if (['delivered', 'opened', 'clicked', 'replied'].includes(email.status)) {
      score += w.delivered || 5;
    }
    if (['opened', 'clicked', 'replied'].includes(email.status)) {
      score += w.opened || 15;
      signals.push('Email opened');
    }
    if (['clicked', 'replied'].includes(email.status)) {
      score += w.clicked || 20;
      signals.push('Link clicked');
    }
    if (email.status === 'replied') {
      score += w.replied || 50;
      signals.push('Replied');
    }
    if (email.status === 'bounced') {
      score += w.bounced || -50;
      signals.push('Email bounced');
    }
    if (email.status === 'unsubscribed') {
      score += w.unsubscribed || -100;
      signals.push('Unsubscribed');
    }
    if (email.status === 'spamreport') {
      score += w.spamReport || -100;
      signals.push('Spam report');
    }
  }

  for (const audit of audits) {
    if (audit.pdfOpenCount >= 1) {
      score += w.pdfOpened || 30;
      signals.push('PDF viewed');
    }
    if (audit.pdfOpenCount >= 2) {
      score += w.pdfOpenedAgain || 20;
      signals.push('PDF viewed multiple times');
    }
  }

  if (prospect?.icpFitScore >= 80) {
    score += w.icpFitHigh || 20;
    signals.push('High ICP fit');
  }

  const label = getScoreLabel(score);

  await storage.prospects.update(prospectId, { hotLeadScore: score });

  return { score, label, signals };
}

export function calculateInitialIcpScore(data: {
  segment?: string;
  location?: string;
  snippet?: string;
}): number {
  let score = 50;

  const luxuryKeywords = ['luxury', 'boutique', 'five star', '5 star', 'independent', 'resort', 'villa', 'palazzo', 'château', 'manor'];
  const text = `${data.segment || ''} ${data.snippet || ''} ${data.location || ''}`.toLowerCase();

  for (const kw of luxuryKeywords) {
    if (text.includes(kw)) { score += 10; break; }
  }

  const highValueLocations = ['bodrum', 'mykonos', 'santorini', 'antalya', 'istanbul', 'capri', 'amalfi', 'maldives', 'bali', 'dubai', 'paris', 'london', 'new york', 'tokyo'];
  for (const loc of highValueLocations) {
    if (text.includes(loc)) { score += 10; break; }
  }

  return Math.min(score, 100);
}
