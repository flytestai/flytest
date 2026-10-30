const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installFixtures } = require('./verify-workspace-layout.cjs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5175';
const output = process.env.UI_OUTPUT_DIR || path.resolve(__dirname, '../playwright-screenshots/a2-workspaces');
const catalogFile = path.resolve(__dirname, '../../FlyTest_Django/data_factory/catalog.py');
// Use the actual, pure-data tool catalog without loading Django or accessing its database.
const catalog = JSON.parse(execFileSync(process.env.PYTHON || 'python', [
  '-X', 'utf8', '-c', 'import json,runpy,sys; print(json.dumps(runpy.run_path(sys.argv[1])["get_tool_catalog"]()))', catalogFile,
], { encoding: 'utf8' }));
const widths = (process.env.UI_WIDTHS || '1440,390,320').split(',').map(Number);
const selectedTools = process.env.UI_TOOLS ? new Set(process.env.UI_TOOLS.split(',')) : null;
const componentFile = path.resolve(__dirname, '../../FlyTest_FastAPI_AppAutomation/app/database.py');
const components = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-X', 'utf8', '-c', `
import ast,json,sys
tree=ast.parse(open(sys.argv[1],encoding='utf-8-sig').read())
class LiteralCatalog(ast.NodeTransformer):
    def visit_Call(self,n):
        if isinstance(n.func,ast.Name) and n.func.id=='json_dumps': return self.visit(n.args[0])
        raise ValueError('Unexpected catalog expression')
    def visit_Name(self,n):
        if n.id=='now': return ast.Constant('2026-10-30T08:00:00Z')
        return n
items=[]
for n in ast.walk(tree):
    if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id in ('default_components','supplemental_components') for t in n.targets):
        items.extend(ast.literal_eval(LiteralCatalog().visit(n.value)))
