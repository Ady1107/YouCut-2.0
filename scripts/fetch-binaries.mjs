import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const binDir = path.join(projectRoot, 'resources', 'bin');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const FFMPEG_ZIP_URL = 'https://github.com/GyanD/codexffmpeg/releases/download/7.1/ffmpeg-7.1-essentials_build.zip';
const FFMPEG_FALLBACK_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';

async function downloadFile(url, destPath) {
  console.log(`Downloading from ${url} ...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'YouCut-Fetcher/2.0' },
    redirect: 'follow'
  });
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status} ${res.statusText}`);
  }
  const fileStream = fs.createWriteStream(destPath);
  await pipeline(Readable.fromWeb(res.body), fileStream);
  console.log(`Saved to ${destPath} (${fs.statSync(destPath).size} bytes)`);
}

async function fetchYtDlp() {
  const dest = path.join(binDir, 'yt-dlp.exe');
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000000) {
    console.log(`yt-dlp.exe already present at ${dest}`);
    return;
  }
  const tempDest = dest + '.tmp';
  try {
    await downloadFile(YTDLP_URL, tempDest);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(tempDest, dest);
    console.log(`yt-dlp.exe successfully installed to ${dest}`);
  } catch (err) {
    if (fs.existsSync(tempDest)) fs.unlinkSync(tempDest);
    throw new Error(`Failed to fetch yt-dlp.exe: ${err.message}`);
  }
}

async function fetchFfmpeg() {
  const ffmpegDest = path.join(binDir, 'ffmpeg.exe');
  const ffprobeDest = path.join(binDir, 'ffprobe.exe');

  if (fs.existsSync(ffmpegDest) && fs.existsSync(ffprobeDest)) {
    console.log(`ffmpeg.exe and ffprobe.exe already present in ${binDir}`);
    return;
  }

  const zipPath = path.join(binDir, 'ffmpeg.zip');
  try {
    try {
      await downloadFile(FFMPEG_ZIP_URL, zipPath);
    } catch (e) {
      console.warn(`Primary FFmpeg source failed (${e.message}), trying fallback...`);
      await downloadFile(FFMPEG_FALLBACK_URL, zipPath);
    }

    console.log(`Extracting ffmpeg.exe and ffprobe.exe from ${zipPath}...`);
    // Use PowerShell Expand-Archive into a temporary folder or extract directly
    const tempExtractDir = path.join(binDir, 'temp_ffmpeg');
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempExtractDir, { recursive: true });

    execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${tempExtractDir}" -Force`
    ], { stdio: 'inherit' });

    // Find ffmpeg.exe and ffprobe.exe inside tempExtractDir
    function findFile(dir, fileName) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const res = findFile(full, fileName);
          if (res) return res;
        } else if (entry.name.toLowerCase() === fileName.toLowerCase()) {
          return full;
        }
      }
      return null;
    }

    const foundFfmpeg = findFile(tempExtractDir, 'ffmpeg.exe');
    const foundFfprobe = findFile(tempExtractDir, 'ffprobe.exe');

    if (!foundFfmpeg || !foundFfprobe) {
      throw new Error(`Could not find ffmpeg.exe or ffprobe.exe in downloaded archive`);
    }

    fs.copyFileSync(foundFfmpeg, ffmpegDest);
    fs.copyFileSync(foundFfprobe, ffprobeDest);
    console.log(`Extracted ffmpeg.exe and ffprobe.exe successfully.`);

    // Cleanup temp
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);
  } catch (err) {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    throw new Error(`Failed to fetch ffmpeg/ffprobe: ${err.message}`);
  }
}

async function verifyBinaries() {
  console.log('\n--- Verifying Installed Binaries ---');
  const ytdlpPath = path.join(binDir, 'yt-dlp.exe');
  const ffmpegPath = path.join(binDir, 'ffmpeg.exe');
  const ffprobePath = path.join(binDir, 'ffprobe.exe');

  if (!fs.existsSync(ytdlpPath)) throw new Error(`Missing yt-dlp.exe at ${ytdlpPath}`);
  if (!fs.existsSync(ffmpegPath)) throw new Error(`Missing ffmpeg.exe at ${ffmpegPath}`);
  if (!fs.existsSync(ffprobePath)) throw new Error(`Missing ffprobe.exe at ${ffprobePath}`);

  const ytdlpVer = execFileSync(ytdlpPath, ['--version'], { encoding: 'utf-8' }).trim();
  console.log(`[PASS] yt-dlp version: ${ytdlpVer}`);

  const ffmpegOut = execFileSync(ffmpegPath, ['-version'], { encoding: 'utf-8' });
  const ffmpegFirstLine = ffmpegOut.split('\n')[0].trim();
  console.log(`[PASS] ffmpeg: ${ffmpegFirstLine}`);

  const ffprobeOut = execFileSync(ffprobePath, ['-version'], { encoding: 'utf-8' });
  const ffprobeFirstLine = ffprobeOut.split('\n')[0].trim();
  console.log(`[PASS] ffprobe: ${ffprobeFirstLine}`);
}

async function main() {
  console.log(`Target binaries directory: ${binDir}\n`);
  try {
    await fetchYtDlp();
    await fetchFfmpeg();
    await verifyBinaries();
    console.log('\nAll binaries ready in resources/bin!');
  } catch (err) {
    console.error('\n[ERROR]', err.message);
    console.error('\nManual action required:');
    console.error('Please place the following files into resources/bin/:');
    console.error('  - yt-dlp.exe');
    console.error('  - ffmpeg.exe');
    console.error('  - ffprobe.exe');
    process.exit(1);
  }
}

main();
