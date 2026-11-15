import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { getBinaryPath, getYouCutHome } from '../config/paths';
import { PlaylistDetectResult, PlaylistInfo, PlaylistEntry } from '../../shared/types';
import { sanitizeFilename } from '../../shared/filename';

export function detectPlaylistUrl(rawUrl: string): PlaylistDetectResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isPlaylist: false, hasVideoAndPlaylist: false };
  }

  const clean = rawUrl.trim();
  let urlObj: URL;
  try {
    urlObj = new URL(clean);
  } catch {
    return { isPlaylist: false, hasVideoAndPlaylist: false };
  }

  const listParam = urlObj.searchParams.get('list');
  const videoParam = urlObj.searchParams.get('v');

  const isPlaylist = Boolean(listParam && listParam.length > 0) || urlObj.pathname.includes('/playlist');

  if (!isPlaylist || !listParam) {
    return { isPlaylist: false, hasVideoAndPlaylist: false };
  }

  return {
    isPlaylist: true,
    hasVideoAndPlaylist: Boolean(videoParam && videoParam.length > 0),
    playlistId: listParam,
    videoId: videoParam || undefined
  };
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getPlaylistArchiveFilePath(playlistId: string): string {
  const archivesDir = path.join(getYouCutHome(), 'archives');
  if (!fs.existsSync(archivesDir)) {
    try {
      fs.mkdirSync(archivesDir, { recursive: true });
    } catch {}
  }
  const safeId = playlistId.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(archivesDir, `${safeId}.txt`);
}

export async function fetchPlaylistInfo(url: string): Promise<PlaylistInfo> {
  const cleanUrl = url.trim();
  const ytdlpPath = getBinaryPath('yt-dlp');

  if (!fs.existsSync(ytdlpPath)) {
    throw new Error('yt-dlp binary not found at ' + ytdlpPath);
  }

  const args = [
    '--flat-playlist',
    '-J',
    '--no-warnings',
    cleanUrl
  ];

  return new Promise((resolve, reject) => {
    execFile(
      ytdlpPath,
      args,
      { maxBuffer: 30 * 1024 * 1024, timeout: 60000 },
      (error, stdout, stderr) => {
        if (error) {
          console.error('[Playlist] Failed to fetch playlist info:', error.message, stderr);
          return reject(new Error(error.message || 'Failed to fetch playlist'));
        }

        try {
          const raw = JSON.parse(stdout);
          const rawEntries = Array.isArray(raw.entries) ? raw.entries : [];
          let totalSec = 0;

          const entries: PlaylistEntry[] = rawEntries.map((e: any, idx: number) => {
            const rawTitle = e.title || `Video ${idx + 1}`;
            const dur = Math.max(0, Math.round(e.duration || 0));
            totalSec += dur;

            const isDeletedOrPrivate =
              rawTitle === '[Private video]' ||
              rawTitle === '[Deleted video]' ||
              e.availability === 'private' ||
              e.availability === 'subscriber_only';

            const videoId = e.id || '';
            const thumb = videoId
              ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
              : (e.thumbnails?.[0]?.url || '');

            return {
              id: videoId || `entry-${idx + 1}`,
              index: idx + 1,
              title: rawTitle,
              durationSec: dur,
              durationFormatted: formatDuration(dur),
              thumbnailUrl: thumb,
              available: !isDeletedOrPrivate
            };
          });

          const playlistThumbnail =
            raw.thumbnails?.[0]?.url ||
            (entries[0]?.thumbnailUrl) ||
            '';

          const playlistInfo: PlaylistInfo = {
            id: raw.id || 'playlist',
            title: raw.title || 'Untitled Playlist',
            channel: raw.uploader || raw.channel || 'Unknown Channel',
            count: entries.length,
            totalDurationSec: totalSec,
            totalDurationFormatted: formatDuration(totalSec),
            thumbnailUrl: playlistThumbnail,
            entries
          };

          resolve(playlistInfo);
        } catch (parseErr: any) {
          console.error('[Playlist] JSON parse error:', parseErr);
          reject(new Error('Failed to parse playlist metadata'));
        }
      }
    );
  });
}
