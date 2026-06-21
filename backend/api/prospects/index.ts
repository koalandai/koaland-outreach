import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../middleware/auth';
import { storage } from '../../services/storageService';
import { prospectId } from '../../utils/ids';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === 'GET') {
    const prospects = await storage.prospects.list();
    // Sort by hotLeadScore desc, then updatedAt desc
    const sorted = (prospects as any[]).sort((a, b) => {
      if (b.hotLeadScore !== a.hotLeadScore) return (b.hotLeadScore || 0) - (a.hotLeadScore || 0);
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });
    return res.json({ prospects: sorted, total: sorted.length });
  }

  if (req.method === 'POST') {
    const body = req.body as any;
    if (!body.hotelName && !body.website) {
      return res.status(400).json({ error: 'hotelName or website required' });
    }

    const now = new Date().toISOString();
    const prospect = {
      id: prospectId(),
      hotelName: body.hotelName || '',
      website: body.website || '',
      location: body.location || '',
      country: body.country || '',
      segment: body.segment || '',
      contactEmail: body.contactEmail || '',
      contactPerson: body.contactPerson || '',
      instagram: body.instagram || '',
      linkedin: body.linkedin || '',
      status: body.status || 'research_queue',
      source: body.source || 'manual',
      icpFitScore: body.icpFitScore || 0,
      commercialUpsideScore: body.commercialUpsideScore || 0,
      hotLeadScore: 0,
      priority: body.priority || 'B',
      recommendedAngle: body.recommendedAngle || '',
      notes: body.notes || '',
      createdAt: now,
      updatedAt: now,
      lastActionAt: now,
      nextFollowUpAt: body.nextFollowUpAt || null,
    };

    const created = await storage.prospects.create(prospect);
    return res.status(201).json({ prospect: created });
  }

  res.status(405).json({ error: 'Method not allowed' });
});
