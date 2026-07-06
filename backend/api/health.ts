import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors } from '../middleware/auth';
import { checkOpenAIStatus } from '../services/openaiService';
import { checkSendGridStatus } from '../services/sendgridService';

export default withCors(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const [openai, sendgrid] = await Promise.allSettled([
    checkOpenAIStatus(),
    checkSendGridStatus(),
  ]);

  res.json({
    ok: true,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    integrations: {
      openai: openai.status === 'fulfilled' ? openai.value : { ok: false },
      sendgrid: sendgrid.status === 'fulfilled' ? sendgrid.value : { ok: false },
      pagespeed: { ok: !!process.env.PAGESPEED_API_KEY, configured: !!process.env.PAGESPEED_API_KEY },
      serp: { ok: !!process.env.SERP_API_KEY, provider: process.env.SERP_PROVIDER || 'serpapi', configured: !!process.env.SERP_API_KEY },
      storage: { ok: !!process.env.KV_REST_API_URL, type: 'vercel-kv' },
    },
  });
});
