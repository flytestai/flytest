const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { installFixtures } = require('./verify-workspace-layout.cjs');

const baseUrl = process.env.UI_BASE_URL || 'http://127.0.0.1:5174';
const output = process.env.UI_OUTPUT_DIR || path.resolve(__dirname, '../playwright-screenshots/dashboard-insights');
const scenarios = [
  { name: 'desktop', width: 1440 },
  { name: 'tablet', width: 1024 },
  { name: 'mobile', width: 390 },
  { name: 'small-mobile', width: 320 },
  { name: 'empty', width: 1440, empty: true },
  { name: 'empty-mobile', width: 390, empty: true },
  { name: 'large-values', width: 1440, large: true },
  { name: 'large-values-mobile', width: 390, large: true },
  { name: 'dark', width: 1440, dark: true },
  { name: 'dark-mobile', width: 390, dark: true },
];

function statistics(empty, large) {
  const n = value => empty ? 0 : large ? value * 100000 : value;
  return {
    project: { id: 1, name: '飞测 · 产品质量中心' },
    testcases: { total: n(248), by_review_status: { approved: n(180), pending_review: n(36), needs_optimization: n(20), optimization_pending_review: n(8), unavailable: n(4) } },
    executions: { total_executions: n(64), by_status: {}, case_results: { total: n(200), passed: n(184), failed: n(12), skipped: n(4), error: 0 } },
    bugs: { total: n(28), open: n(8), high_severity: n(2), pending_retest: n(4), closed: n(16), by_status: { confirmed: n(3), assigned: n(5) } },
    ui_automation: { total_cases: n(48), total_executions: n(36), by_status: { success: n(32), failed: n(4) } },
    api_automation: { requests: n(120), test_cases: n(86), executions: n(240) },
    execution_trend: { summary_30d: { execution_count: n(64), passed: n(184), failed: n(12) }, daily_7d: Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-${24 + i}`, execution_count: n(i + 2), passed: n([12, 24, 18, 36, 28, 42, 24][i]), failed: n([2, 1, 4, 2, 0, 3, 0][i]) })) },
    mcp: { active: 2, total: 3 }, skills: { active: 8, total: 10 },
  };
}

function tokenStatistics(empty, large, period) {
  const n = value => empty ? 0 : large ? value * 100000 : value;
  return {
    total: { input_tokens: n(86400), output_tokens: n(41600), total_tokens: n(period === 'week' ? 256000 : period === 'month' ? 384000 : 128000), request_count: n(64), session_count: n(18) },
    by_user: empty ? [] : ['林晓', '周晨', large ? '非常长的测试团队成员姓名用于验证界面边界' : '陈可'].map((name, i) => ({ user_id: i + 1, username: name, real_name: name, total_tokens: n([64000, 42000, 22000][i]) })),
    by_time: [],
  };
}

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_CHANNEL ? { channel: process.env.UI_BROWSER_CHANNEL } : {}) });
  const report = [];
  try {
    for (const scenario of scenarios) {
      const context = await browser.newContext({ viewport: { width: scenario.width, height: 1000 }, reducedMotion: 'reduce' });
      await installFixtures(context);
      await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
      if (scenario.dark) await context.addInitScript(() => localStorage.setItem('flytest-theme-mode', 'black'));
      const requestedPeriods = [];
      await context.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        let data;
        if (url.pathname === '/api/projects/1/statistics/') data = statistics(scenario.empty, scenario.large);
        else if (url.pathname === '/api/lg/token-usage/') {
          const period = url.searchParams.get('group_by');
          requestedPeriods.push(period);
          data = tokenStatistics(scenario.empty, scenario.large, period);
        } else return route.fallback();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', code: 200, data }) });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const responses = [page.waitForResponse(r => r.url().includes('/api/projects/1/statistics/')), page.waitForResponse(r => r.url().includes('/api/lg/token-usage/'))];
      await page.goto(baseUrl + '/dashboard', { waitUntil: 'domcontentloaded' });
      await Promise.all(responses);
      await page.locator('.dashboard-insights').waitFor({ state: 'visible' });
      await page.waitForTimeout(200);
      assert.equal(await page.locator('.insights-block').count(), 7);
      assert.equal(await page.locator('.insights-automation-item').last().locator('strong').innerText(), '—');
      if (scenario.empty) await page.getByText('暂无执行趋势', { exact: true }).waitFor();
      else assert.equal(await page.locator('.insights-chart-stack').count(), 7);

      const geometry = await page.locator('.dashboard-insights').evaluate(root => {
        const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const visibleOverflow = [...root.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.right > innerWidth + 2 || r.left < -2); }).map(el => String(el.className));
        return { visibleOverflow, documentWidth: document.documentElement.scrollWidth, primary: [...root.querySelector('.insights-primary').children].map(rect), resources: [...root.querySelector('.insights-resources').children].map(rect), execution: [...root.querySelector('.insights-execution').children].map(rect), background: getComputedStyle(root.querySelector('.insights-block')).backgroundColor };
      });
      assert.deepEqual(geometry.visibleOverflow, [], `${scenario.name}: visible content must stay inside the viewport`);
      assert(geometry.documentWidth <= scenario.width);
      const overlappingChartLabels = await page.locator('.insights-chart-count').evaluateAll(items => {
        const boxes = items.map(el => el.getBoundingClientRect()).filter(rect => rect.width && rect.height);
        return boxes.some((rect, index) => boxes.slice(index + 1).some(next => rect.left < next.right && rect.right > next.left && rect.top < next.bottom && rect.bottom > next.top));
      });
      assert.equal(overlappingChartLabels, false, 'Trend value labels should not overlap');
      const splitNumbers = await page.locator('.insights-token-metrics dd').evaluateAll(items => items.slice(0, 2).filter(el => el.getBoundingClientRect().height > parseFloat(getComputedStyle(el).lineHeight) + 1).length);
      assert.equal(splitNumbers, 0, 'Token request and session counts must remain on one line');
      if (scenario.width < 680) {
        const alignedMetrics = await page.locator('.insights-token-metrics').evaluate(el => [...el.children].every(row => Math.abs(row.getBoundingClientRect().width - el.getBoundingClientRect().width) < 2));
        assert(alignedMetrics, 'Mobile Token metrics should use full-width rows');
      }
      if (scenario.width === 1440) {
        const heights = geometry.primary.map(rect => Math.round(rect.height));
        assert.equal(new Set(heights).size, 1, 'First row cards must align');
        assert.equal(Math.round(geometry.resources[0].y), Math.round(geometry.resources[1].y));
        assert(geometry.resources[1].width > geometry.resources[0].width * 1.8, 'Resource row should use the full width');
      }
      if (scenario.dark) {
        assert.notEqual(geometry.background, 'rgb(255, 255, 255)');
        assert.equal(await page.locator('.dashboard-insights').evaluate(el => getComputedStyle(el).getPropertyValue('--insight-danger-soft').trim()), '#3e2834');
      }
      if (['desktop', 'tablet', 'mobile', 'dark', 'empty', 'large-values', 'large-values-mobile'].includes(scenario.name)) {
        const blocks = scenario.width < 680 ? page.locator('.insights-block') : page.locator('.insights-row');
        for (let i = 0; i < await blocks.count(); i++) await blocks.nth(i).screenshot({ path: path.join(output, `${scenario.name}-${i + 1}.png`), animations: 'disabled' });
        await page.locator('.insights-intro').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `${scenario.name}-overview.png`), animations: 'disabled' });
      }
      if (scenario.name === 'desktop') {
        const weekResponse = page.waitForResponse(r => r.url().includes('/api/lg/token-usage/') && r.url().includes('group_by=week'));
        await page.getByRole('button', { name: '周', exact: true }).click();
        await weekResponse;
        await page.waitForFunction(() => document.querySelector('.insights-token-total > strong').textContent === '256,000');
        const monthResponse = page.waitForResponse(r => r.url().includes('/api/lg/token-usage/') && r.url().includes('group_by=month'));
        await page.getByRole('button', { name: '月', exact: true }).focus();
        await page.keyboard.press('Enter');
        await monthResponse;
        await page.waitForFunction(() => document.querySelector('.insights-token-total > strong').textContent === '384,000');
        assert.equal(await page.getByRole('button', { name: '月', exact: true }).getAttribute('aria-pressed'), 'true');
        assert(requestedPeriods.includes('week') && requestedPeriods.includes('month'));
      }
      assert.deepEqual(errors, [], `${scenario.name}: no page errors`);
      report.push({ scenario: scenario.name, width: scenario.width, passed: true, ...geometry });
      console.log(`PASS ${scenario.name} (${scenario.width}px)`);
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`${report.length}/${scenarios.length} dashboard insight scenarios passed`);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
