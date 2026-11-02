const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installFixtures } = require('./verify-workspace-layout.cjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = process.env.UI_OUTPUT_DIR || path.resolve(__dirname, '../playwright-screenshots/density');
const routes = ['/api-automation?tab=environments', '/api-automation', '/testcases', '/test-bugs', '/dashboard'];
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const report = [];
  try {
    for (const width of (process.env.UI_WIDTHS || '1440,1024,390,320').split(',').map(Number)) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await installFixtures(context);
      if (process.env.UI_POPULATED) await context.route(/\/api\/api-automation\/environments\/(?:\?.*)?$/, route => route.fulfill({ json: { success: true, status: 'success', data: Array.from({ length: 30 }, (_, index) => ({ id: index + 1, name: `回归环境 ${index + 1}`, base_url: 'https://example.test', is_default: index === 0, timeout_ms: 30000, updated_at: '2026-10-31T08:00:00Z' })) } }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const route of routes) {
        errors.length = 0;
        await page.goto((process.env.UI_BASE_URL || 'http://127.0.0.1:5175') + route, { waitUntil: 'domcontentloaded' });
        await page.locator(route === '/dashboard' ? '.kpi-card' : '.fc-workspace-topbar .fc-page-heading__title:visible').first().waitFor();
        if (route.includes('environments')) await page.locator('.arco-table').waitFor();
        await page.waitForTimeout(650);
        const metrics = await page.evaluate(() => {
          const visible = node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
          const box = selector => { const node = [...document.querySelectorAll(selector)].find(visible); if (!node) return null; const r = node.getBoundingClientRect(); return { top: Math.round(r.top), height: Math.round(r.height) }; };
          const overflow = [...document.querySelectorAll('.content button,.content input,.content .arco-select-view')].filter(visible).filter(node => !node.closest('.arco-table')).filter(node => {const r=node.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1}).map(node => node.outerHTML.slice(0, 120));
          const visibleRows = [...document.querySelectorAll('.arco-table tbody tr:not(.arco-table-tr-empty)')].filter(node => { const r = node.getBoundingClientRect(); return r.height > 0 && r.bottom <= innerHeight; }).length;
          return { table: box('.arco-table'), heading: box('.fc-workspace-heading'), context: box('.fc-workspace-context'), kpi: box('.kpi-card'), visibleRows, docWidth: document.documentElement.scrollWidth, overflow };
        });
        report.push({ width, route, ...metrics });
        await page.screenshot({ path: path.join(output, `${route.replace(/[^a-z0-9]/gi, '-')}-${width}.png`) });
        assert.deepEqual(errors, [], `${route}: script errors`);
        assert(metrics.docWidth <= width && !metrics.overflow.length, `${route}: clipped controls at ${width}`);
        if (width === 1440 && route === '/testcases') assert(metrics.table?.top <= 190, 'Case list must begin within the first 190px');
        if (route === '/api-automation') {
          await page.getByRole('button', { name: '执行测试', exact: true }).click();
          for (const label of ['执行选中', '执行当前集合', '执行当前项目']) assert.equal(await page.locator('.arco-dropdown-option:visible').filter({ hasText: label }).count(), 1, `Execution scope ${label} remains available`);
          await page.locator('.fc-page-heading__title:visible').click();
        }
        if (route === '/testcases') {
          const trigger = page.getByRole('button', { name: /^筛选/ });
          await trigger.click();
          await page.locator('.fc-filter-popover:visible .level-filter').click();
          await page.locator('.arco-select-option:visible').filter({ hasText: 'P1' }).click();
          await page.locator('.fc-page-heading__title:visible').click();
          await page.locator('.fc-filter-popover:visible').waitFor({ state: 'hidden' });
          assert.equal(await trigger.locator('.fc-filter-count').innerText(), '1', 'Active filters remain discoverable');
          await trigger.click();
          assert.match(await page.locator('.fc-filter-popover:visible .level-filter').innerText(), /P1/, 'Filter survives closing the panel');
          await page.screenshot({ path: path.join(output, `filters-${width}.png`) });
          await page.locator('.fc-page-heading__title:visible').click();
          await page.getByRole('button', { name: '导入 / 导出', exact: true }).click();
          assert(await page.locator('.arco-dropdown-option:visible').filter({ hasText: '导入用例' }).isVisible());
          assert(await page.locator('.arco-dropdown-option:visible').filter({ hasText: '导出用例' }).isVisible());
        }
      }
      await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.some(item => item.docWidth > item.width || item.overflow.length)) process.exitCode = 1;
})();
