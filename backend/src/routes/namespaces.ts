import { Router, type Request, type Response } from 'express';
import { getNamespaces, parseClusters } from '../kube/namespacesService.js';

/**
 * POST /api/namespaces
 * Body: { clusters: ["kubernetes-qa-tb", ...] }
 * Returns { namespaces: [{ name, clusters }], errors: [{ cluster, message }] }
 *
 * A POST because the cluster list travels in the body, but this is a read-only
 * query — it only lists namespaces.
 */
export const namespacesRouter = Router();

namespacesRouter.post('/', async (req: Request, res: Response) => {
  const parsed = parseClusters(req.body);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  try {
    const result = await getNamespaces(parsed.clusters);
    res.json(result);
  } catch (err) {
    // getNamespaces isolates per-cluster failures, so reaching here is unexpected.
    const message = err instanceof Error ? err.message : 'Erro ao listar namespaces.';
    res.status(500).json({ error: message });
  }
});
