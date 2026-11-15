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

export function formatClipStamp(startSec: number, endSec: number): string {
  const pad = (n: number) => Math.floor(n).toString().padStart(2, '0');
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${pad(m)}m${pad(sec)}s`;
  };
  return `[${fmt(startSec)}-${fmt(endSec)}]`;
}

export function buildSafeClipFilename(
  title: string,
  startSec: number,
  endSec: number,
  ext: string,
  isFull: boolean = false
): string {
  const baseTitle = sanitizeFilename(title, 60);
  const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;

  if (isFull) {
    return `${baseTitle}${cleanExt}`;
  }

  const stamp = formatClipStamp(startSec, endSec);
  return `${baseTitle} ${stamp}${cleanExt}`;
}
