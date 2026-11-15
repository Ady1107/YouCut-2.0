import { contextBridge, ipcRenderer } from 'electron';
import {
  QueueItem,
  QueueGroup,
  QueueStatePayload,
  PlaylistInfo,
  PlaylistDetectResult
} from '../shared/types';

export * from '../shared/types';

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
  addGroupToQueue: (group: QueueGroup, children: QueueItem[]) => Promise<void>;
  getQueue: () => Promise<QueueStatePayload | QueueItem[]>;
  pauseQueueItem: (id: string) => Promise<void>;
  resumeQueueItem: (id: string) => Promise<void>;
  cancelQueueItem: (id: string) => Promise<void>;
  retryQueueItem: (id: string) => Promise<void>;
  removeQueueItem: (id: string) => Promise<void>;
  reorderQueue: (order: string[]) => Promise<void>;
  startNowQueueItem: (id: string) => Promise<void>;
  pauseAllQueue: () => Promise<void>;
  resumeAllQueue: () => Promise<void>;
  resumeQueueCooldown: () => Promise<void>;
  clearCompletedQueue: () => Promise<void>;
  setQueueConcurrency: (n: number) => Promise<void>;
  onQueueUpdate: (callback: (payload: QueueStatePayload | QueueItem[]) => void) => () => void;
  onQueueProgress: (callback: (data: any) => void) => () => void;

  // Playlist methods
  detectPlaylist: (url: string) => Promise<PlaylistDetectResult>;
  fetchPlaylist: (url: string) => Promise<PlaylistInfo>;

  // History methods
  getHistory: () => Promise<HistoryRecord[]>;
  clearHistory: () => Promise<void>;
  removeHistoryItem: (id: string) => Promise<void>;
  checkHistoryDuplicate: (url: string, format: string, isFullVideo: boolean, startSec?: number, endSec?: number) => Promise<HistoryRecord | undefined>;

  // System shell
  openFolder: (filePath: string) => Promise<boolean>;
  openFile: (filePath: string) => Promise<boolean>;
  openDirectoryDialog: (defaultPath?: string) => Promise<string | null>;
  getDefaultDownloadDir: (platform: string) => Promise<string>;

  // Settings & Updates
  getSettings: () => Promise<any>;
  patchSettings: (partial: any) => Promise<any>;
  getUpdatesState: () => Promise<any>;
  checkUpdates: (tool?: string) => Promise<any>;
  applyUpdate: (tool: string) => Promise<void>;
  cancelUpdate: (tool: string) => Promise<void>;
  onUpdatesState: (callback: (state: any) => void) => () => void;
  checkBrowserCookies: (browser: string) => Promise<string>;
  browseCookiesFile: () => Promise<string | null>;
  validateCookiesFile: (filePath: string) => Promise<{ valid: boolean; error?: string }>;
  getDiagnostics: () => Promise<string>;
}

const api: IElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getYouCutHome: () => ipcRenderer.invoke('app:home'),
  getBinariesStatus: () => ipcRenderer.invoke('binaries:status'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),
  fetchVideoInfo: (url: string) => ipcRenderer.invoke('youtube:fetch-info', url),

  addToQueue: (item) => ipcRenderer.invoke('queue:add', item),
  addGroupToQueue: (group, children) => ipcRenderer.invoke('queue:add-group', group, children),
  getQueue: () => ipcRenderer.invoke('queue:list'),
  pauseQueueItem: (id) => ipcRenderer.invoke('queue:pause', id),
  resumeQueueItem: (id) => ipcRenderer.invoke('queue:resume', id),
  cancelQueueItem: (id) => ipcRenderer.invoke('queue:cancel', id),
  retryQueueItem: (id) => ipcRenderer.invoke('queue:retry', id),
  removeQueueItem: (id) => ipcRenderer.invoke('queue:remove', id),
  reorderQueue: (order) => ipcRenderer.invoke('queue:reorder', order),
  startNowQueueItem: (id) => ipcRenderer.invoke('queue:start-now', id),
  pauseAllQueue: () => ipcRenderer.invoke('queue:pause-all'),
  resumeAllQueue: () => ipcRenderer.invoke('queue:resume-all'),
  resumeQueueCooldown: () => ipcRenderer.invoke('queue:resume-cooldown'),
  clearCompletedQueue: () => ipcRenderer.invoke('queue:clear-completed'),
  setQueueConcurrency: (n) => ipcRenderer.invoke('queue:set-concurrency', n),

  onQueueUpdate: (callback) => {
    const handler = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on('queue:update', handler);
    return () => ipcRenderer.removeListener('queue:update', handler);
  },
  onQueueProgress: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('queue:progress', handler);
    return () => ipcRenderer.removeListener('queue:progress', handler);
  },

  detectPlaylist: (url) => ipcRenderer.invoke('playlist:detect', url),
  fetchPlaylist: (url) => ipcRenderer.invoke('playlist:fetch', url),

  getHistory: () => ipcRenderer.invoke('history:list'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  removeHistoryItem: (id) => ipcRenderer.invoke('history:remove', id),
  checkHistoryDuplicate: (url, format, isFullVideo, startSec, endSec) =>
    ipcRenderer.invoke('history:check-duplicate', url, format, isFullVideo, startSec, endSec),

  openFolder: (filePath) => ipcRenderer.invoke('shell:open-folder', filePath),
  openFile: (filePath) => ipcRenderer.invoke('shell:open-file', filePath),
  openDirectoryDialog: (defaultPath) => ipcRenderer.invoke('dialog:open-directory', defaultPath),
  getDefaultDownloadDir: (platform) => ipcRenderer.invoke('downloads:get-default', platform),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  patchSettings: (partial) => ipcRenderer.invoke('settings:patch', partial),
  getUpdatesState: () => ipcRenderer.invoke('updates:getState'),
  checkUpdates: (tool) => ipcRenderer.invoke('updates:check', tool),
  applyUpdate: (tool) => ipcRenderer.invoke('updates:apply', tool),
  cancelUpdate: (tool) => ipcRenderer.invoke('updates:cancel', tool),
  onUpdatesState: (callback) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on('updates:state', handler);
    return () => ipcRenderer.removeListener('updates:state', handler);
  },
  checkBrowserCookies: (browser) => ipcRenderer.invoke('cookies:check-browser', browser),
  browseCookiesFile: () => ipcRenderer.invoke('cookies:browse-file'),
  validateCookiesFile: (filePath) => ipcRenderer.invoke('cookies:validate-file', filePath),
  getDiagnostics: () => ipcRenderer.invoke('diagnostics:get')
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
