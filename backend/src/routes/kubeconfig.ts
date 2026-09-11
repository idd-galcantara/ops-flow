import { Router, type Request, type Response } from 'express';
import { getKubeConfigStatus } from '../kube/kubeconfig.js';

export const kubeconfigRouter = Router();

kubeconfigRouter.get('/status', (_req: Request, res: Response) => {
  res.json(getKubeConfigStatus());
});