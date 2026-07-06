import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../middleware/auth';
import { storage } from '../../services/storageService';
import { recalculateTasks } from '../../services/taskService';

export default withAuth(async (req: VercelRequest, res: VercelResponse) => {
  const { action } = req.query as { action: string };

  // POST /api/tasks/recalculate
  if (action === 'recalculate' && req.method === 'POST') {
    await recalculateTasks();
    return res.json({ ok: true });
  }

  // PATCH /api/tasks/:id
  if (req.method === 'PATCH') {
    const task = await storage.tasks.getById(action);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const updated = await storage.tasks.update(action, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    return res.json({ task: updated });
  }

  res.status(405).json({ error: 'Method not allowed' });
});
