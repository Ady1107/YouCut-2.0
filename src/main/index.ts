import { app, BrowserWindow, shell, ipcMain, clipboard, session } from 'electron';
import { join } from 'path';
import fs from 'fs';
import { exec, execFile } from 'child_process';
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
const isTest =
  process.env.NODE_ENV === 'test' ||
  Boolean(process.env.PLAYWRIGHT_TEST) ||
  app.commandLine.hasSwitch('playwright-test') ||
  process.argv.includes('--playwright-test');

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
      try { process.kill(pid, 'SIGKILL'); } catch { }
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
ipcMain.handle('clipboard:read', () => {
  try {
    return clipboard.readText();
  } catch (err) {
    console.error('[Main] clipboard:read failed:', err);
    return '';
  }
});
ipcMain.handle('clipboard:write', (_event, text: string) => {
  try {
    clipboard.writeText(text || '');
    return true;
  } catch (err) {
    console.error('[Main] clipboard:write failed:', err);
    return false;
  }
});

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds || 0);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

ipcMain.handle('youtube:fetch-info', async (_event, rawUrl: string) => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Please enter a valid video URL');
  }

  const cleanUrl = rawUrl.trim();
  const ytdlpPath = getBinaryPath('yt-dlp');

  if (!fs.existsSync(ytdlpPath)) {
    throw new Error('yt-dlp binary not found at ' + ytdlpPath);
  }

  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-playlist',
      '--js-runtimes',
      'node',
      '--no-warnings',
      cleanUrl
    ];

    execFile(
      ytdlpPath,
      args,
      { maxBuffer: 15 * 1024 * 1024, timeout: 60000 },
      (error, stdout, stderr) => {
        if (error) {
          console.error('[Main] fetch-info error:', error.message, stderr);
          if (error.killed || error.signal === 'SIGTERM') {
            reject(new Error('Fetching took longer than 60 seconds and timed out. Check your internet connection.'));
            return;
          }
          if (stderr.includes('Private video') || stderr.includes('Sign in')) {
            reject(new Error('This video is private or requires sign in.'));
          } else if (stderr.includes('Video unavailable') || stderr.includes('does not exist')) {
            reject(new Error('This video is unavailable or has been removed.'));
          } else if (stderr.includes('getaddrinfo') || stderr.includes('Failed to resolve')) {
            reject(new Error('Network error: Unable to connect to YouTube. Check your internet connection.'));
          } else {
            reject(new Error(stderr || error.message || 'Failed to fetch video information'));
          }
          return;
        }

        try {
          const data = JSON.parse(stdout);

          // Detect vertical format (Shorts)
          const isVertical =
            (data.width && data.height && data.height > data.width) ||
            cleanUrl.includes('/shorts/') ||
            (data.aspect_ratio && data.aspect_ratio < 1);

          // Extract available unique video heights
          const formatHeights = (data.formats || [])
            .map((f: any) => f.height)
            .filter((h: any) => typeof h === 'number' && h > 0);
          const uniqueHeights = Array.from(new Set(formatHeights)).sort((a: any, b: any) => b - a) as number[];
          const availableResolutions = uniqueHeights.map((h) => `${h}p`);

          const info = {
            id: data.id,
            title: data.title || 'Untitled Video',
            duration: data.duration || 0,
            durationFormatted: formatDuration(data.duration || 0),
            uploader: data.uploader || data.channel || 'Unknown Channel',
            thumbnail:
              data.thumbnail ||
              (data.thumbnails && data.thumbnails.length > 0
                ? data.thumbnails[data.thumbnails.length - 1].url
                : ''),
            webpageUrl: data.webpage_url || cleanUrl,
            viewCount: data.view_count || 0,
            uploadDate: data.upload_date || '',
            isVertical,
            isPlaylist: cleanUrl.includes('list='),
            availableResolutions: availableResolutions.length > 0 ? availableResolutions : ['1080p', '720p', '480p'],
            chapters: data.chapters || []
          };
          resolve(info);
        } catch (e: any) {
          reject(new Error('Failed to parse video info from yt-dlp'));
        }
      }
    );
  });
});

app.whenReady().then(() => {
  // Grant clipboard and media permissions for the app session
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'clipboard-read' || permission === 'clipboard-sanitized-write') {
      callback(true);
      return;
    }
    callback(true);
  });

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