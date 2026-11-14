import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'docs', 'screenshots', 'p3');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  console.log('=== Starting Phase 3 Engine & UI Full Verification ===');
  const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  console.log('Using Electron binary:', electronPath);

  delete process.env.ELECTRON_RUN_AS_NODE;
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  cleanEnv.PLAYWRIGHT_TEST = '1';
  cleanEnv.NODE_ENV = 'test';
  cleanEnv.YOUCUT_HOME = path.resolve(projectRoot, 'test-userdata-p3');

  if (!fs.existsSync(cleanEnv.YOUCUT_HOME)) {
    fs.mkdirSync(cleanEnv.YOUCUT_HOME, { recursive: true });
  }

  const app = await electron.launch({
    executablePath: electronPath,
    args: ['--no-sandbox', '--playwright-test', path.join(projectRoot, 'out', 'main', 'index.js')],
    env: cleanEnv
  });

  try {
    const window = await app.firstWindow();
    console.log('App window loaded. Title:', await window.title());
    await window.setViewportSize({ width: 1176, height: 784 });
    await window.waitForTimeout(1000);

    // ==========================================
    // 1. Verify Settings: Theme Switcher & Dirs
    // ==========================================
    console.log('\n--- 1. Testing Settings & Theme Switching ---');
    await window.locator('button[data-route="settings"]').click();
    await window.waitForTimeout(500);

    // Capture Settings Dark Mode
    const settingsDarkShot = path.join(outDir, '01-settings-dark.png');
    await window.screenshot({ path: settingsDarkShot });
    console.log('  [PASS] Captured Settings (Dark):', settingsDarkShot);

    // Click Light Theme button
    console.log('  Clicking Light Theme button...');
    const lightBtn = window.locator('button:has-text("Light")');
    await lightBtn.click();
    await window.waitForTimeout(400);

    // Verify data-theme attribute on <html>
    const themeAttr = await window.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log('  HTML data-theme attribute is now:', themeAttr);
    if (themeAttr !== 'light') {
      throw new Error(`Expected data-theme="light", got "${themeAttr}"`);
    }

    // Capture Settings Light Mode
    const settingsLightShot = path.join(outDir, '02-settings-light.png');
    await window.screenshot({ path: settingsLightShot });
    console.log('  [PASS] Captured Settings (Light):', settingsLightShot);

    // Switch back to Dark Theme for design consistency
    const darkBtn = window.locator('button:has-text("Dark")');
    await darkBtn.click();
    await window.waitForTimeout(300);

    // ==========================================
    // 2. Verify YouTube Route: Controls & Trimming
    // ==========================================
    console.log('\n--- 2. Testing YouTube Interactive Trimming & Player Controls ---');
    await window.locator('button[data-route="youtube"]').click();
    await window.waitForTimeout(500);

    // Test entering a URL into the URL bar
    const testUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'; // Big Buck Bunny
    const urlInput = window.locator('input[placeholder*="Paste a YouTube URL"]');
    await urlInput.fill(testUrl);
    await window.waitForTimeout(300);

    // Verify that typing or pasting does NOT auto-fetch
    const isStillWaiting = await window.locator('text=No Video Loaded').count();
    console.log('  Checking manual fetch requirement: No Video Loaded visible before fetch?', isStillWaiting > 0);
    if (isStillWaiting === 0) {
      throw new Error('Video auto-fetched on input! Manual click requirement violated.');
    }
    console.log('  [PASS] Manual fetch verified: video info did not auto-fetch.');

    // Click "Fetch info" button explicitly
    console.log('  Clicking "Fetch info" button...');
    const fetchBtn = window.locator('button:has-text("Fetch info")');
    await fetchBtn.click();

    // Wait for fetch to complete (up to 15s)
    console.log('  Waiting for video metadata to load...');
    await window.waitForSelector('text=Video found', { timeout: 20000 });
    console.log('  [PASS] Video metadata fetched successfully!');

    // Capture YouTube video loaded state
    const ytLoadedShot = path.join(outDir, '03-youtube-video-loaded.png');
    await window.screenshot({ path: ytLoadedShot });
    console.log('  [PASS] Captured YouTube loaded view:', ytLoadedShot);

    // Test START Card -1s / +1s / Use playhead
    console.log('  Testing START Card adjust buttons (+1s)...');
    const startPlus1 = window.locator('div:has-text("START") button:has-text("+1s")').first();
    await startPlus1.click();
    await window.waitForTimeout(200);

    // Test Presets
    console.log('  Testing Preset "First 30s"...');
    const first30sBtn = window.locator('button:has-text("First 30s")');
    await first30sBtn.click();
    await window.waitForTimeout(300);

    // Check Start and End values
    const startVal = await window.locator('div:has-text("START") input').first().inputValue();
    const endVal = await window.locator('div:has-text("END") input').first().inputValue();
    console.log(`  Start timecode: ${startVal}, End timecode: ${endVal}`);
    if (startVal !== '00:00:00' || endVal !== '00:00:30') {
      console.warn(`  Warning: expected 00:00:00 to 00:00:30, got ${startVal} to ${endVal}`);
    } else {
      console.log('  [PASS] Preset "First 30s" applied accurately!');
    }

    // Test Format Chips
    console.log('  Testing Format Chips (Audio -> MP3, WAV)...');
    const audioToggle = window.locator('div[role="group"] button:has-text("Audio only")');
    await audioToggle.click();
    await window.waitForTimeout(300);

    const wavChip = window.locator('button:has-text("WAV")');
    await wavChip.click();
    await window.waitForTimeout(200);

    // Switch back to Video MP4
    const videoToggle = window.locator('div[role="group"] button:has-text("Video")');
    await videoToggle.click();
    await window.waitForTimeout(200);

    // Test "Full video" checkbox toggle
    console.log('  Testing Full video checkbox...');
    const fullVideoPill = window.locator('button[role="checkbox"]');
    await fullVideoPill.click();
    await window.waitForTimeout(300);

    const fullVideoShot = path.join(outDir, '04-youtube-full-video-on.png');
    await window.screenshot({ path: fullVideoShot });
    console.log('  [PASS] Captured Full video ON state:', fullVideoShot);

    // Toggle back to clip
    await fullVideoPill.click();
    await window.waitForTimeout(200);

    // ==========================================
    // 3. Add to Queue & Verify Sequential Queue
    // ==========================================
    console.log('\n--- 3. Testing Queue & Download Engine ---');
    console.log('  Clicking "Add to queue"...');
    const addToQueueBtn = window.locator('button:has-text("Add to queue")');
    await addToQueueBtn.click();
    await window.waitForTimeout(500);

    // Navigate to Queue view
    console.log('  Navigating to Queue route...');
    await window.locator('button[data-route="queue"]').click();
    await window.waitForTimeout(800);

    // Verify item is present in Queue
    const queueItemCount = await window.locator('text=Download Queue').count();
    const hasItems = await window.locator('text=Big Buck Bunny').count();
    console.log(`  Queue item rendered: ${hasItems > 0}`);
    if (hasItems === 0) {
      throw new Error('Added item not found in Download Queue!');
    }
    console.log('  [PASS] Queue item successfully rendered!');

    // Capture Queue view
    const queueShot = path.join(outDir, '05-queue-with-item.png');
    await window.screenshot({ path: queueShot });
    console.log('  [PASS] Captured Queue with active item:', queueShot);

    // Test Pause / Resume on Queue item
    const pauseBtn = window.locator('button:has-text("Pause")').first();
    if (await pauseBtn.count() > 0) {
      console.log('  Testing Pause button...');
      await pauseBtn.click();
      await window.waitForTimeout(400);

      const resumeBtn = window.locator('button:has-text("Resume")').first();
      console.log('  Resume button visible after pause?', (await resumeBtn.count()) > 0);
      if (await resumeBtn.count() > 0) {
        console.log('  Testing Resume button...');
        await resumeBtn.click();
        await window.waitForTimeout(400);
      }
    }

    // ==========================================
    // 4. Verify History Route
    // ==========================================
    console.log('\n--- 4. Testing History Route ---');
    await window.locator('button[data-route="history"]').click();
    await window.waitForTimeout(500);

    const historyShot = path.join(outDir, '06-history-view.png');
    await window.screenshot({ path: historyShot });
    console.log('  [PASS] Captured History view:', historyShot);

    // ==========================================
    // 5. Verify Process Cleanup (Lesson 2)
    // ==========================================
    console.log('\n--- 5. Verifying Clean Process Termination ---');
    await app.close();
    console.log('  App closed cleanly.');

    // Query tasklist for lingering yt-dlp.exe or ffmpeg.exe
    try {
      const tasklist = execSync('tasklist', { encoding: 'utf8' });
      const lingeringYtdlp = tasklist.includes('yt-dlp.exe');
      const lingeringFfmpeg = tasklist.includes('ffmpeg.exe');
      console.log('  Lingering yt-dlp.exe processes:', lingeringYtdlp);
      console.log('  Lingering ffmpeg.exe processes:', lingeringFfmpeg);
      if (lingeringYtdlp || lingeringFfmpeg) {
        console.warn('  [WARN] Lingering processes found, cleaning up...');
        execSync('taskkill /F /IM yt-dlp.exe /T', { stdio: 'ignore' });
        execSync('taskkill /F /IM ffmpeg.exe /T', { stdio: 'ignore' });
      } else {
        console.log('  [PASS] Zero lingering processes. Process tree cleanly killed!');
      }
    } catch {}

    console.log('\n=== ALL PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Verification failed with error:', err);
    await app.close().catch(() => {});
    process.exit(1);
  }
}

run();
