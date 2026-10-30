// Export compatibility PNGs from the same editable FeiCe SVG sources.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const publicDir = path.resolve(__dirname, '../public');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_CHANNEL ? { channel: process.env.UI_BROWSER_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 600 }, reducedMotion: 'reduce' });
    const assets = [
      ['feice-mark.svg', 'logo.png', 256, 256],
      ['feice-mark.svg', 'favicon.png', 64, 64],
      ['feice-mark.svg', 'app-icon.png', 512, 512],
      ['feice-mark.svg', 'FlyTest.png', 256, 256],
      ['feice-logo.svg', 'full-logo.png', 1200, 256],
      ['feice-logo.svg', 'wordmark.png', 1200, 256],
      ['feice-logo-light.svg', 'full-logo-login-white.png', 1200, 256],
    ];
    for (const [source, destination, width, height] of assets) {
      const svg = fs.readFileSync(path.join(publicDir, source), 'utf8').replace(/width="\d+" height="\d+"/, `width="${width}" height="${height}"`);
      await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
      await page.locator('svg').screenshot({ path: path.join(publicDir, destination), omitBackground: true });
      console.log(`Exported ${destination}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
