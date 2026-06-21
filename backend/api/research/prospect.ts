import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../middleware/auth';
import { storage } from '../../services/storageService';
import { crawlWebsite } from '../../services/crawlerService';
import { analyzeHotelResearch } from '../../services/openaiService';
import { researchId } from '../../utils/ids';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prospectId } = req.body as { prospectId: string };
  if (!prospectId) return res.status(400).json({ error: 'prospectId required' });

  const prospect = await storage.prospects.getById(prospectId) as any;
  if (!prospect) return res.status(404).json({ error: 'Prospect not found' });
  if (!prospect.website) return res.status(400).json({ error: 'Prospect has no website URL' });

  await storage.prospects.update(prospectId, { status: 'researching' });

  let crawlResult: any;
  try {
    crawlResult = await crawlWebsite(prospect.website);
  } catch (err: any) {
    await storage.prospects.update(prospectId, { status: 'research_queue' });
    return res.status(422).json({ error: `Failed to crawl website: ${err.message}` });
  }

  // Run AI analysis on the crawled data
  let aiProfile: any = {};
  try {
    aiProfile = await analyzeHotelResearch({
      url: crawlResult.url,
      title: crawlResult.title,
      metaDescription: crawlResult.metaDescription,
      headings: crawlResult.headings,
      bodyText: crawlResult.bodyText,
      ctaTexts: crawlResult.ctaTexts,
      bookingLinks: crawlResult.bookingLinks,
      schemaTypes: crawlResult.schemaTypes,
    });
  } catch (err) {
    console.error('AI analysis failed, continuing with crawl data only:', err);
  }

  const now = new Date().toISOString();

  // Save research snapshot
  const snapshot = await storage.research.create({
    id: researchId(),
    prospectId,
    websiteTitle: crawlResult.title,
    metaDescription: crawlResult.metaDescription,
    headings: crawlResult.headings,
    ctaTexts: crawlResult.ctaTexts,
    bookingLinks: crawlResult.bookingLinks,
    contactLinks: crawlResult.contactLinks,
    emailsFound: crawlResult.emailsFound,
    schemaTypes: crawlResult.schemaTypes,
    faqDetected: crawlResult.faqText.length > 50,
    bodyTextSample: crawlResult.bodyText.slice(0, 500),
    navLinks: crawlResult.navLinks,
    hasSitemap: crawlResult.hasSitemap,
    aiProfile,
    createdAt: now,
  });

  // Update prospect with research results
  const updates: any = {
    status: 'research_complete',
    updatedAt: now,
    lastActionAt: now,
  };

  if (aiProfile.likelyIcpFit) updates.icpFitScore = aiProfile.likelyIcpFit;
  if (aiProfile.commercialUpsideScore) updates.commercialUpsideScore = aiProfile.commercialUpsideScore;
  if (aiProfile.segment && !prospect.segment) updates.segment = aiProfile.segment;
  if (aiProfile.location && !prospect.location) updates.location = aiProfile.location;
  if (aiProfile.country && !prospect.country) updates.country = aiProfile.country;

  // Auto-extract email if found
  if (crawlResult.emailsFound.length > 0 && !prospect.contactEmail) {
    updates.contactEmail = crawlResult.emailsFound[0];
  }

  await storage.prospects.update(prospectId, updates);

  res.json({
    prospectId,
    snapshotId: snapshot.id,
    crawl: {
      title: crawlResult.title,
      emailsFound: crawlResult.emailsFound,
      bookingLinks: crawlResult.bookingLinks,
      faqDetected: crawlResult.faqText.length > 50,
      schemaTypes: crawlResult.schemaTypes,
    },
    aiProfile,
  });
});
