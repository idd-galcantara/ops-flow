import { Router, type Request, type Response } from 'express';
import { getPods } from '../kube/podsService.js';
import { parseTargets } from '../kube/parseTargets.js';

/**
 * POST /api/pods
 * Body: { targets: [{ cluster, namespace }, ...] }
 * Returns { pods, errors } — pods from all targets (annotated with origin),
 * plus per-target errors. Read-only.
 */
export const podsRouter = Router();

podsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = parseTargets(req.body);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  try {
    const result = await getPods(parsed.targets);
    res.json(result);
  } catch (err) {
    // getPods isolates per-target failures, so reaching here is unexpected.
    const message = err instanceof Error ? err.message : 'Erro ao consultar pods.';
    res.status(500).json({ error: message });
  }
});
