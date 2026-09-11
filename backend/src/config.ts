/** Central configuration for the ops-flow backend. Local-only by design. */
export const config = {
  /** Port the API listens on. Overridable via OPS_FLOW_PORT. */
  port: Number(process.env.OPS_FLOW_PORT ?? 4000),
  /** Bind to localhost only — ops-flow is a local, read-only tool. */
  host: '127.0.0.1',
  /** Optional production frontend directory served by the local backend. */
  frontendDist: process.env.OPS_FLOW_FRONTEND_DIST || undefined,
} as const;
