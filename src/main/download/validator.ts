import { execFile } from 'child_process';
import fs from 'fs';
import { getBinaryPath } from '../config/paths';

export interface ValidationOptions {
  filePath: string;
  expectedDurationSec: number;
  isAudioOnly: boolean;
  isExactCut: boolean;
  isFullVideo?: boolean;
  jobStartedAtMs?: number;
  stdout?: string;
}

export interface ValidationResult {
  valid: boolean;
  fileSizeBytes: number;
  durationSeconds: number;
  hasAudio: boolean;
  hasVideo: boolean;
  warning?: string;
}

/**
 * A2 & Correction 1:
 * Validates output media file using ffprobe and filesystem metadata.
 * Proves that:
 * 1. File exists on disk and size > 0.
 * 2. File was created/modified after job start (not a stale prior file).
 * 3. File was not skipped with "has already been downloaded".
 * 4. Required audio/video streams exist.
 * 5. Duration is strictly within tolerance (1s for Exact, 5s for Fast, 2s for full video).
 */
export function validateOutputWithFFprobe(
  optionsOrPath: string | ValidationOptions,
  legacyExpectedDuration?: number,
  legacyIsAudioOnly?: boolean,
  legacyIsExactCut?: boolean
): Promise<ValidationResult> {
  const options: ValidationOptions = typeof optionsOrPath === 'string'
    ? {
        filePath: optionsOrPath,
        expectedDurationSec: legacyExpectedDuration || 0,
        isAudioOnly: Boolean(legacyIsAudioOnly),
        isExactCut: Boolean(legacyIsExactCut),
        isFullVideo: false
      }
    : optionsOrPath;

  const {
    filePath,
    expectedDurationSec,
    isAudioOnly,
    isExactCut,
    isFullVideo = false,
    jobStartedAtMs,
    stdout
  } = options;

  return new Promise((resolve) => {
    // 1. File existence
    if (!fs.existsSync(filePath)) {
      resolve({
        valid: false,
        fileSizeBytes: 0,
        durationSeconds: 0,
        hasAudio: false,
        hasVideo: false,
        warning: 'Output file does not exist on disk'
      });
      return;
    }

    const stats = fs.statSync(filePath);

    // 2. Non-zero size
    if (stats.size === 0) {
      resolve({
        valid: false,
        fileSizeBytes: 0,
        durationSeconds: 0,
        hasAudio: false,
        hasVideo: false,
        warning: 'Output file is 0 bytes'
      });
      return;
    }

    // 3. File creation timestamp check (must not predate job start)
    if (typeof jobStartedAtMs === 'number' && jobStartedAtMs > 0) {
      // Allow 2000ms clock skew buffer
      const fileTimestamp = stats.mtimeMs || stats.birthtimeMs || 0;
      if (fileTimestamp < jobStartedAtMs - 2000) {
        resolve({
          valid: false,
          fileSizeBytes: stats.size,
          durationSeconds: 0,
          hasAudio: false,
          hasVideo: false,
          warning: 'Output file predates job start (file was not created by this download)'
        });
        return;
      }
    }

    // 4. "has already been downloaded" check
    if (stdout && stdout.includes('has already been downloaded')) {
      resolve({
        valid: false,
        fileSizeBytes: stats.size,
        durationSeconds: 0,
        hasAudio: false,
        hasVideo: false,
        warning: 'File was already downloaded by a previous job'
      });
      return;
    }

    // 5. ffprobe stream and duration verification
    const ffprobePath = getBinaryPath('ffprobe');
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,codec_name',
      '-of', 'json',
      filePath
    ];

    execFile(ffprobePath, args, { timeout: 15000 }, (err, ffprobeStdout) => {
      if (err) {
        console.warn('[Validator] ffprobe failed:', err.message);
        resolve({
          valid: false,
          fileSizeBytes: stats.size,
          durationSeconds: 0,
          hasAudio: false,
          hasVideo: false,
          warning: `ffprobe failed to parse file: ${err.message}`
        });
        return;
      }

      try {
        const probeData = JSON.parse(ffprobeStdout);
        const streams = probeData.streams || [];
        const hasAudio = streams.some((s: any) => s.codec_type === 'audio');
        const hasVideo = streams.some((s: any) => s.codec_type === 'video');
        const durationSeconds = parseFloat(probeData.format?.duration || '0');

        // Check streams
        if (isAudioOnly && !hasAudio) {
          resolve({
            valid: false,
            fileSizeBytes: stats.size,
            durationSeconds,
            hasAudio,
            hasVideo,
            warning: 'Expected audio stream, but none was found'
          });
          return;
        }

        if (!isAudioOnly && !hasVideo) {
          resolve({
            valid: false,
            fileSizeBytes: stats.size,
            durationSeconds,
            hasAudio,
            hasVideo,
            warning: 'Expected video stream, but none was found'
          });
          return;
        }

        // Check duration tolerance (Lesson 5 & A2):
        // 1.0s for Exact cut; 5.0s (keyframe interval) for Fast cut; 2.0s for full video
        let tolerance = 1.0;
        if (isFullVideo) {
          tolerance = 2.0;
        } else if (!isExactCut) {
          tolerance = 5.0;
        }

        const diff = Math.abs(durationSeconds - expectedDurationSec);

        if (expectedDurationSec > 0 && diff > tolerance) {
          resolve({
            valid: false,
            fileSizeBytes: stats.size,
            durationSeconds,
            hasAudio,
            hasVideo,
            warning: `Duration discrepancy: expected ~${expectedDurationSec.toFixed(1)}s, got ${durationSeconds.toFixed(1)}s (diff ${diff.toFixed(1)}s > ${tolerance}s)`
          });
          return;
        }

        resolve({
          valid: true,
          fileSizeBytes: stats.size,
          durationSeconds,
          hasAudio,
          hasVideo
        });
      } catch (parseError: any) {
        resolve({
          valid: false,
          fileSizeBytes: stats.size,
          durationSeconds: 0,
          hasAudio: false,
          hasVideo: false,
          warning: `Failed to parse ffprobe JSON: ${parseError.message}`
        });
      }
    });
  });
}
