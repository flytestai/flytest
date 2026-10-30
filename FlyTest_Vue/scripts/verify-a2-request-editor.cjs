const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installFixtures } = require('./verify-workspace-layout.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5175';
const output = process.env.UI_OUTPUT_DIR || path.resolve(__dirname, '../playwright-screenshots/a2-request-editor');
const tabs = ['Headers','Query','Cookies','Auth','Body','Files','Assertions','Extractors','Transport'];
const additions = { Headers: '新增 Header', Query: '新增 Query', Cookies: '新增 Cookie', Assertions: '新增断言', Extractors: '新增提取规则' };
async function selectTab(modal, name) {
  const tab = modal.locator('.arco-tabs-tab').filter({ hasText: new RegExp('^' + name + '$') });
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  await tab.page().waitForTimeout(200);
}
async function bounds(modal, label) {
  const clipped = await modal.evaluate(root => [...root.querySelectorAll('.arco-input-wrapper,.arco-textarea-wrapper,.arco-select-view,.arco-btn')].filter(el => {
    if (el.closest('.arco-tabs-content-item:not(.arco-tabs-content-item-active)')) return false;
    if (getComputedStyle(el).visibility === 'hidden' || el.closest('[aria-hidden="true"]')) return false;
    const r = el.getBoundingClientRect(), panel = root.getBoundingClientRect();
    return r.width && r.height && (r.left < Math.max(0, panel.left) - 1 || r.right > Math.min(innerWidth, panel.right) + 1);
  }).map(el => { const r = el.getBoundingClientRect(); return { cls: el.className, text: el.textContent.slice(0, 40), left: r.left, right: r.right, width: r.width }; }));
  if (clipped.length) await modal.screenshot({ path: path.join(output, 'failure-' + label.replace(/[^a-z0-9]/gi, '-') + '.png') });
  assert.deepEqual(clipped, [], label + ' form bounds');
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_CHANNEL ? { channel: process.env.UI_BROWSER_CHANNEL } : {}) });
  const results = [];
  try {
    for (const width of [1440, 1024, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await installFixtures(context);
      await context.route(/\/api\/api-automation\/collections\/(?:tree\/)?(?:\?.*)?$/, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'success', data: [{ id: 1, project: 1, name: '支付接口目录', parent: null, order: 0, children: [] }] }) }));
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      let errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/api-automation');
      await page.getByText('支付接口目录', { exact: true }).click();
      await page.getByRole('button', { name: '新增接口', exact: true }).click();
      const modal = page.locator('.arco-modal:visible').last();
      await modal.waitFor();
      for (const tab of tabs) {
        await selectTab(modal, tab);
        if (additions[tab]) {
          const add = modal.getByRole('button', { name: additions[tab], exact: true });
          if (await add.count()) await add.click();
        }
        await bounds(modal, tab + ' ' + width);
        assert.deepEqual(errors, [], tab + ' runtime');
        await modal.screenshot({ path: path.join(output, `${tab.toLowerCase()}-${width}.png`) });
        results.push({ tab, width, passed: true });
      }
      await selectTab(modal, 'Body');
      for (const mode of ['json','form-data','urlencoded','multipart','raw','xml','graphql','binary/base64']) {
        const field = modal.locator('.arco-form-item').filter({ hasText: /^Body 类型/ });
        await field.locator('.arco-select-view').click();
        await page.locator('.arco-select-dropdown:visible').getByText(mode, { exact: true }).click();
        await page.waitForTimeout(100);
        await bounds(modal, mode + ' ' + width);
        assert.deepEqual(errors, [], mode + ' runtime');
        results.push({ bodyMode: mode, width, passed: true });
      }
      await modal.locator('.arco-modal-close-btn').click();
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(results, null, 2));
    console.log(`${results.length} request editor tab and body-mode checks passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
