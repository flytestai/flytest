const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installFixtures}=require('./verify-workspace-layout.cjs');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const base=process.env.UI_BASE_URL||'http://127.0.0.1:5176';
const output=path.resolve(__dirname,'../playwright-screenshots/user-reference');
async function fixtures(context){
  await installFixtures(context);
  const state={fail:false,saveFail:false,writes:[],records:Array.from({length:24},(_,i)=>({id:i+1,username:i===0?'layout-review':'tester'+(i+1),real_name:'测试成员',email:'tester'+(i+1)+'@example.test',phone_number:'13812345678',first_name:'',last_name:'',is_staff:i<3,is_active:i%5!==4,groups:[i%2?'研发中心':'测试中心'],approval_status:['approved','pending','rejected'][i%3]}))};
  await context.route('**/api/accounts/users/**',async route=>{
    const method=route.request().method(),url=new URL(route.request().url());
    const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({status:status<400?'success':'error',code:status,data,message:status<400?'success':'隔离验证：用户请求失败'})});
    if(method==='GET' && /permissions/.test(url.pathname))return send([]);
    if(method==='GET')return state.fail?send(null,500):send(state.records);
    state.writes.push({method,path:url.pathname,data:route.request().postDataJSON()});
    if(state.saveFail)return send(null,400);
    const id=Number(url.pathname.match(/users\/(\d+)/)?.[1]);
    if(method==='PATCH'){state.records=state.records.map(u=>u.id===id?{...u,...route.request().postDataJSON()}:u);return send(state.records.find(u=>u.id===id));}
    return send({});
  });
  return state;
}
async function closeModal(p){const m=p.locator('.arco-modal:visible');await m.locator('.arco-modal-close-btn').click();await m.waitFor({state:'hidden'});}
async function select(p,label,text){await p.locator('[aria-label="'+label+'"]').click();await p.locator('.arco-select-option:visible').filter({hasText:new RegExp('^'+text+'$')}).click();}
async function run(){
  fs.mkdirSync(output,{recursive:true});const b=await chromium.launch({headless:true,channel:'msedge'}),checks=[];
  try{for(const width of [1672,1440,1024,768,390]){
    const c=await b.newContext({viewport:{width,height:1000}}),state=await fixtures(c),p=await c.newPage(),errors=[];
    p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base+'/users',{waitUntil:'domcontentloaded'});
    await p.getByRole('button',{name:'查看 tester10',exact:true}).waitFor();
    assert.equal(await p.locator('.user-reference-metrics strong').first().innerText(),'24');
    assert.equal(await p.locator('.user-reference-metrics strong').nth(1).innerText(),'8');
    assert.equal(await p.locator('.user-reference-metrics strong').nth(2).innerText(),'20');
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await p.screenshot({path:path.join(output,'users-'+width+'.png'),fullPage:true});
    checks.push({width,check:'responsive layout, global statistics and pagination',passed:true});
    if(width===1672){
      assert(await p.getByRole('button',{name:'禁用 layout-review',exact:true}).isDisabled());
      assert(await p.locator('.user-reference-row-actions').first().evaluate(el=>{const r=el.closest('td').getBoundingClientRect();return [...el.querySelectorAll('button')].every(b=>b.getBoundingClientRect().right<=r.right)}));
      await p.getByRole('textbox',{name:'搜索用户',exact:true}).fill('tester24');await p.getByRole('button',{name:'查询',exact:true}).click();await p.getByRole('button',{name:'查看 tester24',exact:true}).waitFor();assert.equal(await p.locator('.user-reference-row-actions').count(),1);assert.equal(await p.locator('.user-reference-metrics strong').first().innerText(),'24');
      await p.getByRole('button',{name:'重置',exact:true}).click();await select(p,'所属组织筛选','研发中心');await p.getByRole('button',{name:'查询',exact:true}).click();await p.locator('.user-reference-pagination').getByText('共 12 条',{exact:true}).waitFor();
      await p.getByRole('button',{name:'重置',exact:true}).click();await p.locator('.user-reference-tabs button').filter({hasText:'已禁用'}).click();await p.locator('.user-reference-pagination').getByText('共 4 条',{exact:true}).waitFor();await p.getByRole('button',{name:'重置',exact:true}).click();
      await p.locator('.user-reference-pagination .arco-pagination-item').filter({hasText:/^3$/}).click();await p.getByRole('button',{name:'查看 tester24',exact:true}).waitFor();await p.locator('.user-reference-pagination .arco-pagination-item').filter({hasText:/^1$/}).click();
      checks.push({check:'search, organization, disabled tab and pagination preserve global totals',passed:true});
      await p.getByRole('button',{name:'查看 tester2',exact:true}).click();await p.getByText('用户详情',{exact:true}).waitFor();await p.locator('.arco-drawer-close-btn').click();
      await p.getByRole('button',{name:'导入用户',exact:true}).click();await p.getByText('当前服务尚未提供批量用户导入接口。',{exact:true}).waitFor();await closeModal(p);
      await p.getByRole('button',{name:'添加用户',exact:true}).first().click();let modal=p.locator('.arco-modal:visible');await modal.getByRole('button',{name:'确定',exact:true}).click();assert.equal(state.writes.length,0);await closeModal(p);
      await p.getByRole('button',{name:'禁用 tester2',exact:true}).click();await p.locator('.arco-modal:visible').getByRole('button',{name:'取消',exact:true}).click();assert.equal(state.writes.length,0);
      await p.getByRole('button',{name:'禁用 tester2',exact:true}).click();await p.locator('.arco-modal:visible').getByRole('button',{name:'确认禁用',exact:true}).click();await p.getByRole('button',{name:'启用 tester2',exact:true}).waitFor();assert.deepEqual(state.writes.at(-1).data,{is_active:false});
      checks.push({check:'details, honest import capability, form validation and explicit account toggle',passed:true});
      await p.getByRole('button',{name:'权限 tester2',exact:true}).click();await p.getByText('用户权限管理',{exact:true}).waitFor();await closeModal(p);
      state.saveFail=true;await p.getByRole('button',{name:'编辑 tester2',exact:true}).click();modal=p.locator('.arco-modal:visible');await modal.getByRole('button',{name:'确定',exact:true}).click();await p.getByText('隔离验证：用户请求失败',{exact:true}).waitFor();assert(await modal.isVisible());await closeModal(p);
      state.fail=true;await p.reload({waitUntil:'domcontentloaded'});await p.getByText('用户列表加载失败',{exact:true}).waitFor();assert.equal(await p.locator('.user-reference-metrics strong').first().innerText(),'—');checks.push({check:'failed edit retains form and failed list never fabricates zero totals',passed:true});
    }
    if(width===390){await p.getByRole('button',{name:'添加用户',exact:true}).first().click();await p.locator('.arco-modal:visible').getByPlaceholder('请输入系统用户名').waitFor();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await closeModal(p);checks.push({check:'mobile account editor fits viewport',passed:true});}
    assert.deepEqual(errors,[]);await c.close();console.log('PASS users '+width);
  }fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(checks,null,2));console.log(checks.length+' user checks passed');}finally{await b.close();}
}
module.exports={fixtures};if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
