import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const rendererDist = path.join(projectRoot, 'out', 'renderer');
const outDir = path.join(projectRoot, 'docs', 'screenshots', 'p4-queue-playlist');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function startStaticServer(port = 8769) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
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

const PLAYLIST_FIXTURE = {
  id: 'PLx0SYbCqOb8TBPRdmBHs5lftvv9TPboYG',
  title: 'Hans Zimmer Essentials',
  channel: 'Hans Zimmer',
  count: 18,
  totalDurationSec: 5040,
  webpageUrl: 'https://www.youtube.com/playlist?list=PLx0SYbCqOb8TBPRdmBHs5lftvv9TPboYG',
  thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/maxresdefault.jpg',
  entries: [
    { id: 'v1', index: 1, title: 'Time (Inception)', durationSec: 275, durationFormatted: '4:35', thumbnailUrl: '', available: true },
    { id: 'v2', index: 2, title: 'Cornfield Chase (Interstellar)', durationSec: 126, durationFormatted: '2:06', thumbnailUrl: '', available: true },
    { id: 'v3', index: 3, title: 'Now We Are Free (Gladiator)', durationSec: 251, durationFormatted: '4:11', thumbnailUrl: '', available: true },
    { id: 'v4', index: 4, title: "He's a Pirate (Pirates of the Caribbean)", durationSec: 90, durationFormatted: '1:30', thumbnailUrl: '', available: true },
    { id: 'v5', index: 5, title: 'Why So Serious? (The Dark Knight)', durationSec: 554, durationFormatted: '9:14', thumbnailUrl: '', available: true },
    { id: 'v6', index: 6, title: 'Mountains (Interstellar)', durationSec: 221, durationFormatted: '3:41', thumbnailUrl: '', available: true },
    { id: 'v7', index: 7, title: 'Journey to the Line (The Thin Red Line)', durationSec: 320, durationFormatted: '5:20', thumbnailUrl: '', available: true },
    { id: 'v8', index: 8, title: 'Dream Is Collapsing (Inception)', durationSec: 143, durationFormatted: '2:23', thumbnailUrl: '', available: true },
    { id: 'v9', index: 9, title: 'Supermarine (Dunkirk)', durationSec: 348, durationFormatted: '5:48', thumbnailUrl: '', available: true },
    { id: 'v10', index: 10, title: 'Tennessee (Interstellar)', durationSec: 295, durationFormatted: '4:55', thumbnailUrl: '', available: true },
    { id: 'v11', index: 11, title: 'No Time for Caution (Interstellar)', durationSec: 245, durationFormatted: '4:05', thumbnailUrl: '', available: true },
    { id: 'v12', index: 12, title: 'Chevaliers de Sangreal (The Da Vinci Code)', durationSec: 247, durationFormatted: '4:07', thumbnailUrl: '', available: true },
    { id: 'v13', index: 13, title: 'Flight (Man of Steel)', durationSec: 279, durationFormatted: '4:39', thumbnailUrl: '', available: true },
    { id: 'v14', index: 14, title: 'What Are You Going to Do When You Are Not Saving the World? (Man of Steel)', durationSec: 327, durationFormatted: '5:27', thumbnailUrl: '', available: true },
    { id: 'v15', index: 15, title: 'Mombasa (Inception)', durationSec: 294, durationFormatted: '4:54', thumbnailUrl: '', available: true },
    { id: 'v16', index: 16, title: 'First Step (Interstellar)', durationSec: 107, durationFormatted: '1:47', thumbnailUrl: '', available: true },
    { id: 'v17', index: 17, title: 'Stay (Interstellar)', durationSec: 412, durationFormatted: '6:52', thumbnailUrl: '', available: true },
    { id: 'v18', index: 18, title: 'Discombobulate (Sherlock Holmes)', durationSec: 145, durationFormatted: '2:25', thumbnailUrl: '', available: true }
  ]
};

