import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { startBackend, stopBackend, waitForBackend } from './backendProcess';

interface KubeConfigStatus {
  available: boolean;
  source: 'environment' | 'selected' | 'default';
  contextCount?: number;
}

interface SelectionResult {
  cancelled: boolean;
  status?: KubeConfigStatus;
  error?: string;
}

let mainWindow: BrowserWindow | null = null;
let backendProcess: ReturnType<typeof startBackend> | null = null;
let shuttingDown = false;
let backendPort: number | null = null;
let internalToken = '';

function preferencesFile(): string {
  return path.join(app.getPath('userData'), 'preferences.json');
}

async function readSelectedKubeconfigPath(): Promise<string | undefined> {
  try {
    const contents = await readFile(preferencesFile(), 'utf8');
    const preferences = JSON.parse(contents) as { selectedKubeconfigPath?: unknown };
    return typeof preferences.selectedKubeconfigPath === 'string' && preferences.selectedKubeconfigPath.trim()
      ? preferences.selectedKubeconfigPath.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

async function saveSelectedKubeconfigPath(selectedPath: string): Promise<void> {
  await writeFile(
    preferencesFile(),
    `${JSON.stringify({ selectedKubeconfigPath: selectedPath }, null, 2)}\n`,
    'utf8',
  );
}

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
  return app.isPackaged ? process.resourcesPath : path.resolve(app.getAppPath(), '..');
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
  const selectedKubeconfigPath = await readSelectedKubeconfigPath();
  backendPort = port;
  internalToken = randomBytes(32).toString('hex');

  backendProcess = startBackend({
    projectRoot: root,
    frontendDist,
    port,
    internalToken,
    selectedKubeconfigPath,
  });
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

async function selectKubeconfig(): Promise<SelectionResult> {
  if (!mainWindow || backendPort === null || !internalToken) {
    return { cancelled: false, error: 'The desktop backend is not ready.' };
  }

  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Select kubeconfig',
    properties: ['openFile'],
    filters: [
      { name: 'Kubeconfig', extensions: ['yaml', 'yml', 'config'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (selection.canceled || selection.filePaths.length === 0) return { cancelled: true };

  try {
    const response = await fetch(`http://127.0.0.1:${backendPort}/api/kubeconfig/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ops-Flow-Token': internalToken,
      },
      body: JSON.stringify({ path: selection.filePaths[0] }),
    });
    if (!response.ok) return { cancelled: false, error: 'Could not read the selected kubeconfig.' };

    const status = (await response.json()) as KubeConfigStatus;
    try {
      await saveSelectedKubeconfigPath(selection.filePaths[0]);
      return { cancelled: false, status };
    } catch {
      return {
        cancelled: false,
        status,
        error: 'Kubeconfig selected for this session, but the preference could not be saved.',
      };
    }
  } catch {
    return { cancelled: false, error: 'Could not connect to the local backend.' };
  }
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
  ipcMain.handle('select-kubeconfig', selectKubeconfig);

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