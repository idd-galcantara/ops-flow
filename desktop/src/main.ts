import { app, BrowserWindow, dialog } from 'electron';
import { createServer } from 'node:net';
import path from 'node:path';
import { startBackend, stopBackend, waitForBackend } from './backendProcess';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ReturnType<typeof startBackend> | null = null;
let shuttingDown = false;

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close(() => reject(new Error('Could not reserve a local port.')));
        return;
      }
      probe.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function projectRoot(): string {
  return app.isPackaged ? app.getAppPath() : path.resolve(app.getAppPath(), '..');
}

async function closeBackend(): Promise<void> {
  await stopBackend(backendProcess);
  backendProcess = null;
}

async function shutdownApplication(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await closeBackend();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  } else {
    app.quit();
  }
}

async function createMainWindow(): Promise<void> {
  const root = projectRoot();
  const frontendDist = path.join(root, 'frontend', 'dist');
  const port = await availablePort();

  backendProcess = startBackend({ projectRoot: root, frontendDist, port });
  await waitForBackend(port);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.on('close', (event) => {
    if (shuttingDown) return;
    event.preventDefault();
    void shutdownApplication();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  process.once('SIGINT', () => void shutdownApplication());
  process.once('SIGTERM', () => void shutdownApplication());

  app.whenReady().then(async () => {
    try {
      await createMainWindow();
    } catch (error) {
      await closeBackend();
      dialog.showErrorBox(
        'Could not start ops-flow',
        error instanceof Error ? error.message : 'The desktop application could not start.',
      );
      app.quit();
    }
  });

  app.on('window-all-closed', () => app.quit());
}