import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { attachLogsWebSocket } from './logsWebSocket.js';

const app = createApp();
const server = createServer(app);

// Log streaming shares the HTTP server via the WebSocket upgrade path.
attachLogsWebSocket(server);

/**
 * A leftover backend holding the port is the most common local hiccup. Report it
 * plainly instead of letting Node print an unhandled EADDRINUSE stack trace.
 */
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nA porta ${config.port} já está em uso — provavelmente há outro ops-flow rodando.\n` +
        `Encerre o processo anterior ou use outra porta: OPS_FLOW_PORT=4001 npm run dev\n`,
    );
    process.exit(1);
  }
  console.error(`Falha ao iniciar o servidor: ${err.message}`);
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  console.log(`ops-flow backend (read-only) listening on http://${config.host}:${config.port}`);
});
