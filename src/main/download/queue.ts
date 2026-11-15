import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { BrowserWindow, Notification } from 'electron';
import { getBinaryPath, getYouCutHome } from '../config/paths';
import { validateOutputWithFFprobe } from './validator';
import { historyStore } from './history';
import { killProcessTree, registerChildPid, unregisterChildPid } from '../index';
import {
  QueueItem,
  QueueGroup,
  QueueItemStatus,
  QueueStatePayload,
  QueueProgress
} from '../../shared/types';
import { queuePersistence } from './persist';
import { mapYtDlpError } from './errors';
import { getPlaylistArchiveFilePath } from './playlist';

class QueueManager {
  private items: QueueItem[] = [];
  private groups: QueueGroup[] = [];
  private order: string[] = []; // IDs of groups and standalone items in display order

  private activeProcesses = new Map<string, { process: ChildProcess; watchdog: NodeJS.Timeout | null }>();
  private maxConcurrency = 1;
  private concurrentFragments = 8;
  private notificationsEnabled = true;

  // Rolling 3s speed measurement
  private speedSamples: Array<{ time: number; bytes: number }> = [];
  private speedHistory: number[] = new Array(21).fill(0); // 21 samples, every 500ms
  private sparklineInterval: NodeJS.Timeout | null = null;

  // Throttled progress broadcasts (max 5 per second per item)
  private lastProgressEmit = new Map<string, number>();

  constructor() {
    this.initFromStorage();
    this.startSparklineSampler();
  }

  private initFromStorage() {
    const loaded = queuePersistence.load();
    this.items = loaded.items || [];
    this.groups = loaded.groups || [];
    this.order = loaded.order || [];

    // Ensure all items are in order array
    for (const group of this.groups) {
      if (!this.order.includes(group.id)) {
        this.order.push(group.id);
      }
    }
    for (const item of this.items) {
      if (!item.groupId && !this.order.includes(item.id)) {
        this.order.push(item.id);
      }
    }
  }

  private startSparklineSampler() {
    this.sparklineInterval = setInterval(() => {
      const currentSpeed = this.calculateOverallSpeedBps();
      this.speedHistory.shift();
      this.speedHistory.push(currentSpeed);
      // If there are active downloads, broadcast update periodically
      if (this.activeProcesses.size > 0) {
        this.broadcastState();
      }
    }, 500);
  }

  public setMaxConcurrency(n: number) {
    this.maxConcurrency = Math.max(1, Math.min(3, n));
    this.triggerNext();
  }

  public setConcurrentFragments(n: number) {
    this.concurrentFragments = Math.max(1, Math.min(32, n));
  }

  public setNotificationsEnabled(enabled: boolean) {
    this.notificationsEnabled = enabled;
  }

  public getItems(): QueueItem[] {
    return this.items;
  }

  public getGroups(): QueueGroup[] {
    return this.groups;
  }

  public getOrder(): string[] {
    return this.order;
  }

  public addItem(rawItem: Partial<QueueItem> & { url: string; title: string; outputDir: string }): QueueItem {
    const fullItem: QueueItem = {
      id: rawItem.id || Math.random().toString(36).substring(2, 9),
      platform: rawItem.platform || 'youtube',
      url: rawItem.url,
      title: rawItem.title,
      thumbnailUrl: rawItem.thumbnailUrl || (rawItem as any).thumbnail || '',
      durationSec: rawItem.durationSec || (rawItem as any).duration || 0,
      format: (rawItem.format || 'mp4').toLowerCase() as any,
      quality: rawItem.quality || '1080p',
      mode: rawItem.mode || (['mp3', 'm4a', 'wav'].includes((rawItem.format || '').toLowerCase()) ? 'audio' : 'video'),
      clip: rawItem.clip !== undefined ? rawItem.clip : ((rawItem as any).isFullVideo ? null : { startSec: (rawItem as any).startSec || 0, endSec: (rawItem as any).endSec || 0 }),
      outputDir: rawItem.outputDir || (rawItem as any).saveFolder || getYouCutHome(),
      filePath: rawItem.filePath || (rawItem as any).finalPath,
      fileName: rawItem.fileName,
      status: (rawItem.status as any) === 'queued' ? 'waiting' : (rawItem.status || 'waiting'),
      progress: {
        percent: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speedBps: 0,
        speed: '—',
        etaSec: 0,
        eta: '—'
      },
      error: rawItem.error,
      attempts: 0,
      addedAt: rawItem.addedAt || Date.now(),
      frameAccurate: rawItem.frameAccurate
    };

    this.items.push(fullItem);
    if (!this.order.includes(fullItem.id)) {
      this.order.push(fullItem.id);
    }

    this.persistQueue();
    this.broadcastState();
    this.triggerNext();
    return fullItem;
  }

