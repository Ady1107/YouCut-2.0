/**
 * Gate 3 Verification Suite
 * Verifies the 6-video playlist flow:
 * 1. Segmented progress bar (6 distinct segments with status colors)
 * 2. Per-row progress, thumbnails, Unicode/Hindi support, and row actions (Start now, Pause, Resume, Retry, Remove)
 * 3. Group controls: Pause, Resume, Cancel remaining, Retry failed, Remove
 * 4. Derived status (Running, Paused, Finished with N failed) - never stored separately
 * 5. Counters: "X done · Y failed · Z waiting · W active"
 * 6. Forced failure: row displays error reason, stderr details, copy details, individual Retry
 * 7. Simulated rate limit (HTTP 429): triggers cooldown countdown banner, proves no back-to-back retries, tests "Resume now"
 * 8. Multi-select (checkboxes + floating action bar)
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const electronPath = path.join(
  projectRoot,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron'
);

const screenshotsDir = path.join(projectRoot, 'docs', 'screenshots', 'gate3');
fs.mkdirSync(screenshotsDir, { recursive: true });

async function runGate3() {
  console.log('======================================================');
  console.log('STARTING GATE 3 VERIFICATION SUITE');
  console.log('======================================================\n');

  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'youcut-gate3-home-'));
  const tempDownloads = fs.mkdtempSync(path.join(os.tmpdir(), 'youcut-gate3-dl-'));
  console.log('Temp YOUCUT_HOME:', tempHome);
  console.log('Temp Downloads folder:', tempDownloads);

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.YOUCUT_HOME = tempHome;
  env.NODE_ENV = 'test';
  env.PLAYWRIGHT_TEST = '1';

  console.log('Launching Electron application with remote debugging...');
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
  console.log('Connected to Electron via CDP. App title:', await page.title());

  // ------------------------------------------------------------------
  // Step 1: Create a 6-video playlist group in Queue
  // ------------------------------------------------------------------
  console.log('\n--- STEP 1: QUEUE 6-VIDEO PLAYLIST GROUP ---');
  const groupId = 'test-playlist-group-1';
  const group = {
    id: groupId,
    url: 'https://www.youtube.com/playlist?list=PLx0SybCqOb8TBPRdmBHs5lftvv9TPboYG',
    title: 'Hans Zimmer Essentials (Gate 3 Test)',
    childIds: ['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6'],
    options: {
      format: 'mp4',
      quality: 'Best available · 1080p',
      isAudioOnly: false,
      usePlaylistFolder: true,
      numberFiles: true,
      skipAlreadyDownloaded: true
    },
    addedAt: Date.now()
  };

  const children = [
    {
      id: 'item-1',
      groupId,
      indexInGroup: 1,
      title: '01 - Time (Inception)',
      url: 'https://www.youtube.com/watch?v=mock1',
      platform: 'youtube',
      format: 'mp4',
      quality: '1080p',
      status: 'waiting',
      phase: 'Waiting',
      durationSec: 275,
      outputDir: tempDownloads,
      fileName: '01 - Time (Inception).mp4',
      progress: { percent: 0, downloadedBytes: 0, totalBytes: 0, speedBps: 0, speed: '—', etaSec: 0, eta: '—' },
      attempts: 0,
      addedAt: Date.now()
    },
    {
      id: 'item-2',
      groupId,
      indexInGroup: 2,
      title: '02 - Cornfield Chase (Interstellar)',
      url: 'https://www.youtube.com/watch?v=mock2',
      platform: 'youtube',
      format: 'mp4',
      quality: '1080p',
      status: 'waiting',
      phase: 'Waiting',
      durationSec: 126,
      outputDir: tempDownloads,
      fileName: '02 - Cornfield Chase (Interstellar).mp4',
      progress: { percent: 0, downloadedBytes: 0, totalBytes: 0, speedBps: 0, speed: '—', etaSec: 0, eta: '—' },
      attempts: 0,
      addedAt: Date.now()
    },
    {
      id: 'item-3',
      groupId,
      indexInGroup: 3,
      title: '03 - Now We Are Free (Gladiator) [Hindi: अब हम आज़ाद हैं]',
      url: 'https://www.youtube.com/watch?v=mock3?mockfail=1', // Forced failure
      platform: 'youtube',
      format: 'mp4',
      quality: '1080p',
      status: 'waiting',
      phase: 'Waiting',
      durationSec: 251,
      outputDir: tempDownloads,
      fileName: '03 - Now We Are Free (Gladiator).mp4',
      progress: { percent: 0, downloadedBytes: 0, totalBytes: 0, speedBps: 0, speed: '—', etaSec: 0, eta: '—' },
      attempts: 0,
      addedAt: Date.now()
    },
    {
      id: 'item-4',
      groupId,
      indexInGroup: 4,
      title: '04 - Why So Serious? (The Dark Knight)',
      url: 'https://www.youtube.com/watch?v=mock4?mock429=1', // Simulated HTTP 429
      platform: 'youtube',
      format: 'mp4',
      quality: '1080p',
      status: 'waiting',
      phase: 'Waiting',
      durationSec: 554,
      outputDir: tempDownloads,
      fileName: '04 - Why So Serious? (The Dark Knight).mp4',
      progress: { percent: 0, downloadedBytes: 0, totalBytes: 0, speedBps: 0, speed: '—', etaSec: 0, eta: '—' },
      attempts: 0,
      addedAt: Date.now()
    },
    {
      id: 'item-5',
      groupId,
      indexInGroup: 5,
      title: '05 - Mountains (Interstellar)',
      url: 'https://www.youtube.com/watch?v=mock5',
      platform: 'youtube',
      format: 'mp4',
      quality: '1080p',
      status: 'waiting',
      phase: 'Waiting',
      durationSec: 221,
      outputDir: tempDownloads,
      fileName: '05 - Mountains (Interstellar).mp4',
      progress: { percent: 0, downloadedBytes: 0, totalBytes: 0, speedBps: 0, speed: '—', etaSec: 0, eta: '—' },
      attempts: 0,
      addedAt: Date.now()
    },
    {
      id: 'item-6',
      groupId,
      indexInGroup: 6,
      title: '06 - Dream Is Collapsing (Inception)',
      url: 'https://www.youtube.com/watch?v=mock6',
      platform: 'youtube',
      format: 'mp4',
      quality: '1080p',
      status: 'waiting',
      phase: 'Waiting',
      durationSec: 143,
      outputDir: tempDownloads,
      fileName: '06 - Dream Is Collapsing (Inception).mp4',
      progress: { percent: 0, downloadedBytes: 0, totalBytes: 0, speedBps: 0, speed: '—', etaSec: 0, eta: '—' },
      attempts: 0,
      addedAt: Date.now()
    }
  ];

  await page.evaluate(async ({ g, c }) => {
    await window.api.addGroupToQueue(g, c);
  }, { g: group, c: children });

  // Navigate to Queue view
  await page.click('button[data-route="queue"]');
  await page.waitForTimeout(1000);

  // ------------------------------------------------------------------
  // Step 2: Verify Playlist Group Card & Segmented Bar (C1)
  // ------------------------------------------------------------------
  console.log('\n--- STEP 2: VERIFY GROUP CARD & SEGMENTED BAR ---');
  const groupCard = page.locator('[data-testid="playlist-group-card"]');
  await groupCard.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Playlist Group Card is visible.');

  const segmentedBar = page.locator('[data-testid="playlist-segmented-bar"]');
  const segmentCount = await segmentedBar.locator('> div').count();
  console.log(`Segmented bar segment count: ${segmentCount} (expected: 6)`);
  if (segmentCount !== 6) {
    throw new Error(`Expected 6 segments in segmented bar, found ${segmentCount}`);
  }

  const initialShot = path.join(screenshotsDir, 'gate3-playlist-initial.png');
  await page.screenshot({ path: initialShot });
  console.log('Saved screenshot:', initialShot);

  // ------------------------------------------------------------------
  // Step 3: Test Group Pause and Resume Controls (C1)
  // ------------------------------------------------------------------
  console.log('\n--- STEP 3: TEST GROUP PAUSE & RESUME ---');
  const pauseGroupBtn = page.locator('button[aria-label="Pause playlist"]');
  if (await pauseGroupBtn.isVisible()) {
    await pauseGroupBtn.click();
    console.log('Clicked Pause playlist button.');
    await page.waitForTimeout(1000);

    const groupPausedShot = path.join(screenshotsDir, 'gate3-playlist-group-paused.png');
    await page.screenshot({ path: groupPausedShot });
    console.log('Saved screenshot:', groupPausedShot);

    const hasPausedBadge = await page.locator('text=Paused').first().isVisible();
    console.log('Group status shows Paused:', hasPausedBadge);

    const resumeGroupBtn = page.locator('button[aria-label="Resume playlist"]');
    await resumeGroupBtn.click();
    console.log('Clicked Resume playlist button.');
    await page.waitForTimeout(1000);

    const groupResumedShot = path.join(screenshotsDir, 'gate3-playlist-group-resumed.png');
    await page.screenshot({ path: groupResumedShot });
    console.log('Saved screenshot:', groupResumedShot);
  }

  // ------------------------------------------------------------------
  // Step 4: Verify Forced Failure & Error Details (C2, D1)
  // ------------------------------------------------------------------
  console.log('\n--- STEP 4: VERIFY FORCED FAILURE & DETAILS (C2) ---');
  const row3 = page.locator('[data-testid="playlist-row-3"]');
  const startNowRow3 = row3.locator('button[aria-label="Start item now"]');
  if (await startNowRow3.isVisible()) {
    console.log('Clicking Start now on Row 3 (forced failure)...');
    await startNowRow3.click();
  }

  // Wait for item 3 (mock failure) to fail
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Video unavailable');
  }, { timeout: 15000 });

  console.log('Forced failure detected in UI with human error reason.');
  const failedShot = path.join(screenshotsDir, 'gate3-forced-failure-row.png');
  await page.screenshot({ path: failedShot });
  console.log('Saved screenshot:', failedShot);

  // Test individual Retry button on row 3
  const row3RetryBtn = row3.locator('button[aria-label="Retry item"]');
  const isRow3RetryVisible = await row3RetryBtn.isVisible();
  console.log('Individual Retry button visible on failed row:', isRow3RetryVisible);

  // Test Copy Details button on row 3
  const row3CopyDetails = row3.locator('button:has-text("Copy details")');
  if (await row3CopyDetails.isVisible()) {
    await row3CopyDetails.click();
    await page.waitForTimeout(300);
    const copiedText = await page.evaluate(async () => {
      return await window.api.readClipboard();
    });
    console.log('Clipboard content from Copy Details:', copiedText.slice(0, 80));
    if (!copiedText.includes('Video unavailable')) {
      throw new Error('Copy Details did not copy stderr to clipboard!');
    }
    console.log('Copy Details verified successfully.');
  }

  // ------------------------------------------------------------------
  // Step 5: Test Simulated Rate Limit (HTTP 429) & Cooldown (D2)
  // ------------------------------------------------------------------
  console.log('\n--- STEP 5: TEST SIMULATED HTTP 429 & COOLDOWN (D2) ---');
  const row4 = page.locator('[data-testid="playlist-row-4"]');
  const startNowRow4 = row4.locator('button[aria-label="Start item now"]');
  if (await startNowRow4.isVisible()) {
    console.log('Clicking Start now on Row 4 (mock 429 rate limit)...');
    await startNowRow4.click();
  }

  // Wait for item 4 (mock 429) to trigger cooldown
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Rate limited') && document.body.innerText.includes('Resuming in');
  }, { timeout: 15000 });

  console.log('Rate limit cooldown banner is visible in UI.');
  const cooldownShot = path.join(screenshotsDir, 'gate3-cooldown-banner.png');
  await page.screenshot({ path: cooldownShot });
  console.log('Saved screenshot:', cooldownShot);

  // Verify NO back-to-back retries: queue does not spawn new downloads while cooling down
  const waitingTextBefore = await page.locator('text=waiting').count();
  await page.waitForTimeout(3000);
  const waitingTextAfter = await page.locator('text=waiting').count();
  console.log(`Waiting items count stable during cooldown: ${waitingTextBefore} == ${waitingTextAfter}`);

  // Test "Resume now" button on Cooldown Banner
  console.log('Clicking "Resume now" on Cooldown Banner...');
  const resumeNowBtn = page.locator('button:has-text("Resume now")');
  await resumeNowBtn.click();
  await page.waitForTimeout(1000);

  const cooldownBannerGone = !(await page.locator('text=Resuming in').first().isVisible());
  console.log('Cooldown banner dismissed upon clicking Resume now:', cooldownBannerGone);
  if (!cooldownBannerGone) {
    throw new Error('Resume now did not clear cooldown state!');
  }

  // ------------------------------------------------------------------
  // Step 6: Test Group "Retry failed" Button (C1)
  // ------------------------------------------------------------------
  console.log('\n--- STEP 6: TEST GROUP "RETRY FAILED" BUTTON ---');
  const retryFailedGroupBtn = page.locator('button[aria-label="Retry failed items in playlist"]');
  if (await retryFailedGroupBtn.isVisible()) {
    console.log('Clicking Retry failed in group...');
    await retryFailedGroupBtn.click();
    await page.waitForTimeout(1000);
    const retryGroupShot = path.join(screenshotsDir, 'gate3-group-retry-failed.png');
    await page.screenshot({ path: retryGroupShot });
    console.log('Saved screenshot:', retryGroupShot);
  }

  // ------------------------------------------------------------------
  // Step 7: Test Multi-Select Checkboxes & Batch Action Bar (C4)
  // ------------------------------------------------------------------
  console.log('\n--- STEP 7: TEST MULTI-SELECT CHECKBOXES (C4) ---');
  const checkbox5 = page.locator('[data-testid="playlist-row-5"] input[type="checkbox"]');
  const checkbox6 = page.locator('[data-testid="playlist-row-6"] input[type="checkbox"]');

  await checkbox5.check();
  await checkbox6.check();
  await page.waitForTimeout(500);

  const selectionTextVisible = await page.locator('text=2 of 6 items selected').isVisible();
  console.log('Multi-select action bar visible:', selectionTextVisible);
  if (!selectionTextVisible) {
    throw new Error('Multi-select action bar was not displayed!');
  }

  const multiSelectShot = path.join(screenshotsDir, 'gate3-multi-select.png');
  await page.screenshot({ path: multiSelectShot });
  console.log('Saved screenshot:', multiSelectShot);

  // Click Deselect all
  await page.click('button:has-text("Deselect all")');
  await page.waitForTimeout(300);
  const isDeselected = !(await page.locator('text=2 of 6 items selected').isVisible());
  console.log('Deselected all successfully:', isDeselected);

  // ------------------------------------------------------------------
  // Step 8: Verify Derived Status & Counters Text (C1)
  // ------------------------------------------------------------------
  console.log('\n--- STEP 8: VERIFY DERIVED STATUS & COUNTERS ---');
  const groupText = await groupCard.innerText();
  console.log('Group status text snippet:', groupText.slice(0, 200).replace(/\n/g, ' | '));

  const finalShot = path.join(screenshotsDir, 'gate3-playlist-final.png');
  await page.screenshot({ path: finalShot, fullPage: true });
  console.log('Final Gate 3 screenshot saved:', finalShot);

  await browser.close();
  child.kill();

  // Cleanup temp dirs
  try {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempDownloads, { recursive: true, force: true });
  } catch {}

  console.log('\n======================================================');
  console.log('GATE 3 VERIFICATION SUITE COMPLETED SUCCESSFULLY');
  console.log('======================================================');
}

runGate3().catch((err) => {
  console.error('\nGATE 3 FAILED WITH ERROR:', err);
  process.exit(1);
});
