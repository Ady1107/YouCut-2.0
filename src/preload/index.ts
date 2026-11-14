import { contextBridge, ipcRenderer } from 'electron';

export interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  durationFormatted: string;
  uploader: string;
  thumbnail: string;
  webpageUrl: string;
  viewCount?: number;
  uploadDate?: string;
  isVertical?: boolean;
  isPlaylist?: boolean;
  availableResolutions?: string[];
  chapters?: Array<{ title: string; start_time: number; end_time: number }>;
}

export interface QueueItem {
  id: string;
  title: string;
  url: string;
  platform: 'youtube' | 'instagram' | 'facebook';
  format: string;
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

export interface HistoryRecord {
  id: string;
  title: string;
  url: string;
  platform: 'youtube' | 'instagram' | 'facebook';
  format: string;
  quality: string;
  durationFormatted: string;
  durationSeconds: number;
  filePath: string;
  fileSizeBytes: number;
  downloadedAt: number;
  isFullVideo: boolean;
  startSec?: number;
  endSec?: number;
}

export interface IElectronAPI {
  getAppVersion: () => Promise<string>;
  getYouCutHome: () => Promise<string>;
  getBinariesStatus: () => Promise<Record<string, boolean>>;
  readClipboard: () => Promise<string>;
  writeClipboard: (text: string) => Promise<boolean>;
  fetchVideoInfo: (url: string) => Promise<VideoInfo>;

  // Queue methods
  addToQueue: (item: any) => Promise<QueueItem>;
  getQueue: () => Promise<QueueItem[]>;
  pauseQueueItem: (id: string) => Promise<void>;
  resumeQueueItem: (id: string) => Promise<void>;
  cancelQueueItem: (id: string) => Promise<void>;
  clearCompletedQueue: () => Promise<void>;
  setQueueConcurrency: (n: number) => Promise<void>;
  onQueueUpdate: (callback: (items: QueueItem[]) => void) => () => void;
  onQueueProgress: (callback: (data: { id: string; progress: number; speed: string; eta: string; downloadedBytes: number; totalBytes: number }) => void) => () => void;

  // History methods
  getHistory: () => Promise<HistoryRecord[]>;
  clearHistory: () => Promise<void>;
  removeHistoryItem: (id: string) => Promise<void>;

  // System shell
  openFolder: (filePath: string) => Promise<boolean>;
  openFile: (filePath: string) => Promise<boolean>;
  openDirectoryDialog: (defaultPath?: string) => Promise<string | null>;
  getDefaultDownloadDir: (platform: string) => Promise<string>;
}

const api: IElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getYouCutHome: () => ipcRenderer.invoke('app:home'),
  getBinariesStatus: () => ipcRenderer.invoke('binaries:status'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),
  fetchVideoInfo: (url: string) => ipcRenderer.invoke('youtube:fetch-info', url),

  addToQueue: (item) => ipcRenderer.invoke('queue:add', item),
  getQueue: () => ipcRenderer.invoke('queue:list'),
  pauseQueueItem: (id) => ipcRenderer.invoke('queue:pause', id),
  resumeQueueItem: (id) => ipcRenderer.invoke('queue:resume', id),
  cancelQueueItem: (id) => ipcRenderer.invoke('queue:cancel', id),
  clearCompletedQueue: () => ipcRenderer.invoke('queue:clear-completed'),
  setQueueConcurrency: (n) => ipcRenderer.invoke('queue:set-concurrency', n),

  onQueueUpdate: (callback) => {
    const handler = (_event: any, items: QueueItem[]) => callback(items);
    ipcRenderer.on('queue:update', handler);
    return () => ipcRenderer.removeListener('queue:update', handler);
  },
  onQueueProgress: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('queue:progress', handler);
    return () => ipcRenderer.removeListener('queue:progress', handler);
  },

  getHistory: () => ipcRenderer.invoke('history:list'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  removeHistoryItem: (id) => ipcRenderer.invoke('history:remove', id),

  openFolder: (filePath) => ipcRenderer.invoke('shell:open-folder', filePath),
  openFile: (filePath) => ipcRenderer.invoke('shell:open-file', filePath),
  openDirectoryDialog: (defaultPath) => ipcRenderer.invoke('dialog:open-directory', defaultPath),
  getDefaultDownloadDir: (platform) => ipcRenderer.invoke('downloads:get-default', platform)
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error('Failed to expose preload api:', error);
  }
} else {
  // @ts-ignore
  window.api = api;
}