  public addGroup(group: QueueGroup, children: QueueItem[]): void {
    this.groups.push(group);
    for (const child of children) {
      child.groupId = group.id;
      this.items.push(child);
    }
    if (!this.order.includes(group.id)) {
      this.order.push(group.id);
    }

    this.persistQueue();
    this.broadcastState();
    this.triggerNext();
  }

  public reorder(newOrder: string[]): void {
    this.order = newOrder;
    this.persistQueue();
    this.broadcastState();
  }

  public startNow(targetId: string): void {
    // If it's a group or item, bring to front of order
    const idx = this.order.indexOf(targetId);
    if (idx > -1) {
      this.order.splice(idx, 1);
      this.order.unshift(targetId);
    }

    // Find the item
    const item = this.items.find((i) => i.id === targetId);
    if (item && item.status !== 'done') {
      item.status = 'waiting';
    } else {
      // Could be a group
      const group = this.groups.find((g) => g.id === targetId);
      if (group) {
        for (const cid of group.childIds) {
          const child = this.items.find((i) => i.id === cid);
          if (child && child.status !== 'done') {
            child.status = 'waiting';
          }
        }
      }
    }

    this.persistQueue();
    this.broadcastState();
    this.triggerNext();
  }

  public pauseItem(id: string): void {
    // Check if group
    const group = this.groups.find((g) => g.id === id);
    if (group) {
      for (const cid of group.childIds) {
        this.pauseSingleItem(cid);
      }
    } else {
      this.pauseSingleItem(id);
    }

    this.persistQueue();
    this.broadcastState();
    this.triggerNext();
  }

  private pauseSingleItem(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;

    if (this.activeProcesses.has(id)) {
      const active = this.activeProcesses.get(id)!;
      if (active.watchdog) clearTimeout(active.watchdog);
      if (active.process.pid) {
        killProcessTree(active.process.pid);
      }
      this.activeProcesses.delete(id);
    }

    if (item.status === 'downloading' || item.status === 'waiting') {
      item.status = 'paused';
    }
  }

  public resumeItem(id: string): void {
    const group = this.groups.find((g) => g.id === id);
    if (group) {
      for (const cid of group.childIds) {
        const child = this.items.find((i) => i.id === cid);
        if (child && (child.status === 'paused' || child.status === 'failed')) {
          child.status = 'waiting';
          child.error = undefined;
        }
      }
    } else {
      const item = this.items.find((i) => i.id === id);
      if (item && (item.status === 'paused' || item.status === 'failed')) {
        item.status = 'waiting';
        item.error = undefined;
      }
    }

    this.persistQueue();
    this.broadcastState();
    this.triggerNext();
  }

  public cancelItem(id: string): void {
    const group = this.groups.find((g) => g.id === id);
    if (group) {
      for (const cid of group.childIds) {
        this.cancelSingleItem(cid);
      }
      this.groups = this.groups.filter((g) => g.id !== id);
      this.order = this.order.filter((o) => o !== id);
    } else {
      this.cancelSingleItem(id);
      this.items = this.items.filter((i) => i.id !== id);
      this.order = this.order.filter((o) => o !== id);
    }

    this.persistQueue();
    this.broadcastState();
    this.triggerNext();
  }

