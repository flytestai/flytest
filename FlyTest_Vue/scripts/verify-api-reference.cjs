const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installNavyFixtures } = require('./verify-navy-workbench.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5175';
const output = process.env.UI_OUTPUT_DIR || path.resolve(__dirname, '../playwright-screenshots/api-reference');

async function fixtures(context) {
  const state = await installNavyFixtures(context);
  const now = '2026-11-02T08:00:00Z';
  const cases = [101, 102, 103].map((id,index) => ({ id,project:1,request:21,request_name:'创建订单',request_method:'POST',request_url:'/api/orders',collection_id:11,name:['重复支付请求幂等校验','订单正常创建','取消已发货订单'][index],description:'验证订单状态与交易记录保持一致',status:index===0?'draft':'ready',tags:[],script:{},assertions:[{type:'status_code',expected:201}],creator:1,creator_name:'陈晨',created_at:now,updated_at:now }));
  const records = cases.map((item,index) => ({ id:index+1,project:1,request:21,test_case:item.id,environment:1,run_id:'RUN-20261102-00'+index,run_name:'订单回归 '+index,request_name:'创建订单',interface_name:'创建订单',test_case_name:item.name,method:'POST',url:'/api/orders',status:index===1?'failed':'success',passed:index!==1,status_code:201,response_time:180+index*10,request_snapshot:{body:{quantity:2}},response_snapshot:{body:{order_id:'ORDER-1001'}},assertions_results:[{name:'订单状态',expected:'created',actual:index===1?'pending':'created',passed:index!==1}],error_message:index===1?'断言失败：订单状态不符合预期':'',executor:1,executor_name:'陈晨',environment_name:'测试环境',created_at:now }));
  const environments = [{id:1,project:1,name:'测试环境',base_url:'https://api.example.test',timeout_ms:30000,is_default:true,variables:{token:'fixture-secret-token',tenant_id:'test-tenant'},common_headers:{Authorization:'Bearer fixture-secret-token'},creator:1,created_at:now,updated_at:now},{id:2,project:1,name:'回归环境',base_url:'https://regression.example.test',timeout_ms:60000,is_default:false,variables:{tenant_id:'regression'},common_headers:{},creator:1,created_at:now,updated_at:now}];
  Object.assign(state,{cases,records,environments,created:[],environmentWrites:[]});
  const fulfill=(route,data)=>route.fulfill({json:{status:'success',success:true,code:200,data}});
  await context.route(/\/api\/api-automation\/test-cases\/(?:\?.*)?$/,route=>{if(route.request().method()==='POST'){const data=route.request().postDataJSON();state.created.push(data);const item={...cases[0],...data,id:104};cases.push(item);return fulfill(route,item)}return fulfill(route,cases)});
  await context.route(/\/api\/api-automation\/test-cases\/\d+\/(?:\?.*)?$/,route=>{const id=Number(new URL(route.request().url()).pathname.match(/test-cases\/(\d+)/)[1]),item=cases.find(item=>item.id===id);if(route.request().method()==='PATCH')Object.assign(item,route.request().postDataJSON());return fulfill(route,item)});
  await context.route(/\/api\/api-automation\/execution-records\/(?:\?.*)?$/,route=>fulfill(route,records));
  await context.route(/\/api\/api-automation\/execution-records\/report-summary\/(?:\?.*)?$/,route=>fulfill(route,{summary:'本轮存在订单状态断言失败，请优先核对响应状态。',note:'规则汇总',used_ai:false,top_risks:[],recommended_actions:[],evidence:[],cache_hit:false,duration_ms:1}));
  await context.route(/\/api\/api-automation\/environments\/(?:\?.*)?$/,route=>fulfill(route,environments));
  await context.route(/\/api\/api-automation\/environments\/\d+\/(?:\?.*)?$/,route=>{const payload=route.request().postDataJSON();state.environmentWrites.push(payload);const item=environments.find(item=>item.id===Number(new URL(route.request().url()).pathname.match(/environments\/(\d+)/)[1]));Object.assign(item,payload);return fulfill(route,item)});
  await context.route(/\/api\/api-automation\/execution-records\/report\/(?:\?.*)?$/,route=>fulfill(route,{summary:{total_count:3,success_count:2,passed_count:2,failed_count:1,error_count:0,pass_rate:66.6,avg_response_time:190,latest_executed_at:now},method_breakdown:[{method:'POST',total:3,passed:2,failed:1,error:0,avg_response_time:190}],collection_breakdown:[{request__collection__name:'支付中心',total:3,passed:2,failed:1,error:0}],failing_requests:[{request_id:21,request_name:'创建订单',request__collection__name:'支付中心',total:1,latest_executed_at:now,latest_status_code:201}],trend:Array.from({length:7},(_,i)=>({day:'2026-10-'+(26+i),total:3+i,passed:2+i,failed:1,error:0})),recent_records:records,run_groups:[],hierarchy_summary:{run_count:3,interface_count:1,failed_interface_count:1,test_case_count:3,failed_test_case_count:1}}));
  return state;
}

async function selectRequest(page) {
  const toggle=page.getByRole('button',{name:'接口目录',exact:true});
  if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  await page.locator('.fc-workspace-directory:visible .fc-directory-node__label').filter({hasText:/^创建订单$/}).click();
}
async function fit(page) {
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document must not overflow');
  const bad=await page.locator('.api-page-actions button,.api-workspace-metrics .asset-metric,.api-local-toolbar input,.api-local-toolbar .arco-select-view').evaluateAll(nodes=>nodes.filter(node=>{const r=node.getBoundingClientRect();return r.width>0 && (r.left< -1 || r.right>innerWidth+1)}).map(node=>node.outerHTML.slice(0,140)));
  assert.deepEqual(bad,[],'visible controls must fit');
}
async function run() {
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:process.env.UI_BROWSER_CHANNEL || 'msedge'}), report=[];
  try { for(const width of (process.env.UI_WIDTHS || '1440,1024,390,320').split(',').map(Number)) {
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}), state=await fixtures(context), page=await context.newPage(), errors=[];
    page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
    for(const tab of ['requests','test-cases','environments','execution-records','execution-report']) {
      await page.goto(base+'/api-automation?tab='+tab);
      await page.locator('.api-page-hero h2').waitFor();
      assert.equal(await page.locator('.api-workspace-metrics .asset-metric').count(),4);
      if(tab==='requests') {
        await selectRequest(page);await page.locator('.fc-request-target .arco-input-wrapper input').waitFor();
        await page.locator('.fc-request-target').getByRole('button',{name:'执行测试',exact:true}).click();
        await page.locator('.fc-request-result-grid').getByText('ORDER-1001',{exact:false}).waitFor();
        if(width>=1360){await page.getByRole('region',{name:'接口概览'}).waitFor();assert((await page.locator('.fc-request-results').boundingBox()).y<850,'response section begins within first desktop screen');}
        if(width===1440){await page.locator('.fc-request-target .arco-input-wrapper input').fill('/api/orders/updated');await page.locator('.fc-request-target').getByRole('button',{name:'保存',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.fc-request-unsaved'));assert.equal(state.saved.at(-1).url,'/api/orders/updated');}
      }
      if(tab==='test-cases') {
        await selectRequest(page);await page.locator('.api-row-name').filter({hasText:'重复支付请求幂等校验'}).click();
        const preview=page.locator('.api-preview:visible').filter({hasText:'用例详情'}),scrollBefore=await page.locator('.fc-workspace-content').evaluate(node=>node.scrollTop);await preview.getByRole('button',{name:'设为就绪',exact:true}).click();await preview.getByRole('button',{name:'已就绪',exact:true}).waitFor();assert.equal(state.cases[0].status,'ready');if(width>=1360)assert.equal(await page.locator('.fc-workspace-content').evaluate(node=>node.scrollTop),scrollBefore,'detail actions must not scroll the list toolbar away');await page.screenshot({path:path.join(output,'case-preview-'+width+'.png'),fullPage:true});await preview.getByRole('button',{name:'关闭用例详情',exact:true}).click();
        if(width===1440){await page.locator('.api-page-actions').getByRole('button',{name:'新建用例',exact:true}).click();const modal=page.locator('.arco-modal:visible');await modal.locator('input').first().fill('人工新建订单用例');await modal.getByRole('button',{name:'确定',exact:true}).click();await modal.waitFor({state:'hidden'});assert.equal(state.created.length,1);assert.equal(state.created[0].request,21);}
      }
      if(tab==='environments') {
        await page.locator('.api-row-name').filter({hasText:'测试环境'}).click();const preview=page.locator('.api-preview:visible').filter({hasText:'环境详情'});
        if(width>=1360){const header=page.getByRole('columnheader',{name:'基础地址',exact:true});await header.waitFor();assert((await header.boundingBox()).width>=200,'base URL retains a readable column width');}
        assert(!(await preview.innerText()).includes('fixture-secret-token'),'secrets start masked');
        await preview.getByRole('button',{name:'显示变量 token',exact:true}).click();assert((await preview.innerText()).includes('fixture-secret-token'));await preview.getByRole('button',{name:'隐藏变量 token',exact:true}).click();
        await page.screenshot({path:path.join(output,'environment-preview-'+width+'.png'),fullPage:true});await preview.getByRole('button',{name:'编辑环境',exact:true}).click();const modal=page.locator('.arco-modal:visible');if(width===1440){await modal.locator('input').first().fill('测试环境更新');await modal.getByRole('button',{name:'确定',exact:true}).click();await modal.waitFor({state:'hidden'});assert.equal(state.environmentWrites[0].variables.token,'fixture-secret-token');}else await modal.getByRole('button',{name:'取消',exact:true}).click();await preview.getByRole('button',{name:'关闭环境详情',exact:true}).click();
      }
      if(tab==='execution-records') {
        await page.locator('.api-row-name').filter({hasText:'订单回归 1'}).click();const preview=page.locator('.api-preview:visible').filter({hasText:'执行详情'});await preview.getByText('错误摘要',{exact:true}).waitFor();await preview.getByRole('button',{name:'查看完整日志与复盘',exact:true}).click();await page.locator('.arco-modal:visible').getByText('执行记录详情',{exact:true}).waitFor();await page.locator('.arco-modal:visible .arco-modal-close-btn').click();await preview.getByRole('button',{name:'关闭执行详情',exact:true}).click();
      }
      if(tab==='execution-report') {await page.getByRole('heading',{name:'结果分布',exact:true}).waitFor();assert.equal(await page.locator('.api-trend-day').count(),7);assert(await page.locator('.api-report-ai summary').isVisible());if(width===1440){await page.getByRole('button',{name:'生成 AI 摘要',exact:true}).click();await page.getByText('规则摘要已生成',{exact:true}).waitFor();assert.equal(await page.locator('.api-report-ai').getAttribute('open'),'');}}
      if(tab!=='environments'){const metric=page.locator('.api-workspace-metrics .asset-metric').filter({hasText:tab==='execution-report'?'总通过率':'通过率'});await metric.locator('strong').filter({hasText:'66.6%'}).waitFor();assert((await metric.getAttribute('class')).includes('danger'));}
      await fit(page);assert.deepEqual(errors,[]);await page.mouse.move(0,0);await page.screenshot({path:path.join(output,tab+'-'+width+'.png'),fullPage:true});report.push({tab,width,passed:true});console.log('PASS '+tab+' '+width);
    }
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await installNavyFixtures(context);
  let passed=1,total=1,unavailable=false;
  await context.route(/\/api\/api-automation\/execution-records\/report\/(?:\?.*)?$/,route=>unavailable?route.fulfill({status:503,json:{message:'fixture unavailable'}}):route.fulfill({json:{status:'success',data:{summary:{total_count:total,passed_count:passed,success_count:passed,failed_count:total-passed,error_count:0,pass_rate:total?passed/total*100:0,avg_response_time:null,latest_executed_at:null},method_breakdown:[],collection_breakdown:[],failing_requests:[],trend:[],recent_records:[],run_groups:[]}}}));
  const page=await context.newPage();page.setDefaultTimeout(30000);
  for(const item of [{passed:100,total:100,text:'100%',tone:'success'},{passed:99999,total:100000,text:'99.9%',tone:'danger'},{passed:0,total:0,text:'—',tone:'neutral'}]){passed=item.passed;total=item.total;await page.goto(base+'/api-automation');const metric=page.locator('.api-workspace-metrics .asset-metric').filter({hasText:'通过率'});await metric.locator('strong').getByText(item.text,{exact:true}).waitFor();assert((await metric.getAttribute('class')).includes('asset-metric--'+item.tone));report.push({check:'pass rate '+item.text,passed:true});}
  unavailable=true;await page.goto(base+'/api-automation?tab=execution-report');await page.locator('.api-report-error').waitFor();unavailable=false;total=1;passed=1;await page.locator('.api-report-error').getByRole('button',{name:'重试',exact:true}).click();await page.getByRole('heading',{name:'结果分布',exact:true}).waitFor();report.push({check:'report error and retry',passed:true});await context.close();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(report.length+'/'+report.length+' API reference checks passed');}finally{await browser.close();}
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1});
module.exports={fixtures,selectRequest};
