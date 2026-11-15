export interface ClassifiedError {
  type: '429' | '403' | 'login' | 'private' | 'age' | 'geo' | 'unavailable' | 'ffmpeg' | 'disk' | 'network' | 'unknown';
  message: string;
  suggestedAction: string;
  isRateLimit: boolean;
  stderrTail?: string[];
}

/**
 * D1 & Correction 2:
 * Captures real stderr tail (last 20 lines) and classifies strictly from raw stderr text.
 */
export function classifyErrorFromStderr(rawStderr: string, attempts = 1): ClassifiedError {
  const lines = (rawStderr || '')
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const stderrTail = lines.slice(-20);
  const text = stderrTail.join(' ').toLowerCase();

  // 1. HTTP 429 Rate Limiting
  if (text.includes('429') || text.includes('too many requests')) {
    return {
      type: '429',
      message: 'Rate limited by YouTube (HTTP 429)',
      suggestedAction: 'Queue will cool down before retrying',
      isRateLimit: true,
      stderrTail
    };
  }

  // 2. HTTP 403 Forbidden
  if (text.includes('403') || text.includes('forbidden')) {
    return {
      type: '403',
      message: 'Access forbidden by platform (HTTP 403)',
      suggestedAction: 'Sign in with cookies or wait before trying again',
      isRateLimit: true,
      stderrTail
    };
  }

  // 3. Private Video
  if (text.includes('private video') || text.includes('this video is private')) {
    return {
      type: 'private',
      message: 'Private video · Sign-in required',
      suggestedAction: 'Provide browser cookies in Settings to access private content',
      isRateLimit: false,
      stderrTail
    };
  }

  // 4. Age-restricted Video
  if (text.includes('sign in to confirm your age') || text.includes('age-restricted')) {
    return {
      type: 'age',
      message: 'Age-restricted video · Requires sign-in',
      suggestedAction: 'Provide browser cookies in Settings to verify age',
      isRateLimit: false,
      stderrTail
    };
  }

  // 5. Video Unavailable / Removed
  if (text.includes('video unavailable') || text.includes('video has been removed') || text.includes('deleted video')) {
    return {
      type: 'unavailable',
      message: 'Video unavailable or removed by uploader',
      suggestedAction: 'Check the URL or verify if the video is still published',
      isRateLimit: false,
      stderrTail
    };
  }

  // 6. Geo-restricted
  if (text.includes('not available in your country') || text.includes('blocked in your country') || text.includes('geo-restricted')) {
    return {
      type: 'geo',
      message: 'Geo-restricted · Not available in your region',
      suggestedAction: 'Content is restricted to specific geographic locations',
      isRateLimit: false,
      stderrTail
    };
  }

  // 7. Disk Full
  if (text.includes('no space left on device') || text.includes('not enough space') || text.includes('disk full')) {
    return {
      type: 'disk',
      message: 'Disk full · Free up space on target drive',
      suggestedAction: 'Free up space on your download destination drive',
      isRateLimit: false,
      stderrTail
    };
  }

  // 8. FFmpeg error
  if (text.includes('ffmpeg') && (text.includes('conversion failed') || text.includes('muxing failed') || text.includes('invalid argument'))) {
    return {
      type: 'ffmpeg',
      message: 'FFmpeg processing error during section merge',
      suggestedAction: 'Verify media container formats or try re-downloading',
      isRateLimit: false,
      stderrTail
    };
  }

  // 9. Network timeout
  if (text.includes('timed out') || text.includes('timeout') || text.includes('connection reset') || text.includes('network unreachable') || text.includes('errno 11001') || text.includes('temporary failure')) {
    return {
      type: 'network',
      message: attempts >= 2 ? 'Network timeout · failed after 3 tries' : 'Network timeout · Retrying...',
      suggestedAction: 'Check your internet connection or proxy settings',
      isRateLimit: false,
      stderrTail
    };
  }

  // Generic fallback: pick first line with ERROR:
  const errorLine = lines.find((l) => l.startsWith('ERROR:') || l.includes('Error'));
  const cleanMessage = errorLine
    ? errorLine.replace(/^ERROR:\s*/i, '').replace(/\[.*?\]\s*/g, '').slice(0, 80)
    : attempts > 1
    ? `Download failed after ${attempts} attempts`
    : 'Download failed';

  return {
    type: 'unknown',
    message: cleanMessage,
    suggestedAction: 'Check output logs for detailed process information',
    isRateLimit: false,
    stderrTail
  };
}

export function mapYtDlpError(rawError: string, attempts = 1): string {
  const classified = classifyErrorFromStderr(rawError, attempts);
  return classified.message;
}