  private cancelSingleItem(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;

    if (this.activeProcesses.has(id)) {
      const active = this.activeProcesses.get(id)!;
      if (active.watchdog) clearTimeout(active.watchdog);
      if (active.process.pid) {
        killProcessTree(active.process.pid);
      }
      this.activeProcesses.delete(id);
    }

    // Explicit cancel: delete partial .part files per Lesson 3
    this.cleanupPartFiles(item);
  }

  public pauseAll(): void {
    for (const [id, active] of this.activeProcesses.entries()) {
      if (active.watchdog) clearTimeout(active.watchdog);
      if (active.process.pid) killProcessTree(active.process.pid);
      const item = this.items.find((i) => i.id === id);
      if (item) item.status = 'paused';
    }
    this.activeProcesses.clear();

    for (const item of this.items) {
      if (item.status === 'waiting' || item.status === 'downloading') {
        item.status = 'paused';
      }
    }

    this.persistQueue();
    this.broadcastState();
  }

  public resumeAll(): void {
    for (const item of this.items) {
      if (item.status === 'paused') {
        item.status = 'waiting';
      }
    }

    this.persistQueue();
    this.broadcastState();
    this.triggerNext();
  }

  public clearCompleted(): void {
    const completedItemIds = new Set(this.items.filter((i) => i.status === 'done').map((i) => i.id));

    // Remove standalone completed items
    this.items = this.items.filter((i) => i.status !== 'done');

    // Clean up empty or fully finished groups
    this.groups = this.groups.filter((g) => {
      const remainingChildren = g.childIds.filter((cid) => !completedItemIds.has(cid));
      g.childIds = remainingChildren;
      return remainingChildren.length > 0;
    });

    // Update order
    const validIds = new Set([...this.items.filter((i) => !i.groupId).map((i) => i.id), ...this.groups.map((g) => g.id)]);
    this.order = this.order.filter((id) => validIds.has(id));

    this.persistQueue();
    this.broadcastState();
  }

  public remove(id: string): void {
    this.cancelItem(id);
  }

  public retry(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (item) {
      item.status = 'waiting';
      item.attempts = 0;
      item.error = undefined;
      item.progress.percent = 0;
      this.persistQueue();
      this.broadcastState();
      this.triggerNext();
    }
  }

  private persistQueue() {
    queuePersistence.saveDebounced({
      items: this.items,
      groups: this.groups,
      order: this.order
    });
  }

  private triggerNext() {
    if (this.activeProcesses.size >= this.maxConcurrency) return;

    // Find next waiting item according to order array
    let nextItem: QueueItem | null = null;

    for (const entryId of this.order) {
      // Is it a group?
      const group = this.groups.find((g) => g.id === entryId);
      if (group) {
        for (const childId of group.childIds) {
          const child = this.items.find((i) => i.id === childId && i.status === 'waiting');
          if (child && !this.activeProcesses.has(child.id)) {
            nextItem = child;
            break;
          }
        }
        if (nextItem) break;
      } else {
        // Standalone item
        const item = this.items.find((i) => i.id === entryId && i.status === 'waiting');
        if (item && !this.activeProcesses.has(item.id)) {
          nextItem = item;
          break;
        }
      }
    }

    // Fallback: any waiting item not yet in order
    if (!nextItem) {
      nextItem = this.items.find((i) => i.status === 'waiting' && !this.activeProcesses.has(i.id)) || null;
    }

    if (!nextItem) return;

    this.processItem(nextItem);

    // If concurrency allows, trigger another
    if (this.activeProcesses.size < this.maxConcurrency) {
      this.triggerNext();
    }
  }

