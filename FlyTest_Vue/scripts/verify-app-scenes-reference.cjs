const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installFixtures } = require('./verify-workspace-layout.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5175', output = path.resolve(__dirname, '../playwright-screenshots/app-scenes-reference');
async function fixtures(context) {
  await installFixtures(context);
  const now = new Date().toISOString(), step = (id, type, name) => ({ id, kind: 'base', type, action: type, component_type: type, name, config: {} });
  const state = { saves: [], failSave: false, empty: false, records: [
    { id: 1, project_id: 1, name: '用户登录流程', description: '输入账号密码并验证登录结果', package_id: 1, timeout: 300, retry_count: 0, tags: ['登录'], variables: [], ui_flow: { steps: [step('a', 'start_app', '启动应用'), step('b', 'click', '点击登录按钮'), { ...step('c', 'if', '判断登录结果'), steps: [step('d', 'wait', '等待首页')], else_steps: [step('e', 'screenshot', '失败截图')] }] }, last_result: 'passed', last_run_at: now, updated_at: now },
    { id: 2, project_id: 1, name: '注册验证流程', description: '', package_id: 1, timeout: 300, retry_count: 0, tags: [], variables: [], ui_flow: { steps: [step('f', 'click', '点击注册')] }, last_result: 'failed', last_run_at: now, updated_at: now },
  ] };
  const fulfill = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status === 200, status: status === 200 ? 'success' : 'error', code: status, data, message: status === 200 ? '' : '隔离测试保存失败' }) });
  await context.route('**/api/app-automation/**', route => {
    const url = new URL(route.request().url()), method = route.request().method();
    if (url.pathname.endsWith('/components/')) return fulfill(route, ['start_app','click','input','swipe','wait','assert','if','loop','try'].map((type,i) => ({ id:i+1,type,name:['启动应用','点击元素','输入文本','滑动操作','等待','断言','条件分支','循环','异常处理'][i],category:'base',default_config:{},is_active:true })));
    if (url.pathname.endsWith('/packages/')) return fulfill(route, [{ id:1,name:'FeiCe 测试版',project_id:1,package_name:'com.feice',platform:'android',app_version:'2.6.0' }]);
    if (url.pathname.endsWith('/devices/')) return fulfill(route, []);
    if (url.pathname.endsWith('/test-cases/') && method === 'GET') return fulfill(route, state.empty ? [] : state.records);
    if (/test-cases\/\d+\//.test(url.pathname) && method === 'PUT') { const payload = route.request().postDataJSON(); state.saves.push(payload); if (state.failSave) return fulfill(route, null, 503); const id = +url.pathname.match(/test-cases\/(\d+)/)[1], item = state.records.find(x=>x.id===id); Object.assign(item,payload); return fulfill(route,item); }
    if (url.pathname.endsWith('/test-cases/') && method === 'POST') { const payload = route.request().postDataJSON(); state.saves.push(payload); const item={...payload,id:3,last_result:'',last_run_at:null,updated_at:now};state.records.push(item);return fulfill(route,item); }
    return fulfill(route, []);
  }); return state;
}
async function run() {
  fs.mkdirSync(output, { recursive:true }); const browser=await chromium.launch({headless:true,channel:'msedge'}), report=[];
  try {
    for(const width of (process.env.UI_WIDTHS || '1672,1280,768,390,320').split(',').map(Number)) {
      const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),state=await fixtures(context),page=await context.newPage(),errors=[];
      page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/app-automation?tab=scene-builder&caseId=1',{waitUntil:'domcontentloaded'});
      await page.locator('.scene-editor-title h3').filter({hasText:'用户登录流程'}).waitFor();
      assert.equal(await page.locator('.scene-metric').count(),5); assert.equal(await page.locator('.scene-metric.red strong').innerText(),'50.0%');
      await page.locator('.step-item-wrapper').nth(2).waitFor(); assert.equal(await page.locator('.step-item-wrapper').count(),3);
      await page.locator('.step-item').last().hover(); await page.locator('.step-item').last().getByRole('button',{name:'展开',exact:true}).click();
      await page.getByText('Then 分支',{exact:true}).waitFor(); await page.getByText('Else 分支',{exact:true}).waitFor();
      await page.getByRole('button',{name:'缩小画布',exact:true}).click(); assert.equal(await page.locator('.scene-flow-zoom span').innerText(),'90%');
      await page.getByRole('button',{name:'重置画布',exact:true}).click(); assert.equal(await page.locator('.scene-flow-zoom span').innerText(),'100%');
      await page.getByRole('button',{name:'编辑步骤 点击登录按钮',exact:true}).press('Enter');
      assert.equal(await page.getByRole('tab',{name:'属性',exact:true}).getAttribute('aria-selected'),'true');
      await page.getByRole('tab',{name:'步骤',exact:true}).click();
      assert(await page.locator('.scene-palette .component-item').filter({hasText:'输入文本'}).isVisible());
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document overflow at '+width);
      await page.locator('.content').evaluate(el => el.scrollTop = 0); await page.screenshot({path:path.join(output,'scene-'+width+'.png'),fullPage:true}); report.push({width,check:'graph branches, keyboard inspector, zoom and responsive layout',passed:true});
      if(width===1672) {
        await page.locator('.scene-palette .component-item').filter({hasText:'输入文本'}).click();
        assert.equal(await page.locator('.step-item-wrapper').count(),4);
        await page.locator('.scene-tree button').filter({hasText:'注册验证流程'}).click(); await page.getByText('当前场景有未保存的修改，切换后将丢弃这些修改。',{exact:true}).waitFor();
        await page.locator('.arco-modal:visible').getByRole('button',{name:'取消',exact:true}).click(); assert.equal(await page.locator('.step-item-wrapper').count(),4);
        await page.locator('.scene-editor-actions').getByRole('button',{name:'保存',exact:true}).click(); await page.getByText('测试用例已更新',{exact:true}).waitFor();
        assert.deepEqual(state.saves.at(-1).tags,['登录']); assert.equal(state.saves.at(-1).ui_flow.steps.length,4); assert.equal(state.saves.at(-1).ui_flow.steps[2].else_steps.length,1);
        await page.reload({waitUntil:'domcontentloaded'}); await page.locator('.step-item-wrapper').nth(3).waitFor(); report.push({check:'save and reopen preserves branches and added step',passed:true});
        await page.getByPlaceholder('搜索场景名称').fill('注册');assert.equal(await page.locator('.scene-tree button').count(),1); await page.getByPlaceholder('搜索场景名称').fill('');
        await page.getByRole('button',{name:'场景设置',exact:false}).click();await page.getByPlaceholder('例如：登录并进入首页').fill('登录验证新名称');await page.locator('.arco-drawer-close-btn:visible').click();
        state.failSave=true;await page.locator('.scene-editor-actions').getByRole('button',{name:'保存',exact:true}).click();await page.getByText('隔离测试保存失败',{exact:true}).waitFor();
        await page.locator('.scene-tree button').filter({hasText:'注册验证流程'}).click();await page.getByRole('button',{name:'丢弃并切换',exact:true}).click();await page.locator('.scene-editor-title h3').filter({hasText:'注册验证流程'}).waitFor();report.push({check:'failed save retains unsaved-change protection',passed:true});
      }
      assert.deepEqual(errors,[]);await context.close();console.log('PASS scenes '+width);
    }
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(report.length+' scene checks passed');
  } finally {await browser.close()}
}
module.exports={fixtures};if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1});
