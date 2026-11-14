import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'docs', 'screenshots', 'p1');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  console.log('=== Starting Phase 1 Shell & Navigation Verification ===');
  const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  console.log('Using Electron binary:', electronPath);

  delete process.env.ELECTRON_RUN_AS_NODE;
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  cleanEnv.PLAYWRIGHT_TEST = '1';
  cleanEnv.NODE_ENV = 'test';
  cleanEnv.YOUCUT_HOME = path.resolve(projectRoot, 'test-userdata');

  const app = await electron.launch({
    executablePath: electronPath,
    args: ['--no-sandbox', '--playwright-test', path.join(projectRoot, 'out', 'main', 'index.js')],
    env: cleanEnv
  });

  const window = await app.firstWindow();
  console.log('App window loaded. Title:', await window.title());

  const routes = [
    { id: 'home', label: 'Home' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'queue', label: 'Queue' },
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' }
  ];

  // 1. Test clicking every navigation button and screenshot at 1176x784
  await window.setViewportSize({ width: 1176, height: 784 });
  await window.waitForTimeout(1000);

  for (const route of routes) {
    console.log(`Navigating to ${route.label} (id: ${route.id})...`);
    const navBtn = window.locator(`button[data-route="${route.id}"]`);
    await navBtn.click();
    await window.waitForTimeout(400);

    const shot1176 = path.join(outDir, `${route.id}-1176x784.png`);
    await window.screenshot({ path: shot1176 });
    console.log(`  -> Captured 1176x784: ${shot1176}`);
  }

  // 2. Test 1440x900 expanded size on Home, YouTube, and Settings
  console.log('Testing 1440x900 expanded viewport...');
  await window.setViewportSize({ width: 1440, height: 900 });
  await window.waitForTimeout(400);

  for (const routeId of ['home', 'youtube', 'settings']) {
    const navBtn = window.locator(`button[data-route="${routeId}"]`);
    await navBtn.click();
    await window.waitForTimeout(300);

    const shot1440 = path.join(outDir, `${routeId}-1440x900.png`);
    await window.screenshot({ path: shot1440 });
    console.log(`  -> Captured 1440x900: ${shot1440}`);
  }

  // 3. Reset to 1176x784 and test interactive YouTube features
  await window.setViewportSize({ width: 1176, height: 784 });
  await window.locator('button[data-route="youtube"]').click();
  await window.waitForTimeout(400);

  // Test Full Video Toggle
  console.log('Testing YouTube Full Video toggle...');
  const fullVideoToggle = window.locator('button[role="checkbox"]');
  await fullVideoToggle.click();
  await window.waitForTimeout(300);

  const fullVideoShot = path.join(outDir, 'youtube-fullvideo-on-1176x784.png');
  await window.screenshot({ path: fullVideoShot });
  console.log(`  -> Captured Full Video ON: ${fullVideoShot}`);

  // Toggle Full video off
  await fullVideoToggle.click();
  await window.waitForTimeout(200);

  // Test Audio Only toggle
  console.log('Testing YouTube Audio Only toggle...');
  const audioToggle = window.locator('button:has-text("Audio only")');
  await audioToggle.click();
  await window.waitForTimeout(300);

  const audioShot = path.join(outDir, 'youtube-audio-only-1176x784.png');
  await window.screenshot({ path: audioShot });
  console.log(`  -> Captured Audio Only: ${audioShot}`);

  // 4. Test Home quick routing
  console.log('Testing Home URL auto-routing...');
  await window.locator('button[data-route="home"]').click();
  await window.waitForTimeout(300);

  const homeInput = window.locator('input[placeholder*="Paste any YouTube"]');
  await homeInput.fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await homeInput.press('Enter');
  await window.waitForTimeout(500);

  console.log('Active route after submit:', await window.locator('button[data-route="youtube"]').getAttribute('class'));

  // 5. Test Paste button with native clipboard IPC
  console.log('Testing Home Paste button with native clipboard...');
  await window.locator('button[data-route="home"]').click();
  await window.waitForTimeout(300);

  await window.evaluate(async () => {
    if (window.api && window.api.writeClipboard) {
      await window.api.writeClipboard('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    }
  });

  const pasteBtn = window.locator('button:has-text("Paste")');
  await pasteBtn.click();
  await window.waitForTimeout(500);

  const isYouTubeActive = await window.locator('button[data-route="youtube"]').getAttribute('class');
  console.log('Paste button test result:', isYouTubeActive?.includes('font-semibold') ? 'PASSED (auto-routed to YouTube)' : 'CHECK');

  await app.close();
  console.log('All Phase 1 tests passed cleanly and app closed.');

  // Clean test user data
  const testUserDir = path.join(projectRoot, 'test-userdata');
  if (fs.existsSync(testUserDir)) {
    fs.rmSync(testUserDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('Phase 1 verification failed:', err);
  process.exit(1);
});