  private cleanupPartFiles(item: QueueItem) {
    try {
      if (!fs.existsSync(item.outputDir)) return;
      const files = fs.readdirSync(item.outputDir);
      const prefix = item.fileName || path.basename(item.filePath || item.title);
      for (const f of files) {
        if (f.startsWith(prefix) && (f.endsWith('.part') || f.endsWith('.ytdl'))) {
          try {
            fs.unlinkSync(path.join(item.outputDir, f));
            console.log(`[Queue] Deleted partial file: ${f}`);
          } catch {}
        }
      }
    } catch (e) {
      console.warn('[Queue] cleanupPartFiles error:', e);
    }
  }

  private resetWatchdog(item: QueueItem, pid: number) {
    const active = this.activeProcesses.get(item.id);
    if (!active) return;
    if (active.watchdog) clearTimeout(active.watchdog);

    active.watchdog = setTimeout(() => {
      console.warn(`[Watchdog] Stalled download detected for PID ${pid} (no progress for 90s). Terminating.`);
      killProcessTree(pid);
      this.handleProcessFailure(item, 'Download stalled (90-second watchdog timeout)');
    }, 90000);
  }

  private async processItem(item: QueueItem) {
    item.status = 'downloading';
    item.attempts += 1;
    this.broadcastState();

    const ytdlpPath = getBinaryPath('yt-dlp');
    const ext = item.format.toLowerCase();
    const isAudioOnly = item.mode === 'audio' || ['mp3', 'm4a', 'wav'].includes(ext);

    // Ensure destination directory exists
    if (!fs.existsSync(item.outputDir)) {
      try {
        fs.mkdirSync(item.outputDir, { recursive: true });
      } catch {}
    }

    const outputName = item.fileName ? `${item.fileName}.${ext}` : `${item.title}.${ext}`;
    const outputFilePath = path.join(item.outputDir, outputName);
    item.filePath = outputFilePath;

    // Resolve FFmpeg directory so yt-dlp finds ffmpeg & ffprobe on Windows
    const ffmpegPath = getBinaryPath('ffmpeg');
    const binDir = path.dirname(ffmpegPath);

    // Base yt-dlp arguments per Lessons 1, 4, 7
    const args: string[] = [
      '--newline',
      '--no-playlist',
      '--ffmpeg-location', binDir,
      '--js-runtimes', 'node',
      '--concurrent-fragments', this.concurrentFragments.toString(),
      '--continue',
      '--progress-template',
      'download:{"percent":"%(progress._percent_str)s","downloaded":"%(progress.downloaded_bytes)s","total":"%(progress.total_bytes)s","speed":"%(progress._speed_str)s","eta":"%(progress._eta_str)s"}'
    ];

    // Playlist archive handling: skip already downloaded
    if (item.groupId) {
      const group = this.groups.find((g) => g.id === item.groupId);
      if (group && group.options.skipAlreadyDownloaded) {
        const archiveFile = getPlaylistArchiveFilePath(group.id);
        args.push('--download-archive', archiveFile);
      }
    }

    // Section clipping
    if (item.clip && (item.clip.startSec > 0 || item.clip.endSec > 0)) {
      args.push('--download-sections', `*${item.clip.startSec}-${item.clip.endSec}`);
      const isExact = item.frameAccurate || item.clip.endSec <= 600;
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

    console.log(`[Queue] Starting download PID for "${item.title}"`);
    console.log(`[Queue CMD]: ${ytdlpPath} ${args.join(' ')}`);

    const child = spawn(ytdlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.activeProcesses.set(item.id, { process: child, watchdog: null });

    if (child.pid) {
      registerChildPid(child.pid);
      this.resetWatchdog(item, child.pid);
    }

    let stderrBuffer = '';

    child.stdout?.on('data', (data) => {
      if (child.pid) this.resetWatchdog(item, child.pid);

      const lines = data.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('download:{')) {
          try {
            const jsonStr = trimmed.replace('download:', '');
            const parsed = JSON.parse(jsonStr);

            const percentStr = (parsed.percent || '0%').replace('%', '').trim();
            const pct = Math.min(100, Math.max(0, Math.round(parseFloat(percentStr) || 0)));
            const downloaded = parseInt(parsed.downloaded, 10) || 0;
            const total = parseInt(parsed.total, 10) || 0;

            // Speed parsing
            const speedStr = (parsed.speed || '—').trim();
            const etaStr = (parsed.eta || '—').trim();

            item.progress.percent = pct;
            item.progress.downloadedBytes = downloaded;
            item.progress.totalBytes = total;
            item.progress.speed = speedStr;
            item.progress.eta = etaStr;

            // Record rolling speed sample
            this.speedSamples.push({ time: Date.now(), bytes: downloaded });
            const cutoff = Date.now() - 3000;
            this.speedSamples = this.speedSamples.filter((s) => s.time >= cutoff);

            // Throttle progress events to max 5 per second per item
            const now = Date.now();
            const lastEmit = this.lastProgressEmit.get(item.id) || 0;
            if (now - lastEmit >= 200) {
              this.lastProgressEmit.set(item.id, now);
              this.broadcastState();
            }
          } catch {}
        }
      }
    });

    child.stderr?.on('data', (data) => {
      if (child.pid) this.resetWatchdog(item, child.pid);
      stderrBuffer += data.toString();
    });

    child.on('close', async (exitCode) => {
      const active = this.activeProcesses.get(item.id);
      if (active?.watchdog) clearTimeout(active.watchdog);
      if (child.pid) unregisterChildPid(child.pid);
      this.activeProcesses.delete(item.id);

      console.log(`[Queue] Process exited code ${exitCode} for "${item.title}"`);

      if (exitCode === 0) {
        await this.handleProcessSuccess(item, outputFilePath, isAudioOnly);
      } else {
        if (item.status !== 'paused' && item.status !== 'canceled') {
          this.handleProcessFailure(item, stderrBuffer || `Process exited with code ${exitCode}`);
        }
      }

      this.persistQueue();
      this.broadcastState();
      this.triggerNext();
    });
  }

