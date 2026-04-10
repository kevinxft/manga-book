import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, protocol, net } from 'electron';
import type { ScanTaskEvent } from '@shared/types';
import { createRepositories } from './db';
import { createSourceScanner } from './scanner/sourceScanner';
import { TaskQueue } from './tasks/taskQueue';
import { registerIpcHandlers } from './ipc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STABLE_USER_DATA_DIRNAME = 'MangaBook';
const LEGACY_USER_DATA_DIRNAMES = ['manga-book-electron', '漫书'];

function getLatestLegacyUserDataPath(appDataPath: string): string | null {
  let latestLegacyPath: string | null = null;
  let latestModifiedTime = 0;

  for (const legacyDirName of LEGACY_USER_DATA_DIRNAMES) {
    const legacyPath = path.join(appDataPath, legacyDirName);
    const legacyDatabasePath = path.join(legacyPath, 'mangabook.db');

    if (!fs.existsSync(legacyDatabasePath)) {
      continue;
    }

    const modifiedTime = fs.statSync(legacyDatabasePath).mtimeMs;
    if (modifiedTime > latestModifiedTime) {
      latestModifiedTime = modifiedTime;
      latestLegacyPath = legacyPath;
    }
  }

  return latestLegacyPath;
}

function configurePersistentAppPaths(): void {
  const appDataPath = app.getPath('appData');
  const stableUserDataPath = path.join(appDataPath, STABLE_USER_DATA_DIRNAME);

  fs.mkdirSync(stableUserDataPath, { recursive: true });

  const stableDatabasePath = path.join(stableUserDataPath, 'mangabook.db');
  if (!fs.existsSync(stableDatabasePath)) {
    const latestLegacyPath = getLatestLegacyUserDataPath(appDataPath);
    if (latestLegacyPath && latestLegacyPath !== stableUserDataPath) {
      fs.cpSync(latestLegacyPath, stableUserDataPath, {
        recursive: true,
        force: false,
        errorOnExist: false
      });
    }
  }

  app.setPath('userData', stableUserDataPath);
  app.setPath('sessionData', stableUserDataPath);
}

function getAppIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../build/icon.png');
}

configurePersistentAppPaths();

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
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 18, y: 18 }
        }
      : { icon: getAppIconPath() }),
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

  scanQueue.onTaskUpdate((task: ScanTaskEvent) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('library:scan-progress', task);
      }
    }
  });

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
