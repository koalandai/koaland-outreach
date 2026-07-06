import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../middleware/auth';
import { storage } from '../../services/storageService';
import { taskId } from '../../utils/ids';
import { recalculateTasks } from '../../services/taskService';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === 'GET') {
    const { status, prospectId } = req.query as { status?: string; prospectId?: string };

    let tasks = await storage.tasks.list() as any[];

    if (status) tasks = tasks.filter(t => t.status === status);
    if (prospectId) tasks = tasks.filter(t => t.prospectId === prospectId);

    // Sort by dueAt
    tasks.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    return res.json({ tasks, total: tasks.length });
  }

  if (req.method === 'POST') {
    const body = req.body as any;
    if (!body.prospectId || !body.title) {
      return res.status(400).json({ error: 'prospectId and title required' });
    }

    const now = new Date().toISOString();
    const task = await storage.tasks.create({
      id: taskId(),
      prospectId: body.prospectId,
      type: body.type || 'manual',
      title: body.title,
      reason: body.reason || '',
      recommendedAction: body.recommendedAction || '',
      dueAt: body.dueAt || now,
      status: 'open',
      createdAt: now,
    });

    return res.status(201).json({ task });
  }

  res.status(405).json({ error: 'Method not allowed' });
});
