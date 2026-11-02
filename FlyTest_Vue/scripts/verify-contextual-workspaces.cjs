const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installFixtures } = require('./verify-workspace-layout.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5175';
const output = process.env.UI_OUTPUT_DIR || path.resolve(__dirname, '../playwright-screenshots/contextual-workspaces');
const widths = (process.env.UI_WIDTHS || '1440,1280,1024,768,390,320').split(',').map(Number);
const routes = [
  ['/api-automation', true], ['/api-automation?tab=test-cases', true],
  ['/api-automation?tab=environments', false], ['/api-automation?tab=execution-records', false], ['/api-automation?tab=execution-report', false],
  ['/ui-automation', true], ['/ui-automation?tab=page-steps', true], ['/ui-automation?tab=testcases', true],
  ['/ui-automation?tab=ai-intelligent', false], ['/ui-automation?tab=execution-records', false], ['/ui-automation?tab=batch-records', false],
  ['/ui-automation?tab=public-data', false], ['/ui-automation?tab=env-config', false], ['/ui-automation?tab=actuators', false],
  ['/testcases', true], ['/testsuites', true], ['/test-bugs', true], ['/test-executions', false],
];
const root = { id: 11, name: '支付业务', project: 1, parent: null, parent_id: null, level: 1, children: [], testcase_count: 0, test_case_count: 0, description: '支付业务回归套件' };
const child = { ...root, id: 12, name: '退款流程', parent: 11, parent_id: 11, level: 2 };
const tree = [{ ...root, children: [child] }];
async function fixture(context) {
  await installFixtures(context);
  await context.route(/\/api\/prompts\/user-prompts\/(?:default\/)?(?:\?.*)?$/, route => {
    const prompt={id:1,name:'离线布局验收',content:'用于浏览器布局与交互验收。',is_active:true,is_default:true,prompt_type:'general'};
    return route.fulfill({json:{status:'success',success:true,code:200,data:route.request().url().includes('/default/')?prompt:[prompt]}});
  });
  await context.route(/\/api\/(?:api-automation\/collections|ui-automation\/modules)\/(?:tree\/)?(?:\?.*)?$/, route => route.fulfill({json:{status:'success',success:true,code:200,data:tree}}));
  await context.route(/\/api\/projects\/1\/testcase-modules\/(?:\?.*)?$/, route => route.fulfill({json:{status:'success',success:true,code:200,data:[root,child]}}));
  await context.route(/\/api\/projects\/1\/test-suites\/(?:\?.*)?$/, route => route.fulfill({json:{status:'success',success:true,code:200,data:[root,child]}}));
  await context.route(/\/api\/projects\/1\/test-suites\/\d+\/(?:\?.*)?$/, route => route.fulfill({json:{status:'success',success:true,code:200,data:root}}));
}
async function bounds(page) {
  return page.evaluate(() => {
    const visible = el => { const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden' };
    const overflow=[...document.querySelectorAll('.content button,.content input,.content .arco-select-view,.fc-workspace-directory--drawer button,.fc-workspace-directory--drawer input')]
      .filter(visible).filter(el => !el.closest('.arco-table,.arco-tabs-content-item:not(.arco-tabs-content-item-active)')).filter(el=>{const r=el.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1}).map(el=>el.outerHTML.slice(0,150));
    return { width:innerWidth,doc:document.documentElement.scrollWidth,overflow };
  });
}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_CHANNEL?{channel:process.env.UI_BROWSER_CHANNEL}:{})});
  const report=[];
  try {
    for (const width of widths) {
      const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});await fixture(context);
      const page=await context.newPage();page.setDefaultTimeout(8000);let errors=[];page.on('pageerror',e=>errors.push(e.message));
      async function check(name,run) {
        if (process.env.UI_CHECKS && !new RegExp(process.env.UI_CHECKS).test(name)) return;
        errors=[];
        try { await run();assert.deepEqual(errors,[], 'script errors');const state=await bounds(page);assert(state.doc<=width,`document width ${state.doc}`);assert.deepEqual(state.overflow,[],'clipped controls');report.push({width,name,passed:true});console.log('PASS',width,name) }
        catch(error) {report.push({width,name,passed:false,error:error.message,errors});console.error('FAIL',width,name,error.message);await page.screenshot({path:path.join(output,`failure-${width}-${report.length}.png`)}).catch(()=>{});}
      }
      async function goto(route) {
        await page.goto(base+route,{waitUntil:'domcontentloaded'});
        await page.locator('.content .fc-module-heading:visible').first().waitFor();
        await page.waitForTimeout(250);
      }
      for(const [route,directory] of routes) await check(route,async()=>{
        await goto(route);
        const dir=page.locator('.fc-workspace-directory:visible');
        const inline=directory&&width>=1440;
        assert.equal(await dir.count(),inline?1:0,'directory presence');
        if(!directory)assert.equal(await page.locator('.fc-workspace-context .fc-directory-toggle').count(),route==='/test-executions'?1:0);
        if(inline) {
          const box=await dir.boundingBox();assert(box.width>=200&&box.width<=260,'compact directory width');
          assert.equal(await dir.locator('.arco-btn-primary').count(),0,'directory must not compete with primary page action');
        }
        const heading=await page.locator('.fc-workspace-topbar').boundingBox(),content=await page.locator('.fc-workspace-content').boundingBox();
        assert(heading.y<content.y,'heading above whole workspace');
        await page.screenshot({path:path.join(output,`${route.replace(/[^a-z0-9]/gi,'-')}-${width}.png`)});
      });
      await check('directory collapse, keyboard resize and reload preference',async()=>{
        await goto('/testcases');const toggle=page.getByRole('button',{name:'模块目录',exact:true});
        if(width>=1024){if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();const resizer=page.getByRole('separator',{name:'调整目录宽度'});const before=Number(await resizer.getAttribute('aria-valuenow'));await resizer.focus();await page.keyboard.press('ArrowRight');assert.equal(Number(await resizer.getAttribute('aria-valuenow')),before+16);await page.getByRole('button',{name:'收起模块目录',exact:true}).click();await page.reload();await page.locator('.content .fc-module-heading:visible').waitFor();assert.equal(await page.locator('.fc-workspace-directory:visible').count(),0);}
        else {await toggle.click();await page.getByRole('dialog',{name:'模块目录',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('.fc-workspace-directory:visible').count(),0);assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);}
      });
      await check('node actions, cancel and mobile directory selection',async()=>{
        await goto('/testcases');const toggle=page.getByRole('button',{name:'模块目录',exact:true});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
        const dir=page.locator('.fc-workspace-directory:visible');const node=dir.locator('.fc-directory-node').filter({hasText:'支付业务'}).first();await node.hover();
        await node.getByRole('button',{name:'支付业务的更多操作',exact:true}).click();
        const edit=page.locator('.arco-dropdown-option:visible').getByText('编辑模块',{exact:true});await edit.waitFor();await edit.click();
        const modal=page.locator('.arco-modal:visible');await modal.waitFor();await modal.getByRole('button',{name:'取消',exact:true}).click();await modal.waitFor({state:'hidden'});
        await dir.getByText('支付业务',{exact:true}).click();
        await page.locator('.fc-workspace-selection').filter({hasText:'支付业务'}).waitFor();
        if(width<1024)assert.equal(await page.locator('.fc-workspace-directory:visible').count(),0,'selection closes drawer');
        await page.getByRole('button',{name:'清除筛选',exact:true}).click();assert.equal(await page.locator('.fc-workspace-selection').count(),0);
      });
      await check('API tab headers, report filters and search state persist',async()=>{
        await goto('/api-automation');const toggle=page.getByRole('button',{name:'接口目录',exact:true});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
        await page.locator('.fc-workspace-directory:visible').getByText('支付业务',{exact:true}).click();
        await page.getByPlaceholder('搜索接口名称或 URL').fill('回归接口');
        await page.locator('.menu-demo,.menu').count().catch(()=>{});
        // Router navigation keeps visited panes mounted, matching actual sidebar usage.
        const routerNav=async(route)=>page.evaluate(route=>document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(route),route);
        await routerNav('/api-automation?tab=environments');await page.locator('.content').getByRole('heading',{name:'环境配置',exact:true}).waitFor();assert.equal(await page.locator('.fc-workspace-directory:visible').count(),0);
        await routerNav('/api-automation?tab=execution-records');await page.locator('.content').getByRole('heading',{name:'执行记录',exact:true}).waitFor();
        assert.equal(await page.locator('.content .fc-module-heading:visible').count(),1,'only active heading');
        await page.getByRole('button',{name:'清除筛选',exact:true}).click();assert.equal(await page.locator('.fc-workspace-selection').count(),0);
        await page.locator('.fc-context-filter').click();await page.locator('.arco-select-option:visible').getByText('支付业务',{exact:true}).click();await page.locator('.fc-workspace-selection').filter({hasText:'支付业务'}).waitFor();
        await routerNav('/api-automation');await page.getByPlaceholder('搜索接口名称或 URL').waitFor();assert.equal(await page.getByPlaceholder('搜索接口名称或 URL').inputValue(),'回归接口');assert.equal(await page.locator('.content .fc-module-heading:visible').count(),1);
      });
      await check('report range drawer and focus return',async()=>{
        await goto('/test-executions');const trigger=page.getByRole('button',{name:'报告范围与快照',exact:true});await trigger.click();const dialog=page.getByRole('dialog',{name:'报告范围与快照',exact:true});await dialog.waitFor();assert.equal(await page.locator('#app').evaluate(el=>el.inert),true);const dismiss=dialog.getByRole('button',{name:'收起报告范围与快照',exact:true});await dismiss.focus();await page.keyboard.press('Shift+Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
      });
      await check('UI directory filter follows newly visited tabs',async()=>{
        const requests=[];const record=request=>requests.push(request.url());page.on('request',record);
        try {
          await goto('/ui-automation');const toggle=page.getByRole('button',{name:'模块目录',exact:true});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
          await page.locator('.fc-workspace-directory:visible').getByText('支付业务',{exact:true}).click();
          const filteredRequest = page.waitForRequest(request => request.url().includes('/ui-automation/testcases/') && new URL(request.url()).searchParams.get('module') === '11');
          await page.evaluate(()=>document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/ui-automation?tab=testcases'));
          await page.locator('.content').getByRole('heading',{name:'测试用例',exact:true}).waitFor();await filteredRequest;
          assert(requests.some(url=>url.includes('/ui-automation/testcases/')&&new URL(url).searchParams.get('module')==='11'),'selected module must filter a newly visited tab');
          assert.equal(await page.locator('.content .fc-module-heading:visible').count(),1);
          await page.getByRole('button',{name:'清除筛选',exact:true}).click();assert.equal(await page.locator('.fc-workspace-selection').count(),0);
        } finally { page.off('request',record) }
      });
      await check('directory menu keyboard navigation and Escape',async()=>{
        await goto('/testcases');const toggle=page.getByRole('button',{name:'模块目录',exact:true});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
        const trigger=page.locator('.fc-workspace-directory:visible').getByRole('button',{name:'支付业务的更多操作',exact:true});await trigger.focus();await page.keyboard.press('ArrowDown');
        const item=page.getByRole('menuitem',{name:'添加子模块',exact:true});await item.waitFor();assert.equal(await item.evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('End');assert.equal(await page.getByRole('menuitem',{name:'删除模块',exact:true}).evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
        if(width<1024) { await page.keyboard.press('Escape');await page.locator('.fc-workspace-directory:visible').waitFor({state:'hidden'}); }
      });
      await check('dark directory drawer and responsive focus cleanup',async()=>{
        await goto('/testcases');await page.locator('.theme-switch-button').click();await page.setViewportSize({width:768,height:1000});
        const trigger=page.getByRole('button',{name:'模块目录',exact:true});await trigger.click();const dialog=page.getByRole('dialog',{name:'模块目录',exact:true});await dialog.waitFor();
        assert.notEqual(await dialog.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
        await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(100);assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);assert.equal(await page.getByRole('dialog',{name:'模块目录',exact:true}).count(),0);
        await page.setViewportSize({width,height:1000});await page.locator('.theme-switch-button').click();
      });
      await check('APP library and property panels collapse independently',async()=>{
        await page.goto(base+'/app-automation?tab=scene-builder');await page.locator('.fc-builder-viewbar').waitFor();
        const library=page.getByRole('button',{name:'组件库',exact:true}),config=page.getByRole('button',{name:'步骤属性',exact:true});
        if(await library.getAttribute('aria-expanded')==='true')await library.click();if(await config.getAttribute('aria-expanded')==='true')await config.click();
        assert.equal(await page.locator('.library-panel:visible,.config-panel:visible').count(),0);assert(await page.locator('.canvas-panel').isVisible());
        await library.click();assert(await page.locator('.library-panel').isVisible());assert.equal(await page.locator('.config-panel:visible').count(),0);
        await config.click();assert(await page.locator('.config-panel').isVisible());await library.click();assert.equal(await page.locator('.library-panel:visible').count(),0);assert(await page.locator('.canvas-panel').isVisible());
        await page.screenshot({path:path.join(output,`scene-panels-${width}.png`)});
      });
      await check('personal center horizontal settings tabs',async()=>{
        await page.goto(base+'/personal-center');await page.locator('.fc-settings-tabs').waitFor();assert.equal(await page.locator('.section-sidebar').count(),0);await page.getByRole('tab',{name:'修改密码',exact:true}).click();await page.getByPlaceholder('请输入当前密码').waitFor();
        await page.keyboard.press('ArrowLeft');assert.equal(await page.getByRole('tab',{name:'个人资料',exact:true}).getAttribute('aria-selected'),'true');await page.keyboard.press('End');assert.equal(await page.getByRole('tab',{name:'修改密码',exact:true}).getAttribute('aria-selected'),'true');
      });
      await check('bug filters fit content and editor prioritizes full width',async()=>{
        await goto('/test-bugs');
        const clipped=await page.locator('.bug-toolbar').evaluate(root=>{const bounds=root.getBoundingClientRect();return [...root.querySelectorAll('input,button,.arco-select-view')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<bounds.left-1||r.right>bounds.right+1)}).map(el=>el.outerHTML.slice(0,120))});
        assert.deepEqual(clipped,[],'bug filter controls must fit their own container');
        await page.getByRole('button',{name:'提 BUG',exact:true}).click();await page.locator('.content').getByRole('heading',{name:'新建缺陷',exact:true}).waitFor();
        assert.equal(await page.locator('.fc-workspace-directory:visible').count(),0,'editor gets full workspace width');
        assert.equal(await page.locator('.content .fc-module-heading:visible').count(),1);
        await page.getByPlaceholder('请输入 BUG 标题',{exact:true}).fill('布局验收草稿');
        assert.equal(await page.getByPlaceholder('请输入 BUG 标题',{exact:true}).inputValue(),'布局验收草稿');
        await page.screenshot({path:path.join(output,`bug-editor-${width}.png`)});
        await page.getByRole('button',{name:'取消',exact:true}).click();await page.locator('.content').getByRole('heading',{name:'缺陷管理',exact:true}).waitFor();
      });
      await check('loading directory does not dismiss an open drawer',async()=>{
        const pattern=/\/api\/api-automation\/collections\/tree\/(?:\?.*)?$/;
        const delayed=async route=>{await new Promise(resolve=>setTimeout(resolve,700));await route.fulfill({json:{status:'success',success:true,code:200,data:tree}})};
        await context.route(pattern,delayed);
        try {
          await page.goto(base+'/api-automation');const trigger=page.getByRole('button',{name:'接口目录',exact:true});await trigger.waitFor();if(await trigger.getAttribute('aria-expanded')==='false')await trigger.click();
          await page.locator('.fc-workspace-directory:visible').waitFor();await page.waitForTimeout(900);assert.equal(await page.locator('.fc-workspace-directory:visible').count(),1,'catalog refresh must not close the directory');
          await page.locator('.fc-workspace-directory:visible').getByText('支付业务',{exact:true}).click();if(width<1024)assert.equal(await page.locator('.fc-workspace-directory:visible').count(),0,'explicit user selection closes the drawer');
        } finally { await context.unroute(pattern,delayed) }
      });
      await check('chat history is contextual and new conversation stays in page heading',async()=>{
        await page.goto(base+'/langgraph-chat');await page.locator('.fc-workspace-heading').getByRole('heading',{name:'AI 对话',exact:true}).waitFor();
        const toggle=page.getByRole('button',{name:'历史会话',exact:true});
        if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
        const directory=page.locator('.fc-workspace-directory:visible');await directory.waitFor();
        assert.equal(await directory.locator('.arco-btn-primary').count(),0,'history panel has no competing primary actions');
        await page.getByRole('button',{name:'收起历史会话',exact:true}).click();
        await page.locator('.fc-workspace-heading').getByRole('button',{name:'新对话',exact:true}).click();
        assert.equal(await page.locator('.fc-workspace-directory:visible').count(),0);
        await page.screenshot({path:path.join(output,`chat-${width}.png`)});
      });
      await context.close();
    }
  } finally { await browser.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)); }
  const failed=report.filter(item=>!item.passed);console.log(`${report.length-failed.length}/${report.length} contextual workspace checks passed`);if(failed.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
