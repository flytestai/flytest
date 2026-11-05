const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installFixtures}=require('./verify-workspace-layout.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.UI_BASE_URL||'http://127.0.0.1:5175',output=path.resolve(__dirname,'../playwright-screenshots/app-overview-reference');
async function fixtures(context){
 await installFixtures(context);
 const now=new Date().toISOString(),state={passed:314,failed:12,empty:false,error:false,bugError:false,legacy:false};
 const task={id:31,project_id:1,name:'夜间回归测试',task_type:'TEST_CASE',test_case_id:41,test_case_name:'APP 登录流程',status:'ACTIVE',trigger_type:'CRON',cron_expression:'0 22 * * *',next_run_time:now,created_at:now,updated_at:now,last_result:{},total_runs:1,successful_runs:1,failed_runs:0};
 const record={id:51,project_id:1,test_case_id:41,case_name:'APP 登录流程',device_id:1,device_name:'Pixel 7',status:'completed',result:'passed',progress:100,total_steps:3,passed_steps:3,failed_steps:0,created_at:now,started_at:now,finished_at:now,duration:12,report_path:'/reports/51.html'};
 const fulfill=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status===200,status:status===200?'success':'error',code:status,data,message:status===200?'':'暂时不可用'})});
 await context.route('**/api/projects/1/statistics/**',route=>state.bugError?fulfill(route,null,503):fulfill(route,{bugs:{open:4,pending_retest:3}}));
 await context.route('**/api/app-automation/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/dashboard/statistics/')){
   if(state.error)return fulfill(route,null,503);
   const data={devices:state.empty?{total:0,online:0,locked:0,busy:0,offline:0,unavailable:0}:{total:12,online:8,locked:2,busy:2,offline:1,unavailable:1},packages:{total:state.empty?0:8},elements:{total:42},test_cases:{total:state.empty?0:168},executions:{total:state.empty?0:state.passed+state.failed,running:0,passed:state.empty?0:state.passed,failed:state.empty?0:state.failed,pass_rate:100},recent_executions:state.empty?[]:[record],trend:Array.from({length:30},(_,i)=>{const day=new Date();day.setUTCDate(day.getUTCDate()-29+i);return {day:day.toISOString().slice(0,10),total:state.empty?0:i+2,passed:state.empty?0:i+1,failed:state.empty?0:1}})};if(state.legacy){delete data.trend;delete data.devices.busy;delete data.devices.offline;delete data.devices.unavailable}return fulfill(route,data);
  }
  if(url.pathname.endsWith('/devices/'))return fulfill(route,Array.from({length:12},(_,index)=>({id:index+1,device_id:'device-'+index,name:'Device '+index,status:index<8?'available':index<10?'locked':index===10?'offline':'unauthorized'})));
  if(url.pathname.endsWith('/executions/'))return fulfill(route,[record,{...record,id:52,result:'failed'}]);
  if(url.pathname.includes('/scheduled-tasks/'))return fulfill(route,state.empty?[]:[task]);
  if(url.pathname.endsWith('/health'))return fulfill(route,{status:'ok',service:'app-automation',version:'1',checked_at:now,scheduler:{running:true,running_tasks:0,poll_interval_seconds:15}});
  return fulfill(route,[]);
 });return state;
}
async function run(){fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true,channel:'msedge'}),report=[];
 try{for(const width of (process.env.UI_WIDTHS||'1672,1280,390,320').split(',').map(Number)){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),state=await fixtures(context),page=await context.newPage(),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/app-automation?tab=overview',{waitUntil:'domcontentloaded'});await page.locator('.app-overview-metric').filter({hasText:'设备总数'}).getByText('12',{exact:true}).waitFor();
  assert.equal(await page.locator('.app-overview-metric').count(),6);assert.equal(await page.locator('.app-device-legend li').count(),4);assert(await page.locator('.app-overview-metric.quality-danger').filter({hasText:'通过率'}).count());assert.equal(await page.locator('.app-chart-data tbody tr').count(),7);await page.screenshot({path:path.join(output,`overview-${width}-7-days.png`),fullPage:true});
  await page.getByLabel('趋势统计时间范围').click();await page.locator('.arco-select-option').filter({hasText:'近 30 天'}).click();assert.equal(await page.locator('.app-chart-data tbody tr').count(),30);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document overflow');const outside=await page.locator('.app-overview-hero,.app-overview-metric,.app-overview-panel>header button,.app-overview-todo,.app-assistant-action button').evaluateAll(nodes=>nodes.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1)}).map(el=>el.className));assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);await page.screenshot({path:path.join(output,`overview-${width}.png`),fullPage:true});report.push({width,check:'layout and 30-day range',passed:true});
  if(width===1672){
   for(const [passed,failed,tone] of [[100,0,'success'],[99999,1,'danger'],[0,0,'neutral']]){state.passed=passed;state.failed=failed;await page.getByRole('button',{name:'刷新概览',exact:true}).click();await page.locator('.app-overview-metric.quality-'+tone).filter({hasText:'通过率'}).waitFor();assert.equal(await page.locator('.app-overview-metric.quality-'+tone).filter({hasText:'通过率'}).count(),1);report.push({check:'pass rate '+tone,passed:true})}
   state.error=true;await page.getByRole('button',{name:'刷新概览',exact:true}).click();await page.getByText('概览数据加载失败',{exact:true}).waitFor();state.error=false;await page.getByRole('button',{name:'重试',exact:true}).click();await page.getByText('概览数据加载失败',{exact:true}).waitFor({state:'hidden'});report.push({check:'error and retry',passed:true});
   state.legacy=true;state.passed=314;state.failed=12;await page.getByRole('button',{name:'刷新概览',exact:true}).click();await page.getByText('所选时段共执行 2 次 · 通过率按已完成结果计算 · UTC 日期',{exact:true}).waitFor();assert.equal(await page.locator('.app-device-legend li').first().innerText().then(text=>text.includes('8')),true);report.push({check:'legacy service real-list compatibility',passed:true});state.legacy=false;
   state.bugError=true;await page.getByRole('button',{name:'刷新概览',exact:true}).click();await page.getByText('项目缺陷统计暂不可用，可刷新后重试。',{exact:true}).waitFor();assert(await page.locator('.app-overview-metric').filter({hasText:'待处理缺陷'}).innerText().then(text=>text.includes('—')));report.push({check:'unavailable project bug statistics',passed:true});state.bugError=false;
   state.empty=true;await page.getByRole('button',{name:'刷新概览',exact:true}).click();await page.getByText('暂无设备，连接设备后可查看运行状态。',{exact:true}).waitFor();assert.equal(await page.locator('.app-trend-svg circle').count(),0);report.push({check:'empty states',passed:true});
  }await context.close();console.log('PASS overview '+width);
 }fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(report.length+' APP overview checks passed');}finally{await browser.close()}}
module.exports={fixtures};if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1});
