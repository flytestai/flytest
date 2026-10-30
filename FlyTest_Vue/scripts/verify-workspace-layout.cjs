const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const root = process.env.UI_OUTPUT_DIR || require('path').resolve(__dirname, '../playwright-screenshots/layout');
const baseUrl = process.env.UI_BASE_URL || 'http://127.0.0.1:5174';
const user = { id: 1, username: 'layout-review', real_name: '测试管理员', email: 'review@example.test', is_staff: true, is_superuser: true, is_active: true, approval_status: 'approved', groups: [] };
const project = { id: 1, name: '飞测 · 产品质量中心', description: '需求、用例与自动化测试的团队协作空间', creator: 1, creator_detail: user, created_at: '2026-10-30T08:00:00Z', updated_at: '2026-10-30T08:00:00Z' };
async function installFixtures(context, { authenticated = true } = {}) {
  if(authenticated) await context.addInitScript(({user}) => {
    sessionStorage.setItem('auth-isAuthenticated','true');
    sessionStorage.setItem('auth-user',JSON.stringify(user));
    sessionStorage.setItem('auth-accessToken','layout-review-fixture');
    sessionStorage.setItem('auth-userPermissions','[]');
    localStorage.setItem('selected_project_id','1');
  }, {user});
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if(!authenticated && /token\/refresh/.test(url.pathname)) return route.fulfill({status:401,contentType:'application/json',body:'{}'});
    let data = [];
    if (/data-factory\/catalog/.test(url.pathname)) data = {categories:[{category:'string',name:'字符工具',description:'常用文本处理与格式转换',icon:'file',tools:[]}],scenarios:[],tools:[]};
    else if (/data-factory\/statistics/.test(url.pathname)) data = {total_records:0,saved_records:0,category_stats:[],scenario_stats:[],tag_stats:[],recent_records:[]};
    else if (/data-factory\/(tags|records)/.test(url.pathname)) data = {count:0,next:null,previous:null,results:[]};
    else if (/\/projects\/$/.test(url.pathname)) data = [project];
    else if (/\/projects\/1\/$/.test(url.pathname)) data = project;
    else if (/notifications\/inbox/.test(url.pathname)) data = {items:[],unread_count:0,total_count:0};
    else if (/\/projects\/1\/statistics\//.test(url.pathname)) data = {testcases:{total:248, by_review_status:{approved:192,pending_review:36,needs_optimization:20}},executions:{total_executions:64,case_results:{total:200,passed:184,failed:12,skipped:4,error:0}},bugs:{total:28,open:8,high_severity:2,pending_retest:4},ui_automation:{total_cases:48,total_executions:36,by_status:{success:32,failed:4}},mcp:{active:2,total:3},skills:{active:8,total:10}};
    else if (/statistics|stats|summary/.test(url.pathname)) data = {};
    else if (/accounts\/me/.test(url.pathname)) data = user;
    else if (/permissions/.test(url.pathname)) data = [];
    else if (/token\/refresh/.test(url.pathname)) data = {access:'layout-review-fixture'};
    else if (/tags/.test(url.pathname)) data = [];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',success:true,code:200,data,results:Array.isArray(data)?data:[],count:Array.isArray(data)?data.length:0,total:0,message:'',errors:null})});
  });
}
async function run() {
  const browser = await chromium.launch({headless:true,...(process.env.UI_BROWSER_CHANNEL ? {channel:process.env.UI_BROWSER_CHANNEL} : {})});
  const context = await browser.newContext({viewport:{width:Number(process.env.UI_WIDTH||1440),height:1000},deviceScaleFactor:1});
  await installFixtures(context, {authenticated: !process.env.UI_PUBLIC});
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>console.log('FAILED',r.url(),r.failure()));
  page.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url())});
  if(process.env.DEBUG) {
    page.on('request',r=>console.log('REQ',r.url()));
    page.on('response',async r=>{if(r.url().includes('MainLayout'))console.log('MAIN',r.status(),r.headers()['content-type'],(await r.text()).slice(0,200))});
    page.on('console',m=>console.log('CONSOLE',m.type(),m.text()));
  }
  const routes = (process.env.UI_ROUTES || '/dashboard,/projects,/testcases,/testsuites,/test-bugs,/test-executions,/requirements,/knowledge-management,/data-factory,/personal-center,/users,/organizations,/permissions,/llm-configs,/api-keys,/remote-mcp-configs,/skills,/ai-diagram,/testcase-templates,/langgraph-chat,/api-automation,/api-automation?tab=test-cases,/api-automation?tab=environments,/api-automation?tab=execution-records,/api-automation?tab=execution-report,/ui-automation,/ui-automation?tab=page-steps,/ui-automation?tab=testcases,/ui-automation?tab=ai-intelligent,/ui-automation?tab=execution-records,/ui-automation?tab=batch-records,/ui-automation?tab=public-data,/ui-automation?tab=env-config,/ui-automation?tab=actuators,/app-automation,/app-automation?tab=devices,/app-automation?tab=packages,/app-automation?tab=elements,/app-automation?tab=scene-builder,/app-automation?tab=test-cases,/app-automation?tab=suites,/app-automation?tab=executions,/app-automation?tab=scheduled-tasks,/app-automation?tab=notifications,/app-automation?tab=reports,/app-automation?tab=settings').split(',');
  const report=[];
  fs.mkdirSync(root,{recursive:true});
  for (const path of routes) {
    errors.length=0;
    await page.goto(baseUrl+path,{waitUntil:'domcontentloaded'});
    if(!process.env.UI_PUBLIC) await page.waitForFunction(()=>document.querySelector('.content')?.textContent.trim().length > 5,{},{timeout:20000});
    await page.waitForTimeout(1600);
    for(const close of await page.locator('.arco-modal-close-btn').all()) { if(await close.isVisible()) await close.click(); }
    await page.waitForTimeout(300);
    const state=await page.evaluate(()=>{
      const main=document.querySelector('.content');
      const bounds=el=>{const r=el.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};
      const shell=document.querySelector('.main-layout');
      return {url:location.pathname,viewport:innerWidth,docWidth:document.documentElement.scrollWidth,shell:shell&&{...bounds(shell),height:getComputedStyle(shell).height,minHeight:getComputedStyle(shell).minHeight,maxHeight:getComputedStyle(shell).maxHeight,rows:getComputedStyle(shell).gridTemplateRows},main:main&&{...bounds(main),overflow:getComputedStyle(main).overflow,grid:getComputedStyle(main).gridArea,scrollWidth:main.scrollWidth,scrollHeight:main.scrollHeight},overflow:[...(main||document.body).querySelectorAll('*')].filter(el=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>0&&r.height>0&&r.right>innerWidth+3&&s.visibility!=='hidden'&&s.position!=='fixed'&&!el.closest('.feice-auth-atmosphere')&&!el.closest('.arco-table')&&!el.closest('.arco-tabs-content-item:not(.arco-tabs-content-item-active)')}).slice(0,10).map(el=>({tag:el.tagName,cls:el.className,...bounds(el)}))};
    });
    const name = path.replace(/[^a-z0-9]/gi,'-').replace(/^-+/,'');
    await page.screenshot({path:root+'/'+name+'-'+(process.env.UI_WIDTH||1440)+'.png'});
    report.push({path,...state,errors:[...errors]});
    console.log('CHECK',path,JSON.stringify({main:state.main,overflow:state.overflow.length,errors}));
  }
  fs.writeFileSync(root+'/report-'+(process.env.UI_WIDTH||1440)+'.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
  const failures = report.filter(item => item.errors.length || item.overflow.length || item.docWidth > item.viewport || (!process.env.UI_PUBLIC && !item.main));
  console.log(`${report.length - failures.length}/${report.length} layout checks passed at ${process.env.UI_WIDTH || 1440}px`);
  if (failures.length) process.exitCode = 1;
}
module.exports = { installFixtures };
if (require.main === module) run().catch(error => { console.error(error); process.exit(1); });