const QUEUE_PAYLOAD_FIXTURE = {
  items: [
    // Group children:
    {
      id: 'grp-c1',
      groupId: 'grp-1',
      indexInGroup: 1,
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=v1',
      title: 'Time (Inception)',
      thumbnailUrl: '',
      durationSec: 275,
      format: 'mp3',
      quality: 'Best available',
      mode: 'audio',
      clip: null,
      outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube\\Hans Zimmer Essentials',
      fileName: '01 - Time (Inception)',
      status: 'done',
      progress: { percent: 100, downloadedBytes: 8800000, totalBytes: 8800000, speed: '—', eta: '—' },
      finishedAt: Date.now() - 300000
    },
    {
      id: 'grp-c2',
      groupId: 'grp-1',
      indexInGroup: 2,
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=v2',
      title: 'Cornfield Chase (Interstellar)',
      thumbnailUrl: '',
      durationSec: 126,
      format: 'mp3',
      quality: 'Best available',
      mode: 'audio',
      clip: null,
      outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube\\Hans Zimmer Essentials',
      fileName: '02 - Cornfield Chase (Interstellar)',
      status: 'done',
      progress: { percent: 100, downloadedBytes: 4032000, totalBytes: 4032000, speed: '—', eta: '—' },
      finishedAt: Date.now() - 240000
    },
    {
      id: 'grp-c3',
      groupId: 'grp-1',
      indexInGroup: 3,
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=v3',
      title: 'Now We Are Free (Gladiator)',
      thumbnailUrl: '',
      durationSec: 251,
      format: 'mp3',
      quality: 'Best available',
      mode: 'audio',
      clip: null,
      outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube\\Hans Zimmer Essentials',
      fileName: '03 - Now We Are Free (Gladiator)',
      status: 'done',
      progress: { percent: 100, downloadedBytes: 8032000, totalBytes: 8032000, speed: '—', eta: '—' },
      finishedAt: Date.now() - 180000
    },
    {
      id: 'grp-c4',
      groupId: 'grp-1',
      indexInGroup: 4,
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=v5',
      title: 'Why So Serious? (The Dark Knight)',
      thumbnailUrl: '',
      durationSec: 554,
      format: 'mp3',
      quality: 'Best available',
      mode: 'audio',
      clip: null,
      outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube\\Hans Zimmer Essentials',
      fileName: '04 - Why So Serious? (The Dark Knight)',
      status: 'done',
      progress: { percent: 100, downloadedBytes: 17728000, totalBytes: 17728000, speed: '—', eta: '—' },
      finishedAt: Date.now() - 120000
    },
    {
      id: 'grp-c5',
      groupId: 'grp-1',
      indexInGroup: 5,
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=v6',
      title: 'Mountains (Interstellar)',
      thumbnailUrl: '',
      durationSec: 221,
      format: 'mp3',
      quality: 'Best available',
      mode: 'audio',
      clip: null,
      outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube\\Hans Zimmer Essentials',
      fileName: '05 - Mountains (Interstellar)',
      status: 'done',
      progress: { percent: 100, downloadedBytes: 7072000, totalBytes: 7072000, speed: '—', eta: '—' },
      finishedAt: Date.now() - 60000
    },
    {
      id: 'grp-c6',
      groupId: 'grp-1',
      indexInGroup: 6,
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=v7',
      title: 'Now We Are Free (Gladiator)',
      thumbnailUrl: '',
      durationSec: 320,
      format: 'mp3',
      quality: 'Best available',
      mode: 'audio',
      clip: null,
      outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube\\Hans Zimmer Essentials',
      fileName: '06 - Now We Are Free (Gladiator)',
      status: 'done',
      progress: { percent: 100, downloadedBytes: 10240000, totalBytes: 10240000, speed: '—', eta: '—' },
      finishedAt: Date.now() - 15000
    },
    {
      id: 'grp-c7',
      groupId: 'grp-1',
      indexInGroup: 7,
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=v8',
      title: 'Why So Serious? (The Dark Knight)',
      thumbnailUrl: '',
      durationSec: 554,
      format: 'mp3',
      quality: 'Best available',
      mode: 'audio',
      clip: null,
      outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube\\Hans Zimmer Essentials',
      fileName: '07 - Why So Serious? (The Dark Knight)',
      status: 'downloading',
      progress: { percent: 58, downloadedBytes: 10282240, totalBytes: 17728000, speed: '4.1 MB/s', eta: '00:01' }
    },
    {
      id: 'grp-c8',
      groupId: 'grp-1',
      indexInGroup: 8,
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=v10',
      title: 'Mountains (Interstellar)',
      thumbnailUrl: '',
      durationSec: 221,
      format: 'mp3',
      quality: 'Best available',
      mode: 'audio',
      clip: null,
      outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube\\Hans Zimmer Essentials',
      fileName: '08 - Mountains (Interstellar)',
      status: 'waiting',
      progress: { percent: 0, downloadedBytes: 0, totalBytes: 0, speed: '—', eta: '—' }
    },
    // Standalone items (from mockup):
    {
      id: 'wait-1',
      platform: 'youtube',
      url: 'https://youtu.be/XAo1pG3HNG4',
      title: 'Core childhood Memory',
      thumbnailUrl: '',
      durationSec: 71,
      format: 'mp4',
      quality: 'Best available - 1080p',
      mode: 'video',
      clip: { startSec: 1, endSec: 71 },
      outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube',
      fileName: 'Core childhood Memory',
      status: 'waiting',
      progress: { percent: 0, downloadedBytes: 0, totalBytes: 0, speed: '—', eta: '—' }
    },
    {
      id: 'wait-2',
      platform: 'youtube',
      url: 'https://youtu.be/XAo1pG3HNG4',
      title: 'Core childhood Memory',
      thumbnailUrl: '',
      durationSec: 85,
      format: 'mp4',
      quality: 'Best available - 1080p',
      mode: 'video',
      clip: null,
      outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube',
      fileName: 'Core childhood Memory - Full',
      status: 'waiting',
      progress: { percent: 0, downloadedBytes: 0, totalBytes: 0, speed: '—', eta: '—' }
    },
    {
      id: 'done-1',
      platform: 'youtube',
      url: 'https://youtu.be/XAo1pG3HNG4',
      title: 'Core childhood Memory',
      thumbnailUrl: '',
      durationSec: 54,
      format: 'mp4',
      quality: 'Best available - 1080p',
      mode: 'video',
      clip: { startSec: 1, endSec: 54 },
      outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube',
      fileName: 'Core childhood Memory',
      filePath: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube\\Core childhood Memory.mp4',
      sizeBytes: 29.4 * 1024 * 1024,
      status: 'done',
      progress: { percent: 100, downloadedBytes: 30828134, totalBytes: 30828134, speed: '—', eta: '—' },
      finishedAt: Date.now() - 120000
    },
    {
      id: 'failed-1',
      platform: 'youtube',
      url: 'https://youtu.be/XAo1pG3HNG4',
      title: 'Core childhood Memory',
      thumbnailUrl: '',
      durationSec: 54,
      format: 'mp4',
      quality: 'Best available - 1080p',
      mode: 'video',
      clip: null,
      outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube',
      fileName: 'Core childhood Memory',
      status: 'failed',
      error: 'Network timeout · failed after 3 tries',
      attempts: 3,
      progress: { percent: 0, downloadedBytes: 0, totalBytes: 0, speed: '—', eta: '—' }
    }
  ],
  groups: [
    {
      id: 'grp-1',
      kind: 'playlist',
      title: 'Hans Zimmer Essentials',
      channel: 'Hans Zimmer',
      sourceUrl: 'https://www.youtube.com/playlist?list=PLx0SYbCqOb8TBPRdmBHs5lftvv9TPboYG',
      thumbnailUrl: '',
      childIds: [
        'grp-c1', 'grp-c2', 'grp-c3', 'grp-c4', 'grp-c5', 'grp-c6', 'grp-c7', 'grp-c8',
        'grp-c9', 'grp-c10', 'grp-c11', 'grp-c12', 'grp-c13', 'grp-c14', 'grp-c15', 'grp-c16', 'grp-c17', 'grp-c18'
      ],
      options: {
        format: 'mp3',
        quality: 'Best available',
        mode: 'audio',
        outputDir: 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube\\Hans Zimmer Essentials',
        playlistFolder: true,
        numberFiles: true,
        skipAlreadyDownloaded: true
      },
      createdAt: Date.now() - 360000
    }
  ],
  order: ['grp-1', 'wait-1', 'wait-2', 'done-1', 'failed-1'],
  overallSpeedBps: 6.2 * 1024 * 1024,
  overallEtaSec: 130,
  speedHistory: [
    2.1, 2.8, 3.4, 4.0, 3.8, 4.5, 5.2, 5.0, 5.8, 6.1,
    5.9, 6.4, 6.2, 6.0, 6.3, 6.5, 6.1, 6.2, 6.3, 6.2, 6.2
  ],
  concurrency: 1
};

