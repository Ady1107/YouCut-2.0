import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { app, shell, BrowserWindow } from 'electron';
import { getYouCutHome, getBinaryPath } from './paths';
import { settingsManager } from './settings';
import { queueManager } from '../download/queue';

export type ToolId = 'youcut' | 'ytdlp' | 'ffmpeg';
export type ToolStatus =
  | 'upToDate'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'waitingForIdle'
  | 'installing'
  | 'error';

export interface ToolUpdateState {
  id: ToolId;
  name: string;
  version: string;
  status: ToolStatus;
  checkedAt: string;
  targetVersion?: string;
  progress?: number;
  speed?: string;
  newBuildDate?: string;
  newBuildSize?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  errorMessage?: string;
  retryable?: boolean;
  autoUpdate: boolean;
}

export interface UpdatesState {
  lastCheckedAt: string | null;
  isCheckingAll: boolean;
  tools: {
    youcut: ToolUpdateState;
    ytdlp: ToolUpdateState;
    ffmpeg: ToolUpdateState;
  };
}

class UpdatesManager {
  private state: UpdatesState;
  private abortControllers: Map<ToolId, AbortController> = new Map();
  private lastManualCheckTime: number = 0;
  private isFixture: boolean;

  constructor() {
    this.isFixture =
      process.env.YOUCUT_FIXTURE === 'settings-design' ||
      process.argv.includes('--fixture=settings-design');

    const settings = settingsManager.getSettings();

    this.state = {
      lastCheckedAt: this.isFixture ? 'today, 14:02' : settings.updates.lastCheckedAt,
      isCheckingAll: false,
      tools: {
        youcut: {
          id: 'youcut',
          name: 'YouCut',
          version: '2.0.0',
          status: 'upToDate',
          checkedAt: this.isFixture ? 'today, 14:02' : 'Checked today, 14:02',
          autoUpdate: settings.updates.app.checkOnStartup
        },
        ytdlp: {
          id: 'ytdlp',
          name: 'yt-dlp',
          version: '2026.10.26',
          status: this.isFixture ? 'downloading' : 'upToDate',
          checkedAt: this.isFixture ? 'Download engine · started just now' : 'Download engine · checked today',
          progress: this.isFixture ? 64 : 0,
          speed: this.isFixture ? '5.2 MB/s' : '',
          targetVersion: this.isFixture ? 'v2026.11.12' : '',
          autoUpdate: settings.updates.ytdlp.autoUpdate
        },
        ffmpeg: {
          id: 'ffmpeg',
          name: 'FFmpeg',
          version: 'N-127579-g5cb9fcd211-20261016',
          status: this.isFixture ? 'available' : 'upToDate',
          checkedAt: this.isFixture ? 'Video tools · checked today, 14:02' : 'Video tools · checked today',
          newBuildDate: this.isFixture ? '2026-11-12' : '',
          newBuildSize: this.isFixture ? '82 MB' : '',
          autoUpdate: settings.updates.ffmpeg.autoUpdate
        }
      }
    };

    if (!this.isFixture) {
      this.initRealVersions();
    }
  }

  public getState(): UpdatesState {
    return JSON.parse(JSON.stringify(this.state));
  }

