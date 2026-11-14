import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const ytdlpPath = path.join(projectRoot, 'resources', 'bin', 'yt-dlp.exe');

const testCases = [
  {
    type: 'Normal Video with Chapters',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
  },
  {
    type: 'Vertical Short Format',
    url: 'https://www.youtube.com/shorts/kJQP7kiw5Fk'
  },
  {
    type: 'Invalid URL (Error Handling)',
    url: 'https://www.youtube.com/watch?v=nonexistent_invalid_vid_xyz123'
  }
];

function fetchInfo(url) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const args = ['--dump-json', '--no-playlist', '--js-runtimes', 'node', '--no-warnings', url];
    console.log(`\n------------------------------------------------------------`);
    console.log(`[CMD]: ${ytdlpPath} ${args.join(' ')}`);

    execFile(ytdlpPath, args, { maxBuffer: 15 * 1024 * 1024, timeout: 60000 }, (error, stdout, stderr) => {
      const elapsedMs = Date.now() - startTime;
      if (error) {
        console.log(`[STATUS]: FAILED as expected (Elapsed: ${elapsedMs}ms, ExitCode: ${error.code})`);
        console.log(`[STDERR]: ${stderr.trim().split('\n')[0]}`);
        resolve({
          success: false,
          elapsedMs,
          error: stderr.trim() || error.message
        });
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const formatHeights = (data.formats || [])
          .map((f) => f.height)
          .filter((h) => typeof h === 'number' && h > 0);
        const uniqueHeights = Array.from(new Set(formatHeights)).sort((a, b) => b - a);

        const summary = {
          success: true,
          elapsedMs,
          id: data.id,
          title: data.title,
          uploader: data.uploader || data.channel,
          duration: data.duration,
          width: data.width,
          height: data.height,
          isVertical: (data.width && data.height && data.height > data.width) || url.includes('/shorts/'),
          chaptersCount: (data.chapters || []).length,
          topResolutions: uniqueHeights.slice(0, 4).map((h) => `${h}p`)
        };

        console.log(`[STATUS]: SUCCESS (Elapsed: ${elapsedMs}ms)`);
        console.log(`[TITLE]: ${summary.title}`);
        console.log(`[UPLOADER]: ${summary.uploader}`);
        console.log(`[DURATION]: ${summary.duration}s`);
        console.log(`[IS_VERTICAL]: ${summary.isVertical} (${summary.width}x${summary.height})`);
        console.log(`[CHAPTERS]: ${summary.chaptersCount} chapters found`);
        console.log(`[RESOLUTIONS]: ${summary.topResolutions.join(', ')}`);
        resolve(summary);
      } catch (err) {
        resolve({ success: false, elapsedMs, error: err.message });
      }
    });
  });
}

async function run() {
  console.log('=== PHASE 2 REAL YT-DLP FETCH VERIFICATION ===');
  const results = [];
  for (const tc of testCases) {
    console.log(`\nTesting: ${tc.type} (${tc.url})`);
    const res = await fetchInfo(tc.url);
    results.push({ ...tc, ...res });
  }

  const outJson = path.join(projectRoot, 'docs', 'p2-fetch-results.json');
  fs.writeFileSync(outJson, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nSaved fetch results to ${outJson}`);
}

run().catch(console.error);
