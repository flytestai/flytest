const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installFixtures } = require('./verify-workspace-layout.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5175';
const output = path.resolve(__dirname, '../playwright-screenshots/app-devices-reference');
async function fixtures(context) {
  await installFixtures(context);
  const now = new Date().toISOString();
  const state = { empty: false, error: false, writes: [], records: Array.from({ length: 24 }, (_, i) => ({
    id: i + 1, device_id: 'SERIAL-' + (i + 1), name: i === 2 ? 'iOS-001' : `Android-${String(i + 1).padStart(3, '0')}`,
    status: i < 18 ? 'available' : i < 21 ? 'locked' : i < 23 ? 'offline' : 'unauthorized',
    android_version: i === 2 ? '' : '14', connection_type: i % 2 ? 'usb' : 'emulator',
    last_seen_at: now, updated_at: now, locked_by: '', can_unlock: i >= 18 && i < 21, can_delete: true,
    device_specs: { platform: i === 2 ? 'iOS' : 'Android', os_version: i === 2 ? '17.6' : '14', model: i === 2 ? 'iPhone 15' : 'Pixel 8', is_emulator: i % 2 === 0, ...(i === 0 ? {} : { usage_percent: 32 }) },
  })) };
  const fulfill = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status === 200, status: status === 200 ? 'success' : 'error', code: status, data, message: status === 200 ? '' : '设备正被占用' }) });
  await context.route('**/api/app-automation/**', async route => {
    const url = new URL(route.request().url()), method = route.request().method();
    if (url.pathname.endsWith('/devices/')) return fulfill(route, state.empty ? [] : state.records, state.error ? 503 : 200);
    if (url.pathname.endsWith('/devices/connect/')) return fulfill(route, null, 503);
    const lock = url.pathname.match(/devices\/(\d+)\/(lock|unlock)\//);
    if (lock) { state.writes.push({ id: +lock[1], action: lock[2] }); if (+lock[1] === 2) return fulfill(route, null, 409); const record = state.records.find(item => item.id === +lock[1]); record.status = lock[2] === 'lock' ? 'locked' : 'available'; return fulfill(route, record); }
    if (method === 'PATCH' && /devices\/\d+\//.test(url.pathname)) { const record = state.records.find(item => item.id === +url.pathname.match(/devices\/(\d+)/)[1]); Object.assign(record, route.request().postDataJSON()); return fulfill(route, record); }
    if (url.pathname.endsWith('/test-cases/')) return fulfill(route, [{ id: 41, project_id: 1, name: '登录流程验证', description: '验证设备预选', ui_flow: { steps: [] }, variables: [], tags: [], last_result: '', updated_at: now, created_at: now }]);
    return fulfill(route, []);
  });
  return state;
}
async function select(page, label, text) { await page.getByLabel(label, { exact: true }).click(); await page.locator('.arco-select-option').filter({ hasText: new RegExp('^' + text + '$') }).click(); }
async function run() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' }), report = [];
  try {
    for (const width of (process.env.UI_WIDTHS || '1672,1280,768,390,320').split(',').map(Number)) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const state = await fixtures(context), page = await context.newPage(), errors = []; page.setDefaultTimeout(60000); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/app-automation?tab=devices', { waitUntil: 'domcontentloaded' });
      await page.locator('.device-metric').filter({ hasText: '设备总数' }).getByText('24', { exact: true }).waitFor();
      assert.equal(await page.locator('.device-metric').count(), 5); assert.equal(await page.locator('.device-rate strong').innerText(), '75.0%');
      assert.equal(await page.locator('.device-reference-table tbody .device-name').count(), 10);
      assert(await page.getByLabel('使用率未上报', { exact: true }).count());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'document overflow at ' + width);
      const overflow = await page.locator('.device-metric,.device-rate,.device-toolbar-actions,.device-filters').evaluateAll(nodes => nodes.filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1) }).map(el => el.className)); assert.deepEqual(overflow, []);
      await page.screenshot({ path: path.join(output, `devices-${width}.png`), fullPage: true }); report.push({ width, check: 'metrics, table, metadata and responsive containment', passed: true });
      if (width === 1672) {
        await page.locator('.device-reference-table .arco-pagination-item').filter({ hasText: /^2$/ }).click(); await page.getByRole('button', { name: 'Android-011', exact: true }).waitFor(); assert.equal(await page.locator('.device-reference-table tbody .device-name').count(), 10); await page.locator('.device-reference-table .arco-pagination-item').filter({ hasText: /^1$/ }).click(); report.push({ check: 'pagination uses actual filtered inventory', passed: true });
        await page.getByRole('button', { name: '启动测试 Android-004', exact: true }).click(); await page.waitForURL('**/app-automation?tab=test-cases&deviceId=4', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '执行', exact: true }).click(); await page.locator('.arco-modal:visible').getByText('Android-004', { exact: true }).waitFor(); await page.locator('.arco-modal:visible').getByRole('button', { name: '取消', exact: true }).click(); report.push({ check: 'start test preserves selected device in case execution dialog', passed: true });
        await page.goto(base + '/app-automation?tab=devices', { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '启动测试 Android-004', exact: true }).waitFor();
        await select(page, '设备平台', 'iOS'); assert.equal(await page.locator('.device-reference-table tbody .device-name').count(), 1); assert.equal(await page.locator('.device-rate strong').innerText(), '75.0%'); assert(await page.getByRole('button', { name: '启动测试 iOS-001', exact: true }).isDisabled());
        await page.getByRole('button', { name: '重置筛选', exact: true }).click();
        await page.getByLabel('搜索设备', { exact: true }).fill('SERIAL-24'); await page.getByText('Android-024', { exact: true }).waitFor(); assert.equal(await page.locator('.device-reference-table tbody .device-name').count(), 1); assert(await page.getByText('不可用', { exact: true }).count()); await page.getByRole('button', { name: '重置筛选', exact: true }).click(); report.push({ check: 'platform and serial filters retain global counts; iOS executor gate', passed: true });
        await page.locator('.device-reference-table .arco-checkbox').first().click(); await page.getByRole('button', { name: '批量操作', exact: true }).click(); await page.getByText('锁定可用设备', { exact: true }).click(); await page.getByRole('status').filter({ hasText: '失败 1 台' }).waitFor(); assert.equal(state.writes.length, 10); assert.equal(new Set(state.writes.map(item => item.id)).size, 10); report.push({ check: 'batch partial failure is reported and requests are not repeated', passed: true });
        await page.getByRole('button', { name: '取消选择', exact: true }).click();
        await page.getByRole('button', { name: '编辑设备 Android-001', exact: true }).click(); await page.getByPlaceholder('输入设备名称').fill('已编辑设备'); await page.locator('.arco-modal:visible').getByRole('button', { name: '确定', exact: true }).click(); await page.locator('.device-reference-table').getByText('已编辑设备', { exact: true }).waitFor(); report.push({ check: 'edit saves through existing API', passed: true });
        await page.getByRole('button', { name: '添加设备', exact: true }).click(); await page.getByText('连接网络 Android 设备', { exact: true }).click(); await page.getByText('接入局域网或远程 Android 设备', { exact: true }).waitFor(); await page.locator('.arco-modal:visible').getByRole('button', { name: '确定', exact: true }).click(); await page.getByText('请输入设备网络地址与有效端口', { exact: true }).waitFor(); assert.equal(await page.locator('.arco-modal:visible').count(), 1); await page.locator('.arco-modal:visible').getByRole('button', { name: '取消', exact: true }).click(); report.push({ check: 'Android connection entry and invalid input retains dialog', passed: true });
        state.error = true; await page.getByRole('button', { name: '刷新设备列表', exact: true }).click(); await page.getByText('设备数据加载失败', { exact: true }).waitFor(); assert.equal(await page.locator('.device-metric').first().locator('strong').innerText(), '24'); state.error = false; state.empty = true; await page.getByRole('button', { name: '刷新设备列表', exact: true }).click(); await page.getByText('暂无测试设备', { exact: true }).waitFor(); assert.equal(await page.locator('.device-rate strong').innerText(), '—'); report.push({ check: 'error keeps known data and empty rate is not fabricated', passed: true });
      }
      assert.deepEqual(errors, []); await context.close(); console.log('PASS devices ' + width);
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(report.length + ' device checks passed');
  } finally { await browser.close(); }
}
module.exports = { fixtures }; if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1 });
