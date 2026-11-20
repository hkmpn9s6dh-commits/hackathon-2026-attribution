// Rasterise the SVG figures to PNG at 3x so the PDF cannot split them across pages.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const FIGS = ['fig1_testbed', 'fig2_confusion', 'fig3_channels', 'fig4_ladder', 'fig5_curve'];
const exe = process.env.CHROME_PATH || 'C:/Users/张一/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
mkdirSync('out/figures', { recursive: true });

const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined });
const page = await browser.newPage({ deviceScaleFactor: 3 });
for (const name of FIGS) {
  const svg = readFileSync(`out/figures/${name}.svg`, 'utf8');
  const w = Number(svg.match(/width="(\d+)"/)[1]);
  const h = Number(svg.match(/height="(\d+)"/)[1]);
  await page.setViewportSize({ width: w, height: h });
  const b64 = Buffer.from(svg, 'utf8').toString('base64');
  await page.setContent(`<body style="margin:0;background:#fff"><img id="f" src="data:image/svg+xml;base64,${b64}" width="${w}" height="${h}" style="display:block"></body>`);
  await page.waitForFunction(() => {
    const el = document.getElementById('f');
    return el && el.complete && el.naturalWidth > 0;
  });
  const el = await page.$('#f');
  await el.screenshot({ path: `out/figures/${name}.png` });
  const size = readFileSync(`out/figures/${name}.png`).length;
  console.log(`${name}.png ${w}x${h} (${(size / 1024).toFixed(0)} KB)`);
}
await browser.close();
