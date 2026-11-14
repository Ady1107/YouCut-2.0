import { contextBridge, ipcRenderer } from 'electron';

export interface IElectronAPI {
  getAppVersion: () => Promise<string>;
  getYouCutHome: () => Promise<string>;
  getBinariesStatus: () => Promise<Record<string, boolean>>;
}

const api: IElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getYouCutHome: () => ipcRenderer.invoke('app:home'),
  getBinariesStatus: () => ipcRenderer.invoke('binaries:status')
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
