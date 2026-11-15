import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { historyStore } from '../src/main/download/history';
import { updatesManager } from '../src/main/config/updates';

describe('History Store Playlist & Shorts Grouping', () => {
  it('records and returns playlist group metadata in HistoryStore', () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'youcut-history-test-'));
    process.env.YOUCUT_HOME = tmpHome;

    historyStore.add({
      id: 'item-1',
      title: 'Short 1 - मुख में ब्रह्मांड',
      url: 'https://youtube.com/shorts/1',
      platform: 'youtube',
      format: 'MP4',
      quality: 'Best available',
      durationFormatted: '0m 45s',
      durationSeconds: 45,
      filePath: path.join(tmpHome, 'Short 1.mp4'),
      fileSizeBytes: 59700000,
      downloadedAt: Date.now(),
      isFullVideo: true,
      groupId: 'group-archive-shorts',
      groupTitle: 'Archive Shorts',
      indexInGroup: 0,
      totalInGroup: 6
    });

    historyStore.add({
      id: 'item-2',
      title: 'Short 2 - कमाओ, आत्मनिर्भर बनो',
      url: 'https://youtube.com/shorts/2',
      platform: 'youtube',
      format: 'MP4',
      quality: 'Best available',
      durationFormatted: '0m 52s',
      durationSeconds: 52,
      filePath: path.join(tmpHome, 'Short 2.mp4'),
      fileSizeBytes: 47800000,
      downloadedAt: Date.now(),
      isFullVideo: true,
      groupId: 'group-archive-shorts',
      groupTitle: 'Archive Shorts',
      indexInGroup: 1,
      totalInGroup: 6
    });

    const records = historyStore.getAll();
    expect(records.length).toBeGreaterThanOrEqual(2);
    const short1 = records.find((r) => r.id === 'item-1');
    const short2 = records.find((r) => r.id === 'item-2');

    expect(short1).toBeDefined();
    expect(short1?.groupTitle).toBe('Archive Shorts');
    expect(short1?.groupId).toBe('group-archive-shorts');
    expect(short1?.indexInGroup).toBe(0);

    expect(short2).toBeDefined();
    expect(short2?.groupTitle).toBe('Archive Shorts');
    expect(short2?.groupId).toBe('group-archive-shorts');
    expect(short2?.indexInGroup).toBe(1);

    fs.rmSync(tmpHome, { recursive: true, force: true });
    delete process.env.YOUCUT_HOME;
  });
});

describe('Updates Manager Real State Inspection', () => {
  it('provides state for all tools with valid initial configuration', () => {
    const state = updatesManager.getState();
    expect(state).toBeDefined();
    expect(state.tools).toBeDefined();
    expect(state.tools.youcut).toBeDefined();
    expect(state.tools.ytdlp).toBeDefined();
    expect(state.tools.ffmpeg).toBeDefined();

    expect(state.tools.youcut.name).toBe('YouCut');
    expect(state.tools.ytdlp.name).toBe('yt-dlp');
    expect(state.tools.ffmpeg.name).toBe('FFmpeg');
  });
});
