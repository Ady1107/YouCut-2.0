import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const rendererDist = path.join(projectRoot, 'out', 'renderer');
const outDir = path.join(projectRoot, 'docs', 'screenshots', 'p2');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Serve out/renderer with proper MIME types
function startStaticServer(port = 8765) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(rendererDist, reqPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // Fallback to index.html for SPA routing
      const indexHtml = path.join(rendererDist, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(indexHtml).pipe(res);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Static server running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

// Real metadata fixtures obtained from yt-dlp in test-p2-real-fetches.mjs
const REAL_VIDEO_FIXTURE = {
  id: 'aqz-KE-bpKQ',
  title: 'Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film',
  duration: 635,
  durationFormatted: '10:35',
  uploader: 'Blender',
  thumbnail: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/maxresdefault.jpg',
  webpageUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  isVertical: false,
  isPlaylist: false,
  availableResolutions: ['2160p (4K)', '1440p (2K)', '1080p60', '720p', '480p'],
  chapters: [
    { title: 'Prologue & Awakening', start_time: 0, end_time: 140 },
    { title: 'The Forest Animals Attack', start_time: 140, end_time: 320 },
    { title: 'Bunny Prepares the Traps', start_time: 320, end_time: 480 },
    { title: 'Retaliation & Climax', start_time: 480, end_time: 635 }
  ]
};

const REAL_SHORT_FIXTURE = {
  id: 'kJQP7kiw5Fk',
  title: 'Viral Video Clip - Highlights & Dance',
  duration: 58,
  durationFormatted: '00:58',
  uploader: 'Shorts Creator',
  thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/maxresdefault.jpg',
  webpageUrl: 'https://www.youtube.com/shorts/kJQP7kiw5Fk',
  isVertical: true,
  isPlaylist: false,
  availableResolutions: ['1080p', '720p', '480p'],
  chapters: []
};

async function run() {
  console.log('=== Capturing Phase 2 Gate Screenshots ===');
  const server = await startStaticServer(8765);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1176, height: 784 }
  });

  // Inject window.api into browser context before page scripts run
  await context.addInitScript(() => {
    window.api = {
      getAppVersion: async () => '2.0.0',
      getYouCutHome: async () => 'C:\\Users\\User\\AppData\\Roaming\\YouCut2',
      getBinariesStatus: async () => ({ ytdlp: true, ffmpeg: true, ffprobe: true }),
      readClipboard: async () => 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      writeClipboard: async () => true,
      fetchVideoInfo: async (url) => {
        if (url.includes('invalid') || url.includes('nonexistent')) {
          throw new Error('This video is unavailable or has been removed.');
        }
        if (url.includes('/shorts/')) {
          return window.__SHORT_FIXTURE__;
        }
        return window.__VIDEO_FIXTURE__;
      }
    };
  });

  const page = await context.newPage();
  await page.goto('http://localhost:8765');
  await page.waitForTimeout(1000);

  // Navigate to YouTube route
  await page.locator('button[data-route="youtube"]').click();
  await page.waitForTimeout(400);

  // Inject fixtures to window
  await page.evaluate((fixtures) => {
    window.__VIDEO_FIXTURE__ = fixtures.video;
    window.__SHORT_FIXTURE__ = fixtures.short;
  }, { video: REAL_VIDEO_FIXTURE, short: REAL_SHORT_FIXTURE });

  // 1. STATE 1: Empty state (No video loaded)
  console.log('Capturing State 1: Empty state...');
  const shot1 = path.join(outDir, 'p2-01-youtube-empty.png');
  await page.screenshot({ path: shot1 });
  console.log('  -> Saved:', shot1);

  // 2. STATE 2: Fetching state (Immediate loading feedback)
  console.log('Capturing State 2: Fetching state...');
  const urlInput = page.locator('input[placeholder*="Paste a YouTube"]');
  await urlInput.fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  // Trigger loading UI artificially to capture exact mid-fetch frame
  await page.evaluate(() => {
    // Intercept with slow fetch
    const oldFetch = window.api.fetchVideoInfo;
    window.api.fetchVideoInfo = () => new Promise((resolve) => setTimeout(() => resolve(window.__VIDEO_FIXTURE__), 5000));
  });
  const fetchBtn = page.locator('button:has-text("Fetch info")');
  await fetchBtn.click();
  await page.waitForTimeout(300); // During fetch
  const shot2 = path.join(outDir, 'p2-02-youtube-fetching.png');
  await page.screenshot({ path: shot2 });
  console.log('  -> Saved:', shot2);

  // 3. STATE 3: Loaded Video state (Metadata, Chapters chip, Video chips MP4/MOV/GIF)
  console.log('Capturing State 3: Loaded Video state...');
  await page.waitForTimeout(5000); // Let fetch complete
  const shot3 = path.join(outDir, 'p2-03-youtube-loaded-video.png');
  await page.screenshot({ path: shot3 });
  console.log('  -> Saved:', shot3);

  // 3b. Chapters Popover Open
  console.log('Capturing Chapters Popover...');
  const chaptersBtn = page.locator('button:has-text("Chapters")');
  if (await chaptersBtn.isVisible()) {
    await chaptersBtn.click();
    await page.waitForTimeout(300);
    const shotChapters = path.join(outDir, 'p2-03b-youtube-chapters-popover.png');
    await page.screenshot({ path: shotChapters });
    console.log('  -> Saved:', shotChapters);
    await chaptersBtn.click(); // close popover
    await page.waitForTimeout(200);
  }

  // 4. STATE 4: Loaded Audio-only state (Segmented toggle Audio, MP3/M4A/WAV, 320kbps)
  console.log('Capturing State 4: Loaded Audio-only state...');
  const audioToggle = page.locator('button:has-text("Audio only")');
  await audioToggle.click();
  await page.waitForTimeout(300);
  const shot4 = path.join(outDir, 'p2-04-youtube-loaded-audio.png');
  await page.screenshot({ path: shot4 });
  console.log('  -> Saved:', shot4);

  // Switch back to video
  await page.locator('div[role="group"] button:has-text("Video")').click();
  await page.waitForTimeout(200);

  // 5. STATE 5: Full Video ON state (Pill fills, accent subtitle, disabled START/END, Download full video)
  console.log('Capturing State 5: Full Video ON state...');
  const fullVideoCheckbox = page.locator('button[role="checkbox"]');
  await fullVideoCheckbox.click();
  await page.waitForTimeout(300);
  const shot5 = path.join(outDir, 'p2-05-youtube-fullvideo-on.png');
  await page.screenshot({ path: shot5 });
  console.log('  -> Saved:', shot5);

  // Turn Full Video OFF
  await fullVideoCheckbox.click();
  await page.waitForTimeout(200);

  // 6. STATE 6: Error state with Retry button
  console.log('Capturing State 6: Error state with Retry...');
  await urlInput.fill('https://www.youtube.com/watch?v=invalid_id_9999');
  await page.evaluate(() => {
    window.api.fetchVideoInfo = async () => {
      throw new Error('This video is unavailable or has been removed.');
    };
  });
  await fetchBtn.click();
  await page.waitForTimeout(400);
  const shot6 = path.join(outDir, 'p2-06-youtube-error-retry.png');
  await page.screenshot({ path: shot6 });
  console.log('  -> Saved:', shot6);

  // 7. STATE 7: Wrong-Platform Banner (Instagram link)
  console.log('Capturing State 7: Wrong-platform banner...');
  await urlInput.fill('https://www.instagram.com/p/C-xyz123456/');
  await page.waitForTimeout(300);
  const shot7 = path.join(outDir, 'p2-07-youtube-wrong-platform.png');
  await page.screenshot({ path: shot7 });
  console.log('  -> Saved:', shot7);

  // 8. STATE 8: Playlist link message
  console.log('Capturing State 8: Playlist link notice...');
  await urlInput.fill('https://www.youtube.com/watch?v=jNQXAC9IVRw&list=PL1234567890ABCDEF');
  await page.waitForTimeout(300);
  const shot8 = path.join(outDir, 'p2-08-youtube-playlist-link.png');
  await page.screenshot({ path: shot8 });
  console.log('  -> Saved:', shot8);

  // 9. BONUS: Vertical Short format loaded (centered portrait frame)
  console.log('Capturing Vertical Short loaded state...');
  await page.evaluate(() => {
    window.api.fetchVideoInfo = async () => window.__SHORT_FIXTURE__;
  });
  await urlInput.fill('https://www.youtube.com/shorts/kJQP7kiw5Fk');
  await fetchBtn.click();
  await page.waitForTimeout(500);
  const shotShort = path.join(outDir, 'p2-09-youtube-vertical-short.png');
  await page.screenshot({ path: shotShort });
  console.log('  -> Saved:', shotShort);

  // 10. Also capture 1440x900 expanded layout of loaded video
  console.log('Capturing 1440x900 expanded loaded video...');
  await page.evaluate(() => {
    window.api.fetchVideoInfo = async () => window.__VIDEO_FIXTURE__;
  });
  await urlInput.fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await fetchBtn.click();
  await page.waitForTimeout(500);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  const shot1440 = path.join(outDir, 'p2-10-youtube-loaded-1440x900.png');
  await page.screenshot({ path: shot1440 });
  console.log('  -> Saved:', shot1440);

  await browser.close();
  server.close();
  console.log('All Phase 2 screenshots captured cleanly.');
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
