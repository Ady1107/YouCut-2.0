/**
 * B1 & B2: Progress Parser
 * Parses both yt-dlp JSON progress output and FFmpeg \r-separated stats lines for section clipping.
 */

export interface ParsedProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBps: number;
  speed: string;
  etaSec: number;
  eta: string;
  phase?: string;
}

export function parseHmsToSeconds(hmsStr: string): number {
  if (!hmsStr || typeof hmsStr !== 'string') return 0;
  const parts = hmsStr.trim().split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  }
  return parseFloat(hmsStr) || 0;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatSpeed(bps: number): string {
  if (!bps || bps <= 0) return '—';
  return `${formatBytes(bps)}/s`;
}

export function formatEta(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '—';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}:${remM.toString().padStart(2, '0')}:${remS.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${remS.toString().padStart(2, '0')}`;
}

/**
 * Parses FFmpeg stats line emitted to stderr/stdout separated by \r or \n.
 * e.g. "frame= 147 fps= 19 q=31.0 size= 512KiB time=00:00:02.41 bitrate=1735.7kbits/s speed=0.311x"
 * e.g. "frame= 300 fps= 23 q=-1.0 Lsize= 2542KiB time=00:00:04.96 bitrate=4192.5kbits/s speed=0.375x"
 */
export function parseFfmpegStatsLine(
  line: string,
  clipDurationSec: number,
  lastBytes = 0,
  lastTimeMs = Date.now()
): ParsedProgress | null {
  if (!line || (!line.includes('time=') && !line.includes('size='))) {
    return null;
  }

  // Extract time=HH:MM:SS.xx
  const timeMatch = line.match(/time=\s*([0-9:.]+)/);
  if (!timeMatch || timeMatch[1] === 'N/A') return null;

  const currentTimeSec = parseHmsToSeconds(timeMatch[1]);

  // Extract size= (or Lsize=)
  let bytesWritten = lastBytes;
  const sizeMatch = line.match(/(?:size|Lsize)=\s*([0-9.]+)\s*([kKmM]?[iI]?[bB]?)/);
  if (sizeMatch) {
    const val = parseFloat(sizeMatch[1]) || 0;
    const unit = (sizeMatch[2] || 'kib').toLowerCase();
    if (unit.startsWith('m')) {
      bytesWritten = Math.round(val * 1024 * 1024);
    } else if (unit.startsWith('g')) {
      bytesWritten = Math.round(val * 1024 * 1024 * 1024);
    } else {
      bytesWritten = Math.round(val * 1024);
    }
  }

  // Extract speed multiplier (e.g. speed=0.311x or speed=1.2x)
  let speedMultiplier = 1.0;
  const speedMatch = line.match(/speed=\s*([0-9.]+)x/);
  if (speedMatch) {
    speedMultiplier = parseFloat(speedMatch[1]) || 1.0;
  }

  const duration = Math.max(1, clipDurationSec);
  const percent = Math.min(99, Math.max(0, Math.round((currentTimeSec / duration) * 100)));

  // Estimate speed in bytes per second from delta or from bitrate
  let speedBps = 0;
  const now = Date.now();
  const timeDelta = (now - lastTimeMs) / 1000;
  if (timeDelta > 0.3 && bytesWritten > lastBytes) {
    speedBps = Math.round((bytesWritten - lastBytes) / timeDelta);
  } else {
    // Fallback: extract bitrate
    const bitrateMatch = line.match(/bitrate=\s*([0-9.]+)\s*kbits\/s/);
    if (bitrateMatch) {
      const kbps = parseFloat(bitrateMatch[1]) || 0;
      speedBps = Math.round((kbps * 1000) / 8);
    }
  }

  // Calculate ETA
  const remainingSec = Math.max(0, (duration - currentTimeSec) / Math.max(0.1, speedMultiplier));

  return {
    percent,
    downloadedBytes: bytesWritten,
    totalBytes: Math.round(bytesWritten / Math.max(0.01, percent / 100)),
    speedBps,
    speed: formatSpeed(speedBps),
    etaSec: Math.round(remainingSec),
    eta: formatEta(remainingSec),
    phase: 'Merging'
  };
}

/**
 * Splits streaming chunks on BOTH \r and \n to handle carriage returns properly.
 */
export function splitStreamLines(chunk: string): string[] {
  if (!chunk) return [];
  return chunk.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
}
