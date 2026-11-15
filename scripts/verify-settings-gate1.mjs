import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const rendererDist = path.join(projectRoot, 'out', 'renderer');
const outDir = path.join(projectRoot, 'docs', 'screenshots', 'settings');
const designImage = path.join(projectRoot, 'design', 'settings', 'YouCut — Settings 1x.png');

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
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
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
      console.log(`Server running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

const FIXTURE_SETTINGS = {
  version: 1,
  appearance: { theme: 'dark' },
  downloads: {
    defaultFolder: 'C:\\Users\\adysi\\Downloads',
    concurrentFragments: 16,
    defaultVideoFormat: 'mp4',
    trimMode: 'auto'
  },
  cookies: {
    browser: 'none',
    file: null
  },
  updates: {
    app: { autoUpdate: true, checkOnStartup: true },
    ytdlp: { autoUpdate: true },
    ffmpeg: { autoUpdate: false }
  }
};

const FIXTURE_UPDATES = {
  lastChecked: new Date('2026-11-15T14:02:00').toISOString(),
  tools: {
    youcut: {
      status: 'up-to-date',
      currentVersion: '2.0.0',
      autoUpdate: true,
      lastChecked: new Date('2026-11-15T14:02:00').toISOString()
    },
    ytdlp: {
      status: 'updating',
      currentVersion: '2026.10.26',
      latestVersion: '2026.11.12',
      progress: { percent: 64, speedBytesPerSec: 5.2 * 1024 * 1024 },
      autoUpdate: true,
      lastChecked: new Date('2026-11-15T14:02:00').toISOString()
    },
    ffmpeg: {
      status: 'update-available',
      currentVersion: 'N-127579-g5cb9fcd2...',
      latestVersion: '2026-11-12',
      updateSize: '≈ 82 MB',
      autoUpdate: false,
      lastChecked: new Date('2026-11-15T14:02:00').toISOString()
    }
  }
};

async function run() {
  console.log('=== Verifying Settings Gate 1: Visual Regression ===');
  const server = await startStaticServer(8769);

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1
  });

  await context.addInitScript((fixtures) => {
    window.__YOUCUT_FIXTURE__ = 'settings-design';
    window.api = {
      getAppVersion: async () => '2.0.0',
      getYouCutHome: async () => 'C:\\Users\\adysi\\.youcut',
      getBinariesStatus: async () => ({
        ytdlp: { version: '2026.10.26' },
        ffmpeg: { version: 'N-127579-g5cb9fcd211-20261016' }
      }),
      readClipboard: async () => '',
      writeClipboard: async () => true,
      getQueue: async () => [],
      onQueueUpdate: () => () => {},
      getSettings: async () => fixtures.settings,
      patchSettings: async (p) => ({ ...fixtures.settings, ...p }),
      getUpdatesState: async () => fixtures.updates,
      checkAllUpdates: async () => fixtures.updates,
      applyUpdate: async () => true,
      cancelUpdate: async () => true,
      onUpdatesStateChange: (cb) => {
        cb(fixtures.updates);
        return () => {};
      },
      checkBrowserCookies: async () => 'Found 12 cookies for youtube.com',
      browseCookiesFile: async () => 'C:\\Users\\adysi\\cookies.txt',
      validateCookiesFile: async () => ({ valid: true, count: 12 }),
      getDiagnostics: async () => 'YouCut v2.0.0 Diagnostics\nPlatform: win32 x64'
    };
  }, { settings: FIXTURE_SETTINGS, updates: FIXTURE_UPDATES });

  const page = await context.newPage();
  await page.goto('http://localhost:8769/?fixture=settings-design');
  await page.waitForTimeout(600);

  // Navigate to Settings
  await page.locator('button[data-route="settings"]').click();
  await page.waitForTimeout(500);

  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  // Capture 1440x1100
  const shot1440 = path.join(outDir, 'settings-1440x1100.png');
  await page.screenshot({ path: shot1440 });
  console.log('Saved 1440x1100 screenshot:', shot1440);

  // Capture 1180x800
  await page.setViewportSize({ width: 1180, height: 800 });
  await page.waitForTimeout(400);
  const shot1180 = path.join(outDir, 'settings-1180x800.png');
  await page.screenshot({ path: shot1180 });
  console.log('Saved 1180x800 screenshot:', shot1180);

  // Capture 1040x720
  await page.setViewportSize({ width: 1040, height: 720 });
  await page.waitForTimeout(400);
  const shot1040 = path.join(outDir, 'settings-1040x720.png');
  await page.screenshot({ path: shot1040 });
  console.log('Saved 1040x720 screenshot:', shot1040);

  await browser.close();
  server.close();

  // Run pixel comparison script
  const pyScript = path.join(projectRoot, 'scripts', 'diff-settings.py');
  console.log('Running pixel diff comparison...');
  const res = spawnSync('C:\\Users\\adysi\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe', [
    pyScript,
    designImage,
    shot1440,
    path.join(outDir, 'diff-1440x1100.png'),
    path.join(outDir, 'side-by-side-1440x1100.png')
  ], { encoding: 'utf-8' });

  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
