/**
 * Maps raw yt-dlp / ffmpeg stderr into human-friendly, concise error messages.
 */
export function mapYtDlpError(rawError: string, attempts = 1): string {
  if (!rawError) {
    return attempts > 1 ? `Failed after ${attempts} attempts` : 'Unknown download error';
  }

  const lower = rawError.toLowerCase();

  if (lower.includes('private video') || lower.includes('this video is private')) {
    return 'Private video · Sign-in required';
  }

  if (lower.includes('deleted video') || lower.includes('video has been removed') || lower.includes('video unavailable')) {
    return 'Video unavailable or removed by uploader';
  }

  if (lower.includes('sign in to confirm your age') || lower.includes('age-restricted')) {
    return 'Age-restricted video · Requires sign-in';
  }

  if (lower.includes('not available in your country') || lower.includes('geo-restricted') || lower.includes('blocked in your country')) {
    return 'Geo-restricted · Not available in your country';
  }

  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('connection reset') || lower.includes('network unreachable') || lower.includes('errno 11001') || lower.includes('temporary failure')) {
    return attempts >= 3 ? 'Network timeout · failed after 3 tries' : 'Network timeout · Retrying...';
  }

  if (lower.includes('http error 429') || lower.includes('too many requests')) {
    return 'Rate limited by platform (HTTP 429)';
  }

  if (lower.includes('no space left on device') || lower.includes('not enough space') || lower.includes('disk full')) {
    return 'Disk full · Free up space on target drive';
  }

  if (lower.includes('ffmpeg') && (lower.includes('not found') || lower.includes('conversion failed') || lower.includes('muxing failed'))) {
    return 'FFmpeg processing error during media remux';
  }

  if (lower.includes('watchdog timeout') || lower.includes('stalled')) {
    return 'Download stalled (90-second timeout)';
  }

  // Strip excessive traceback or ANSI codes and grab first meaningful error line
  const lines = rawError.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('ERROR:') || l.includes('Error'));
  if (lines.length > 0) {
    const clean = lines[0].replace(/^ERROR:\s*/i, '').replace(/\[.*?\]\s*/g, '');
    if (clean.length > 0 && clean.length <= 80) {
      return clean;
    }
  }

  return attempts >= 3 ? `Download failed after ${attempts} attempts` : 'Download failed';
}
