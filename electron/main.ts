import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, protocol, net } from 'electron';
import { createRepositories } from './db';
import { createSourceScanner } from './scanner/sourceScanner';
import { TaskQueue } from './tasks/taskQueue';
import { registerIpcHandlers } from './ipc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'manga-cover',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return window;
}

async function bootstrap(): Promise<void> {
  const repositories = createRepositories();
  const scanner = createSourceScanner(repositories);
  const scanQueue = new TaskQueue(4);

  protocol.handle('manga-cover', (request) => {
    const url = new URL(request.url);
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      return new Response('Missing path', { status: 400 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  registerIpcHandlers({
    repositories,
    scanner,
    scanQueue
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  createMainWindow();
}

app.whenReady().then(() => {
  bootstrap().catch((error) => {
    console.error('Failed to bootstrap application', error);
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