print(json.dumps([dict(id=i+1,name=r[0],type=r[1],category=r[2],description=r[3],schema=r[4],default_config=r[5],enabled=bool(r[6]),sort_order=r[7],updated_at=r[9]) for i,r in enumerate(items)]))
`, componentFile], { encoding: 'utf8' }));
const dialogs = [
  ['/projects', '添加项目'], ['/users', '添加用户'], ['/organizations', '添加组织'],
  ['/api-keys', '创建Key'], ['/remote-mcp-configs', '添加远程MCP'], ['/llm-configs', '新增配置'],
  ['/requirements', '上传需求文档'], ['/knowledge-management', '新建知识库'],
  ['/api-automation?tab=environments', '新增环境'], ['/ui-automation', '新增页面'],
  ['/ui-automation?tab=env-config', '新增环境'], ['/app-automation?tab=devices', '添加远程设备'],
  ['/app-automation?tab=packages', '新增应用包'], ['/app-automation?tab=elements', '新增元素'],
  ['/app-automation?tab=test-cases', '快速新建'], ['/app-automation?tab=scheduled-tasks', '新建任务'],
];

async function inspectModal(page, width) {
  const modal = page.locator('.arco-modal:visible').last();
  await modal.waitFor();
  await page.waitForTimeout(300);
  const state = await modal.evaluate(root => {
    const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const clipped = [...root.querySelectorAll('.arco-input-wrapper,.arco-select-view,.arco-btn,textarea')].filter(visible).filter(el => {
      if (el.closest('.arco-tabs-content-item:not(.arco-tabs-content-item-active)')) return false;
      const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1;
    }).map(el => ({ cls: el.className, text: el.textContent.slice(0, 50) }));
    return { clipped, radius: getComputedStyle(root).borderRadius, width: root.getBoundingClientRect().width, contract: Boolean(root.closest('.fc-dialog')) };
  });
  assert(state.contract, `The actual dialog must use the shared A2 contract: ${JSON.stringify(state)}`);
  assert.equal(state.radius, width < 768 ? '16px' : '20px');
  assert(state.width <= width, 'Dialog fits viewport');
  assert.deepEqual(state.clipped, [], `Visible form controls fit viewport: ${JSON.stringify(state)}`);
  return modal;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_CHANNEL ? { channel: process.env.UI_BROWSER_CHANNEL } : {}) });
  const results = [];
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await installFixtures(context);
      await context.route(/\/api\/data-factory\/catalog\/?(?:\?.*)?$/, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'success', data: catalog }) }));
      await context.route(/\/api\/app-automation\/components\/?(?:\?.*)?$/, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'success', success: true, data: components }) }));
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      let errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const category of catalog.categories) {
        if (selectedTools && !category.tools.some(tool => selectedTools.has(tool.name))) continue;
        await page.goto(`${base}/data-factory?category=${category.category}`);
        await page.locator('.tool-card').first().waitFor();
        assert.equal(await page.locator('.tool-card').count(), category.tools.length);
        for (const tool of category.tools) {
          if (selectedTools && !selectedTools.has(tool.name)) continue;
          errors = [];
          try {
            await page.locator('.tool-card').filter({ has: page.getByText(tool.display_name, { exact: true }) }).click();
            const modal = await inspectModal(page, width);
            assert.deepEqual(errors, [], 'Tool renders without runtime errors');
            await modal.screenshot({ path: path.join(output, `tool-${tool.name}-${width}.png`) });
            await modal.locator('.arco-modal-close-btn').click();
            await modal.waitFor({ state: 'hidden' });
            results.push({ kind: 'data-tool', category: category.category, tool: tool.name, width, passed: true });
          } catch (error) {
            results.push({ kind: 'data-tool', tool: tool.name, width, passed: false, error: error.message, errors });
            console.error(`FAIL tool ${tool.name} ${width}: ${error.message}`);
            fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(results, null, 2));
            await page.screenshot({ path: path.join(output, `failure-${tool.name}-${width}.png`) });
            const close = page.locator('.arco-modal:visible .arco-modal-close-btn');
            if (await close.count()) await close.last().click().catch(() => {});
          }
        }
        console.log(`TOOLS ${width} ${category.category}: ${category.tools.length}`);
      }
      for (const [route, button] of selectedTools ? [] : dialogs) {
        errors = [];
        try {
          await page.goto(base + route);
          await page.getByRole('button', { name: button, exact: true }).click();
          const modal = await inspectModal(page, width);
          if (route === '/api-automation?tab=environments') {
            await modal.getByRole('button', { name: '新增 Header', exact: true }).click();
            await modal.getByPlaceholder('Header 名，例如 Authorization').fill('X-Workspace');
            await modal.getByText('Variables', { exact: true }).click();
            await modal.getByRole('button', { name: '新增变量', exact: true }).click();
            await modal.getByPlaceholder('变量名，例如 token').fill('tenant');
            await modal.getByText('Headers', { exact: true }).click();
            assert.equal(await modal.getByPlaceholder('Header 名，例如 Authorization').inputValue(), 'X-Workspace');
            await inspectModal(page, width);
          }
          assert.deepEqual(errors, [], 'Editor renders without runtime errors');
          const name = route.replace(/[^a-z0-9]/gi, '-');
          await modal.screenshot({ path: path.join(output, `dialog${name}-${width}.png`) });
          await modal.locator('.arco-modal-close-btn').click();
          await modal.waitFor({ state: 'hidden' });
          results.push({ kind: 'editor', route, button, width, passed: true });
        } catch (error) {
          results.push({ kind: 'editor', route, button, width, passed: false, error: error.message, errors });
          await page.screenshot({ path: path.join(output, `failure-dialog-${route.replace(/[^a-z0-9]/gi, '-')}-${width}.png`) });
        }
      }
      if (selectedTools) {
        await context.close();
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(results, null, 2));
        continue;
      }
      // The builder must keep its real fields, native disclosure and step insertion usable.
      try {
        await page.goto(base + '/app-automation?tab=scene-builder');
        const disclosure = page.locator('.fc-status-disclosure');
        await disclosure.waitFor();
        assert.equal(await disclosure.getAttribute('open'), null);
        await disclosure.locator('summary').click();
        assert.notEqual(await disclosure.getAttribute('open'), null);
        await disclosure.locator('summary').click();
        await page.getByRole('button', { name: '添加变量', exact: true }).click();
        await page.getByPlaceholder('变量名', { exact: true }).fill('customerId');
        assert.equal(await page.getByPlaceholder('变量名', { exact: true }).inputValue(), 'customerId');
        for (const component of components) {
          errors = [];
          const item = page.locator('.library-panel .component-item').filter({ has: page.getByText(component.name, { exact: true }) });
          await item.scrollIntoViewIfNeeded();
          await item.focus();
          await page.keyboard.press('Enter');
          await page.locator('.config-panel .config-form').waitFor();
          const clipped = await page.locator('.config-panel').evaluate(root => [...root.querySelectorAll('.arco-input-wrapper,.arco-select-view,.arco-btn')].filter(el => {
            const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > innerWidth + 1);
          }).map(el => el.className));
          assert.deepEqual(clipped, [], `Step configuration ${component.type}`);
          assert.deepEqual(errors, [], `Step configuration ${component.type} runtime`);
          await page.locator('.config-panel').screenshot({ path: path.join(output, `step-${component.type}-${width}.png`) });
          await page.locator('.canvas-panel').getByRole('button', { name: '删除', exact: true }).first().click();
          results.push({ kind: 'step-config', type: component.type, width, passed: true });
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(output, `builder-${width}.png`) });
        results.push({ kind: 'builder', width, passed: true });
      } catch (error) { results.push({ kind: 'builder', width, passed: false, error: error.message }); }
      await context.close();
      fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(results, null, 2));
    }
  } finally { await browser.close(); }
  const failures = results.filter(result => !result.passed);
  console.log(`${results.length - failures.length}/${results.length} workspace and editor checks passed`);
  if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exitCode = 1; }
})().catch(error => { console.error(error); process.exitCode = 1; });
