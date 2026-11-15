import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectPlaylistUrl } from '../src/main/download/playlist';
import { mapYtDlpError } from '../src/main/download/errors';
import { sanitizeFilename, formatClipStamp } from '../src/shared/filename';
import { resolveUniqueOutputPath } from '../src/main/download/filename';
import { validateOutputWithFFprobe } from '../src/main/download/validator';
import { historyStore } from '../src/main/download/history';

describe('Playlist URL Detection', () => {
  it('detects pure playlist URLs', () => {
    const res = detectPlaylistUrl('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5lftvv9TPboYG');
    expect(res.isPlaylist).toBe(true);
    expect(res.hasVideoAndPlaylist).toBe(false);
    expect(res.playlistId).toBe('PLx0sYbCqOb8TBPRdmBHs5lftvv9TPboYG');
  });

  it('detects watch URL with both video id and playlist list', () => {
    const res = detectPlaylistUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ&list=PLx0sYbCqOb8TBPRdmBHs5lftvv9TPboYG');
    expect(res.isPlaylist).toBe(true);
    expect(res.hasVideoAndPlaylist).toBe(true);
    expect(res.videoId).toBe('aqz-KE-bpKQ');
    expect(res.playlistId).toBe('PLx0sYbCqOb8TBPRdmBHs5lftvv9TPboYG');
  });

  it('returns false for single video without list', () => {
    const res = detectPlaylistUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
    expect(res.isPlaylist).toBe(false);
    expect(res.hasVideoAndPlaylist).toBe(false);
  });
});

describe('Error Mapping & Retry Backoff', () => {
  it('maps network timeout with attempt count', () => {
    const err = mapYtDlpError('Connection reset by peer (errno 11001)', 3);
    expect(err).toBe('Network timeout · failed after 3 tries');
  });

  it('maps private video correctly', () => {
    const err = mapYtDlpError('ERROR: [youtube] 12345: This video is private', 1);
    expect(err).toBe('Private video · Sign-in required');
  });

  it('maps age restriction correctly', () => {
    const err = mapYtDlpError('Sign in to confirm your age', 1);
    expect(err).toBe('Age-restricted video · Requires sign-in');
  });

  it('maps disk full correctly', () => {
    const err = mapYtDlpError('No space left on device', 1);
    expect(err).toBe('Disk full · Free up space on target drive');
  });
});

describe('Unique Output Filename Resolution & Deduplication (Part A1)', () => {
  it('formats clip stamp with HH.MM.SS-HH.MM.SS', () => {
    const stamp = formatClipStamp(2, 21);
    expect(stamp).toBe('[00.00.02-00.00.21]');
  });

  it('appends clip stamp and deduplicates when file exists on disk', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youcut-test-'));
    const title = 'Sample Video';
    const clip = { startSec: 2, endSec: 21 };

    // First clip
    const r1 = resolveUniqueOutputPath(tmpDir, title, 'mp4', clip);
    expect(r1.finalPath).toContain('[00.00.02-00.00.21].mp4');
    fs.writeFileSync(r1.finalPath, 'dummy data 1');

    // Second clip with same range -> should append " (2)"
    const r2 = resolveUniqueOutputPath(tmpDir, title, 'mp4', clip);
    expect(r2.finalPath).toContain('[00.00.02-00.00.21] (2).mp4');
    fs.writeFileSync(r2.finalPath, 'dummy data 2');

    // Third clip with same range -> should append " (3)"
    const r3 = resolveUniqueOutputPath(tmpDir, title, 'mp4', clip);
    expect(r3.finalPath).toContain('[00.00.02-00.00.21] (3).mp4');

    // Full video download of same title -> should be "Sample Video.mp4" (no stamp)
    const rFull = resolveUniqueOutputPath(tmpDir, title, 'mp4', null);
    expect(path.basename(rFull.finalPath)).toBe('Sample Video.mp4');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});


describe('Validation Engine & Correction 1 Unit Tests', () => {
  it('FAILS validation when file predates job start', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youcut-val-'));
    const testFile = path.join(tmpDir, 'old-file.mp4');
    fs.writeFileSync(testFile, 'dummy content');

    // Set file time to 10 seconds ago
    const tenSecsAgo = (Date.now() - 10000) / 1000;
    fs.utimesSync(testFile, tenSecsAgo, tenSecsAgo);

    const jobStartedAtMs = Date.now();
    const result = await validateOutputWithFFprobe({
      filePath: testFile,
      expectedDurationSec: 10,
      isAudioOnly: false,
      isExactCut: true,
      jobStartedAtMs
    });

    expect(result.valid).toBe(false);
    expect(result.warning).toContain('predates job start');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('FAILS validation when stdout reports "has already been downloaded"', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youcut-val-'));
    const testFile = path.join(tmpDir, 'existing.mp4');
    fs.writeFileSync(testFile, 'dummy content');

    const result = await validateOutputWithFFprobe({
      filePath: testFile,
      expectedDurationSec: 10,
      isAudioOnly: false,
      isExactCut: true,
      stdout: '[download] Sample.mp4 has already been downloaded'
    });

    expect(result.valid).toBe(false);
    expect(result.warning).toContain('already downloaded');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('FAILS validation on wrong-length media file (duration discrepancy)', async () => {
    // If a 5.0s file is presented for a 10s exact cut request, tolerance is 1.0s, so diff 5.0s > 1.0s fails
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youcut-val-'));
    const testFile = path.join(tmpDir, 'clip.mp4');

    // Generate a real 5-second test video with ffmpeg
    const ffmpegPath = path.resolve('resources/bin/ffmpeg.exe');
    if (fs.existsSync(ffmpegPath)) {
      const { execFileSync } = await import('child_process');
      execFileSync(ffmpegPath, [
        '-y',
        '-f', 'lavfi',
        '-i', 'testsrc=duration=5:size=320x240:rate=30',
        '-f', 'lavfi',
        '-i', 'sine=frequency=1000:duration=5',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        testFile
      ], { stdio: 'ignore' });

      // Request 10.0 seconds exact cut
      const result = await validateOutputWithFFprobe({
        filePath: testFile,
        expectedDurationSec: 10,
        isAudioOnly: false,
        isExactCut: true,
        isFullVideo: false,
        jobStartedAtMs: Date.now() - 5000
      });

      expect(result.valid).toBe(false);
      expect(result.warning).toContain('Duration discrepancy');
      expect(result.warning).toContain('diff');
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('Hindi & Unicode Character Encoding (Part F)', () => {
  it('preserves exact Hindi Unicode characters on disk and cleans invalid chars', () => {
    const hindiTitle = 'त्योहारों पर घर नहीं गए, तो रिश्तेदार क्या कहेंगे?';
    const sanitized = sanitizeFilename(hindiTitle, 100);

    // Invalid Windows char '?' must be removed or replaced, while Hindi characters must remain untouched
    expect(sanitized).not.toContain('?');
    expect(sanitized).toContain('त्योहारों');
    expect(sanitized).toContain('रिश्तेदार');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youcut-hindi-'));
    const filePath = path.join(tmpDir, `${sanitized}.mp4`);
    fs.writeFileSync(filePath, 'hindi test content', 'utf-8');

    // Verify it exists on disk and reads back identically
    expect(fs.existsSync(filePath)).toBe(true);
    const dirFiles = fs.readdirSync(tmpDir);
    expect(dirFiles[0]).toBe(`${sanitized}.mp4`);
    expect(dirFiles[0]).toContain('त्योहारों');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

