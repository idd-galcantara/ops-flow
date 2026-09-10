import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.port, config.host, () => {
  console.log(`ops-flow backend (read-only) listening on http://${config.host}:${config.port}`);
});
