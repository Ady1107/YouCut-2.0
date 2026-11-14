import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { BrowserWindow } from 'electron';
import { getBinaryPath } from '../config/paths';
import { validateOutputWithFFprobe } from './validator';
import { historyStore } from './history';
import { killProcessTree, registerChildPid, unregisterChildPid } from '../index';

export interface QueueItem {
  id: string;
  title: string;
  url: string;
  platform: 'youtube' | 'instagram' | 'facebook';
  thumbnail?: string;
  duration?: number;
  format: string; // 'MP4' | 'MOV' | 'GIF' | 'MP3' | 'M4A' | 'WAV'
  quality: string;
  startSec: number;
  endSec: number;
  isFullVideo: boolean;
  frameAccurate: boolean;
  saveFolder: string;
  fileName: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused' | 'warning';
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: string;
  eta: string;
  finalPath?: string;
  warning?: string;
  error?: string;
  addedAt: number;
}

class QueueManager {
  private items: QueueItem[] = [];
  private activeItem: QueueItem | null = null;
  private activeProcess: ChildProcess | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private concurrentFragments: number = 8;
  private isProcessing: boolean = false;

  public setConcurrentFragments(n: number) {
    this.concurrentFragments = Math.max(1, Math.min(32, n));
  }

  public getItems(): QueueItem[] {
    return this.items;
  }

  public addItem(item: Omit<QueueItem, 'progress' | 'downloadedBytes' | 'totalBytes' | 'speed' | 'eta' | 'addedAt'>): QueueItem {
    const fullItem: QueueItem = {
      ...item,
      status: item.status || 'queued',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: '—',
      eta: '—',
      addedAt: Date.now()
    };

    this.items.push(fullItem);
    this.broadcastQueue();
    this.triggerNext();
    return fullItem;
  }

  public pauseItem(id: string) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;

    if (this.activeItem && this.activeItem.id === id && this.activeProcess) {
      // Keep .part files on pause per Lesson 3
      this.clearWatchdog();
      if (this.activeProcess.pid) {
        killProcessTree(this.activeProcess.pid);
      }
      this.activeItem.status = 'paused';
      this.activeItem = null;
      this.activeProcess = null;
    } else if (item.status === 'queued') {
      item.status = 'paused';
    }