async function run() {
  console.log('=== Capturing Phase 4 Queue & Playlist Screenshots ===');
  const server = await startStaticServer(8769);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 }
  });

  await context.addInitScript(({ queueFixture, playlistFixture }) => {
    window.__QUEUE_STATE__ = JSON.parse(JSON.stringify(queueFixture));
    window.__PLAYLIST_INFO__ = JSON.parse(JSON.stringify(playlistFixture));

    window.api = {
      getAppVersion: async () => '2.0.0',
      getYouCutHome: async () => 'C:\\Users\\adysi\\AppData\\Roaming\\YouCut2',
      getBinariesStatus: async () => ({ ytdlp: true, ffmpeg: true, ffprobe: true }),
      readClipboard: async () => 'https://www.youtube.com/playlist?list=PLx0SYbCqOb8TBPRdmBHs5lftvv9TPboYG',
      writeClipboard: async () => true,
      fetchVideoInfo: async () => ({
        id: 'aqz-KE-bpKQ',
        title: 'B.Tech / MCA वालों के लिए Golden Chance! RPSC Programmer 2026',
        duration: 724,
        durationFormatted: '12:04',
        uploader: 'KnowledgeGATE by Sanchit Sir',
        thumbnail: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/maxresdefault.jpg',
        webpageUrl: 'https://youtu.be/8tGX7iIPSrM',
        isVertical: false,
        isPlaylist: false,
        availableResolutions: ['1080p', '720p', '480p'],
        chapters: []
      }),
      detectPlaylist: async (url) => {
        const isPl = url.includes('list=');
        return { isPlaylist: isPl, playlistId: isPl ? 'PLx0SYbCqOb8TBPRdmBHs5lftvv9TPboYG' : null };
      },
      fetchPlaylist: async () => window.__PLAYLIST_INFO__,
      openDirectoryDialog: async () => 'C:\\Users\\adysi\\Downloads\\YouCut\\YouTube',
      getDefaultDownloadDir: async (p) => `C:\\Users\\adysi\\Downloads\\YouCut\\${p}`,
      getQueue: async () => window.__QUEUE_STATE__,
      addToQueue: async (item) => {
        window.__QUEUE_STATE__.items.push(item);
        window.__QUEUE_STATE__.order.push(item.id);
        return item;
      },
      addGroupToQueue: async (group, children) => {
        window.__QUEUE_STATE__.groups.push(group);
        window.__QUEUE_STATE__.items.push(...children);
        window.__QUEUE_STATE__.order.push(group.id);
      },
      pauseQueueItem: async (id) => {
        const item = window.__QUEUE_STATE__.items.find((i) => i.id === id);
        if (item) item.status = 'paused';
      },
      resumeQueueItem: async (id) => {
        const item = window.__QUEUE_STATE__.items.find((i) => i.id === id);
        if (item) item.status = 'downloading';
      },
      cancelQueueItem: async (id) => {
        window.__QUEUE_STATE__.items = window.__QUEUE_STATE__.items.filter((i) => i.id !== id);
        window.__QUEUE_STATE__.order = window.__QUEUE_STATE__.order.filter((x) => x !== id);
      },
      retryQueueItem: async (id) => {
        const item = window.__QUEUE_STATE__.items.find((i) => i.id === id);
        if (item) item.status = 'waiting';
      },
      removeQueueItem: async (id) => {
        window.__QUEUE_STATE__.items = window.__QUEUE_STATE__.items.filter((i) => i.id !== id);
        window.__QUEUE_STATE__.order = window.__QUEUE_STATE__.order.filter((x) => x !== id);
      },
      reorderQueue: async (newOrder) => {
        window.__QUEUE_STATE__.order = newOrder;
      },
      startNowQueueItem: async (id) => {
        const idx = window.__QUEUE_STATE__.order.indexOf(id);
        if (idx > -1) {
          window.__QUEUE_STATE__.order.splice(idx, 1);
          window.__QUEUE_STATE__.order.unshift(id);
        }
      },
      pauseAllQueue: async () => {},
      resumeAllQueue: async () => {},
      clearCompletedQueue: async () => {
        window.__QUEUE_STATE__.items = window.__QUEUE_STATE__.items.filter((i) => i.status !== 'done');
      },
      setQueueConcurrency: async () => {},
      onQueueUpdate: (cb) => {
        cb(window.__QUEUE_STATE__);
        return () => {};
      },
      onQueueProgress: () => () => {},
      getHistory: async () => [],
      clearHistory: async () => {},
      removeHistoryItem: async () => {},
      openFolder: async () => true,
      openFile: async () => true,
      getSettings: async () => ({
        downloadFolder: 'C:\\Users\\adysi\\Downloads\\YouCut',
        queueConcurrency: 1,
        theme: 'dark'
      }),
      patchSettings: async () => ({}),
      getUpdatesState: async () => ({}),
      checkUpdates: async () => ({})
    };
  }, { queueFixture: QUEUE_PAYLOAD_FIXTURE, playlistFixture: PLAYLIST_FIXTURE });

  const page = await context.newPage();
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

  // 1. Queue Board (Dark)
  console.log('1. Navigating to Queue (Dark)...');
  await page.goto('http://localhost:8769');
  await page.waitForTimeout(600);
  await page.click('button[data-route="queue"]');
  await page.waitForTimeout(600);

  const shotQueueDark = path.join(outDir, '01-queue-board-dark.png');
  await page.screenshot({ path: shotQueueDark });
  console.log('  -> Saved:', shotQueueDark);

  // 2. Queue Board (Light)
  console.log('2. Switching to Light Mode & capturing Queue...');
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    localStorage.setItem('youcut_theme', 'light');
  });
  await page.waitForTimeout(400);

  const shotQueueLight = path.join(outDir, '02-queue-board-light.png');
  await page.screenshot({ path: shotQueueLight });
  console.log('  -> Saved:', shotQueueLight);

  // Restore dark theme for subsequent tests
  await page.evaluate(() => {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    localStorage.setItem('youcut_theme', 'dark');
  });
  await page.waitForTimeout(300);

  // 3. YouTube Playlist View (Dark)
  console.log('3. Navigating to YouTube Playlist view (Dark)...');
  await page.click('button[data-route="youtube"]');
  await page.waitForTimeout(400);

  // Click Playlist segmented tab
  const playlistTab = page.locator('button:has-text("Playlist")').first();
  await playlistTab.click();
  await page.waitForTimeout(300);

  const urlInput = page.locator('input[placeholder*="Paste a YouTube URL"]');
  await urlInput.fill('https://www.youtube.com/playlist?list=PLx0SYbCqOb8TBPRdmBHs5lftvv9TPboYG');
  const fetchBtn = page.locator('button:has-text("Fetch info")');
  await fetchBtn.click();
  await page.waitForTimeout(600);

  // Uncheck items 4 and 9 to match design mockup ("16 of 18 selected")
  const row4 = page.locator('div[data-index="4"]');
  await row4.click();
  const row9 = page.locator('div[data-index="9"]');
  await row9.click();
  await page.waitForTimeout(300);

  const shotPlaylistDark = path.join(outDir, '03-playlist-view-dark.png');
  await page.screenshot({ path: shotPlaylistDark });
  console.log('  -> Saved:', shotPlaylistDark);

  // 4. YouTube Playlist View (Light)
  console.log('4. Switching to Light Mode & capturing Playlist view...');
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    localStorage.setItem('youcut_theme', 'light');
  });
  await page.waitForTimeout(400);

  const shotPlaylistLight = path.join(outDir, '04-playlist-view-light.png');
  await page.screenshot({ path: shotPlaylistLight });
  console.log('  -> Saved:', shotPlaylistLight);

  // Restore dark theme
  await page.evaluate(() => {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    localStorage.setItem('youcut_theme', 'dark');
  });
  await page.waitForTimeout(300);

  // 5. Playlist Selection Range interaction
  console.log('5. Testing Range input interaction (1 to 10)...');
  const fromInput = page.locator('input[data-testid="range-from"]');
  const toInput = page.locator('input[data-testid="range-to"]');
  await fromInput.fill('1');
  await toInput.fill('10');
  await toInput.dispatchEvent('change');
  await page.waitForTimeout(400);

  const shotRange = path.join(outDir, '05-playlist-selection-range.png');
  await page.screenshot({ path: shotRange });
  console.log('  -> Saved:', shotRange);

  console.log('=== All 5 Screenshots Captured Successfully! ===');
  await browser.close();
  server.close();
}

run().catch((err) => {
  console.error('Error during screenshot capture:', err);
  process.exit(1);
});
