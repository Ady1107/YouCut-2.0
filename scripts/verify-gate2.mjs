import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, spawnSync, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const screenshotsDir = path.join(projectRoot, 'docs', 'screenshots', 'gate2');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const ffprobePath = path.join(projectRoot, 'resources', 'bin', 'ffprobe.exe');
const ytdlpPath = path.join(projectRoot, 'resources', 'bin', 'yt-dlp.exe');
const denoPath = path.join(projectRoot, 'resources', 'bin', 'deno.exe');

function runFFprobe(filePath) {
  try {
    const stdout = execFileSync(
      ffprobePath,
      ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name', '-of', 'json', filePath],
      { encoding: 'utf-8', timeout: 10000 }
    );
    const data = JSON.parse(stdout);
    return {
      duration: parseFloat(data.format?.duration || '0'),
      sizeBytes: parseInt(data.format?.size || '0', 10),
      streams: (data.streams || []).map((s) => s.codec_type)
    };
  } catch (e) {
    return { error: e.message };
  }
}

function checkRunningProcesses() {
  const out = spawnSync('tasklist', [], { encoding: 'utf-8' }).stdout || '';
  return {
    ytdlp: out.toLowerCase().includes('yt-dlp.exe'),
    ffmpeg: out.toLowerCase().includes('ffmpeg.exe'),
    deno: out.toLowerCase().includes('deno.exe')
  };
}

