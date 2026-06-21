import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../middleware/auth';
import { searchProspects } from '../../services/serpService';
import { storage } from '../../services/storageService';
import { calculateInitialIcpScore } from '../../services/scoringService';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, location, maxResults = 10 } = req.body as {
    query: string;
    location?: string;
    maxResults?: number;
  };

  if (!query) return res.status(400).json({ error: 'query required' });

  const serpResults = await searchProspects(query, location || '', maxResults);

  // Get existing prospect websites to deduplicate
  const existing = await storage.prospects.list() as any[];
  const existingUrls = new Set(existing.map(p => normalizeUrl(p.website)));

  const enriched = serpResults.results.map(r => ({
    ...r,
    initialIcpFit: calculateInitialIcpScore({
      segment: r.hotelName,
      location: location,
      snippet: r.snippet,
    }),
    alreadyInDatabase: existingUrls.has(normalizeUrl(r.website)),
    suggestedAction: getSuggestedAction(r),
  }));

  res.json({
    results: enriched,
    query,
    location,
    total: enriched.length,
  });
});

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return url.replace('www.', '');
  }
}

function getSuggestedAction(result: any): string {
  if (result.initialIcpFit >= 70) return 'Add to queue — high ICP fit';
  if (result.initialIcpFit >= 50) return 'Research now';
  return 'Review manually';
}
