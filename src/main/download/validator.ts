import { execFile } from 'child_process';
import fs from 'fs';
import { getBinaryPath } from '../config/paths';

export interface ValidationResult {
  valid: boolean;
  fileSizeBytes: number;
  durationSeconds: number;
  hasAudio: boolean;
  hasVideo: boolean;
  warning?: string;
}

export function validateOutputWithFFprobe(
  filePath: string,
  expectedDurationSec: number,
  isAudioOnly: boolean,
  isExactCut: boolean
): Promise<ValidationResult> {
  return new Promise((resolve) => {
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

    const ffprobePath = getBinaryPath('ffprobe');
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,codec_name',
      '-of', 'json',
      filePath
    ];

    execFile(ffprobePath, args, { timeout: 15000 }, (err, stdout) => {
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
        const probeData = JSON.parse(stdout);
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

        // Check duration tolerance (Lesson 5):
        // 1s tolerance for Exact cut; up to 5s (keyframe interval) for Fast cut
        const tolerance = isExactCut ? 1.5 : 5.0;
        const diff = Math.abs(durationSeconds - expectedDurationSec);

        if (expectedDurationSec > 0 && diff > tolerance) {
          resolve({
            valid: false,
            fileSizeBytes: stats.size,
            durationSeconds,
            hasAudio,
            hasVideo,
            warning: `Duration discrepancy: expected ~${expectedDurationSec.toFixed(1)}s, got ${durationSeconds.toFixed(1)}s (diff > ${tolerance}s)`
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