    this.broadcastQueue();
    this.triggerNext();
  }

  public resumeItem(id: string) {
    const item = this.items.find((i) => i.id === id);
    if (!item || item.status !== 'paused') return;

    item.status = 'queued';
    this.broadcastQueue();
    this.triggerNext();
  }

  public cancelItem(id: string) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;

    if (this.activeItem && this.activeItem.id === id && this.activeProcess) {
      this.clearWatchdog();
      if (this.activeProcess.pid) {
        killProcessTree(this.activeProcess.pid);
      }
      this.activeItem = null;
      this.activeProcess = null;

      // Delete .part files only on explicit cancel per Lesson 3
      this.cleanupPartFiles(item);
    }

    this.items = this.items.filter((i) => i.id !== id);
    this.broadcastQueue();
    this.triggerNext();
  }

  public clearCompleted() {
    this.items = this.items.filter((i) => i.status !== 'completed');
    this.broadcastQueue();
  }

  private broadcastQueue() {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('queue:update', this.items);
      }
    }
  }

  private broadcastProgress(id: string, data: Partial<QueueItem>) {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('queue:progress', { id, ...data });
      }
    }
  }

  private triggerNext() {
    if (this.isProcessing || this.activeItem) return;

    const nextItem = this.items.find((i) => i.status === 'queued');
    if (!nextItem) return;

    this.processItem(nextItem);
  }

  private resetWatchdog(pid: number) {
    this.clearWatchdog();
    // 90s watchdog per Lesson 1
    this.watchdogTimer = setTimeout(() => {
      console.warn(`[Watchdog] Stalled download detected for PID ${pid} (no output for 90s). Terminating process tree.`);
      killProcessTree(pid);
      if (this.activeItem) {
        this.activeItem.status = 'failed';
        this.activeItem.error = 'Download stalled (90-second watchdog timeout). Click retry to resume.';
        this.broadcastQueue();
      }
      this.activeItem = null;
      this.activeProcess = null;
      this.isProcessing = false;
      this.triggerNext();
    }, 90000);
  }

  private clearWatchdog() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private cleanupPartFiles(item: QueueItem) {
    try {
      if (!fs.existsSync(item.saveFolder)) return;
      const files = fs.readdirSync(item.saveFolder);
      for (const f of files) {
        if (f.startsWith(item.fileName) && (f.endsWith('.part') || f.endsWith('.ytdl'))) {
          try {
            fs.unlinkSync(path.join(item.saveFolder, f));
            console.log(`[Queue] Cleaned up partial file: ${f}`);
          } catch {}
        }
      }
    } catch (e) {
      console.warn('[Queue] cleanupPartFiles error:', e);
    }
  }

  private async processItem(item: QueueItem) {
    this.isProcessing = true;
    this.activeItem = item;
    item.status = 'downloading';
    this.broadcastQueue();

    const ytdlpPath = getBinaryPath('yt-dlp');
    const ext = item.format.toLowerCase();
    const isAudioOnly = ['mp3', 'm4a', 'wav'].includes(ext);

    // Ensure save folder exists
    if (!fs.existsSync(item.saveFolder)) {
      try {
        fs.mkdirSync(item.saveFolder, { recursive: true });
      } catch {}
    }

    const outputFilePath = path.join(item.saveFolder, `${item.fileName}.${ext}`);
    item.finalPath = outputFilePath;

    // Resolve FFmpeg directory so yt-dlp finds ffmpeg & ffprobe on Windows
    const ffmpegPath = getBinaryPath('ffmpeg');
    const binDir = path.dirname(ffmpegPath);

    // Build yt-dlp arguments per Lessons 1, 4, 7
    const args: string[] = [
      '--newline',
      '--no-playlist',
      '--ffmpeg-location', binDir,
      '--js-runtimes', 'node',
      '--concurrent-fragments', this.concurrentFragments.toString(),
      '--continue',
      // Progress template outputs structured JSON per line
      '--progress-template',
      'download:{"percent":"%(progress._percent_str)s","downloaded":"%(progress.downloaded_bytes)s","total":"%(progress.total_bytes)s","speed":"%(progress._speed_str)s","eta":"%(progress._eta_str)s"}'
    ];

    // Clipping sections per Lesson 4
    const clipDuration = item.endSec - item.startSec;
    if (!item.isFullVideo) {
      args.push('--download-sections', `*${item.startSec}-${item.endSec}`);
      // Exact = force keyframes at cuts; Auto = Exact when source <= 10m (600s)
      const isExact = item.frameAccurate || item.endSec <= 600;
      if (isExact) {
        args.push('--force-keyframes-at-cuts');
      }
    }

    // Format selection
    if (isAudioOnly) {
      args.push('-x', '--audio-format', ext === 'm4a' ? 'm4a' : ext === 'wav' ? 'wav' : 'mp3');
    } else {
      args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
      args.push('--merge-output-format', ext === 'mov' ? 'mov' : 'mp4');
    }

    args.push('-o', outputFilePath);
    args.push(item.url);

    console.log(`[Queue] Starting download for "${item.title}"`);
    console.log(`[Queue CMD]: ${ytdlpPath} ${args.join(' ')}`);

    const child = spawn(ytdlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.activeProcess = child;

    if (child.pid) {
      registerChildPid(child.pid);
      this.resetWatchdog(child.pid);
    }

    let stderrBuffer = '';

    child.stdout?.on('data', (data) => {
      if (child.pid) this.resetWatchdog(child.pid);

      const lines = data.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('download:{')) {
          try {
            const jsonStr = trimmed.replace('download:', '');
            const parsed = JSON.parse(jsonStr);

            const percentStr = (parsed.percent || '0%').replace('%', '').trim();
            const pct = parseFloat(percentStr) || 0;
            const downloaded = parseInt(parsed.downloaded, 10) || 0;
            const total = parseInt(parsed.total, 10) || 0;
            const speed = parsed.speed || '—';
            const eta = parsed.eta || '—';

            item.progress = Math.min(100, Math.max(0, Math.round(pct)));
            item.downloadedBytes = downloaded;
            item.totalBytes = total;
            item.speed = speed;
            item.eta = eta;

            this.broadcastProgress(item.id, {
              progress: item.progress,
              downloadedBytes: item.downloadedBytes,
              totalBytes: item.totalBytes,
              speed: item.speed,
              eta: item.eta
            });
          } catch {}
        }
      }
    });

    child.stderr?.on('data', (data) => {
      if (child.pid) this.resetWatchdog(child.pid);
      stderrBuffer += data.toString();
    });

    child.on('close', async (exitCode) => {
      this.clearWatchdog();
      if (child.pid) unregisterChildPid(child.pid);

      this.activeProcess = null;
      this.activeItem = null;

      console.log(`[Queue] Process exited with code ${exitCode} for "${item.title}"`);

      if (exitCode === 0) {
        // Validation via ffprobe (Lesson 5)
        const expectedDuration = item.isFullVideo ? item.endSec : clipDuration;
        const validation = await validateOutputWithFFprobe(
          outputFilePath,
          expectedDuration,
          isAudioOnly,
          item.frameAccurate || item.endSec <= 600
        );

        if (validation.valid) {
          item.status = 'completed';
          item.progress = 100;
          item.totalBytes = validation.fileSizeBytes;

          // Record in History
          historyStore.add({
            id: item.id,
            title: item.title,
            url: item.url,
            platform: item.platform,
            format: item.format,
            quality: item.quality,
            durationFormatted: `${Math.floor(validation.durationSeconds / 60)}m ${Math.floor(validation.durationSeconds % 60)}s`,
            durationSeconds: validation.durationSeconds,
            filePath: outputFilePath,
            fileSizeBytes: validation.fileSizeBytes,
            downloadedAt: Date.now(),
            isFullVideo: item.isFullVideo,
            startSec: item.startSec,
            endSec: item.endSec
          });
        } else {
          // Finished with warning per Lesson 5
          item.status = 'warning';
          item.warning = validation.warning;
          console.warn(`[Queue] Validation warning: ${validation.warning}`);
        }
      } else {
        if (item.status !== 'paused') {
          item.status = 'failed';
          item.error = stderrBuffer || `Download failed with exit code ${exitCode}`;
        }
      }

      this.broadcastQueue();
      this.isProcessing = false;
      this.triggerNext();
    });
  }
}

export const queueManager = new QueueManager();
