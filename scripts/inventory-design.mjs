import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const designDir = path.join(projectRoot, 'design');
const outDir = path.join(projectRoot, 'docs', 'design-inventory');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Recursive file inventory
function getFilesRecursively(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath));
    } else {
      const stat = fs.statSync(fullPath);
      files.push({
        relativePath: path.relative(projectRoot, fullPath),
        size: stat.size,
        name: entry.name
      });
    }
  }
  return files;
}

const allFiles = getFilesRecursively(designDir);
console.log(`Found ${allFiles.length} files in design/ directory.`);

// 2. Map HTML files to states and matching PNGs
const pairs = [
  {
    state: 'YouTube clip',
    htmlPath: 'design/YouCut — YouTube — clip-html/Main.dc.html',
    pngPath: 'design/YouCut — Redesign-png (1)/YouCut — YouTube — clip.png',
    outputBase: 'youtube-clip'
  },
  {
    state: 'YouTube Full video on',
    htmlPath: 'design/YouCut — YouTube — Full video on-html/YouTube-Full.dc.html',
    pngPath: 'design/YouCut — Redesign-png (1)/YouCut — YouTube — Full video on.png',
    outputBase: 'youtube-full'
  },
  {
    state: 'Instagram clip',
    htmlPath: 'design/YouCut — Instagram — clip-html/Instagram.dc.html',
    pngPath: 'design/YouCut — Redesign-png (1)/YouCut — Instagram — clip.png',
    outputBase: 'instagram-clip'
  },
  {
    state: 'Facebook clip',
    htmlPath: 'design/YouCut — Facebook — clip-html/Facebook.dc.html',
    pngPath: 'design/YouCut — Redesign-png (1)/YouCut — Facebook — clip.png',
    outputBase: 'facebook-clip'
  },
  {
    state: 'Facebook Full video on',
    htmlPath: 'design/YouCut — Facebook — Full video on-html/Facebook-Full.dc.html',
    pngPath: 'design/YouCut — Redesign-png (1)/YouCut — Facebook — Full video on.png',
    outputBase: 'facebook-full'
  }
];

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  // Viewport 1440x960 at deviceScaleFactor: 2 matches 2880x1920 reference PNG
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  const comparisonReport = [];

  for (const pair of pairs) {
    const fullHtmlPath = path.join(projectRoot, pair.htmlPath);
    const fileUrl = 'file:///' + fullHtmlPath.replace(/\\/g, '/');

    console.log(`\nProcessing State: "${pair.state}"`);
    console.log(`Opening: ${fileUrl}`);

    await page.goto(fileUrl, { waitUntil: 'networkidle' });
    // Wait for the dc-runtime to mount #dc-root
    await page.waitForSelector('#dc-root, x-dc', { timeout: 10000 });
    await page.waitForTimeout(1000); // Allow fonts and styles to settle

    const htmlScreenshotPath = path.join(outDir, `${pair.outputBase}-html.png`);
    await page.screenshot({ path: htmlScreenshotPath });
    console.log(`Captured HTML screenshot: ${htmlScreenshotPath}`);

    const originalPngPath = path.join(projectRoot, pair.pngPath);
    const origStat = fs.statSync(originalPngPath);
    const htmlStat = fs.statSync(htmlScreenshotPath);

    comparisonReport.push({
      state: pair.state,
      htmlFile: pair.htmlPath,
      pngFile: pair.pngPath,
      htmlScreenshot: path.relative(projectRoot, htmlScreenshotPath),
      pngSize: origStat.size,
      htmlScreenshotSize: htmlStat.size
    });
  }

  await browser.close();

  // Save report markdown
  let md = `# Design Inventory and Comparison Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## File Inventory (${allFiles.length} files)\n\n`;
  md += `| File Path | Size (Bytes) |\n| :--- | :--- |\n`;
  for (const f of allFiles) {
    md += `| \`${f.relativePath}\` | ${f.size.toLocaleString()} |\n`;
  }

  md += `\n## HTML State Mapping and Verification\n\n`;
  md += `| Screen State | HTML Source | Reference PNG | HTML Screenshot |\n| :--- | :--- | :--- | :--- |\n`;
  for (const c of comparisonReport) {
    md += `| **${c.state}** | \`${c.htmlFile}\` | \`${c.pngFile}\` | \`${c.htmlScreenshot}\` |\n`;
  }

  const reportPath = path.join(projectRoot, 'docs', 'DESIGN-INVENTORY.md');
  fs.writeFileSync(reportPath, md, 'utf-8');
  console.log(`\nInventory report written to ${reportPath}`);
}

run().catch(err => {
  console.error('Inventory failed:', err);
  process.exit(1);
});
