import fs from 'fs';
import path from 'path';
import { getYouCutHome, getDefaultDownloadsDir } from './paths';

export interface AppSettings {
  schemaVersion: number;
  appearance: {
    theme: 'dark' | 'light' | 'system';
  };
  downloads: {
    defaultFolder: string;
    lastFolderByPlatform: Record<string, string>;
    concurrentFragments: number;
    defaultVideoFormat: string;
    trimMode: 'auto' | 'fast' | 'exact';
  };
  cookies: {
    browser: string;
    file: string | null;
  };
  updates: {
    app: {
      checkOnStartup: boolean;
    };
    ytdlp: {
      autoUpdate: boolean;
    };
    ffmpeg: {
      autoUpdate: boolean;
    };
    lastCheckedAt: string | null;
    toolLastChecked?: Record<string, string>;
  };
  notifications: {
    mode: string;
    onlyWhenBackground: boolean;
    onFailure: boolean;
  };
}

export function getDefaultSettings(): AppSettings {
  const defaultDir = getDefaultDownloadsDir('YouTube');
  return {
    schemaVersion: 1,
    appearance: {
      theme: 'dark'
    },
    downloads: {
      defaultFolder: defaultDir,
      lastFolderByPlatform: {},
      concurrentFragments: 8,
      defaultVideoFormat: 'mp4',
      trimMode: 'auto'
    },
    cookies: {
      browser: 'none',
      file: null
    },
    updates: {
      app: {
        checkOnStartup: true
      },
      ytdlp: {
        autoUpdate: true
      },
      ffmpeg: {
        autoUpdate: false
      },
      lastCheckedAt: null,
      toolLastChecked: {}
    },
    notifications: {
      mode: 'queue',
      onlyWhenBackground: true,
      onFailure: true
    }
  };
}

class SettingsManager {
  private currentSettings: AppSettings;
  private saveTimeout: NodeJS.Timeout | null = null;
  private filePath: string;

  constructor() {
    const home = getYouCutHome();
    this.filePath = path.join(home, 'settings.json');
    this.currentSettings = this.load();
  }

  public getSettings(): AppSettings {
    return JSON.parse(JSON.stringify(this.currentSettings));
  }

  public patchSettings(partial: Partial<AppSettings> | Record<string, any>): AppSettings {
    // Deep merge helper
    const mergeDeep = (target: any, source: any) => {
      for (const key of Object.keys(source)) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key]) &&
          target[key]
        ) {
          mergeDeep(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };

    mergeDeep(this.currentSettings, partial);
    this.scheduleSave();
    return this.getSettings();
  }

  private load(): AppSettings {
    const defaults = getDefaultSettings();
    if (!fs.existsSync(this.filePath)) {
      this.saveImmediate(defaults);
      return defaults;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('settings.json is not an object');
      }

      // Merge with defaults to ensure all fields are populated
      const loaded = {
        ...defaults,
        ...parsed,
        appearance: { ...defaults.appearance, ...(parsed.appearance || {}) },
        downloads: { ...defaults.downloads, ...(parsed.downloads || {}) },
        cookies: { ...defaults.cookies, ...(parsed.cookies || {}) },
        updates: {
          ...defaults.updates,
          ...(parsed.updates || {}),
          app: { ...defaults.updates.app, ...(parsed.updates?.app || {}) },
          ytdlp: { ...defaults.updates.ytdlp, ...(parsed.updates?.ytdlp || {}) },
          ffmpeg: { ...defaults.updates.ffmpeg, ...(parsed.updates?.ffmpeg || {}) }
        },
        notifications: { ...defaults.notifications, ...(parsed.notifications || {}) }
      };
      return loaded;
    } catch (err) {
      console.error('[Settings] Corrupted settings.json detected. Backing up and resetting.', err);
      try {
        const corruptPath = `${this.filePath}.corrupt`;
        if (fs.existsSync(this.filePath)) {
          fs.renameSync(this.filePath, corruptPath);
        }
      } catch (backupErr) {
        console.error('[Settings] Failed to backup corrupt settings file:', backupErr);
      }
      this.saveImmediate(defaults);
      return defaults;
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveImmediate(this.currentSettings);
      this.saveTimeout = null;
    }, 150);
  }

  public saveImmediate(settings: AppSettings): void {
    try {
      const home = path.dirname(this.filePath);
      if (!fs.existsSync(home)) {
        fs.mkdirSync(home, { recursive: true });
      }
      const tmpPath = `${this.filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.error('[Settings] Failed to write settings.json atomically:', err);
    }
  }
}

export const settingsManager = new SettingsManager();
