import path from 'path';
import fs from 'fs';
import os from 'os';
import { app } from 'electron';

export function getYouCutHome(): string {
  if (process.env.YOUCUT_HOME) {
    const custom = path.resolve(process.env.YOUCUT_HOME);
    if (!fs.existsSync(custom)) fs.mkdirSync(custom, { recursive: true });
    return custom;
  }
  const appData = app?.getPath ? app.getPath('appData') : (process.env.APPDATA || os.tmpdir());
  const defaultHome = path.join(appData, 'YouCut2');
  if (!fs.existsSync(defaultHome)) fs.mkdirSync(defaultHome, { recursive: true });
  return defaultHome;
}

export function getBinaryPath(binaryName: string): string {
  const exeName = process.platform === 'win32' && !binaryName.endsWith('.exe') ? `${binaryName}.exe` : binaryName;
  // Check YOUCUT_HOME/bin first (used by auto-updater)
  try {
    const userBin = path.join(getYouCutHome(), 'bin', exeName);
    if (fs.existsSync(userBin)) {
      return userBin;
    }
  } catch {}

  const isDev = !app?.isPackaged;
  const projectRoot = isDev
    ? (app?.getAppPath ? app.getAppPath() : process.cwd())
    : (process.resourcesPath || process.cwd());
  const binDir = path.join(projectRoot, 'resources', 'bin');
  return path.join(binDir, exeName);
}

export function getDefaultDownloadsDir(platform: string = 'YouTube'): string {
  const downloadsDir = app?.getPath ? app.getPath('downloads') : path.join(os.homedir(), 'Downloads');
  const base = path.join(downloadsDir, 'YouCut', platform);
  if (!fs.existsSync(base)) {
    try {
      fs.mkdirSync(base, { recursive: true });
    } catch {
      // Fallback
    }
  }
  return base;
}
