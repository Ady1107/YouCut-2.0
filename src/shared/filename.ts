/**
 * Filename sanitization and Windows 260-char path limit budgeting (Lesson 6)
 */

export function sanitizeFilename(name: string, maxLen: number = 70): string {
  if (!name) return 'youcut_clip';

  // Strip invalid Windows path characters: \ / : * ? " < > |
  let clean = name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim();

  // Budget length
  if (clean.length > maxLen) {
    clean = clean.substring(0, maxLen).trim();
  }

  // Remove trailing dots or underscores
  clean = clean.replace(/[._]+$/, '');

  return clean || 'youcut_clip';
}

export function formatHmsDot(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hrs)}.${pad(mins)}.${pad(secs)}`;
}

export function formatClipStamp(startSec: number, endSec: number): string {
  return `[${formatHmsDot(startSec)}-${formatHmsDot(endSec)}]`;
}

export function buildSafeClipFilename(
  title: string,
  startSec: number,
  endSec: number,
  ext: string,
  isFull: boolean = false
): string {
  const cleanExt = ext.startsWith('.') ? ext.substring(1) : ext;
  if (isFull) {
    const baseTitle = sanitizeFilename(title, 120);
    return `${baseTitle}.${cleanExt}`;
  }

  const stamp = formatClipStamp(startSec, endSec);
  const maxTitle = Math.max(30, 160 - stamp.length);
  const baseTitle = sanitizeFilename(title, maxTitle);
  return `${baseTitle} ${stamp}.${cleanExt}`;
}
