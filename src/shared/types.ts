export type QueueItemStatus = 'waiting' | 'downloading' | 'paused' | 'done' | 'failed' | 'canceled';

export type QueueItemFormat = 'mp4' | 'mov' | 'gif' | 'mp3' | 'm4a' | 'wav';

export interface QueueItemClip {
  startSec: number;
  endSec: number;
}

export interface QueueProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBps: number;
  speed: string; // Formatted e.g. "6.2 MB/s"
  etaSec: number;
  eta: string; // Formatted e.g. "00:03" or "about 02:10 left"
}

export interface QueueItem {
  id: string;
  platform: 'youtube' | 'instagram' | 'facebook';
  url: string;
  title: string;
  thumbnailUrl: string;
  durationSec: number;
  format: QueueItemFormat;
  quality: string;
  mode: 'video' | 'audio';
  clip?: QueueItemClip | null; // null = full video
  outputDir: string;
  filePath?: string;
  status: QueueItemStatus;
  progress: QueueProgress;
  error?: string;
  attempts: number;
  sizeBytes?: number;
  finishedAt?: number;
  groupId?: string;
  indexInGroup?: number;
  addedAt: number;
  frameAccurate?: boolean;
  fileName?: string;
}

export interface QueueGroupOptions {
  createPlaylistFolder?: boolean;
  numberFiles?: boolean;
  skipAlreadyDownloaded?: boolean;
  format?: QueueItemFormat;
  quality?: string;
  mode?: 'video' | 'audio';
}

export interface QueueGroup {
  id: string;
  kind: 'playlist' | 'chapters';
  title: string;
  channel: string;
  sourceUrl: string;
  thumbnailUrl: string;
  childIds: string[];
  options: QueueGroupOptions;
  createdAt: number;
  collapsed?: boolean;
}

export interface PlaylistEntry {
  id: string;
  index: number;
  title: string;
  durationSec: number;
  durationFormatted: string;
  thumbnailUrl: string;
  available: boolean;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  channel: string;
  count: number;
  totalDurationSec: number;
  totalDurationFormatted: string;
  thumbnailUrl: string;
  entries: PlaylistEntry[];
}

export interface PlaylistDetectResult {
  isPlaylist: boolean;
  hasVideoAndPlaylist: boolean;
  playlistId?: string;
  videoId?: string;
}

export interface QueueStatePayload {
  items: QueueItem[];
  groups: QueueGroup[];
  order: string[]; // List of IDs (can be group IDs or item IDs)
  overallSpeedBps: number;
  overallSpeedFormatted: string;
  overallEtaSec: number;
  overallEtaFormatted: string;
  waitingCount: number;
  activeCount: number;
  doneCount: number;
  failedCount: number;
  speedHistory: number[]; // 21 samples, every 500ms
}
