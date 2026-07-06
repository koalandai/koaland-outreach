import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../middleware/auth';
import { storage } from '../services/storageService';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === 'GET') {
    const settings = await storage.settings.get();
    return res.json({ settings });
  }

  if (req.method === 'PATCH') {
    const current = await storage.settings.get();
    const updated = { ...current, ...req.body };
    await storage.settings.save(updated);
    return res.json({ settings: updated });
  }

  res.status(405).json({ error: 'Method not allowed' });
});
