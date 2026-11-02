const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installNavyFixtures}=require('./verify-navy-workbench.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.UI_BASE_URL||'http://127.0.0.1:5176';
const output=process.env.UI_OUTPUT_DIR||path.resolve(__dirname,'../playwright-screenshots/refined-contracts');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.UI_BROWSER_CHANNEL||'msedge'});const report=[];fs.mkdirSync(output,{recursive:true});
 try{
  for(const width of (process.env.UI_WIDTHS||'1440,1024,390,320').split(',').map(Number)){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(30000);await installNavyFixtures(context);
   let releaseHealth;const healthGate=new Promise(resolve=>releaseHealth=resolve);
   await context.route('**/api/app-automation/health',async route=>{await healthGate;await route.fulfill({json:{status:'success',data:{service:'app-automation',status:'ok',scheduler:{running:true,running_tasks:0,poll_interval_seconds:5}}}})});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/app-automation');await page.locator('.stat-card').last().waitFor();
   await page.getByText('正在检查服务',{exact:true}).waitFor();assert.equal(await page.getByText('服务异常',{exact:true}).count(),0);releaseHealth();
   await page.getByText(/调度器运行中/).first().waitFor();
   assert.equal(await page.locator('.content').getByRole('heading',{name:'APP 自动化概览',exact:true}).count(),1);
   assert.equal(await page.getByRole('heading',{name:'APP 自动化总控台',exact:true}).count(),0);
   await page.screenshot({path:path.join(output,'app-inspect-'+width+'.png')});const boxes=await page.locator('.stat-card').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right}}));
   if(width<768){assert.equal(boxes[0].y,boxes[1].y,'mobile metrics use two columns');assert(boxes[0].y<400,'first metrics appear in the first screen');assert(boxes.every(b=>b.right<=width),'metrics fit narrow devices');
    await page.getByRole('button',{name:'APP 自动化全部页面',exact:true}).click();await page.keyboard.press('End');assert.equal(await page.getByRole('menuitem',{name:'环境设置',exact:true}).evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Enter');await page.locator('.content').getByRole('heading',{name:'环境设置',exact:true}).waitFor();
   }else if(width===1440)assert.equal(new Set(boxes.map(b=>b.y)).size,1,'wide metrics share a row');
   await page.screenshot({path:path.join(output,`app-${width}.png`)});report.push({width,check:'single heading, loading status, responsive metrics and mobile module menu',passed:true});
   await page.goto(base+'/testcases');await page.getByRole('button',{name:/重复支付请求幂等校验/}).waitFor();assert.equal(await page.locator('.content h2:visible').count(),1);assert.equal(await page.locator('.fc-workspace-heading .fc-page-heading__copy:visible').count(),0);await page.screenshot({path:path.join(output,`assets-${width}.png`)});report.push({width,check:'asset heading and populated table',passed:true});
   await page.goto(base+'/knowledge-management');await page.getByRole('heading',{name:'建立团队的第一座知识库',exact:true}).waitFor();await page.locator('.fc-start-state').getByRole('button',{name:'新建知识库',exact:true}).click();await page.locator('.arco-modal:visible').waitFor();await page.locator('.arco-modal:visible').getByRole('button',{name:'取消',exact:true}).click();report.push({width,check:'actionable knowledge empty state opens and cancels create form',passed:true});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await context.close();
  }
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await installNavyFixtures(context);
  await context.route('**/api/projects/1/statistics/',route=>route.fulfill({json:{status:'success',data:{testcases:{total:120,by_review_status:{pending_review:5}},executions:{case_results:{passed:95,total:100}},bugs:{open:3,high_severity:1},execution_trend:{daily_7d:[{date:'2026-11-01',passed:95,failed:5},{date:'2026-11-02',passed:90,failed:10}],summary_30d:{execution_count:200,passed:185,failed:15}}}}}));
  const page=await context.newPage();await page.goto(base+'/dashboard');await page.locator('.fc-rate-bar--pass').first().waitFor();assert.equal(await page.locator('.fc-rate-line').count(),0);assert.equal(await page.locator('.fc-rate-bar--pass').first().evaluate(n=>getComputedStyle(n).fill),'rgb(0, 128, 0)');assert.equal(await page.locator('.fc-rate-bar--fail').first().evaluate(n=>getComputedStyle(n).fill),'rgb(224, 0, 0)');await page.getByRole('region',{name:'项目质量摘要'}).waitFor();report.push({check:'red/green bar chart and honest quality summary',passed:true});
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(`${report.length}/${report.length} refined workbench checks passed`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

