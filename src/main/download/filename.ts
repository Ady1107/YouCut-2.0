import fs from 'fs';
import path from 'path';
import { sanitizeFilename, formatClipStamp } from '../../shared/filename';

export interface UniquePathResult {
  finalPath: string;
  outputTemplatePath: string; // The path without extension to pass to -o "<path>.%(ext)s"
  fileNameWithoutExt: string;
  cleanExt: string;
}

/**
 * A1. Resolve a unique final path BEFORE spawning:
 * Clips: "<title> [HH.MM.SS-HH.MM.SS].<ext>"
 * Full video: "<title>.<ext>"
 * If the path exists on disk, append " (2)", " (3)"...
 * Never relies on yt-dlp's overwrite behaviour and never overwrites user files.
 */
export function resolveUniqueOutputPath(
  outputDir: string,
  rawTitle: string,
  rawExt: string,
  clip?: { startSec: number; endSec: number } | null
): UniquePathResult {
  const cleanExt = rawExt.replace(/^\./, '').toLowerCase() || 'mp4';
  const isClip = Boolean(clip && (clip.endSec > clip.startSec || clip.startSec > 0));
  const stamp = isClip && clip ? ` ${formatClipStamp(clip.startSec, clip.endSec)}` : '';

  // Windows path budget: 260 total characters maximum
  // Reserved: outputDir + separator + stamp (~25) + counter (~6) + ext (~5) = budget
  const maxTitleLen = Math.max(30, 250 - outputDir.length - stamp.length - 12 - cleanExt.length);
  const cleanTitle = sanitizeFilename(rawTitle, maxTitleLen);

  const baseName = `${cleanTitle}${stamp}`;
  let candidateName = baseName;
  let counter = 1;

  while (fs.existsSync(path.join(outputDir, `${candidateName}.${cleanExt}`))) {
    counter++;
    candidateName = `${baseName} (${counter})`;
  }

  const finalPath = path.join(outputDir, `${candidateName}.${cleanExt}`);
  const outputTemplatePath = path.join(outputDir, candidateName);

  return {
    finalPath,
    outputTemplatePath,
    fileNameWithoutExt: candidateName,
    cleanExt
  };
}
