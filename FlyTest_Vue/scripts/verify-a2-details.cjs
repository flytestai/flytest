const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installFixtures } = require('./verify-workspace-layout.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5176';
const output = process.env.UI_OUTPUT_DIR || path.resolve(__dirname, '../playwright-screenshots/a2-details');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_CHANNEL?{channel:process.env.UI_BROWSER_CHANNEL}:{})});
  const checks=[];fs.mkdirSync(output,{recursive:true});
  try{
    for(const width of [1440,1024,390,320]){
      const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});await installFixtures(context);
      const writes=[];
      context.on('request',r=>{if(r.method()==='POST'&&/\/api\/projects\/$/.test(new URL(r.url()).pathname))writes.push(r.url())});
      await context.route(/\/api\/projects\/1\/testcases\/(?:\?.*)?$/,route=>route.fulfill({contentType:'application/json',body:JSON.stringify({status:'success',data:[{id:248,name:'银行卡支付成功回调处理',precondition:'检查支付结果与资金流水一致',level:'P0',review_status:'approved',execution_status:'passed',test_type:'functional',related_bug_count:0,module_detail:{id:1,name:'收银台'},creator_detail:{id:1,username:'review',real_name:'林晓'},created_at:'2026-10-30T08:00:00Z'}]})}));
      const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
      for(const route of ['/project-deletion-logs','/users/1/operation-logs','/requirements/1','/requirements/1/report','/ui-automation/trace/1']){
        errors=[];await page.goto(base+route,{waitUntil:'domcontentloaded'});await page.locator('.content').waitFor();await page.waitForTimeout(350);
        assert.deepEqual(errors,[],`${route} ${width} script errors`);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} ${width} overflow`);
        checks.push({route,width,passed:true});
      }
      await page.goto(base+'/projects');await page.getByRole('button',{name:'添加项目',exact:true}).waitFor();
      const danger=page.getByRole('button',{name:'删除',exact:true}).first();assert.equal(await danger.evaluate(e=>getComputedStyle(e).color),'rgb(224, 0, 0)');
      await page.getByRole('button',{name:'添加项目',exact:true}).click();const modal=page.locator('.arco-modal:visible');await modal.waitFor();
      const clipped=await modal.evaluate(root=>[...root.querySelectorAll('input,button,textarea')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.left<0||r.right>innerWidth+1)}).map(e=>e.outerHTML.slice(0,100)));
      assert.deepEqual(clipped,[],`modal controls at ${width}`);
      await modal.getByRole('button',{name:'确定',exact:true}).click();await page.getByText('请输入项目名称',{exact:true}).last().waitFor();
      assert.equal(await modal.isVisible(),true,'Invalid form must remain open');assert.equal(writes.length,0,'Invalid form must not call create project');
      assert.equal(await modal.evaluate(e=>getComputedStyle(e).borderRadius),width<768?'16px':'20px');
      if(width<768)assert((await modal.boundingBox()).height<600,'A short mobile form must not stretch into a full-screen blank panel');
      await modal.screenshot({path:path.join(output,`project-dialog-${width}.png`)});
      await modal.getByRole('button',{name:'取消',exact:true}).click();await modal.waitFor({state:'hidden'});
      checks.push({check:'dialog bounds, validation, cancel and danger button color',width,passed:true});
      await page.goto(base+'/testcases');const name=page.getByText('银行卡支付成功回调处理',{exact:true});await name.waitFor();
      const uncovered=await name.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(Math.max(0,r.left)+8,r.top+r.height/2);return r.left<innerWidth-20&&hit?.closest('td')===el.closest('td')});
      assert(uncovered,`Case name must not be covered by fixed action columns at ${width}`);
      await page.screenshot({path:path.join(output,`populated-cases-${width}.png`)});checks.push({check:'populated testcase name stays readable beside actions',width,passed:true});
      await context.close();
    }
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(checks,null,2));console.log(`${checks.length} dynamic detail and dialog checks passed`);
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
