import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { join } from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { getYouCutHome, getBinaryPath } from './config/paths';

const isDev = !app.isPackaged;

// Set userData to YOUCUT_HOME before anything else
const youcutHome = getYouCutHome();
try {
  app.setPath('userData', youcutHome);
} catch (e) {
  console.warn('[Main] Failed to set userData path:', e);
}

// Disable GPU in sandbox to prevent access violation crashes
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

let mainWindow: BrowserWindow | null = null;
const activeChildPids = new Set<number>();

// 1. Single-instance lock
const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.PLAYWRIGHT_TEST);
if (!isTest) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    console.log('[App] Another instance is already running. Focusing first window and quitting.');
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }
}

// Global process tree killer (Lesson 2)
export function killProcessTree(pid: number) {
  if (process.platform === 'win32') {
    exec(`taskkill /F /T /PID ${pid}`, (err) => {
      if (err) console.warn(`[ProcessTree] Kill PID ${pid} error:`, err.message);
    });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try { process.kill(pid, 'SIGKILL'); } catch {}
    }
  }
}

export function registerChildPid(pid: number) {
  activeChildPids.add(pid);
}

export function unregisterChildPid(pid: number) {
  activeChildPids.delete(pid);
}

function cleanupAllProcesses() {
  for (const pid of activeChildPids) {
    killProcessTree(pid);
  }
  activeChildPids.clear();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1176,
    height: 784,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0B0C10',
    title: 'YouCut v2.0',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // Strict CSP
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' http://localhost:* https://fonts.googleapis.com https://fonts.gstatic.com; " +
          "script-src 'self' 'unsafe-inline' http://localhost:* https://www.youtube.com https://s.ytimg.com; " +
          "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; " +
          "img-src 'self' data: https: http://localhost:*; " +
          "media-src 'self' blob: http://localhost:* https:; " +
          "font-src 'self' https://fonts.gstatic.com;"
        ]
      }
    });
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    cleanupAllProcesses();
    mainWindow = null;
  });
}

// IPC Handlers - registered exactly once
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:home', () => getYouCutHome());
ipcMain.handle('binaries:status', () => {
  return {
    ytdlp: fs.existsSync(getBinaryPath('yt-dlp')),
    ffmpeg: fs.existsSync(getBinaryPath('ffmpeg')),
    ffprobe: fs.existsSync(getBinaryPath('ffprobe'))
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  cleanupAllProcesses();
});

app.on('window-all-closed', () => {
  cleanupAllProcesses();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Global uncaughtException handler (Lesson 10)
process.on('uncaughtException', (err) => {
  console.error('[Main] Uncaught Exception:', err);
});
