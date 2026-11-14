import fs from 'fs';
import path from 'path';
import { getYouCutHome } from '../config/paths';

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

class HistoryStore {
  private getFilePath(): string {
    const home = getYouCutHome();
    return path.join(home, 'history.json');
  }

  public getAll(): HistoryRecord[] {
    try {
      const p = this.getFilePath();
      if (!fs.existsSync(p)) return [];
      const data = fs.readFileSync(p, 'utf-8');
      return JSON.parse(data) || [];
    } catch (e) {
      console.warn('[HistoryStore] Failed to read history:', e);
      return [];
    }
  }

  public add(record: HistoryRecord): void {
    try {
      const list = this.getAll();
      // Prepend so newest is first
      list.unshift(record);
      // Keep up to 500 history items
      const trimmed = list.slice(0, 500);
      fs.writeFileSync(this.getFilePath(), JSON.stringify(trimmed, null, 2), 'utf-8');
    } catch (e) {
      console.error('[HistoryStore] Failed to add history record:', e);
    }
  }

  public clear(): void {
    try {
      fs.writeFileSync(this.getFilePath(), '[]', 'utf-8');
    } catch (e) {
      console.error('[HistoryStore] Failed to clear history:', e);
    }
  }

  public remove(id: string): void {
    try {
      const list = this.getAll().filter((item) => item.id !== id);
      fs.writeFileSync(this.getFilePath(), JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('[HistoryStore] Failed to remove history item:', e);
    }
  }
}

export const historyStore = new HistoryStore();
