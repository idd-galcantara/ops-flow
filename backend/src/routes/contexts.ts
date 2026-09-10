import { Router, type Request, type Response } from 'express';
import { listContexts } from '../kube/kubeconfig.js';

/**
 * GET /api/contexts
 * Returns the kubeconfig contexts (names only) the UI can select as targets.
 * Read-only; never exposes credentials.
 */
export const contextsRouter = Router();

contextsRouter.get('/', (_req: Request, res: Response) => {
  try {
    const contexts = listContexts();
    res.json({ contexts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao listar contexts.';
    res.status(500).json({ error: message });
  }
});
