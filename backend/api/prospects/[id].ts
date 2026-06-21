import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../middleware/auth';
import { storage } from '../../services/storageService';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  const { id } = req.query as { id: string };

  if (req.method === 'GET') {
    const prospect = await storage.prospects.getById(id);
    if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

    const [audits, emails, tasks] = await Promise.all([
      storage.audits.findWhere((a: any) => a.prospectId === id),
      storage.emails.findWhere((e: any) => e.prospectId === id),
      storage.tasks.findWhere((t: any) => t.prospectId === id && t.status === 'open'),
    ]);

    return res.json({ prospect, audits, emails, tasks });
  }

  if (req.method === 'PATCH') {
    const prospect = await storage.prospects.getById(id);
    if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

    const updated = await storage.prospects.update(id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    return res.json({ prospect: updated });
  }

  if (req.method === 'DELETE') {
    const exists = await storage.prospects.getById(id);
    if (!exists) return res.status(404).json({ error: 'Prospect not found' });
    // Soft delete by setting status
    await storage.prospects.update(id, { status: 'not_fit', updatedAt: new Date().toISOString() });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
});