  private async handleProcessSuccess(item: QueueItem, outputFilePath: string, isAudioOnly: boolean) {
    const expectedDuration = item.clip ? Math.max(1, item.clip.endSec - item.clip.startSec) : item.durationSec;
    const validation = await validateOutputWithFFprobe(
      outputFilePath,
      expectedDuration,
      isAudioOnly,
      item.frameAccurate || expectedDuration <= 600
    );

    item.status = 'done';
    item.progress.percent = 100;
    item.finishedAt = Date.now();
    item.sizeBytes = validation.fileSizeBytes || (fs.existsSync(outputFilePath) ? fs.statSync(outputFilePath).size : 0);

    // Record in History
    historyStore.add({
      id: item.id,
      title: item.title,
      url: item.url,
      platform: item.platform,
      format: item.format.toUpperCase(),
      quality: item.quality,
      durationFormatted: `${Math.floor((validation.durationSeconds || expectedDuration) / 60)}m ${Math.floor((validation.durationSeconds || expectedDuration) % 60)}s`,
      durationSeconds: validation.durationSeconds || expectedDuration,
      filePath: outputFilePath,
      fileSizeBytes: item.sizeBytes,
      downloadedAt: Date.now(),
      isFullVideo: !item.clip,
      startSec: item.clip?.startSec,
      endSec: item.clip?.endSec
    });

    // Notify user if group finished or standalone item finished
    if (this.notificationsEnabled && Notification.isSupported()) {
      new Notification({
        title: 'Download Completed',
        body: item.title
      }).show();
    }
  }

