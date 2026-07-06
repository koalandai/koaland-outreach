import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../middleware/auth';
import { storage } from '../../services/storageService';
import { campaignId } from '../../utils/ids';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === 'GET') {
    const campaigns = await storage.campaigns.list() as any[];
    // Enrich with metrics
    const enriched = await Promise.all(campaigns.map(async campaign => {
      const emails = await storage.emails.findWhere((e: any) => e.campaignId === campaign.id && !e.isTest) as any[];
      return {
        ...campaign,
        metrics: {
          prospects: campaign.prospectIds?.length || 0,
          sent: emails.length,
          delivered: emails.filter((e: any) => ['delivered', 'opened', 'clicked', 'replied'].includes(e.status)).length,
          opened: emails.filter((e: any) => ['opened', 'clicked', 'replied'].includes(e.status)).length,
          replied: emails.filter((e: any) => e.status === 'replied').length,
          bounced: emails.filter((e: any) => e.status === 'bounced').length,
        },
      };
    }));
    return res.json({ campaigns: enriched, total: enriched.length });
  }

  if (req.method === 'POST') {
    const body = req.body as any;
    if (!body.name) return res.status(400).json({ error: 'name required' });

    const now = new Date().toISOString();
    const campaign = await storage.campaigns.create({
      id: campaignId(),
      name: body.name,
      market: body.market || '',
      segment: body.segment || '',
      angle: body.angle || '',
      prospectIds: body.prospectIds || [],
      dailySendLimit: body.dailySendLimit || 10,
      startDate: body.startDate || now,
      status: body.status || 'draft',
      createdAt: now,
      updatedAt: now,
    });

    return res.status(201).json({ campaign });
  }

  res.status(405).json({ error: 'Method not allowed' });
});
