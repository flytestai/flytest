const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installFixtures}=require('./verify-workspace-layout.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.UI_BASE_URL||'http://127.0.0.1:5175',output=process.env.UI_OUTPUT_DIR||path.resolve(__dirname,'../playwright-screenshots/chat-reference');
async function fixtures(context){
 await installFixtures(context);const state={configured:true,sent:[],pending:null};
 const response=(route,data)=>route.fulfill({json:{status:'success',code:200,data}});
 const prompt={id:1,name:'默认通用提示词',content:'测试分析',is_active:true,is_default:true,prompt_type:'general'};
 await context.route(/\/api\/prompts\/user-prompts\/(?:default\/)?(?:\?.*)?$/,route=>response(route,route.request().url().includes('/default/')?prompt:[prompt]));
 await context.route('**/api/lg/llm-configs/**',route=>response(route,state.configured?[{id:1,config_name:'测试模型',name:'Fixture model',is_active:true,enable_streaming:false,supports_vision:true,context_limit:128000}]:[]));
 const today=new Date().toISOString(),old=new Date(Date.now()-3*86400000).toISOString();
 await context.route('**/api/lg/chat/sessions/**',route=>response(route,{sessions_detail:[{id:'session-one',title:'登录流程测试点分析',updated_at:today},{id:'session-two',title:'支付接口异常排查',updated_at:today},{id:'session-three',title:'需求文档用例生成',updated_at:old}]}));
 await context.route('**/api/lg/chat/history/**',route=>response(route,{session_id:'session-one',project_id:'1',prompt_id:1,context_token_count:120,context_limit:128000,history:[{type:'human',content:'历史需求问题',timestamp:today},{type:'ai',content:'历史分析结果',timestamp:today}]}));
 await context.route('**/api/lg/tool-approvals/**',route=>response(route,{groups:[],preferences:[]}));
 await context.route('**/api/orchestrator/agent-loop/**',async route=>{state.sent.push(route.request().postDataJSON());await new Promise(resolve=>state.pending=resolve);await response(route,{session_id:'session-new',content:'已完成测试点分析',total_steps:1,tool_results:[],context_token_count:30,context_limit:128000});});
 return state;
}
async function bounds(page){
 const overflow=await page.locator('.chat-layout button,.chat-layout input,.chat-layout textarea,.chat-layout .arco-select-view').evaluateAll(nodes=>nodes.filter(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left< -1||r.right>innerWidth+1)&&!node.closest('.fc-workspace-directory')}).map(node=>node.outerHTML.slice(0,120)));
 assert.deepEqual(overflow,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true,channel:process.env.UI_BROWSER_CHANNEL||'msedge'}),report=[];
 try{for(const width of (process.env.UI_WIDTHS||'1440,1024,390,320').split(',').map(Number)){
 const context=await browser.newContext({viewport:{width,height:width<768?844:1000},reducedMotion:'reduce'});const state=await fixtures(context),page=await context.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/langgraph-chat');await page.getByRole('heading',{name:'开始与 FeiCe 飞测对话',exact:true}).waitFor();await page.getByRole('button',{name:'Fixture model',exact:true}).waitFor();
 await bounds(page);await page.mouse.move(0,0);await page.screenshot({path:path.join(output,`welcome-${width}.png`),fullPage:true});
 await page.getByRole('button',{name:'生成测试用例',exact:true}).click();const input=page.locator('.chat-input textarea');assert((await input.inputValue()).includes('预期结果'));assert.equal(state.sent.length,0);assert(await input.evaluate(node=>document.activeElement===node));
 await input.press('Shift+Enter');assert.equal(state.sent.length,0);await input.dispatchEvent('keydown',{key:'Enter',isComposing:true});assert.equal(state.sent.length,0);
 await page.getByRole('button',{name:'历史会话',exact:true}).count().then(async count=>{if(count&&!(await page.locator('.fc-workspace-directory:visible').count()))await page.getByRole('button',{name:'历史会话',exact:true}).click();});
 const sidebar=page.locator('.fc-workspace-directory:visible');await sidebar.getByRole('textbox',{name:'搜索历史会话',exact:true}).fill('支付');await sidebar.locator('.history-item-content').filter({hasText:'支付接口异常排查'}).waitFor();assert.equal(await sidebar.locator('.chat-history-item').count(),1);
 if(width===1440){await sidebar.getByRole('button',{name:'管理',exact:true}).click();await sidebar.getByRole('button',{name:'全选',exact:true}).click();await sidebar.getByRole('button',{name:'删除选中 (1)',exact:true}).click();await page.locator('.arco-modal:visible').getByRole('button',{name:'取消',exact:true}).click();assert.equal(await sidebar.locator('.chat-history-item').count(),1);await sidebar.getByRole('button',{name:'完成',exact:true}).click();report.push({width,check:'filtered batch selection and cancel deletion preserve history',passed:true});}
 await sidebar.locator('.history-item-content').filter({hasText:'支付接口异常排查'}).click();await page.getByText('历史分析结果',{exact:true}).waitFor();
 await page.getByRole('button',{name:'新对话',exact:true}).click();await page.getByRole('heading',{name:'开始与 FeiCe 飞测对话',exact:true}).waitFor();
 if(width<768)await page.getByRole('button',{name:/对话设置/}).click();
 await page.getByRole('button',{name:'工具审批',exact:true}).click();await page.locator('.arco-modal:visible').getByText('工具审批偏好设置',{exact:true}).waitFor();await page.locator('.arco-modal:visible').getByRole('button',{name:'取消',exact:true}).click();
 if(width<768)await page.getByRole('button',{name:/对话设置/}).click();
 if(width===1440){await page.locator('.conversation-file-input').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAwkAAAAASUVORK5CYII=','base64')});await page.locator('.image-preview img').waitFor();await page.locator('.remove-image-btn').click();assert.equal(await page.locator('.image-preview img').count(),0);assert.equal(state.sent.length,0);report.push({width,check:'image attachment preview and removal without sending',passed:true});}
 await input.fill('请检查支付边界');await input.press('Enter');await page.getByRole('button',{name:'停止',exact:true}).waitFor();assert.equal(state.sent.length,1);assert.equal(state.sent[0].message,'请检查支付边界');state.pending();await page.getByText('已完成测试点分析',{exact:true}).waitFor();
 await page.mouse.move(0,0);await page.screenshot({path:path.join(output,`messages-${width}.png`),fullPage:true});await bounds(page);assert.deepEqual(errors,[]);
 report.push({width,check:'reference layout, suggestion draft, IME/Shift+Enter, history search/switch, new chat, tool preferences, send and response',passed:true});
 state.configured=false;await page.reload();await page.getByRole('button',{name:'模型未配置',exact:true}).waitFor();await input.fill('保留未发送草稿');await input.press('Enter');assert.equal(await input.inputValue(),'保留未发送草稿');assert.equal(state.sent.length,1);assert(await page.getByRole('button',{name:'发送',exact:true}).isDisabled());
 report.push({width,check:'unconfigured model preserves draft and blocks invalid requests',passed:true});await context.close();console.log('PASS chat '+width+'px');
 }fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(`${report.length}/${report.length} chat reference checks passed`);
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