  private handleProcessFailure(item: QueueItem, rawError: string) {
    // Backoff auto-retry (3 attempts: 2s, 8s, 30s)
    if (item.attempts < 3) {
      const delays = [2000, 8000, 30000];
      const delay = delays[item.attempts - 1] || 5000;
      console.warn(`[Queue] Item "${item.title}" failed attempt ${item.attempts}. Retrying in ${delay / 1000}s...`);

      item.status = 'waiting';
      item.error = `Retrying (attempt ${item.attempts + 1} of 3)...`;
      setTimeout(() => {
        if (item.status === 'waiting') {
          this.triggerNext();
        }
      }, delay);
    } else {
      item.status = 'failed';
      item.error = mapYtDlpError(rawError, item.attempts);
      console.error(`[Queue] Item "${item.title}" permanently failed after 3 attempts: ${item.error}`);
    }
  }

  private calculateOverallSpeedBps(): number {
    if (this.speedSamples.length < 2) {
      // Fallback: estimate from active items
      let totalBps = 0;
      for (const item of this.items) {
        if (item.status === 'downloading' && item.progress.speed && item.progress.speed !== '—') {
          totalBps += this.parseSpeedStrToBps(item.progress.speed);
        }
      }
      return totalBps;
    }

    const oldest = this.speedSamples[0];
    const newest = this.speedSamples[this.speedSamples.length - 1];
    const durationSec = Math.max(0.1, (newest.time - oldest.time) / 1000);
    const byteDiff = Math.max(0, newest.bytes - oldest.bytes);
    return Math.round(byteDiff / durationSec);
  }

  private parseSpeedStrToBps(str: string): number {
    const s = str.trim().toUpperCase();
    const num = parseFloat(s);
    if (isNaN(num)) return 0;
    if (s.includes('GIB/S') || s.includes('GB/S')) return num * 1024 * 1024 * 1024;
    if (s.includes('MIB/S') || s.includes('MB/S')) return num * 1024 * 1024;
    if (s.includes('KIB/S') || s.includes('KB/S')) return num * 1024;
    return num;
  }

  private formatSpeed(bps: number): string {
    if (!bps || bps <= 0) return '0 MB/s';
    if (bps >= 1024 * 1024 * 1024) {
      return `${(bps / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
    }
    if (bps >= 1024 * 1024) {
      return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${(bps / 1024).toFixed(0)} KB/s`;
  }

  private formatTime(seconds: number): string {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '00:00';
    const s = Math.round(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  public getQueueStatePayload(): QueueStatePayload {
    const activeItems = this.items.filter((i) => i.status === 'downloading');
    const waitingItems = this.items.filter((i) => i.status === 'waiting');
    const doneItems = this.items.filter((i) => i.status === 'done');
    const failedItems = this.items.filter((i) => i.status === 'failed');

    const overallSpeedBps = this.calculateOverallSpeedBps();

    // Remaining bytes across all active and waiting items
    let remainingBytes = 0;
    for (const item of [...activeItems, ...waitingItems]) {
      const total = item.progress.totalBytes || item.sizeBytes || 40 * 1024 * 1024; // 40MB estimate fallback
      const downloaded = item.progress.downloadedBytes || 0;
      remainingBytes += Math.max(0, total - downloaded);
    }

    const etaSec = overallSpeedBps > 50000 ? Math.round(remainingBytes / overallSpeedBps) : 0;

    return {
      items: this.items,
      groups: this.groups,
      order: this.order,
      overallSpeedBps,
      overallSpeedFormatted: this.formatSpeed(overallSpeedBps),
      overallEtaSec: etaSec,
      overallEtaFormatted: etaSec > 0 ? `≈ ${this.formatTime(etaSec)}` : 'calculating...',
      waitingCount: waitingItems.length,
      activeCount: activeItems.length,
      doneCount: doneItems.length,
      failedCount: failedItems.length,
      speedHistory: [...this.speedHistory]
    };
  }

  private broadcastState() {
    const payload = this.getQueueStatePayload();
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('queue:update', payload);
      }
    }
  }
}

export const queueManager = new QueueManager();
