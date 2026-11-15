import fs from 'fs';
import path from 'path';
import { getYouCutHome } from '../config/paths';
import { QueueItem, QueueGroup } from '../../shared/types';

export interface PersistedQueueData {
  items: QueueItem[];
  groups: QueueGroup[];
  order: string[]; // Order of cards (IDs of standalone items and group IDs)
}

class QueuePersistence {
  private saveTimeout: NodeJS.Timeout | null = null;

  public getQueueFilePath(): string {
    const home = getYouCutHome();
    if (!fs.existsSync(home)) {
      try {
        fs.mkdirSync(home, { recursive: true });
      } catch {}
    }
    return path.join(home, 'queue.json');
  }

  public load(): PersistedQueueData {
    try {
      const p = this.getQueueFilePath();
      if (!fs.existsSync(p)) {
        return { items: [], groups: [], order: [] };
      }
      const raw = fs.readFileSync(p, 'utf-8');
      const data = JSON.parse(raw) as PersistedQueueData;

      const items = (data.items || []).map((item) => {
        // If app crashed or exited while downloading, mark as paused on startup
        if (item.status === 'downloading') {
          return { ...item, status: 'paused' as const };
        }
        return item;
      });

      return {
        items,
        groups: data.groups || [],
        order: data.order || items.map((i) => i.id)
      };
    } catch (e) {
      console.warn('[QueuePersistence] Failed to read queue.json:', e);
      return { items: [], groups: [], order: [] };
    }
  }

  public saveDebounced(data: PersistedQueueData, delayMs = 300): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveImmediate(data);
    }, delayMs);
  }

  public saveImmediate(data: PersistedQueueData): void {
    try {
      const filePath = this.getQueueFilePath();
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      const json = JSON.stringify(data, null, 2);

      fs.writeFileSync(tempPath, json, 'utf-8');
      fs.renameSync(tempPath, filePath);
    } catch (e) {
      console.error('[QueuePersistence] Failed to atomically save queue.json:', e);
    }
  }
}

export const queuePersistence = new QueuePersistence();
