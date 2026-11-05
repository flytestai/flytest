const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installFixtures } = require('./verify-workspace-layout.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5175';
const output = process.env.UI_OUTPUT_DIR || path.resolve(__dirname, '../playwright-screenshots/requirements-reference');

async function fixtures(context) {
  await installFixtures(context);
  const state = { empty: true, fail: false, uploadFail: false, requests: [], uploads: [] };
  const documents = ['uploaded', 'ready_for_review', 'reviewing', 'review_completed', 'failed'].map((status, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index + 1}`, project: '1', title: ['支付需求说明', '订单退款规则', '用户认证需求', '交易对账需求', '营销活动需求'][index], description: '业务需求说明', status, document_type: index % 2 ? 'md' : 'pdf', uploader: index % 2 ? 2 : 1, uploader_name: index % 2 ? '李明' : '陈晨', modules_count: 4, word_count: 2360, uploaded_at: '2026-11-02T08:00:00Z', reviewed: index > 1,
  }));
  await context.route('**/api/projects/1/members/**', route => route.fulfill({ json: { status: 'success', code: 200, data: [{ user: 1, user_detail: { username: '陈晨' } }, { user: 2, user_detail: { username: '李明' } }] } }));
  await context.route(/\/api\/requirements\/documents\/(?:\?.*)?$/, async route => {
    const request = route.request(), url = new URL(request.url()), params = url.searchParams;
    state.requests.push(Object.fromEntries(params));
    if (request.method() === 'POST') {
      state.uploads.push(request.postData());
      if (state.uploadFail) return route.fulfill({ status: 400, json: { status: 'error', message: 'Fixture upload rejected' } });
      return route.fulfill({ json: { status: 'success', code: 201, data: documents[0] } });
    }
    if (state.fail && params.get('page_size') !== '1') return route.fulfill({ status: 500, json: { status: 'error', message: 'Fixture unavailable' } });
    let filtered = state.empty ? [] : [...documents];
    if (params.get('has_review') === 'true') filtered = filtered.filter(document => document.reviewed);
    if (params.get('status')) filtered = filtered.filter(document => document.status === params.get('status'));
    if (params.get('document_type')) filtered = filtered.filter(document => document.document_type === params.get('document_type'));
    if (params.get('uploader')) filtered = filtered.filter(document => String(document.uploader) === params.get('uploader'));
    if (params.get('search')) filtered = filtered.filter(document => document.title.includes(params.get('search')));
    return route.fulfill({ json: { status: 'success', code: 200, data: { count: filtered.length, results: filtered.slice(0, Number(params.get('page_size') || 10)) } } });
  });
  return state;
}

async function bounds(page) {
  const overflow = await page.locator('.requirement-management button,.requirement-management input,.requirement-management .arco-select-view').evaluateAll(nodes => nodes.filter(node => {
    if (node.closest('.arco-table')) return false;
    const rect = node.getBoundingClientRect();
    return rect.width && rect.height && (rect.left < -1 || rect.right > innerWidth + 1);
  }).map(node => node.outerHTML.slice(0, 100)));
  assert.deepEqual(overflow, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge' });
  const report = [];
  try {
    for (const width of (process.env.UI_WIDTHS || '1440,1024,390,320').split(',').map(Number)) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const state = await fixtures(context), page = await context.newPage(), errors = [];
      page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/requirements');
      await page.getByRole('heading', { name: '暂无需求文档', exact: true }).waitFor();
      await page.locator('.requirement-overview[aria-busy=false]').waitFor();
      assert.deepEqual(await page.locator('.requirement-metric strong').allTextContents(), ['0', '0', '0', '0']);
      await bounds(page); await page.mouse.move(0, 0);
      await page.screenshot({ path: path.join(output, `empty-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: '立即上传', exact: true }).click();
      const upload = page.locator('.arco-modal:visible'); await upload.getByRole('button', { name: '确定', exact: true }).click();
      await upload.getByText('请输入文档标题', { exact: true }).waitFor();
      await upload.getByRole('button', { name: '取消', exact: true }).click();
      report.push({ width, check: 'reference layout, honest empty metrics, upload validation and responsive bounds', passed: true });

      state.empty = false; await page.getByRole('button', { name: '重置', exact: true }).click();
      await page.getByRole('button', { name: /订单退款规则/ }).waitFor();
      await page.reload(); await page.locator('.requirement-overview[aria-busy=false]').waitFor();
      assert.deepEqual(await page.locator('.requirement-metric strong').allTextContents(), ['5', '3', '1', '1']);
      await bounds(page); await page.mouse.move(0, 0);
      await page.screenshot({ path: path.join(output, `populated-${width}.png`), fullPage: true });
      await page.getByRole('tab', { name: '评审记录', exact: true }).click();
      await page.getByRole('button', { name: /用户认证需求/ }).waitFor();
      assert(state.requests.some(params => params.has_review === 'true'));
      await page.getByRole('tab', { name: '分析报告', exact: true }).click();
      await page.getByRole('button', { name: /交易对账需求/ }).waitFor();
      await page.waitForFunction(() => document.querySelectorAll('.requirement-document-title').length === 1);
      assert.equal(await page.locator('.requirement-document-title').count(), 1);
      await page.getByRole('tab', { name: '分析报告', exact: true }).focus(); await page.keyboard.press('Home');
      await page.getByRole('tab', { name: '需求文档', exact: true }).waitFor();
      assert.equal(await page.getByRole('tab', { name: '需求文档', exact: true }).getAttribute('aria-selected'), 'true');
      await page.getByRole('button', { name: /订单退款规则/ }).waitFor();
      await page.getByRole('textbox', { name: '搜索需求文档', exact: true }).fill('不存在');
      await page.getByRole('textbox', { name: '搜索需求文档', exact: true }).press('Enter');
      await page.getByRole('heading', { name: '没有找到匹配的文档', exact: true }).waitFor();
      assert.deepEqual(await page.locator('.requirement-metric strong').allTextContents(), ['5', '3', '1', '1']);
      await page.getByRole('button', { name: '重置筛选', exact: true }).click();
      await page.getByRole('button', { name: /订单退款规则/ }).waitFor();
      await page.getByRole('button', { name: '新建评审', exact: true }).click();
      const picker = page.locator('.arco-modal:visible');
      await picker.locator('.arco-select-view').click();
      await page.locator('.arco-select-option:visible').getByText('订单退款规则', { exact: true }).click();
      await picker.getByRole('button', { name: '确定', exact: true }).click();
      await page.locator('.arco-modal:visible').getByText('评审配置', { exact: true }).waitFor();
      await page.locator('.arco-modal:visible').getByRole('button', { name: '取消', exact: true }).click();
      report.push({ width, check: 'project metrics, review/report tabs, keyboard navigation, filtering, reset and new review configuration', passed: true });

      state.fail = true; await page.getByRole('button', { name: '重置', exact: true }).click();
      await page.getByRole('heading', { name: '暂时无法加载需求文档', exact: true }).waitFor();
      state.fail = false; await page.locator('.requirement-list-error').getByRole('button', { name: '重新加载', exact: true }).click();
      await page.getByRole('button', { name: /订单退款规则/ }).waitFor();
      assert.deepEqual(errors, []); await bounds(page);
      report.push({ width, check: 'list error recovery and no browser errors', passed: true });
      if (width === 1440) {
        await page.locator('.filter-select').nth(0).click();
        await page.locator('.arco-select-option:visible').getByText('待评审', { exact: true }).click();
        await page.getByRole('button', { name: /订单退款规则/ }).waitFor();
        await page.waitForFunction(() => document.querySelectorAll('.requirement-document-title').length === 1);
        assert.equal(await page.locator('.requirement-document-title').count(), 1);
        await page.locator('.filter-select').nth(1).click();
        await page.locator('.arco-select-option:visible').getByText('Markdown', { exact: true }).click();
        await page.locator('.filter-select').nth(2).click();
        await page.locator('.arco-select-option:visible').getByText('陈晨', { exact: true }).click();
        await page.getByRole('heading', { name: '没有找到匹配的文档', exact: true }).waitFor();
        assert(state.requests.some(params => params.status === 'ready_for_review' && params.document_type === 'md' && params.uploader === '1'));
        await page.getByRole('button', { name: '重置筛选', exact: true }).click();
        await page.locator('.requirement-hero').getByRole('button', { name: '上传需求文档', exact: true }).click();
        const dialog = page.locator('.arco-modal:visible');
        await dialog.getByPlaceholder('请输入文档标题', { exact: true }).fill('Layout validation PRD');
        await dialog.getByText('直接输入', { exact: true }).click();
        await dialog.getByPlaceholder('请输入或粘贴文档内容').fill('Requirement validation content');
        state.uploadFail = true;
        await dialog.getByRole('button', { name: '确定', exact: true }).click();
        await page.locator('.arco-message-error').filter({ hasText: 'Fixture upload rejected' }).waitFor();
        assert.equal(await dialog.getByPlaceholder('请输入文档标题', { exact: true }).inputValue(), 'Layout validation PRD');
        state.uploadFail = false;
        await dialog.getByRole('button', { name: '确定', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        assert(state.uploads.length >= 2);
        assert(state.uploads.at(-1).includes('Layout validation PRD') && state.uploads.at(-1).includes('Requirement validation content'));
        report.push({ width, check: 'combined status/type/uploader filters and content upload failure preservation/success', passed: true });
      }
      await context.close(); console.log(`PASS requirements ${width}px`);
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`${report.length}/${report.length} requirements layout and interaction checks passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
