import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors } from '../../middleware/auth';

export default withCors(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body as { token?: string };
  const expected = process.env.DASHBOARD_ACCESS_TOKEN || '';

  if (!expected) return res.status(500).json({ error: 'Server not configured' });
  if (!token || token !== expected) return res.status(401).json({ ok: false, error: 'Invalid token' });

  res.json({ ok: true });
});
