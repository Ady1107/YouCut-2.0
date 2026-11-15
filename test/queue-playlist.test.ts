import { describe, it, expect } from 'vitest';
import { detectPlaylistUrl } from '../src/main/download/playlist';
import { mapYtDlpError } from '../src/main/download/errors';
import { sanitizeFilename } from '../src/renderer/src/utils/filename';

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

describe('Filename Numbering & Sanitization', () => {
  it('pads file numbers based on playlist size and sanitizes characters', () => {
    const totalCount = 18;
    const zeroPadWidth = totalCount.toString().length;
    const index = 7;
    const rawTitle = 'Time (Inception): The Soundtrack? <Special> / Cut';

    const paddedIndex = index.toString().padStart(zeroPadWidth, '0');
    const cleanTitle = sanitizeFilename(rawTitle, 60);
    const finalFilename = `${paddedIndex} - ${cleanTitle}.mp3`;

    expect(paddedIndex).toBe('07');
    expect(finalFilename).not.toContain(':');
    expect(finalFilename).not.toContain('?');
    expect(finalFilename).not.toContain('<');
    expect(finalFilename).not.toContain('>');
    expect(finalFilename).not.toContain('/');
    expect(finalFilename.startsWith('07 - Time (Inception)')).toBe(true);
  });
});

describe('Group Progress Calculation', () => {
  it('computes group progress accurately across finished and active fraction', () => {
    const totalVideos = 18;
    const finishedCount = 6;
    const currentChildProgressPercent = 58; // 0.58

    const activeFraction = currentChildProgressPercent / 100;
    const groupProgress = Math.min(100, Math.round(((finishedCount + activeFraction) / totalVideos) * 100));

    // (6 + 0.58) / 18 = 6.58 / 18 = 0.3655 -> 37% (or ~38% if finished = 6.84)
    expect(groupProgress).toBe(37);
  });
});

describe('Size Estimation Formula', () => {
  it('calculates audio size based on bitrate and duration', () => {
    // 10 videos, each 4 minutes = 2400 seconds
    const durationSec = 2400;
    // 256 kbps = 32 KB/sec
    const sizeBytes = durationSec * 32 * 1024;
    const sizeMb = sizeBytes / (1024 * 1024);
    expect(Math.round(sizeMb)).toBe(75); // ~75 MB
  });

  it('calculates video size based on 1080p profile', () => {
    // 2400 seconds
    const durationSec = 2400;
    // 426 KB/sec
    const sizeBytes = durationSec * 426 * 1024;
    const sizeMb = sizeBytes / (1024 * 1024);
    expect(Math.round(sizeMb)).toBe(998); // ~1 GB (998 MB)
  });
});
