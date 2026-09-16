/** Central configuration for the ops-union backend. Local-only by design. */
export const config = {
  /** Port the API listens on. Overridable via OPS_FLOW_PORT. */
  port: Number(process.env.OPS_FLOW_PORT ?? 4000),
  /** Bind to localhost only — ops-union is a local, read-only tool. */
  host: '127.0.0.1',
  /** Optional production frontend directory served by the local backend. */
  frontendDist: process.env.OPS_FLOW_FRONTEND_DIST || undefined,
  /** Ephemeral token used only by the Electron main process for local reloads. */
  get internalToken(): string | undefined {
    return process.env.OPS_FLOW_INTERNAL_TOKEN || undefined;
  },
} as const;
