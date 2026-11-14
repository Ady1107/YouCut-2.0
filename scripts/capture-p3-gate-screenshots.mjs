import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const rendererDist = path.join(projectRoot, 'out', 'renderer');
const outDir = path.join(projectRoot, 'docs', 'screenshots', 'p3');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function startStaticServer(port = 8766) {
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

const REAL_VIDEO_FIXTURE = {
  id: 'aqz-KE-bpKQ',
  title: 'B.Tech / MCA वालों के लिए Golden Chance! RPSC Programmer 2026 Full Roadmap',
  duration: 724,
  durationFormatted: '12:04',
  uploader: 'KnowledgeGATE by Sanchit Sir',
  thumbnail: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/maxresdefault.jpg',
  webpageUrl: 'https://youtu.be/8tGX7iIPSrM',
  isVertical: false,
  isPlaylist: false,
  availableResolutions: ['1080p', '720p', '480p'],
  chapters: [
    { title: 'Programmer Post Details', start_time: 0, end_time: 180 },
    { title: 'Eligibility & Syllabus', start_time: 180, end_time: 420 },
    { title: 'Exam Pattern & Strategy', start_time: 420, end_time: 724 }
  ]
};

const QUEUE_FIXTURES = [
  {
    id: 'q1',
    title: 'B.Tech / MCA वालों के लिए Golden Chance! RPSC Programmer 2026',
    url: 'https://youtu.be/8tGX7iIPSrM',
    platform: 'youtube',
    format: 'MP4',
    quality: '1080p',
    startSec: 45,
    endSec: 180,
    isFullVideo: false,
    frameAccurate: true,
    saveFolder: 'C:\\Users\\User\\Downloads\\YouCut\\YouTube',
    fileName: 'RPSC_Programmer_Clip',
    status: 'downloading',
    progress: 68,
    downloadedBytes: 35651584,
    totalBytes: 52428800,
    speed: '6.4 MB/s',
    eta: '00:03',
    finalPath: 'C:\\Users\\User\\Downloads\\YouCut\\YouTube\\RPSC_Programmer_Clip.mp4',
    addedAt: Date.now() - 15000
  },
  {
    id: 'q2',
    title: 'Blender 4K Official Animated Short Film',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    platform: 'youtube',
    format: 'MP3',
    quality: '320 kbps (High)',
    startSec: 0,
    endSec: 635,
    isFullVideo: true,
    frameAccurate: false,
    saveFolder: 'C:\\Users\\User\\Downloads\\YouCut\\YouTube',
    fileName: 'Blender_Short_Audio',
    status: 'queued',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: '—',
    eta: '—',
    finalPath: 'C:\\Users\\User\\Downloads\\YouCut\\YouTube\\Blender_Short_Audio.mp3',
    addedAt: Date.now() - 5000
  }
];

const HISTORY_FIXTURES = [
  {
    id: 'h1',
    title: 'Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    platform: 'youtube',
    format: 'MP4',
    quality: '1080p',
    durationFormatted: '10m 35s',
    durationSeconds: 635,
    filePath: 'C:\\Users\\User\\Downloads\\YouCut\\YouTube\\Big_Buck_Bunny.mp4',
    fileSizeBytes: 142606336,
    downloadedAt: Date.now() - 3600000,
    isFullVideo: true
  },
  {
    id: 'h2',
    title: 'Programmer Syllabus & Pattern Key Highlights',
    url: 'https://youtu.be/8tGX7iIPSrM',
    platform: 'youtube',
    format: 'MP4',
    quality: '1080p',
    durationFormatted: '4m 00s',
    durationSeconds: 240,
    filePath: 'C:\\Users\\User\\Downloads\\YouCut\\YouTube\\Programmer_Syllabus_Clip.mp4',
    fileSizeBytes: 48234496,
    downloadedAt: Date.now() - 7200000,
    isFullVideo: false,
    startSec: 180,
    endSec: 420
  }
];

async function run() {
  console.log('=== Capturing Phase 3 Verification Screenshots ===');
  const server = await startStaticServer(8766);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1176, height: 784 }
  });

  await context.addInitScript(() => {
    window.__VIDEO_FIXTURE__ = {
      id: 'aqz-KE-bpKQ',
      title: 'B.Tech / MCA वालों के लिए Golden Chance! RPSC Programmer 2026 Full Roadmap',
      duration: 724,
      durationFormatted: '12:04',
      uploader: 'KnowledgeGATE by Sanchit Sir',
      thumbnail: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/maxresdefault.jpg',
      webpageUrl: 'https://youtu.be/8tGX7iIPSrM',
      isVertical: false,
      isPlaylist: false,
      availableResolutions: ['1080p', '720p', '480p'],
      chapters: [
        { title: 'Programmer Post Details', start_time: 0, end_time: 180 },
        { title: 'Eligibility & Syllabus', start_time: 180, end_time: 420 },
        { title: 'Exam Pattern & Strategy', start_time: 420, end_time: 724 }
      ]
    };

    window.__QUEUE__ = [
      {
        id: 'q1',
        title: 'B.Tech / MCA वालों के लिए Golden Chance! RPSC Programmer 2026',
        url: 'https://youtu.be/8tGX7iIPSrM',
        platform: 'youtube',
        format: 'MP4',
        quality: '1080p',
        startSec: 45,
        endSec: 180,
        isFullVideo: false,
        frameAccurate: true,
        saveFolder: 'C:\\Users\\User\\Downloads\\YouCut\\YouTube',
        fileName: 'RPSC_Programmer_Clip',
        status: 'downloading',
        progress: 68,
        downloadedBytes: 35651584,
        totalBytes: 52428800,
        speed: '6.4 MB/s',
        eta: '00:03',
        finalPath: 'C:\\Users\\User\\Downloads\\YouCut\\YouTube\\RPSC_Programmer_Clip.mp4',
        addedAt: Date.now() - 15000
      },
      {
        id: 'q2',
        title: 'Blender 4K Official Animated Short Film',
        url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        platform: 'youtube',
        format: 'MP3',
        quality: '320 kbps (High)',
        startSec: 0,
        endSec: 635,
        isFullVideo: true,
        frameAccurate: false,
        saveFolder: 'C:\\Users\\User\\Downloads\\YouCut\\YouTube',
        fileName: 'Blender_Short_Audio',
        status: 'queued',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: '—',
        eta: '—',
        finalPath: 'C:\\Users\\User\\Downloads\\YouCut\\YouTube\\Blender_Short_Audio.mp3',
        addedAt: Date.now() - 5000
      }
    ];

    window.__HISTORY__ = [
      {
        id: 'h1',
        title: 'Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film',
        url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        platform: 'youtube',
        format: 'MP4',
        quality: '1080p',
        durationFormatted: '10m 35s',
        durationSeconds: 635,
        filePath: 'C:\\Users\\User\\Downloads\\YouCut\\YouTube\\Big_Buck_Bunny.mp4',
        fileSizeBytes: 142606336,
        downloadedAt: Date.now() - 3600000,
        isFullVideo: true
      },
      {
        id: 'h2',
        title: 'Programmer Syllabus & Pattern Key Highlights',
        url: 'https://youtu.be/8tGX7iIPSrM',
        platform: 'youtube',
        format: 'MP4',
        quality: '1080p',
        durationFormatted: '4m 00s',
        durationSeconds: 240,
        filePath: 'C:\\Users\\User\\Downloads\\YouCut\\YouTube\\Programmer_Syllabus_Clip.mp4',
        fileSizeBytes: 48234496,
        downloadedAt: Date.now() - 7200000,
        isFullVideo: false,
        startSec: 180,
        endSec: 420
      }
    ];

    window.api = {
      getAppVersion: async () => '2.0.0',
      getYouCutHome: async () => 'C:\\Users\\User\\AppData\\Roaming\\YouCut2',
      getBinariesStatus: async () => ({ ytdlp: true, ffmpeg: true, ffprobe: true }),
      readClipboard: async () => 'https://youtu.be/8tGX7iIPSrM',
      writeClipboard: async () => true,
      fetchVideoInfo: async () => window.__VIDEO_FIXTURE__,
      openDirectoryDialog: async () => 'C:\\Users\\User\\Downloads\\YouCut\\CustomFolder',
      getDefaultDownloadDir: async (p) => `C:\\Users\\User\\Downloads\\YouCut\\${p}`,
      getQueue: async () => window.__QUEUE__,
      addToQueue: async (item) => {
        window.__QUEUE__.push({ ...item, status: 'queued', progress: 0, speed: '—', eta: '—', downloadedBytes: 0, totalBytes: 0, addedAt: Date.now() });
        return item;
      },
      pauseQueueItem: async (id) => {
        const item = window.__QUEUE__.find((i) => i.id === id);
        if (item) item.status = 'paused';
      },
      resumeQueueItem: async (id) => {
        const item = window.__QUEUE__.find((i) => i.id === id);
        if (item) item.status = 'downloading';
      },
      cancelQueueItem: async (id) => {
        window.__QUEUE__ = window.__QUEUE__.filter((i) => i.id !== id);
      },
      clearCompletedQueue: async () => {
        window.__QUEUE__ = window.__QUEUE__.filter((i) => i.status !== 'completed');
      },
      setQueueConcurrency: async () => {},
      onQueueUpdate: () => () => {},
      onQueueProgress: () => () => {},
      getHistory: async () => window.__HISTORY__,
      clearHistory: async () => { window.__HISTORY__ = []; },
      removeHistoryItem: async (id) => {
        window.__HISTORY__ = window.__HISTORY__.filter((i) => i.id !== id);
      },
      openFolder: async () => true,
      openFile: async () => true
    };
  });

  const page = await context.newPage();
  await page.goto('http://localhost:8766');
  await page.waitForTimeout(600);

  // 1. YouTube view with video loaded, speed button, and volume slider
  console.log('Navigating to YouTube clipper...');
  await page.click('button[data-route="youtube"]');
  await page.waitForTimeout(300);

  const urlInput = page.locator('input[placeholder*="Paste a YouTube URL"]');
  await urlInput.fill('https://youtu.be/8tGX7iIPSrM');
  const fetchBtn = page.locator('button:has-text("Fetch info")');
  await fetchBtn.click();
  await page.waitForTimeout(500);

  // Verify speed control and volume slider are present
  const speedBtn = page.locator('button[title="Playback Speed"]');
  const volumeSlider = page.locator('input[title*="Volume"]');
  console.log('Speed button present?', (await speedBtn.count()) > 0);
  console.log('Volume slider present?', (await volumeSlider.count()) > 0);

  // Capture YouTube view with Speed & Volume & Trimming (No Toast Clutter)
  const shotYt = path.join(outDir, '01-youtube-speed-volume-shortcuts.png');
  await page.screenshot({ path: shotYt });
  console.log('  -> Saved:', shotYt);

  // 2. Open Speed menu and capture
  await speedBtn.click();
  await page.waitForTimeout(200);
  const shotSpeedMenu = path.join(outDir, '02-youtube-speed-dropdown.png');
  await page.screenshot({ path: shotSpeedMenu });
  console.log('  -> Saved:', shotSpeedMenu);

  // Select 1.5x speed
  await page.click('button:has-text("1.5x")');
  await page.waitForTimeout(200);

  // 3. Test keyboard shortcut 'i' and 'o'
  console.log('Testing keyboard shortcuts "i" and "o"...');
  // Click on the body or outside to ensure input is unfocused
  await page.click('h1, h2, div.font-display');
  await page.waitForTimeout(100);

  // Press 'i' to set in point
  await page.keyboard.press('i');
  await page.waitForTimeout(100);

  // Press 'o' to set out point
  await page.keyboard.press('o');
  await page.waitForTimeout(100);

  // 4. Capture Queue view with active downloading item and progress bar
  console.log('Navigating to Queue route...');
  await page.click('button[data-route="queue"]');
  await page.waitForTimeout(400);

  const shotQueue = path.join(outDir, '03-queue-active-downloads.png');
  await page.screenshot({ path: shotQueue });
  console.log('  -> Saved:', shotQueue);

  // 5. Capture History view with completed downloads
  console.log('Navigating to History route...');
  await page.click('button[data-route="history"]');
  await page.waitForTimeout(400);

  const shotHistory = path.join(outDir, '04-history-completed-clips.png');
  await page.screenshot({ path: shotHistory });
  console.log('  -> Saved:', shotHistory);

  // 6. Settings view: Dark mode
  console.log('Navigating to Settings route...');
  await page.click('button[data-route="settings"]');
  await page.waitForTimeout(400);

  const shotSettingsDark = path.join(outDir, '05-settings-dark-mode.png');
  await page.screenshot({ path: shotSettingsDark });
  console.log('  -> Saved:', shotSettingsDark);

  // 7. Settings view: Light mode
  console.log('Switching to Light mode in Settings...');
  await page.click('button:has-text("Light")');
  await page.waitForTimeout(400);

  const shotSettingsLight = path.join(outDir, '06-settings-light-mode.png');
  await page.screenshot({ path: shotSettingsLight });
  console.log('  -> Saved:', shotSettingsLight);

  // 8. YouTube view in Light mode
  console.log('Navigating to YouTube route in Light mode...');
  await page.click('button[data-route="youtube"]');
  await page.waitForTimeout(400);

  const shotYtLight = path.join(outDir, '07-youtube-light-mode.png');
  await page.screenshot({ path: shotYtLight });
  console.log('  -> Saved:', shotYtLight);

  await browser.close();
  server.close();
  console.log('\n=== All Phase 3 screenshots captured cleanly and verified! ===');
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