  private broadcastState(): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('updates:state', this.getState());
      }
    }
  }

  private initRealVersions(): void {
    try {
      this.state.tools.youcut.version = app?.getVersion ? app.getVersion() : '2.0.0';
    } catch {
      this.state.tools.youcut.version = '2.0.0';
    }

    const ytdlpPath = getBinaryPath('yt-dlp');
    if (fs.existsSync(ytdlpPath)) {
      execFile(ytdlpPath, ['--version'], (err, stdout) => {
        if (!err && stdout.trim()) {
          this.state.tools.ytdlp.version = stdout.trim();
          this.broadcastState();
        }
      });
    }

    const ffmpegPath = getBinaryPath('ffmpeg');
    if (fs.existsSync(ffmpegPath)) {
      execFile(ffmpegPath, ['-version'], (err, stdout) => {
        if (!err && stdout.trim()) {
          const firstLine = stdout.split('\n')[0].trim();
          const match = firstLine.match(/ffmpeg version\s+([^\s]+)/i);
          this.state.tools.ffmpeg.version = match ? match[1] : firstLine;
          this.broadcastState();
        }
      });
    }
  }

  public async checkUpdates(target: 'all' | ToolId = 'all'): Promise<UpdatesState> {
    const now = Date.now();
    if (now - this.lastManualCheckTime < 3000 && !this.isFixture) {
      return this.getState();
    }
    this.lastManualCheckTime = now;

    if (this.isFixture) {
      return this.getState();
    }

    if (target === 'all') {
      this.state.isCheckingAll = true;
      this.state.tools.youcut.status = 'checking';
      this.state.tools.ytdlp.status = 'checking';
      this.state.tools.ffmpeg.status = 'checking';
      this.broadcastState();

      await Promise.allSettled([
        this.checkYouCutUpdate(),
        this.checkYtDlpUpdate(),
        this.checkFfmpegUpdate()
      ]);

      this.state.isCheckingAll = false;
      this.state.lastCheckedAt = 'today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      settingsManager.patchSettings({
        updates: { lastCheckedAt: this.state.lastCheckedAt }
      });
      this.broadcastState();
    } else if (target === 'youcut') {
      this.state.tools.youcut.status = 'checking';
      this.broadcastState();
      await this.checkYouCutUpdate();
    } else if (target === 'ytdlp') {
      this.state.tools.ytdlp.status = 'checking';
      this.broadcastState();
      await this.checkYtDlpUpdate();
    } else if (target === 'ffmpeg') {
      this.state.tools.ffmpeg.status = 'checking';
      this.broadcastState();
      await this.checkFfmpegUpdate();
    }

    return this.getState();
  }

  private async checkYouCutUpdate(): Promise<void> {
    try {
      const res = await fetch('https://api.github.com/repos/Ady1107/YouCut-2.0/releases/latest', {
        headers: { 'User-Agent': 'YouCut-2.0-App' }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: any = await res.json();
      const latestTag = (data.tag_name || '').replace(/^v/, '');
      const currentVersion = app?.getVersion ? app.getVersion() : '2.0.0';

      if (this.isNewerSemver(latestTag, currentVersion)) {
        this.state.tools.youcut.status = 'available';
        this.state.tools.youcut.targetVersion = `v${latestTag}`;
        this.state.tools.youcut.downloadUrl = data.html_url;
        this.state.tools.youcut.releaseNotes = data.body || '';
      } else {
        this.state.tools.youcut.status = 'upToDate';
      }
      this.state.tools.youcut.checkedAt = 'Checked today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      this.state.tools.youcut.status = 'upToDate';
      this.state.tools.youcut.checkedAt = 'Checked today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    this.broadcastState();
  }

  private async checkYtDlpUpdate(): Promise<void> {
    try {
      const res = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
        headers: { 'User-Agent': 'YouCut-2.0-App' }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: any = await res.json();
      const latestTag = (data.tag_name || '').replace(/^v/, '');
      const currentVer = this.state.tools.ytdlp.version;

      if (this.compareYtDlpVersions(latestTag, currentVer) > 0) {
        this.state.tools.ytdlp.status = 'available';
        this.state.tools.ytdlp.targetVersion = `v${latestTag}`;
        this.state.tools.ytdlp.downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
      } else {
        this.state.tools.ytdlp.status = 'upToDate';
      }
      this.state.tools.ytdlp.checkedAt = 'Download engine · checked today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      this.state.tools.ytdlp.status = 'upToDate';
      this.state.tools.ytdlp.checkedAt = 'Download engine · checked today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    this.broadcastState();
  }

  private async checkFfmpegUpdate(): Promise<void> {
    try {
      const res = await fetch('https://api.github.com/repos/GyanD/codexffmpeg/releases/latest', {
        headers: { 'User-Agent': 'YouCut-2.0-App' }
      });
      if (res.ok) {
        const data: any = await res.json();
        const publishedDate = data.published_at ? data.published_at.slice(0, 10) : '';
        const asset = Array.isArray(data.assets)
          ? data.assets.find((a: any) => a.name && a.name.includes('essentials_build.zip'))
          : null;

        if (asset && asset.browser_download_url) {
          this.state.tools.ffmpeg.downloadUrl = asset.browser_download_url;
          this.state.tools.ffmpeg.newBuildSize = `${Math.round(asset.size / (1024 * 1024))} MB`;
        } else {
          this.state.tools.ffmpeg.downloadUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
          this.state.tools.ffmpeg.newBuildSize = '82 MB';
        }

        this.state.tools.ffmpeg.status = 'available';
        this.state.tools.ffmpeg.newBuildDate = publishedDate || 'Recent build';
        this.state.tools.ffmpeg.checkedAt = 'Video tools · checked today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        this.state.tools.ffmpeg.downloadUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
        this.state.tools.ffmpeg.newBuildSize = '82 MB';
        this.state.tools.ffmpeg.newBuildDate = 'Recent build';
        this.state.tools.ffmpeg.status = 'available';
        this.state.tools.ffmpeg.checkedAt = 'Video tools · checked today';
      }
    } catch {
      this.state.tools.ffmpeg.status = 'upToDate';
      this.state.tools.ffmpeg.checkedAt = 'Video tools · checked today';
    }
    this.broadcastState();
  }

  private async streamDownloadToFile(
    url: string,
    destPath: string,
    abortSignal: AbortSignal,
    onProgress: (percent: number, speedStr: string) => void
  ): Promise<void> {
    const res = await fetch(url, {
      signal: abortSignal,
      headers: { 'User-Agent': 'YouCut-2.0-App' },
      redirect: 'follow'
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const totalBytes = parseInt(res.headers.get('content-length') || '0', 10);
    let downloadedBytes = 0;
    let lastTime = Date.now();
    let lastBytes = 0;

    const fileStream = fs.createWriteStream(destPath);

    if (!res.body) {
      throw new Error('Response body is null');
    }

    const reader = res.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          fileStream.write(Buffer.from(value));
          downloadedBytes += value.length;

          const now = Date.now();
          if (now - lastTime >= 250) {
            const timeDiff = (now - lastTime) / 1000;
            const byteDiff = downloadedBytes - lastBytes;
            const bytesPerSec = timeDiff > 0 ? byteDiff / timeDiff : 0;
            const mbps = (bytesPerSec / (1024 * 1024)).toFixed(1);
            const speedStr = `${mbps} MB/s`;

            const pct = totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 50;
            onProgress(pct, speedStr);

            lastTime = now;
            lastBytes = downloadedBytes;
          }
        }
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', () => resolve());
        fileStream.on('error', (e) => reject(e));
        fileStream.end();
      });
    }
  }

  public async applyUpdate(tool: ToolId): Promise<void> {
    if (this.isFixture) {
      return;
    }

    if (tool === 'youcut') {
      const url = this.state.tools.youcut.downloadUrl || 'https://github.com/Ady1107/YouCut-2.0/releases/latest';
      shell.openExternal(url);
      return;
    }

    // Check if download queue is running
    const queueItems = queueManager.getItems();
    const isQueueBusy = queueItems.some((i) => i.status === 'downloading');
    if (isQueueBusy) {
      this.state.tools[tool].status = 'waitingForIdle';
      this.broadcastState();
      return;
    }

    const binDir = path.join(getYouCutHome(), 'bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    const ac = new AbortController();
    this.abortControllers.set(tool, ac);

    if (tool === 'ytdlp') {
      const downloadUrl = this.state.tools.ytdlp.downloadUrl || 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
      const tmpPath = path.join(binDir, 'yt-dlp.exe.download');
      const finalPath = path.join(binDir, 'yt-dlp.exe');

      this.state.tools.ytdlp.status = 'downloading';
      this.state.tools.ytdlp.progress = 5;
      this.state.tools.ytdlp.speed = 'Connecting...';
      this.broadcastState();

      try {
        await this.streamDownloadToFile(downloadUrl, tmpPath, ac.signal, (pct, speed) => {
          this.state.tools.ytdlp.progress = pct;
          this.state.tools.ytdlp.speed = speed;
          this.broadcastState();
        });

        this.state.tools.ytdlp.status = 'installing';
        this.state.tools.ytdlp.progress = 100;
        this.broadcastState();

        execFile(tmpPath, ['--version'], (err, stdout) => {
          if (err || !stdout.trim()) {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            this.state.tools.ytdlp.status = 'error';
            this.state.tools.ytdlp.errorMessage = 'Downloaded binary verification failed';
            this.broadcastState();
            return;
          }

          const newVer = stdout.trim();
          try {
            fs.copyFileSync(tmpPath, finalPath);
            fs.unlinkSync(tmpPath);
          } catch (e: any) {
            this.state.tools.ytdlp.status = 'error';
            this.state.tools.ytdlp.errorMessage = e.message || 'Failed to replace binary';
            this.broadcastState();
            return;
          }

          this.state.tools.ytdlp.version = newVer;
          this.state.tools.ytdlp.status = 'upToDate';
          this.state.tools.ytdlp.progress = 100;
          this.state.tools.ytdlp.checkedAt = 'Updated just now';
          this.broadcastState();
        });
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        this.state.tools.ytdlp.status = 'error';
        this.state.tools.ytdlp.errorMessage = err.message || 'Download failed';
        this.state.tools.ytdlp.retryable = true;
        this.broadcastState();
      } finally {
        this.abortControllers.delete('ytdlp');
      }
    } else if (tool === 'ffmpeg') {
      const downloadUrl = this.state.tools.ffmpeg.downloadUrl || 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
      const tmpZipPath = path.join(binDir, 'ffmpeg.zip.download');
      const extractDir = path.join(binDir, 'ffmpeg_extracted');

      this.state.tools.ffmpeg.status = 'downloading';
      this.state.tools.ffmpeg.progress = 5;
      this.state.tools.ffmpeg.speed = 'Connecting...';
      this.broadcastState();

      try {
        await this.streamDownloadToFile(downloadUrl, tmpZipPath, ac.signal, (pct, speed) => {
          this.state.tools.ffmpeg.progress = pct;
          this.state.tools.ffmpeg.speed = speed;
          this.broadcastState();
        });

        this.state.tools.ffmpeg.status = 'installing';
        this.state.tools.ffmpeg.progress = 100;
        this.broadcastState();

        if (fs.existsSync(extractDir)) {
          fs.rmSync(extractDir, { recursive: true, force: true });
        }
        fs.mkdirSync(extractDir, { recursive: true });

        // Extract with Windows built-in tar or PowerShell
        execFile('tar', ['-xf', tmpZipPath, '-C', extractDir], (tarErr) => {
          const finishInstallation = () => {
            const findFiles = (dir: string): { ffmpeg?: string; ffprobe?: string } => {
              let res: { ffmpeg?: string; ffprobe?: string } = {};
              if (!fs.existsSync(dir)) return res;
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  const nested = findFiles(full);
                  if (nested.ffmpeg) res.ffmpeg = nested.ffmpeg;
                  if (nested.ffprobe) res.ffprobe = nested.ffprobe;
                } else {
                  if (entry.name.toLowerCase() === 'ffmpeg.exe') res.ffmpeg = full;
                  if (entry.name.toLowerCase() === 'ffprobe.exe') res.ffprobe = full;
                }
              }
              return res;
            };

            const found = findFiles(extractDir);
            if (found.ffmpeg && found.ffprobe) {
              try {
                fs.copyFileSync(found.ffmpeg, path.join(binDir, 'ffmpeg.exe'));
                fs.copyFileSync(found.ffprobe, path.join(binDir, 'ffprobe.exe'));
                fs.rmSync(extractDir, { recursive: true, force: true });
                if (fs.existsSync(tmpZipPath)) fs.unlinkSync(tmpZipPath);
              } catch (copyErr: any) {
                this.state.tools.ffmpeg.status = 'error';
                this.state.tools.ffmpeg.errorMessage = copyErr.message || 'Failed to install binaries';
                this.broadcastState();
                return;
              }

              execFile(path.join(binDir, 'ffmpeg.exe'), ['-version'], (err, stdout) => {
                const firstLine = stdout ? stdout.split('\n')[0].trim() : '';
                const match = firstLine.match(/ffmpeg version\s+([^\s]+)/i);
                this.state.tools.ffmpeg.version = match ? match[1] : 'Latest';
                this.state.tools.ffmpeg.status = 'upToDate';
                this.state.tools.ffmpeg.checkedAt = 'Updated just now';
                this.broadcastState();
              });
            } else {
              this.state.tools.ffmpeg.status = 'error';
              this.state.tools.ffmpeg.errorMessage = 'Could not find ffmpeg.exe in extracted archive';
              this.broadcastState();
            }
          };

          if (tarErr) {
            // Fallback to PowerShell Expand-Archive
            const psCmd = `Expand-Archive -LiteralPath "${tmpZipPath}" -DestinationPath "${extractDir}" -Force`;
            execFile('powershell', ['-NoProfile', '-Command', psCmd], (psErr) => {
              if (psErr) {
                this.state.tools.ffmpeg.status = 'error';
                this.state.tools.ffmpeg.errorMessage = 'Extraction failed';
                this.broadcastState();
                return;
              }
              finishInstallation();
            });
          } else {
            finishInstallation();
          }
        });
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        this.state.tools.ffmpeg.status = 'error';
        this.state.tools.ffmpeg.errorMessage = err.message || 'Download failed';
        this.state.tools.ffmpeg.retryable = true;
        this.broadcastState();
      } finally {
        this.abortControllers.delete('ffmpeg');
      }
    }
  }

  public cancelUpdate(tool: ToolId): void {
    if (this.abortControllers.has(tool)) {
      this.abortControllers.get(tool)?.abort();
      this.abortControllers.delete(tool);
    }
    this.state.tools[tool].status = 'available';
    this.state.tools[tool].progress = 0;
    this.state.tools[tool].speed = '';
    this.broadcastState();
  }

  private isNewerSemver(latest: string, current: string): boolean {
    const l = latest.split('.').map((n) => parseInt(n, 10) || 0);
    const c = current.split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
      if ((l[i] || 0) > (c[i] || 0)) return true;
      if ((l[i] || 0) < (c[i] || 0)) return false;
    }
    return false;
  }

  private compareYtDlpVersions(v1: string, v2: string): number {
    const p1 = v1.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
    const p2 = v2.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const a = p1[i] || 0;
      const b = p2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }
}

export const updatesManager = new UpdatesManager();
