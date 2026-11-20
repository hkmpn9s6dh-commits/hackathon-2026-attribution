// Screenshots for review: each A4-ish page of report.html, plus the standalone figures.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const exe = process.env.CHROME_PATH || 'C:/Users/张一/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
mkdirSync('out/shots', { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined });
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1.6 });

await page.goto('file://' + encodeURI(process.cwd().replace(/\\/g, '/')) + '/out/report.html');
await page.waitForTimeout(300);
const height = await page.evaluate(() => document.body.scrollHeight);
const pages = Math.ceil(height / 1123);
for (let i = 0; i < pages; i++) {
  await page.evaluate((y) => window.scrollTo(0, y), i * 1123);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `out/shots/page-${i + 1}.png` });
}
console.log(`report: ${pages} page shots, height ${height}`);

const figPage = await browser.newPage({ viewport: { width: 700, height: 400 }, deviceScaleFactor: 2 });
for (const f of ['fig1_testbed', 'fig2_confusion', 'fig3_channels', 'fig4_ladder', 'fig5_curve']) {
  await figPage.goto('file://' + encodeURI(process.cwd().replace(/\\/g, '/')) + `/out/figures/${f}.svg`);
  await figPage.screenshot({ path: `out/shots/${f}.png`, fullPage: true });
}
console.log('figures shot');

await browser.close();
