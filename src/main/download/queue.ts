import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { BrowserWindow, Notification } from 'electron';
import { getBinaryPath, getYouCutHome } from '../config/paths';
import { settingsManager } from '../config/settings';
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
import { classifyErrorFromStderr } from './errors';
import { getPlaylistArchiveFilePath } from './playlist';
import { resolveUniqueOutputPath } from './filename';
import { splitStreamLines, parseFfmpegStatsLine } from './progressParser';

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

  // D2: Rate limiting cooldown state
  private cooldownUntil: number | null = null;
  private cooldownReason: string | null = null;
  private cooldownTimer: NodeJS.Timeout | null = null;
  private cooldownAttempt = 0;

  constructor() {
    this.initFromStorage();
    this.startSparklineSampler();
    this.triggerNext();
  }

  private initFromStorage() {
    const loaded = queuePersistence.load();
    this.items = loaded.items || [];
    this.groups = loaded.groups || [];
    this.order = loaded.order || [];

    // Reset any dangling 'downloading' items to 'waiting' after app restart/crash
    for (const item of this.items) {
      if (item.status === 'downloading') {
        item.status = 'waiting';
        item.phase = 'Waiting';
      }
    }

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
      if (this.activeProcesses.size > 0 || this.cooldownUntil) {
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
    const isFull = Boolean((rawItem as any).isFullVideo || rawItem.clip === null);
    let clip = rawItem.clip !== undefined
      ? rawItem.clip
      : isFull
        ? null
        : { startSec: (rawItem as any).startSec || 0, endSec: (rawItem as any).endSec || 0 };

    // Range validation (A3 & Correction 3): out - in >= 1s, in >= 0
    if (!isFull && clip) {
      if (clip.endSec - clip.startSec < 1 || clip.startSec < 0) {
        throw new Error(
          `Clip range invalid: duration must be at least 1 second (start: ${clip.startSec}s, end: ${clip.endSec}s)`
        );
      }
    }

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
      clip: isFull ? null : clip,
      outputDir: rawItem.outputDir || (rawItem as any).saveFolder || getYouCutHome(),
      filePath: rawItem.filePath || (rawItem as any).finalPath,
      fileName: rawItem.fileName,
      status: (rawItem.status as any) === 'queued' ? 'waiting' : (rawItem.status || 'waiting'),
      phase: 'Waiting',
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
      child.status = child.status || 'waiting';
      child.phase = 'Waiting';
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
    const item = this.items.find((i) => i.id === targetId);
    if (item && (item.status === 'paused' || item.status === 'failed')) {
      item.status = 'waiting';
      item.phase = 'Waiting';
      item.attempts = 0;
      item.error = undefined;
    }

    const idx = this.order.indexOf(targetId);
    if (idx > -1) {
      this.order.splice(idx, 1);
      this.order.unshift(targetId);
    }

    // If target is child of a group, promote it
    if (item && item.groupId) {
      const group = this.groups.find((g) => g.id === item.groupId);
      if (group) {
        const cIdx = group.childIds.indexOf(targetId);
        if (cIdx > -1) {
          group.childIds.splice(cIdx, 1);
          group.childIds.unshift(targetId);
        }
      }
    }

    this.persistQueue();
    this.broadcastState();
    this.triggerNext();
  }

  public pauseItem(id: string): void {
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
      item.phase = 'Paused';
    }
  }

  public resumeItem(id: string): void {
    const group = this.groups.find((g) => g.id === id);
    if (group) {
      for (const cid of group.childIds) {
        const child = this.items.find((i) => i.id === cid);
        if (child && (child.status === 'paused' || child.status === 'failed')) {
          child.status = 'waiting';
          child.phase = 'Waiting';
          child.error = undefined;
        }
      }
    } else {
      const item = this.items.find((i) => i.id === id);
      if (item && (item.status === 'paused' || item.status === 'failed')) {
        item.status = 'waiting';
        item.phase = 'Waiting';
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

  public retryFailedInGroup(groupId: string): void {
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return;
    for (const cid of group.childIds) {
      const child = this.items.find((i) => i.id === cid);
      if (child && child.status === 'failed') {
        child.status = 'waiting';
        child.phase = 'Waiting';
        child.attempts = 0;
        child.error = undefined;
      }
    }
    this.persistQueue();
    this.broadcastState();
    this.triggerNext();
  }

  public cancelRemainingInGroup(groupId: string): void {
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return;
    for (const cid of group.childIds) {
      const child = this.items.find((i) => i.id === cid);
      if (child && (child.status === 'downloading' || child.status === 'waiting' || child.status === 'paused')) {
        this.cancelSingleItem(cid);
        this.items = this.items.filter((i) => i.id !== cid);
        group.childIds = group.childIds.filter((id) => id !== cid);
      }
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
      if (item) {
        item.status = 'paused';
        item.phase = 'Paused';
      }
    }
    this.activeProcesses.clear();

    for (const item of this.items) {
      if (item.status === 'waiting' || item.status === 'downloading') {
        item.status = 'paused';
        item.phase = 'Paused';
      }
    }

    this.persistQueue();
    this.broadcastState();
  }

  public resumeAll(): void {
    for (const item of this.items) {
      if (item.status === 'paused') {
        item.status = 'waiting';
        item.phase = 'Waiting';
      }
    }

    this.persistQueue();
    this.broadcastState();
    this.triggerNext();
  }

  public clearCompleted(): void {
    const completedItemIds = new Set(this.items.filter((i) => i.status === 'done').map((i) => i.id));

    this.items = this.items.filter((i) => i.status !== 'done');

    this.groups = this.groups.filter((g) => {
      const remainingChildren = g.childIds.filter((cid) => !completedItemIds.has(cid));
      g.childIds = remainingChildren;
      return remainingChildren.length > 0;
    });

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
      item.phase = 'Waiting';
      item.attempts = 0;
      item.error = undefined;
      item.warning = undefined;
      item.progress.percent = 0;
      this.persistQueue();
      this.broadcastState();
      this.triggerNext();
    }
  }

  public triggerCooldown(reason: string) {
    this.cooldownAttempt++;
    if (this.cooldownAttempt > 3) {
      this.cooldownUntil = null;
      this.cooldownReason = null;
      return;
    }

    // Graduated gentle backoffs (30s -> 60s -> 3m) to prevent IP throttling without frustrating users
    const backoffs = [30 * 1000, 60 * 1000, 180 * 1000];
    const duration = backoffs[this.cooldownAttempt - 1] || 30 * 1000;
    this.cooldownUntil = Date.now() + duration;
    this.cooldownReason = reason || 'Rate limited by platform';

    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
    this.cooldownTimer = setTimeout(() => {
      this.resumeCooldown();
    }, duration);

    this.broadcastState();
  }

  public resumeCooldown() {
    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
    this.cooldownTimer = null;
    this.cooldownUntil = null;
    this.cooldownReason = null;
    this.cooldownAttempt = 0;
    this.broadcastState();
    this.triggerNext();
  }

  private persistQueue() {
    queuePersistence.saveDebounced({
      items: this.items,
      groups: this.groups,
      order: this.order
    });
  }

  private triggerNext() {
    // If cooling down, wait
    if (this.cooldownUntil && this.cooldownUntil > Date.now()) {
      return;
    }

    if (this.activeProcesses.size >= this.maxConcurrency) return;

    let nextItem: QueueItem | null = null;

    for (const entryId of this.order) {
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
        const item = this.items.find((i) => i.id === entryId && i.status === 'waiting');
        if (item && !this.activeProcesses.has(item.id)) {
          nextItem = item;
          break;
        }
      }
    }

    if (!nextItem) {
      nextItem = this.items.find((i) => i.status === 'waiting' && !this.activeProcesses.has(i.id)) || null;
    }

    if (!nextItem) return;

    this.processItem(nextItem);

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
    item.phase = 'Preparing';
    item.attempts += 1;
    this.broadcastState();

    const ytdlpPath = getBinaryPath('yt-dlp');
    const denoPath = getBinaryPath('deno');
    const ext = item.format.toLowerCase();
    const isAudioOnly = item.mode === 'audio' || ['mp3', 'm4a', 'wav'].includes(ext);

    // Ensure destination directory exists
    if (!fs.existsSync(item.outputDir)) {
      try {
        fs.mkdirSync(item.outputDir, { recursive: true });
      } catch {}
    }

    // A1: Resolve unique final path BEFORE spawning
    const isClip = Boolean(item.clip && (item.clip.endSec > item.clip.startSec || item.clip.startSec > 0));
    const unique = resolveUniqueOutputPath(
      item.outputDir,
      item.fileName || item.title,
      ext,
      item.clip
    );
    const outputFilePath = unique.finalPath;
    item.filePath = outputFilePath;

    // Resolve FFmpeg directory
    const ffmpegPath = getBinaryPath('ffmpeg');
    const binDir = path.dirname(ffmpegPath);

    // yt-dlp arguments per Part G (Deno runtime), Part D3 (gentle sleep for groups)
    const settings = settingsManager.getSettings();
    const args: string[] = [
      '--newline',
      '--no-playlist',
      '--no-mtime',
      '--ffmpeg-location', binDir,
      '--js-runtimes', `deno:${denoPath}`,
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      '--concurrent-fragments', this.concurrentFragments.toString(),
      '--continue',
      '--progress-template',
      'download:progress:{"percent":"%(progress._percent_str)s","downloaded":"%(progress.downloaded_bytes)s","total":"%(progress.total_bytes)s","speed":"%(progress._speed_str)s","eta":"%(progress._eta_str)s"}'
    ];

    if (settings.cookies?.file && fs.existsSync(settings.cookies.file)) {
      args.push('--cookies', settings.cookies.file);
    } else if (settings.cookies?.browser && settings.cookies.browser !== 'none') {
      args.push('--cookies-from-browser', settings.cookies.browser.toLowerCase());
    }

    // Gentle batching for playlists to avoid 429 rate limiting & IP bans
    if (item.groupId) {
      args.push('--sleep-interval', '2', '--max-sleep-interval', '5', '--sleep-requests', '2');
      const group = this.groups.find((g) => g.id === item.groupId);
      if (group && group.options.skipAlreadyDownloaded) {
        const archiveFile = getPlaylistArchiveFilePath(group.id);
        args.push('--download-archive', archiveFile);
      }
    }

    // Section clipping
    if (isClip && item.clip) {
      args.push('--download-sections', `*${item.clip.startSec}-${item.clip.endSec}`);
      const isExact = item.frameAccurate || item.clip.endSec <= 600;
      if (isExact) {
        args.push('--force-keyframes-at-cuts');
      }
    }

    // Format selection
    if (isAudioOnly) {
      args.push('-x', '--audio-format', ext === 'm4a' ? 'm4a' : ext === 'wav' ? 'wav' : 'mp3');
      const kbpsMatch = item.quality?.match(/(\d+)\s*kbps/i);
      if (kbpsMatch) {
        args.push('--audio-quality', `${kbpsMatch[1]}K`);
      } else {
        args.push('--audio-quality', '0');
      }
    } else {
      const cleanQuality = (item.quality || '').trim();
      const heightMatch = cleanQuality.match(/(\d+)p/i);

      if (heightMatch && !cleanQuality.toLowerCase().startsWith('best available')) {
        const height = parseInt(heightMatch[1], 10);
        args.push(
          '-f',
          `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`
        );
      } else {
        args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best');
      }

      args.push('--merge-output-format', ext === 'mov' ? 'mov' : 'mp4');
    }

    // Output template
    args.push('-o', `${unique.outputTemplatePath}.%(ext)s`);
    args.push(item.url);

    console.log(`[Queue] Starting download for "${item.title}" -> ${outputFilePath}`);

    // Gate 3 & D2 Mock: Support YOUCUT_MOCK_YTDLP=429 and forced mock failures
    if (process.env.YOUCUT_MOCK_YTDLP === '429' || item.url.includes('mock429=1') || item.title.includes('[MOCK_429]')) {
      console.log(`[Queue Mock] Simulating HTTP 429 Rate Limit for "${item.title}"`);
      item.attempts++;
      setTimeout(() => {
        const mockStderr = 'ERROR: [youtube] HTTP Error 429: Too Many Requests. You are being rate limited by YouTube.';
        this.handleProcessFailure(item, mockStderr);
      }, 400);
      return;
    }

    if (process.env.YOUCUT_MOCK_FAIL === '1' || item.url.includes('mockfail=1') || item.title.includes('[MOCK_FAIL]')) {
      console.log(`[Queue Mock] Simulating failure for "${item.title}"`);
      item.attempts++;
      setTimeout(() => {
        const mockStderr = 'ERROR: [youtube] Video unavailable. This video is not available in your region.';
        this.handleProcessFailure(item, mockStderr);
        this.triggerNext();
      }, 400);
      return;
    }

    const jobStartedAtMs = Date.now();
    const childEnv = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8'
    };

    const child = spawn(ytdlpPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: childEnv
    });

    this.activeProcesses.set(item.id, { process: child, watchdog: null });

    if (child.pid) {
      registerChildPid(child.pid);
      this.resetWatchdog(item, child.pid);
    }

    let stdoutAccumulator = '';
    let stderrBuffer = '';
    let lastFfmpegBytes = 0;
    let lastFfmpegTimeMs = Date.now();
    const clipLengthSec = isClip && item.clip ? Math.max(1, item.clip.endSec - item.clip.startSec) : item.durationSec;

    child.stdout?.on('data', (data) => {
      if (child.pid) this.resetWatchdog(item, child.pid);
      const text = data.toString('utf-8');
      stdoutAccumulator += text;

      const lines = splitStreamLines(text);
      for (const line of lines) {
        if (line.startsWith('progress:{') || line.startsWith('download:{') || line.startsWith('{"percent"')) {
          try {
            const jsonStr = line.startsWith('progress:')
              ? line.replace('progress:', '')
              : line.startsWith('download:')
                ? line.replace('download:', '')
                : line;
            const parsed = JSON.parse(jsonStr);

            const percentStr = (parsed.percent || '0%').replace('%', '').trim();
            const pct = Math.min(100, Math.max(0, Math.round(parseFloat(percentStr) || 0)));
            const downloaded = parseInt(parsed.downloaded, 10) || 0;
            const total = parseInt(parsed.total, 10) || 0;
            const speedStr = (parsed.speed || '—').trim();
            const etaStr = (parsed.eta || '—').trim();

            item.phase = 'Downloading';
            item.progress.percent = pct;
            item.progress.downloadedBytes = downloaded;
            item.progress.totalBytes = total;
            item.progress.speed = speedStr;
            item.progress.eta = etaStr;

            this.speedSamples.push({ time: Date.now(), bytes: downloaded });
            const cutoff = Date.now() - 3000;
            this.speedSamples = this.speedSamples.filter((s) => s.time >= cutoff);

            this.throttleBroadcast(item.id);
          } catch {}
        } else if (isClip && (line.includes('time=') || line.includes('size='))) {
          const parsed = parseFfmpegStatsLine(line, clipLengthSec, lastFfmpegBytes, lastFfmpegTimeMs);
          if (parsed) {
            lastFfmpegBytes = parsed.downloadedBytes;
            lastFfmpegTimeMs = Date.now();
            item.phase = 'Merging';
            item.progress.percent = parsed.percent;
            item.progress.downloadedBytes = parsed.downloadedBytes;
            item.progress.totalBytes = parsed.totalBytes;
            item.progress.speed = parsed.speed;
            item.progress.eta = parsed.eta;

            this.speedSamples.push({ time: Date.now(), bytes: parsed.downloadedBytes });
            const cutoff = Date.now() - 3000;
            this.speedSamples = this.speedSamples.filter((s) => s.time >= cutoff);

            this.throttleBroadcast(item.id);
          }
        }
      }
    });

    child.stderr?.on('data', (data) => {
      if (child.pid) this.resetWatchdog(item, child.pid);
      const text = data.toString('utf-8');
      stderrBuffer += text;

      // FFmpeg stats are emitted to stderr with \r
      const lines = splitStreamLines(text);
      for (const line of lines) {
        if (isClip && (line.includes('time=') || line.includes('size='))) {
          const parsed = parseFfmpegStatsLine(line, clipLengthSec, lastFfmpegBytes, lastFfmpegTimeMs);
          if (parsed) {
            lastFfmpegBytes = parsed.downloadedBytes;
            lastFfmpegTimeMs = Date.now();
            item.phase = 'Merging';
            item.progress.percent = parsed.percent;
            item.progress.downloadedBytes = parsed.downloadedBytes;
            item.progress.totalBytes = parsed.totalBytes;
            item.progress.speed = parsed.speed;
            item.progress.eta = parsed.eta;

            this.speedSamples.push({ time: Date.now(), bytes: parsed.downloadedBytes });
            const cutoff = Date.now() - 3000;
            this.speedSamples = this.speedSamples.filter((s) => s.time >= cutoff);

            this.throttleBroadcast(item.id);
          }
        }
      }
    });

    child.on('close', async (exitCode) => {
      const active = this.activeProcesses.get(item.id);
      if (active?.watchdog) clearTimeout(active.watchdog);
      if (child.pid) unregisterChildPid(child.pid);
      this.activeProcesses.delete(item.id);

      console.log(`[Queue] Process exited code ${exitCode} for "${item.title}"`);

      if (exitCode === 0) {
        item.phase = 'Validating';
        this.broadcastState();
        await this.handleProcessSuccess(item, outputFilePath, isAudioOnly, jobStartedAtMs, stdoutAccumulator);
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

  private throttleBroadcast(itemId: string) {
    const now = Date.now();
    const lastEmit = this.lastProgressEmit.get(itemId) || 0;
    if (now - lastEmit >= 200) {
      this.lastProgressEmit.set(itemId, now);
      this.broadcastState();
    }
  }

  private async handleProcessSuccess(
    item: QueueItem,
    outputFilePath: string,
    isAudioOnly: boolean,
    jobStartedAtMs: number,
    stdout: string
  ) {
    const expectedDuration = item.clip ? Math.max(1, item.clip.endSec - item.clip.startSec) : item.durationSec;
    const isClip = Boolean(item.clip && (item.clip.endSec > item.clip.startSec || item.clip.startSec > 0));

    // A2 & Correction 1: ffprobe and metadata validation
    const validation = await validateOutputWithFFprobe({
      filePath: outputFilePath,
      expectedDurationSec: expectedDuration,
      isAudioOnly,
      isExactCut: item.frameAccurate || expectedDuration <= 600,
      isFullVideo: !isClip,
      jobStartedAtMs,
      stdout
    });

    if (!validation.valid) {
      console.warn(`[Queue] Validation failed for "${item.title}": ${validation.warning}`);
      item.status = 'warning';
      item.phase = 'Warning';
      item.warning = validation.warning || 'Output validation failed';
      item.progress.percent = 100;
      item.finishedAt = Date.now();
      item.sizeBytes = validation.fileSizeBytes || (fs.existsSync(outputFilePath) ? fs.statSync(outputFilePath).size : 0);
      // DO NOT record as history success
      return;
    }

    item.status = 'done';
    item.phase = 'Done';
    item.progress.percent = 100;
    item.finishedAt = Date.now();
    item.sizeBytes = validation.fileSizeBytes;
    item.durationSec = validation.durationSeconds || expectedDuration;

    // Reset cooldown attempt on successful download
    this.cooldownAttempt = 0;
    const group = item.groupId ? this.groups.find((g) => g.id === item.groupId) : undefined;

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
      endSec: item.clip?.endSec,
      groupId: item.groupId,
      groupTitle: group?.title,
      indexInGroup: item.indexInGroup,
      totalInGroup: group?.childIds?.length
    });

    // Broadcast history update to all renderer windows
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('history:updated');
      }
    }

    if (this.notificationsEnabled && Notification.isSupported()) {
      new Notification({
        title: 'Download Completed',
        body: item.title
      }).show();
    }
  }

  private handleProcessFailure(item: QueueItem, rawError: string) {
    const classified = classifyErrorFromStderr(rawError, item.attempts);
    item.stderrTail = classified.stderrTail;

    if (classified.isRateLimit) {
      item.status = 'failed';
      item.phase = 'Failed';
      item.error = `${classified.message} · ${classified.suggestedAction}`;
      console.warn(`[Queue] Rate limit detected for "${item.title}": ${classified.message}`);
      this.triggerCooldown(classified.message);
      return;
    }

    // Normal transient errors: backoff retry once after 5s
    if (item.attempts < 2) {
      console.warn(`[Queue] Item "${item.title}" failed attempt ${item.attempts}. Retrying in 5s...`);
      item.status = 'waiting';
      item.phase = 'Waiting';
      item.error = `Retrying in 5s... (${classified.message})`;
      setTimeout(() => {
        if (item.status === 'waiting') {
          this.triggerNext();
        }
      }, 5000);
    } else {
      item.status = 'failed';
      item.phase = 'Failed';
      item.error = `${classified.message} · ${classified.suggestedAction}`;
      console.error(`[Queue] Item "${item.title}" permanently failed: ${item.error}`);
    }
  }

  private calculateOverallSpeedBps(): number {
    if (this.speedSamples.length < 2) {
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
    if (!bps || bps <= 0) return '—';
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
    const warningItems = this.items.filter((i) => i.status === 'warning');
    const failedItems = this.items.filter((i) => i.status === 'failed');

    const overallSpeedBps = activeItems.length > 0 ? this.calculateOverallSpeedBps() : 0;

    // Remaining bytes across all active and waiting items
    let remainingBytes = 0;
    for (const item of [...activeItems, ...waitingItems]) {
      const total = item.progress.totalBytes || item.sizeBytes || 40 * 1024 * 1024;
      const downloaded = item.progress.downloadedBytes || 0;
      remainingBytes += Math.max(0, total - downloaded);
    }

    const etaSec = overallSpeedBps > 50000 ? Math.round(remainingBytes / overallSpeedBps) : 0;

    return {
      items: this.items,
      groups: this.groups,
      order: this.order,
      overallSpeedBps,
      overallSpeedFormatted: activeItems.length > 0 ? this.formatSpeed(overallSpeedBps) : '—',
      overallEtaSec: etaSec,
      overallEtaFormatted: activeItems.length > 0 && etaSec > 0 ? `≈ ${this.formatTime(etaSec)}` : 'calculating...',
      waitingCount: waitingItems.length,
      activeCount: activeItems.length,
      doneCount: doneItems.length,
      warningCount: warningItems.length,
      failedCount: failedItems.length,
      cooldownUntil: this.cooldownUntil || undefined,
      cooldownReason: this.cooldownReason || undefined,
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