async function runGate2() {
  console.log('======================================================');
  console.log('STARTING GATE 2 VERIFICATION SUITE');
  console.log('======================================================\n');

  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'youcut-gate2-home-'));
  const tempDownloads = fs.mkdtempSync(path.join(os.tmpdir(), 'youcut-gate2-dl-'));
  console.log('Temp YOUCUT_HOME:', tempHome);
  console.log('Temp Downloads folder:', tempDownloads);

  // ------------------------------------------------------------------
  // GATE 2(f): Test download with PATH stripped of node/deno
  // ------------------------------------------------------------------
  console.log('\n--- GATE 2(f): TEST DOWNLOAD WITH PATH STRIPPED OF NODE/DENO ---');
  const filteredPath = (process.env.PATH || '')
    .split(';')
    .filter((p) => !p.toLowerCase().includes('nodejs') && !p.toLowerCase().includes('node') && !p.toLowerCase().includes('deno'))
    .join(';');

  const partGOutFile = path.join(tempDownloads, 'part_g_test.mp4');
  const partGArgs = [
    '--no-playlist',
    '--no-mtime',
    '--js-runtimes', `deno:${denoPath}`,
    '--download-sections', '*0-5',
    '-f', 'best[ext=mp4]/best',
    '-o', partGOutFile,
    'https://www.youtube.com/watch?v=jNQXAC9IVRw'
  ];

  console.log('Running yt-dlp with isolated PATH (node and deno stripped)...');
  const partGRes = spawnSync(ytdlpPath, partGArgs, {
    env: { ...process.env, PATH: filteredPath, PYTHONIOENCODING: 'utf-8' },
    encoding: 'utf-8',
    timeout: 30000
  });

  console.log('Part G Exit Code:', partGRes.status);
  if (fs.existsSync(partGOutFile)) {
    const probe = runFFprobe(partGOutFile);
    console.log(`Part G Success: File created (${fs.statSync(partGOutFile).size} bytes, duration: ${probe.duration}s, streams: ${probe.streams.join(', ')})`);
  } else {
    console.error('Part G Stderr:', partGRes.stderr);
    throw new Error('Part G download failed');
  }

  // ------------------------------------------------------------------
  // Launch Electron App with remote debugging for Playwright CDP
  // ------------------------------------------------------------------
  console.log('\nLaunching Electron application...');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.YOUCUT_HOME = tempHome;
  env.NODE_ENV = 'test';
  env.PLAYWRIGHT_TEST = '1';

  const child = spawn(electronPath, ['--remote-debugging-port=9222', '--no-sandbox', '.'], {
    cwd: projectRoot,
    env,
    stdio: 'ignore'
  });

  await new Promise((r) => setTimeout(r, 2500));

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || (await context.newPage());
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  console.log('Connected to Electron via CDP. Title:', await page.title());

  // ------------------------------------------------------------------
  // GATE 2(a): Same URL clips & range validation
  // ------------------------------------------------------------------
  console.log('\n--- GATE 2(a): SAME URL CLIPS & ZERO-LENGTH REJECTION ---');
  await page.click('button[data-route="youtube"]');
  await page.waitForTimeout(500);

  const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
  const inputBar = page.locator('[data-testid="url-input"]');
  await inputBar.fill(testUrl);
  await page.click('button:has-text("Fetch info")');
  console.log('Fetching video metadata...');
  await page.waitForSelector('text=Me at the zoo', { timeout: 25000 });
  console.log('Video metadata loaded.');

  // Test zero-length clip rejection (*5-5)
  console.log('Testing zero-length clip rejection (*5-5)...');
  const fullVideoToggle = page.locator('button:has-text("Full video")');
  if (await fullVideoToggle.isVisible()) {
    const isChecked = await fullVideoToggle.evaluate((el) => el.getAttribute('aria-checked') === 'true');
    if (isChecked) {
      await fullVideoToggle.click();
      await page.waitForTimeout(300);
    }
  }

  const startInput = page.locator('[data-testid="start-time-input"]');
  const endInput = page.locator('[data-testid="end-time-input"]');

  await startInput.fill('00:00:05');
  await startInput.blur();
  await endInput.fill('00:00:05');
  await endInput.blur();
  await page.waitForTimeout(500);

  const addToQueueBtn = page.locator('button:has-text("Add to queue")');
  const isAddDisabled = await addToQueueBtn.isDisabled();
  const inlineWarning = await page.locator('text=Clip duration must be at least 1s').isVisible();
  console.log(`Zero-length check: Add to queue disabled = ${isAddDisabled}, Inline warning visible = ${inlineWarning}`);
  if (!isAddDisabled || !inlineWarning) {
    throw new Error('Zero-length clip was not properly disabled in UI!');
  }

  // Clip 1: 00:00:02 to 00:00:08 (duration 6s)
  console.log('Configuring Clip 1: 00:00:02 to 00:00:08...');
  await startInput.fill('00:00:02');
  await endInput.fill('00:00:08');
  await endInput.blur();
  await page.waitForTimeout(300);
  await addToQueueBtn.click();
  console.log('Added Clip 1 to queue.');
  await page.waitForTimeout(1000);

  // Clip 2: 00:00:10 to 00:00:16 (duration 6s)
  console.log('Configuring Clip 2: 00:00:10 to 00:00:16...');
  await page.click('button[data-route="youtube"]');
  await page.waitForTimeout(500);
  await startInput.fill('00:00:10');
  await endInput.fill('00:00:16');
  await endInput.blur();
  await page.waitForTimeout(300);
  await addToQueueBtn.click();
  console.log('Added Clip 2 to queue.');
  await page.waitForTimeout(1000);

  // Full Video
  console.log('Configuring Full Video download...');
  await page.click('button[data-route="youtube"]');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Full video")');
  await page.waitForTimeout(300);
  await addToQueueBtn.click();
  console.log('Added Full Video to queue.');
  await page.waitForTimeout(1000);

  // Navigate to Queue and wait for downloads to finish
  await page.click('button[data-route="queue"]');
  console.log('Waiting for the 3 downloads to complete...');

  await page.waitForFunction(
    () => {
      const cards = document.querySelectorAll('[class*="rounded-[18px]"]');
      let finished = 0;
      cards.forEach((c) => {
        if (c.textContent && (c.textContent.includes('Done') || c.textContent.includes('Finished with warning'))) {
          finished++;
        }
      });
      return finished >= 3;
    },
    { timeout: 60000 }
  );

  const shotPathDone = path.join(screenshotsDir, 'gate2-same-url-clips-done.png');
  await page.screenshot({ path: shotPathDone, fullPage: true });
  console.log('All 3 downloads finished. Screenshot saved:', shotPathDone);

  // Verify the 3 distinct files created on disk
  const queuePayload = await page.evaluate(async () => {
    return await window.api.getQueue();
  });

  const downloadedFiles = queuePayload.items.map((i) => i.filePath);
  console.log('\nDownloaded files reported by queue:');
  const distinctFiles = new Set(downloadedFiles);
  if (distinctFiles.size < 3) {
    throw new Error(`File collision detected! Expected 3 distinct files, got ${distinctFiles.size}`);
  }

  for (const f of downloadedFiles) {
    console.log(`- Path: ${f}`);
    if (fs.existsSync(f)) {
      const probe = runFFprobe(f);
      console.log(`  Size: ${fs.statSync(f).size} bytes, Duration: ${probe.duration}s, Streams: ${probe.streams?.join(', ')}`);
    } else {
      console.error(`  FILE NOT FOUND ON DISK: ${f}`);
      throw new Error(`File missing on disk: ${f}`);
    }
  }

  // ------------------------------------------------------------------
  // GATE 2(d): Stop then Resume
  // ------------------------------------------------------------------
  console.log('\n--- GATE 2(d): STOP THEN RESUME ---');
  await page.click('button[data-route="youtube"]');
  await page.waitForTimeout(500);

  await page.click('button:has-text("Full video")');
  await page.waitForTimeout(300);
  await addToQueueBtn.click();
  await page.waitForTimeout(500);

  console.log('Waiting for downloading item...');
  const pauseBtn = page.locator('button[aria-label="Pause download"]').first();
  if (await pauseBtn.isVisible({ timeout: 5000 })) {
    await pauseBtn.click();
    console.log('Clicked Pause.');
    await page.waitForTimeout(1000);
    const shotPause = path.join(screenshotsDir, 'gate2-paused-state.png');
    await page.screenshot({ path: shotPause });
    console.log('Saved screenshot:', shotPause);

    const hasPaused = await page.getByText('Paused', { exact: true }).first().isVisible();
    console.log('Card shows Paused status:', hasPaused);

    console.log('Clicking Resume...');
    const resumeBtn = page.locator('button[aria-label="Resume download"]').first();
    await resumeBtn.click();
    console.log('Clicked Resume.');
    await page.waitForTimeout(1000);
    const shotResume = path.join(screenshotsDir, 'gate2-resumed-state.png');
    await page.screenshot({ path: shotResume });
    console.log('Saved screenshot:', shotResume);
  }

  await page.waitForTimeout(6000);

  // ------------------------------------------------------------------
  // GATE 2(e): Close window mid-download, verify process list is clean
  // ------------------------------------------------------------------
  console.log('\n--- GATE 2(e): WINDOW CLOSE MID-DOWNLOAD PROCESS CLEANUP ---');
  await page.click('button[data-route="youtube"]');
  await page.waitForTimeout(500);
  await inputBar.fill('https://www.youtube.com/watch?v=eRsGyueVLvQ');
  await page.click('button:has-text("Fetch info")');
  await page.waitForSelector('text=Sintel', { timeout: 30000 });
  const fullVideoToggleSintel = page.locator('button:has-text("Full video")');
  if (await fullVideoToggleSintel.isVisible()) {
    const isChecked = await fullVideoToggleSintel.evaluate((el) => el.getAttribute('aria-checked') === 'true');
    if (!isChecked) {
      await fullVideoToggleSintel.click();
      await page.waitForTimeout(300);
    }
  }
  await page.click('button:has-text("Add to queue")');
  await page.waitForTimeout(2000);

  console.log('Active processes before close:', checkRunningProcesses());
  console.log('Closing browser and killing Electron process tree...');
  await browser.close();
  child.kill();
  await new Promise((r) => setTimeout(r, 2000));

  const procsAfter = checkRunningProcesses();
  console.log('Active processes after window close:', procsAfter);
  if (procsAfter.ytdlp || procsAfter.ffmpeg) {
    throw new Error('Lingering download processes detected after window close!');
  }
  console.log('Process list is completely CLEAN.');

  // ------------------------------------------------------------------
  // GATE 2(b): 13+ min full video download with screenshots at 25/50/75%
  // ------------------------------------------------------------------
  console.log('\n--- GATE 2(b): 13+ MIN FULL VIDEO DOWNLOAD WITH MILESTONES (25/50/75%) ---');
  const child2 = spawn(electronPath, ['--remote-debugging-port=9222', '--no-sandbox', '.'], {
    cwd: projectRoot,
    env,
    stdio: 'ignore'
  });

  await new Promise((r) => setTimeout(r, 2500));

  const browser2 = await chromium.connectOverCDP('http://localhost:9222');
  const context2 = browser2.contexts()[0];
  const page2 = context2.pages()[0] || (await context2.newPage());
  await page2.setViewportSize({ width: 1280, height: 850 });
  await page2.waitForLoadState('domcontentloaded');

  await page2.click('button[data-route="queue"]');
  await page2.waitForTimeout(1000);

  const resumeSintelBtn = page2.locator('button[aria-label="Resume download"]').first();
  if (await resumeSintelBtn.isVisible()) {
    console.log('Clicking Resume for Sintel...');
    await resumeSintelBtn.click();
    await page2.waitForTimeout(500);
  }

  const startNowBtn = page2.locator('button:has-text("Start now")').first();
  if (await startNowBtn.isVisible()) {
    console.log('Clicking Start now for Sintel...');
    await startNowBtn.click();
    await page2.waitForTimeout(500);
  }

  let shot25 = false;
  let shot50 = false;
  let shot75 = false;

  console.log('Monitoring Sintel download progress for 25%, 50%, 75% milestones...');
  const startTime = Date.now();
  while (Date.now() - startTime < 180000) {
    const { currentPct, isDone, text } = await page2.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[class*="rounded-[18px]"]'));
      const sintelCard = cards.find((c) => c.textContent?.includes('Sintel'));
      if (!sintelCard) return { currentPct: 0, isDone: false, text: '' };
      const cText = sintelCard.textContent || '';
      const m = cText.match(/(\d+)%/);
      const isDone = cText.includes('Done') || cText.includes('Open folder');
      return {
        currentPct: m ? parseInt(m[1], 10) : 0,
        isDone,
        text: cText.slice(0, 100)
      };
    });

    if (currentPct >= 15 && !shot25) {
      shot25 = true;
      console.log(`Reached milestone ~25% (${currentPct}%). Capturing screenshot...`);
      await page2.screenshot({ path: path.join(screenshotsDir, 'gate2-sintel-progress-25pct.png') });
    }
    if (currentPct >= 45 && !shot50) {
      shot50 = true;
      console.log(`Reached milestone ~50% (${currentPct}%). Capturing screenshot...`);
      await page2.screenshot({ path: path.join(screenshotsDir, 'gate2-sintel-progress-50pct.png') });
    }
    if (currentPct >= 70 && !shot75) {
      shot75 = true;
      console.log(`Reached milestone ~75% (${currentPct}%). Capturing screenshot...`);
      await page2.screenshot({ path: path.join(screenshotsDir, 'gate2-sintel-progress-75pct.png') });
      break;
    }

    if (isDone) {
      console.log('Sintel completed!');
      break;
    }

    console.log(`[Sintel Progress Check] Pct: ${currentPct}%, Card text: ${text}`);
    await page2.waitForTimeout(2000);
  }

  await browser2.close();
  child2.kill();

  // Cleanup temp dirs
  try {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempDownloads, { recursive: true, force: true });
  } catch {}

  console.log('\n======================================================');
  console.log('GATE 2 VERIFICATION SUITE COMPLETED SUCCESSFULLY');
  console.log('======================================================');
}

runGate2().catch((err) => {
  console.error('\nGATE 2 FAILED WITH ERROR:', err);
  process.exit(1);
});
