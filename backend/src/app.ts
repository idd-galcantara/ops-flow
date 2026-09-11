import express, { type Express, type Request, type Response } from 'express';
import { contextsRouter } from './routes/contexts.js';
import { kubeconfigRouter } from './routes/kubeconfig.js';
import { namespacesRouter } from './routes/namespaces.js';
import { podsRouter } from './routes/pods.js';

/**
 * Builds the Express app. Kept separate from the server bootstrap so it can be
 * imported by tests without opening a socket.
 *
 * ops-flow is read-only: only GET routes live here. Cluster read endpoints
 * (pods, describe, metrics) and the log WebSocket are added in later phases.
 */
export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'ops-flow-backend', readOnly: true });
  });

  app.use('/api/contexts', contextsRouter);
  app.use('/api/kubeconfig', kubeconfigRouter);
  app.use('/api/namespaces', namespacesRouter);
  app.use('/api/pods', podsRouter);

  return app;
}
