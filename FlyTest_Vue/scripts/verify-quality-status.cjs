const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { Script } = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installFixtures } = require('./verify-workspace-layout.cjs');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5175';
const output = process.env.UI_OUTPUT_DIR || path.resolve(__dirname, '../playwright-screenshots/a2-quality');

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const source = fs.readFileSync(path.resolve(__dirname, '../src/utils/qualityStatus.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const sandbox = { exports: {} }; new Script(compiled).runInNewContext(sandbox);
  const q = sandbox.exports;
  const checks = [];
  for (const [rate, pass, coverage] of [[0,'danger','danger'],[79.999,'danger','danger'],[80,'danger','success'],[99.9999,'danger','success'],[100,'success','success'],[null,'neutral','neutral'],[undefined,'neutral','neutral'],[-1,'neutral','neutral'],[101,'neutral','neutral'],[NaN,'neutral','neutral']]) {
    assert.equal(q.passRateTone(rate), pass); assert.equal(q.coverageTone(rate), coverage);
    checks.push({ check: `rate ${String(rate)}`, pass, coverage, passed: true });
  }
  assert.equal(q.formatQualityPercent(99.9999), '99.9%');
  assert.equal(q.calculatePassRate(0,0),null);
  assert.equal(q.passRateTone(q.calculatePassRate(99999,100000)),'danger');
  assert.equal(q.calculatePassRate(101,100),null);
  assert.equal(q.progressFraction(96.8),0.968);
  assert.equal(q.progressFraction(120),1);
  assert.equal(q.progressFraction(null),0);
  const browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_CHANNEL ? { channel: process.env.UI_BROWSER_CHANNEL } : {}) });
  try {
    for (const scenario of [{name:'partial',passed:968,total:1000,coverage:78.2},{name:'perfect',passed:1000,total:1000,coverage:80},{name:'near-perfect',passed:99999,total:100000,coverage:79.999},{name:'no-data',passed:0,total:0}]) {
      const context = await browser.newContext({ viewport: { width:1440,height:1000 }, reducedMotion:'reduce' });
      await installFixtures(context);
      await context.route('**/api/projects/1/statistics/', route => route.fulfill({contentType:'application/json',body:JSON.stringify({status:'success',data:{testcases:{total:1248,by_review_status:{approved:1086,pending_review:24}},executions:{case_results:{passed:scenario.passed,total:scenario.total}},bugs:{open:18,total:25,high_severity:3,pending_retest:8},ui_automation:{total_cases:168,total_executions:100,by_status:{success:96,failed:4}},api_automation:{test_cases:420,requests:560,executions:120},...(scenario.coverage!==undefined?{automation_coverage:{rate:scenario.coverage}}:{}),execution_trend:{daily_7d:Array.from({length:7},(_,i)=>({date:`2026-10-${24+i}`,passed:20+i*7,failed:i+1})),summary_30d:{execution_count:125,passed:scenario.passed,failed:scenario.total-scenario.passed}}}})}));
      const page = await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/dashboard'); await page.locator('[data-metric=total] .kpi-value').filter({hasText:'1,248'}).waitFor();
      const pass=page.locator('[data-metric=pass-rate]'),coverage=page.locator('[data-metric=coverage]');
      const expectedPass=scenario.total?q.passRateTone(scenario.passed/scenario.total*100):'neutral';
      assert.equal(await pass.getAttribute('data-quality'),expectedPass);
      assert.equal(await coverage.getAttribute('data-quality'),q.coverageTone(scenario.coverage));
      assert.equal(await page.locator('[data-metric=open-defects]').getAttribute('data-quality'),'danger');
      assert.equal(await page.locator('[data-metric=open-defects] .kpi-value').evaluate(el=>getComputedStyle(el).color),'rgb(224, 0, 0)');
      const green=await page.locator('.insights-chart-stack>.tone-success').first().evaluate(el=>({color:getComputedStyle(el).backgroundColor,height:el.getBoundingClientRect().height}));
      const red=await page.locator('.insights-chart-stack>.tone-danger').first().evaluate(el=>({color:getComputedStyle(el).backgroundColor,height:el.getBoundingClientRect().height}));
      assert.equal(green.color,'rgb(0, 128, 0)');assert.equal(red.color,'rgb(224, 0, 0)');assert(green.height>red.height&&red.height>0,'Trend columns preserve their real positive counts');
      assert.deepEqual(errors,[]);
      if(scenario.name==='partial'){
        await page.screenshot({path:path.join(output,'dashboard-desktop.png')});
        await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'dashboard-mobile.png')});
        await page.setViewportSize({width:1440,height:1000});
        await page.locator('.theme-switch-button').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'black');
        assert.notEqual(await page.locator('[data-metric=open-defects] .kpi-value').evaluate(el=>getComputedStyle(el).color),'rgb(224, 0, 0)');
        await page.screenshot({path:path.join(output,'dashboard-dark.png')});
      }
      checks.push({check:scenario.name,passed:true});await context.close();
    }
    const reportContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await installFixtures(reportContext);
    const reportCalls=[];
    await reportContext.route('**/api/**',route=>{
      const pathname=new URL(route.request().url()).pathname;
      if(!pathname.endsWith('/execution-records/report/'))return route.fallback();
      reportCalls.push(pathname);
      return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'success',data:{summary:{total_count:1000,success_count:968,passed_count:968,failed_count:32,error_count:0,pass_rate:96.8,avg_response_time:120,latest_executed_at:null},method_breakdown:[],collection_breakdown:[],failing_requests:[],trend:[],recent_records:[],run_groups:[]}})});
    });
    const reportPage=await reportContext.newPage();await reportPage.goto(base+'/api-automation?tab=execution-report');
    const progress=reportPage.locator('.arco-progress-line-bar').first();
    try{await progress.waitFor()}catch(e){console.error('Report fixture diagnostics',JSON.stringify({calls:reportCalls,url:reportPage.url(),text:(await reportPage.locator('body').innerText()).slice(0,1500)}));throw e}
    const state=await progress.evaluate(el=>({width:el.style.width,color:getComputedStyle(el).backgroundColor}));
    assert.equal(state.width,'96.8%');assert.equal(state.color,'rgb(224, 0, 0)');
    await reportPage.screenshot({path:path.join(output,'api-report.png')});
    checks.push({check:'API report 96.8% uses red and correct 0–1 progress fraction',passed:true});await reportContext.close();
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(checks,null,2));console.log(`${checks.length} quality rule and rendered dashboard/report checks passed`);
  } finally { await browser.close(); }
}
run().catch(e=>{console.error(e);process.exitCode=1});
