import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../middleware/auth';
import { storage } from '../../services/storageService';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  const { id } = req.query as { id: string };

  if (id === 'generate' || id === 'send') {
    return res.status(404).json({ error: 'Use POST /api/emails/generate or /api/emails/send' });
  }

  if (req.method === 'GET') {
    const email = await storage.emails.getById(id);
    if (!email) return res.status(404).json({ error: 'Email not found' });
    return res.json({ email });
  }

  if (req.method === 'PATCH') {
    const email = await storage.emails.getById(id);
    if (!email) return res.status(404).json({ error: 'Email not found' });
    const updated = await storage.emails.update(id, req.body);
    return res.json({ email: updated });
  }

  res.status(405).json({ error: 'Method not allowed' });
});
