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

export interface IElectronAPI {
  getAppVersion: () => Promise<string>;
  getYouCutHome: () => Promise<string>;
  getBinariesStatus: () => Promise<Record<string, boolean>>;
  readClipboard: () => Promise<string>;
  writeClipboard: (text: string) => Promise<boolean>;
  fetchVideoInfo: (url: string) => Promise<VideoInfo>;
}

const api: IElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getYouCutHome: () => ipcRenderer.invoke('app:home'),
  getBinariesStatus: () => ipcRenderer.invoke('binaries:status'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),
  fetchVideoInfo: (url: string) => ipcRenderer.invoke('youtube:fetch-info', url)
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
