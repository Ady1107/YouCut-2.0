import { app, BrowserWindow, shell, ipcMain, clipboard, session, dialog } from 'electron';
import { join } from 'path';
import fs from 'fs';
import { exec, execFile } from 'child_process';
import { getYouCutHome, getBinaryPath, getDefaultDownloadsDir } from './config/paths';
import { settingsManager } from './config/settings';
import { updatesManager, ToolId } from './config/updates';
import { queueManager } from './download/queue';
import { historyStore } from './download/history';
import { detectPlaylistUrl, fetchPlaylistInfo } from './download/playlist';

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
  const isFixture =
    process.env.YOUCUT_FIXTURE === 'settings-design' ||
    process.argv.includes('--fixture=settings-design');

  mainWindow = new BrowserWindow({
    width: isFixture ? 1440 : 1176,
    height: isFixture ? 1100 : 784,
    minWidth: 1040,
    minHeight: 720,
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

  // CSP allowing YouTube embeds, API, and video streaming
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https: data: blob:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://www.youtube.com https://s.ytimg.com https://www.youtube-nocookie.com https://*.google.com https://*.gstatic.com; " +
          "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.youtube.com; " +
          "img-src 'self' data: https: blob: http://localhost:*; " +
          "media-src 'self' blob: data: https: http://localhost:*; " +
          "connect-src 'self' https: http://localhost:* wss://* ws://*; " +
          "font-src 'self' data: https:;"
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

// Queue IPC Handlers
ipcMain.handle('queue:add', (_event, item) => queueManager.addItem(item));
ipcMain.handle('queue:add-group', (_event, group, children) => queueManager.addGroup(group, children));
ipcMain.handle('queue:list', () => queueManager.getQueueStatePayload());
ipcMain.handle('queue:pause', (_event, id: string) => queueManager.pauseItem(id));
ipcMain.handle('queue:resume', (_event, id: string) => queueManager.resumeItem(id));
ipcMain.handle('queue:cancel', (_event, id: string) => queueManager.cancelItem(id));
ipcMain.handle('queue:retry', (_event, id: string) => queueManager.retry(id));
ipcMain.handle('queue:remove', (_event, id: string) => queueManager.remove(id));
ipcMain.handle('queue:reorder', (_event, order: string[]) => queueManager.reorder(order));
ipcMain.handle('queue:start-now', (_event, id: string) => queueManager.startNow(id));
ipcMain.handle('queue:pause-all', () => queueManager.pauseAll());
ipcMain.handle('queue:resume-all', () => queueManager.resumeAll());
ipcMain.handle('queue:clear-completed', () => queueManager.clearCompleted());
ipcMain.handle('queue:set-concurrency', (_event, n: number) => queueManager.setMaxConcurrency(n));

// Playlist IPC Handlers
ipcMain.handle('playlist:detect', (_event, url: string) => detectPlaylistUrl(url));
ipcMain.handle('playlist:fetch', (_event, url: string) => fetchPlaylistInfo(url));

// History IPC Handlers
ipcMain.handle('history:list', () => historyStore.getAll());
ipcMain.handle('history:clear', () => historyStore.clear());
ipcMain.handle('history:remove', (_event, id: string) => historyStore.remove(id));

// Shell System Handlers
ipcMain.handle('shell:open-folder', (_event, filePath: string) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});
ipcMain.handle('shell:open-file', async (_event, filePath: string) => {
  if (filePath && fs.existsSync(filePath)) {
    await shell.openPath(filePath);
    return true;
  }
  return false;
});

// Dialog and Downloads Handlers
ipcMain.handle('dialog:open-directory', async (_event, defaultPath?: string) => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: defaultPath || getDefaultDownloadsDir('YouTube')
  });
  if (!res.canceled && res.filePaths && res.filePaths.length > 0) {
    return res.filePaths[0];
  }
  return null;
});

ipcMain.handle('downloads:get-default', (_event, platform: string) => {
  return getDefaultDownloadsDir(platform || 'YouTube');
});

// Settings IPC Handlers
ipcMain.handle('settings:get', () => settingsManager.getSettings());
ipcMain.handle('settings:patch', (_event, partial) => settingsManager.patchSettings(partial));

// Updates IPC Handlers
ipcMain.handle('updates:getState', () => updatesManager.getState());
ipcMain.handle('updates:check', (_event, tool: 'all' | ToolId) => updatesManager.checkUpdates(tool));
ipcMain.handle('updates:apply', (_event, tool: ToolId) => updatesManager.applyUpdate(tool));
ipcMain.handle('updates:cancel', (_event, tool: ToolId) => updatesManager.cancelUpdate(tool));

// Cookies & Diagnostics Handlers
ipcMain.handle('cookies:check-browser', async (_event, browser: string) => {
  if (!browser || browser.toLowerCase() === 'none') {
    return '';
  }
  const bLower = browser.toLowerCase();
  const ytdlpPath = getBinaryPath('yt-dlp');
  if (!fs.existsSync(ytdlpPath)) {
    return 'yt-dlp binary missing';
  }

  return new Promise((resolve) => {
    execFile(
      ytdlpPath,
      ['--cookies-from-browser', bLower, '--simulate', '--no-warnings', 'https://www.youtube.com'],
      { timeout: 8000 },
      (err, _stdout, stderr) => {
        if (!err) {
          resolve('Cookies can be read');
          return;
        }
        const errLower = (stderr || err.message || '').toLowerCase();
        if (
          errLower.includes('could not copy') ||
          errLower.includes('cookie database') ||
          errLower.includes('lock')
        ) {
          resolve(
            `${browser} may block access while it is open: close it or use a cookies.txt file`
          );
        } else if (errLower.includes('not found') || errLower.includes('no profile')) {
          resolve(`No ${browser} profile found`);
        } else {
          resolve(`Could not read cookies from ${browser}`);
        }
      }
    );
  });
});

ipcMain.handle('cookies:browse-file', async () => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Select cookies.txt',
    filters: [{ name: 'Text files (*.txt)', extensions: ['txt'] }],
    properties: ['openFile']
  });
  if (!res.canceled && res.filePaths && res.filePaths.length > 0) {
    return res.filePaths[0];
  }
  return null;
});

ipcMain.handle('cookies:validate-file', (_event, filePath: string) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return { valid: false, error: 'File not found' };
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const hasHeader = lines.some((l) => l.includes('# Netscape HTTP Cookie File'));
    const hasValidFields = lines.some((l) => !l.startsWith('#') && l.split('\t').length >= 7);
    if (hasHeader || hasValidFields) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid Netscape cookie format' };
  } catch {
    return { valid: false, error: 'Could not read file' };
  }
});

ipcMain.handle('diagnostics:get', () => {
  const settings = settingsManager.getSettings();
  const diagnostics = {
    app: 'YouCut v2.0',
    platform: process.platform,
    arch: process.arch,
    binaries: {
      ytdlp: '2026.10.26',
      ffmpeg: 'N-127579-g5cb9fcd211-20261016',
      ffprobe: '7.1'
    },
    settings: {
      appearance: settings.appearance,
      downloads: {
        ...settings.downloads,
        defaultFolder: settings.downloads.defaultFolder ? '<redacted_path>' : ''
      },
      cookies: {
        browser: settings.cookies.browser,
        file: settings.cookies.file ? '<redacted_cookie_path>' : null
      },
      updates: settings.updates
    },
    timestamp: new Date().toISOString()
  };
  return JSON.stringify(diagnostics, null, 2);
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