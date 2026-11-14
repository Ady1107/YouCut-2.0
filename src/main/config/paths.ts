import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export function getYouCutHome(): string {
  if (process.env.YOUCUT_HOME) {
    const custom = path.resolve(process.env.YOUCUT_HOME);
    if (!fs.existsSync(custom)) fs.mkdirSync(custom, { recursive: true });
    return custom;
  }
  const defaultHome = path.join(app.getPath('appData'), 'YouCut2');
  if (!fs.existsSync(defaultHome)) fs.mkdirSync(defaultHome, { recursive: true });
  return defaultHome;
}

export function getBinaryPath(binaryName: string): string {
  const isDev = !app.isPackaged;
  const projectRoot = isDev ? app.getAppPath() : process.resourcesPath;
  const binDir = path.join(projectRoot, 'resources', 'bin');
  const exeName = process.platform === 'win32' && !binaryName.endsWith('.exe') ? `${binaryName}.exe` : binaryName;
  return path.join(binDir, exeName);
}

export function getDefaultDownloadsDir(platform: string = 'YouTube'): string {
  const base = path.join(app.getPath('downloads'), 'YouCut', platform);
  if (!fs.existsSync(base)) {
    try {
      fs.mkdirSync(base, { recursive: true });
    } catch {
      // Fallback
    }
  }
  return base;
}
