import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { attachLogsWebSocket } from './logsWebSocket.js';

const app = createApp();
const server = createServer(app);

// Log streaming shares the HTTP server via the WebSocket upgrade path.
attachLogsWebSocket(server);

server.listen(config.port, config.host, () => {
  console.log(`ops-flow backend (read-only) listening on http://${config.host}:${config.port}`);
});
