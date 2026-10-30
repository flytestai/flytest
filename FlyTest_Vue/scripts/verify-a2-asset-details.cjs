const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installFixtures } = require('./verify-workspace-layout.cjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5175';
const output = process.env.UI_OUTPUT_DIR || path.resolve(__dirname, '../playwright-screenshots/a2-asset-details');
const caseData = {
  id: 248, name: '支付结果一致性与重复回调验证', level: 'P0', test_type: 'functional', review_status: 'approved',
  execution_status: 'passed', precondition: '用户已登录，订单处于待支付状态。', notes: '包含重复通知与超时回调场景。',
  module_id: 1, module_detail: '支付回调', creator: 1, creator_detail: { id: 1, username: 'review', real_name: '测试管理员' },
  steps: [{ id: 1, step_number: 1, description: '提交支付并发送重复回调。', expected_result: '订单仅更新一次，交易流水一致。' }],
  screenshots: [], created_at: '2026-10-30T08:00:00Z', updated_at: '2026-10-30T08:00:00Z',
};
const analysis = { score: 92, overall_score: 92, summary: '支付流程具备主要信息，需要进一步补充异常场景。', strengths: ['输入输出清晰'], recommendations: ['补充回调超时场景'], issues: [] };
const report = {
  id: 'report-2', document: '1', document_title: '支付业务需求', review_date: '2026-10-30T08:00:00Z', reviewer: '测试管理员',
  status: 'completed', overall_rating: 'good', overall_rating_display: '良好', completion_score: 92, overall_score: 92,
  total_issues: 0, high_priority_issues: 0, medium_priority_issues: 0, low_priority_issues: 0,
  summary: analysis.summary, recommendations: '补充回调超时场景', issues: [], module_results: [],
  scores: Object.fromEntries(['completeness','consistency','testability','feasibility','clarity','logic'].map(key => [key, 92])),
  specialized_analyses: Object.fromEntries(['completeness','consistency','testability','feasibility','clarity','logic'].map(key => [key + '_analysis', analysis])),
};
const document = {
  id: '1', title: '支付业务需求', description: '订单支付与回调处理', document_type: 'md', content: '# 支付流程\n\n验证订单状态和重复回调。',
  status: 'review_completed', version: '1.0', is_latest: true, uploader: 1, uploader_name: '测试管理员', project: '1',
  project_name: '产品质量中心', uploaded_at: '2026-10-30T08:00:00Z', updated_at: '2026-10-30T08:00:00Z',
  word_count: 100, page_count: 1, modules_count: 1, has_images: false, image_count: 0,
  modules: [{ id: 'module-1', title: '订单支付', content: '提交订单后完成支付，重复通知应保持幂等。', order: 1, level: 1, parent_module: null }],
  review_reports: [report, { ...report, id: 'report-1', review_date: '2026-10-29T08:00:00Z' }], latest_review: report,
};
async function checkPage(page, label) {
  const overflow = await page.evaluate(() => {
    const root = document.querySelector('.content');
    return [...root.querySelectorAll('input,textarea,button,h1,h2')].filter(el => {
      if (el.closest('.arco-table,.arco-tabs-content-item:not(.arco-tabs-content-item-active)')) return false;
      const r = el.getBoundingClientRect(); return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1);
    }).map(el => ({ cls: el.className, text: el.textContent.slice(0, 40) }));
  });
  assert.deepEqual(overflow, [], label + ' visible controls fit');
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_CHANNEL ? { channel: process.env.UI_BROWSER_CHANNEL } : {}) });
  const results = [];
  try {
    for (const width of [1440, 1024, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await installFixtures(context);
      const fulfill = (route, data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'success', success: true, code: 200, data }) });
      await context.route(/\/api\/projects\/1\/testcases\/(?:\?.*)?$/, route => fulfill(route, [caseData]));
      await context.route(/\/api\/projects\/1\/testcases\/248\/(?:\?.*)?$/, route => fulfill(route, caseData));
      await context.route(/\/api\/requirements\/documents\/1\/(?:\?.*)?$/, route => fulfill(route, document));
      const page = await context.newPage();
      let errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const url of ['/requirements/1', '/requirements/1/report']) {
        errors = [];
        await page.goto(base + url);
        await page.locator('.fc-page-heading__title').getByText('支付业务需求', { exact: true }).waitFor();
        await page.waitForTimeout(300);
        await checkPage(page, url);
        assert.deepEqual(errors, [], url + ' runtime');
        assert(await page.getByRole('button', { name: '返回列表', exact: true }).isVisible(), 'Back navigation is preserved');
        await page.screenshot({ path: path.join(output, `requirement${url.endsWith('report') ? '-report' : ''}-${width}.png`) });
        results.push({ url, width, passed: true });
      }
      errors = [];
      await page.goto(base + '/testcases');
      await page.getByRole('button', { name: '查看', exact: true }).first().click();
      await page.getByRole('heading', { name: '测试用例详情', exact: true }).waitFor();
      await page.locator('.precondition-content').getByText(caseData.precondition, { exact: true }).waitFor();
      await checkPage(page, 'case detail');
      assert.deepEqual(errors, [], 'case detail runtime');
      await page.screenshot({ path: path.join(output, `case-detail-${width}.png`) });
      results.push({ view: 'case-detail', width, passed: true });
      await page.getByRole('button', { name: '编辑', exact: true }).click();
      await page.getByRole('heading', { name: '编辑测试用例', exact: true }).waitFor();
      await checkPage(page, 'case editor');
      assert.deepEqual(errors, [], 'case editor runtime');
      await page.screenshot({ path: path.join(output, `case-editor-${width}.png`) });
      await page.getByRole('button', { name: '取消', exact: true }).click();
      await page.getByRole('button', { name: '查看', exact: true }).first().waitFor();
      results.push({ view: 'case-editor', width, passed: true });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(results, null, 2));
    console.log(`${results.length} populated requirement, report, testcase detail and editor checks passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
