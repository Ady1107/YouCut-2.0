import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'docs', 'screenshots');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  console.log('Launching Electron app with Playwright...');
  const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  console.log('Using Electron at:', electronPath);

  // Prepare environment: remove ELECTRON_RUN_AS_NODE so Electron runs as GUI app
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  cleanEnv.PLAYWRIGHT_TEST = '1';
  cleanEnv.NODE_ENV = 'test';
  cleanEnv.YOUCUT_HOME = path.resolve(projectRoot, 'test-userdata');

  const app = await electron.launch({
    executablePath: electronPath,
    args: ['--no-sandbox', path.join(projectRoot, 'out', 'main', 'index.js')],
    env: cleanEnv
  });

  const window = await app.firstWindow();
  console.log('App window opened. Title:', await window.title());

  // Set window size to 1176x784 (exact app logical size)
  await window.setViewportSize({ width: 1176, height: 784 });
  await window.waitForTimeout(2000); // Allow fonts to load and style guide to render

  const screenshotPath1176 = path.join(outDir, 'p0-styleguide-1176x784.png');
  await window.screenshot({ path: screenshotPath1176, fullPage: false });
  console.log(`Saved screenshot at 1176x784: ${screenshotPath1176}`);

  // Also take full page screenshot to show full component library
  const fullPagePath = path.join(outDir, 'p0-styleguide-fullpage.png');
  await window.screenshot({ path: fullPagePath, fullPage: true });
  console.log(`Saved full page screenshot: ${fullPagePath}`);

  // Test 1440x960
  await window.setViewportSize({ width: 1440, height: 960 });
  await window.waitForTimeout(500);
  const screenshotPath1440 = path.join(outDir, 'p0-styleguide-1440x960.png');
  await window.screenshot({ path: screenshotPath1440 });
  console.log(`Saved screenshot at 1440x960: ${screenshotPath1440}`);

  await app.close();
  console.log('Electron closed cleanly.');

  // Clean test user data
  const testUserDir = path.join(projectRoot, 'test-userdata');
  if (fs.existsSync(testUserDir)) {
    fs.rmSync(testUserDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('Playwright screenshot failed:', err);
  process.exit(1);
});
