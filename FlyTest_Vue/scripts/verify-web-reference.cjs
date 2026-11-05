const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installFixtures}=require('./verify-workspace-layout.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.UI_BASE_URL||'http://127.0.0.1:5175',output=path.resolve(__dirname,'../playwright-screenshots/web-reference');
const tabs=['pages','page-steps','testcases','ai-intelligent','execution-records','batch-records','public-data','env-config','actuators'];
async function fixtures(context){
 await installFixtures(context);
 const now='2026-11-03T08:00:00Z';
 const common={project:1,module:11,module_name:'订单管理',creator:1,creator_name:'admin',created_at:now,updated_at:now};
 const entries={
  pages:[{...common,id:101,name:'创建订单页',url:'/orders/create',element_count:3,description:'创建订单并确认支付信息'},{...common,id:102,name:'订单详情页',url:'/orders/detail',element_count:2}],
  'page-steps':[{...common,id:201,page:101,page_name:'创建订单页',name:'点击提交订单',step_count:2,status:2},{...common,id:202,page:101,page_name:'创建订单页',name:'校验订单结果',step_count:1,status:0}],
  testcases:[{...common,id:301,name:'订单提交完整流程',level:'P1',status:2,step_count:2,front_custom:[],front_sql:[],posterior_sql:[],parametrize:[]},{...common,id:302,name:'重复订单校验',level:'P0',status:3,step_count:1,front_custom:[],front_sql:[],posterior_sql:[],parametrize:[]}],
  'execution-records':[{...common,id:401,test_case:301,test_case_name:'订单提交完整流程',executor_name:'admin',status:3,trigger_type:'manual',duration:12,start_time:now,end_time:now,error_message:'未找到支付成功提示',step_results:[],screenshots:[],log:'断言未通过'}],
  'batch-records':[{...common,id:501,name:'订单链路冒烟',status:2,total_cases:2,passed_cases:2,failed_cases:0,success_rate:100,duration:24,execution_records:[]}],
  'public-data':[{...common,id:601,key:'login_password',value:'secret-fixture-value',type:0,is_enabled:true},{...common,id:602,key:'product_name',value:'飞测平台',type:0,is_enabled:false}],
  'env-configs':[{...common,id:701,name:'默认环境',base_url:'https://example.test/with/a/long/path',browser:'chromium',headless:true,is_default:true,viewport_width:1440,viewport_height:900,timeout:30000,db_c_status:false,db_rud_status:false,mysql_config:{},extra_config:{}}],
 };
 const nodes=[{...common,id:11,name:'订单管理',parent:null,level:0,children:[]}];
 const fulfill=(route,data)=>route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,status:'success',code:200,data})});
 await context.route('**/api/ui-automation/**',route=>{
  const url=new URL(route.request().url()),parts=url.pathname.split('/').filter(Boolean),kind=parts[2],id=Number(parts[3]);
  if(kind==='modules')return fulfill(route,nodes);
  if(kind==='actuators')return fulfill(route,{count:1,items:[{id:'local',name:'FeiCe 本地执行器',ip:'127.0.0.1',type:'web_ui',browser_type:'chromium',is_open:true,debug:false,headless:true,connected_at:now}]});
  if(kind==='ai-execution-records'&&parts[3]==='capabilities')return fulfill(route,{execution_backend:'browser_use',browser_use_available:true,playwright_available:true,browser_executable_found:true,llm_configured:false,text_mode_ready:false,vision_mode_ready:false,supports_vision:false,summary:'需要配置模型',issues:['当前没有激活的 LLM 配置'],recommendations:['请配置可用模型后再运行任务。'],default_environment:entries['env-configs'][0]});
  const rows=entries[kind]||[];
  if(id){const item={...rows.find(r=>r.id===id)};if(kind==='pages')item.elements=[{id:1,name:'提交订单',locator_type:'css',locator_value:'#submit'}];if(kind==='page-steps')item.step_details=[{id:1,step_type:0,element_name:'提交订单',step_sort:1}];if(kind==='testcases')item.case_steps=[{id:1,page_step_name:'点击提交订单',case_sort:1}];return fulfill(route,item)}
  const filtered=url.searchParams.get('search')?rows.filter(row=>String(row.name||row.key).includes(url.searchParams.get('search'))):rows;
  return fulfill(route,{count:filtered.length,results:filtered});
 });
}
async function run(){fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true,channel:'msedge'}),report=[];
 try{for(const width of (process.env.UI_WIDTHS||'1672,1280,390,320').split(',').map(Number)){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});await fixtures(context);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
  await page.goto(base+'/ui-automation?tab=pages',{waitUntil:'domcontentloaded',timeout:60000});
  for(const tab of tabs){errors.length=0;if(tab!=='pages'){const all=page.getByRole('button',{name:'Web 自动化全部页面',exact:true});if(await all.isVisible()){await all.click();const labels={pages:'页面管理','page-steps':'页面步骤',testcases:'测试用例','ai-intelligent':'AI 智能模式','execution-records':'执行记录','batch-records':'批量执行','public-data':'公共数据','env-config':'环境配置',actuators:'执行器'};await page.locator('.fc-module-menu').getByRole('menuitem',{name:labels[tab],exact:true}).click()}else await page.locator('.fc-module-tabs a[href="/ui-automation?tab='+tab+'"]').click();await page.waitForFunction(tab=>new URLSearchParams(location.search).get('tab')===tab,tab)}await page.locator('#web-workspace-metrics .web-metric:visible').first().waitFor();await page.waitForTimeout(450);assert.equal(await page.locator('#web-workspace-metrics .web-metric:visible').count(),4);
   if(tab!=='ai-intelligent'){
    await page.locator('.fc-workspace-pane:visible .web-row-link').first().waitFor();await page.locator('.fc-workspace-pane:visible .web-row-link').first().click();await page.locator('.web-record-preview:visible').waitFor();
    if(tab==='pages')await page.locator('.web-record-section').filter({hasText:'页面元素'}).waitFor();
    if(tab==='public-data'){assert(!await page.locator('.web-data-main:visible').innerText().then(t=>t.includes('secret-fixture-value')));const preview=page.locator('.web-record-preview:visible');assert(!await preview.innerText().then(t=>t.includes('secret-fixture-value')));await preview.getByRole('button',{name:'显示内容',exact:true}).click();assert(await preview.innerText().then(t=>t.includes('secret-fixture-value')))}
    if(width===1672)await page.screenshot({path:path.join(output,`${tab}-${width}-detail.png`)});
    await page.locator('.web-record-preview:visible').getByRole('button',{name:'关闭详情',exact:true}).click();
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document overflow '+tab+' '+width);
   const bad=await page.locator('.web-data-main .fc-page-heading input,.web-data-main .fc-page-heading button,.web-metric').evaluateAll(nodes=>nodes.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left< -1||r.right>innerWidth+1)}).map(el=>el.outerHTML.slice(0,160)));assert.deepEqual(bad,[],'controls must fit '+tab+' '+width);assert.deepEqual(errors,[]);
   await page.screenshot({path:path.join(output,`${tab}-${width}.png`)});report.push({tab,width,passed:true});console.log('PASS',tab,width);
  }await context.close();
 }
 const context=await browser.newContext({viewport:{width:1672,height:1000},reducedMotion:'reduce'});await fixtures(context);const page=await context.newPage();page.setDefaultTimeout(60000);await page.goto(base+'/ui-automation?tab=pages',{waitUntil:'domcontentloaded'});await page.locator('.fc-workspace-pane:visible .web-row-link').first().waitFor();
 for(const tab of [...tabs.slice(1),'pages']){await page.locator('.fc-module-tabs a[href="/ui-automation?tab='+tab+'"]').click();await page.locator('.fc-module-tabs a[aria-current="page"][href="/ui-automation?tab='+tab+'"]').waitFor();await page.locator('#web-workspace-metrics .web-metric:visible').first().waitFor();assert.equal(await page.locator('#web-workspace-metrics .web-metric:visible').count(),4)}
 await page.setViewportSize({width:320,height:900});await page.waitForTimeout(400);assert.equal(await page.locator('.web-record-preview:visible').count(),1,'inactive retained tabs must not create drawers');report.push({check:'retained tab drawers after viewport resize',passed:true});
 await page.locator('.web-record-preview:visible').getByRole('button',{name:'查看元素',exact:true}).click();await page.locator('.element-list').waitFor();await page.waitForTimeout(400);const drawers=await page.locator('.arco-drawer:visible').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right}}));assert(drawers.every(r=>r.left>=0 && r.right<=320),'nested element drawers must fit');report.push({check:'nested element drawer at 320px',passed:true});await context.close();
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(report.length+' Web reference checks passed');}finally{await browser.close()}}
module.exports={fixtures};if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1});
