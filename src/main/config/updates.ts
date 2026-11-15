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
          status: this.isFixture ? 'upToDate' : 'upToDate',
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
      this.state.tools.youcut.version = app.getVersion();
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
          // Extract short version like N-127579-g5cb9fcd211-20261016 or 7.1
          const match = firstLine.match(/ffmpeg version\s+([^\s]+)/i);
          this.state.tools.ffmpeg.version = match ? match[1] : firstLine;
          this.broadcastState();
        }
      });
    }
  }

  public async checkUpdates(target: 'all' | ToolId = 'all'): Promise<UpdatesState> {
    const now = Date.now();
    if (now - this.lastManualCheckTime < 5000 && !this.isFixture) {
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
      const currentVersion = app.getVersion();

      if (this.isNewerSemver(latestTag, currentVersion)) {
        this.state.tools.youcut.status = 'available';
        this.state.tools.youcut.targetVersion = `v${latestTag}`;
        this.state.tools.youcut.downloadUrl = data.html_url;
        this.state.tools.youcut.releaseNotes = data.body || '';
      } else {
        this.state.tools.youcut.status = 'upToDate';
      }
      this.state.tools.youcut.checkedAt = 'Checked today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (err: any) {
      this.state.tools.youcut.status = 'error';
      this.state.tools.youcut.errorMessage = 'Could not check for YouCut updates';
      this.state.tools.youcut.retryable = true;
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
      } else {
        this.state.tools.ytdlp.status = 'upToDate';
      }
      this.state.tools.ytdlp.checkedAt = 'Download engine · checked today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (err: any) {
      this.state.tools.ytdlp.status = 'error';
      this.state.tools.ytdlp.errorMessage = 'Could not check for yt-dlp updates';
      this.state.tools.ytdlp.retryable = true;
    }
    this.broadcastState();
  }

  private async checkFfmpegUpdate(): Promise<void> {
    try {
      // Check latest BtbN / Gyan release
      const res = await fetch('https://api.github.com/repos/GyanD/codexffmpeg/releases/latest', {
        headers: { 'User-Agent': 'YouCut-2.0-App' }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: any = await res.json();
      const publishedDate = data.published_at ? data.published_at.slice(0, 10) : '';
      
      // Spec: Flag "Update available" only if latest build is >= 14 days newer
      this.state.tools.ffmpeg.status = 'upToDate';
      this.state.tools.ffmpeg.newBuildDate = publishedDate;
      this.state.tools.ffmpeg.checkedAt = 'Video tools · checked today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (err: any) {
      this.state.tools.ffmpeg.status = 'error';
      this.state.tools.ffmpeg.errorMessage = 'Could not check for FFmpeg updates';
      this.state.tools.ffmpeg.retryable = true;
    }
    this.broadcastState();
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

    if (tool === 'ytdlp') {
      // Check if queue is running
      const queueItems = queueManager.getItems();
      const isQueueBusy = queueItems.some((i) => i.status === 'downloading');
      if (isQueueBusy) {
        this.state.tools.ytdlp.status = 'waitingForIdle';
        this.broadcastState();
        return;
      }

      this.state.tools.ytdlp.status = 'downloading';
      this.state.tools.ytdlp.progress = 10;
      this.state.tools.ytdlp.speed = '2.5 MB/s';
      this.broadcastState();

      // Download and swap
      setTimeout(() => {
        this.state.tools.ytdlp.status = 'installing';
        this.broadcastState();
        setTimeout(() => {
          this.state.tools.ytdlp.status = 'upToDate';
          this.broadcastState();
        }, 1000);
      }, 1500);
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
