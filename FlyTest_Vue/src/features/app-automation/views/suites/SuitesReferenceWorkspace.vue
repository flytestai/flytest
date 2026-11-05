<template>
 <div class="app-case-reference app-suite-reference">
  <a-alert v-if="error" type="error" title="套件数据加载失败">{{error}} <a-button size="small" @click="emit('reload')">重试</a-button></a-alert>
  <section class="app-case-metrics" aria-label="套件统计"><article v-for="metric in metrics" :key="metric.label" class="app-case-metric" :class="metric.tone"><span class="app-case-metric-icon"><component :is="metric.icon"/></span><div><span>{{metric.label}}</span><strong>{{metric.value}}</strong><small>{{metric.hint}}</small></div></article><article class="app-case-ai"><strong><icon-star/> AI 生成套件</strong><p>基于用例标签与测试目标辅助组合</p><a-button type="primary" class="fc-ai-action app-case-ai-button" size="small" @click="aiVisible=true">立即生成 <icon-arrow-right/></a-button></article></section>
  <div class="app-case-workspace">
   <aside class="app-case-directory" aria-label="套件分组"><header><h3>套件分组</h3><a-button type="text" aria-label="新建分组套件" @click="emit('create','')"><icon-plus/></a-button></header><a-input-search v-model="groupSearch" placeholder="搜索分组" allow-clear/><button class="app-case-group-root" :class="{active:group===null}" @click="group=null"><icon-folder/> 全部套件 <span>{{suites.length}}</span></button><div class="app-case-groups"><button v-for="item in groups" :key="item.name" :class="{active:group===item.name}" :aria-pressed="group===item.name" @click="group=item.name"><icon-folder/><span>{{item.name||'未分组'}}</span><small>{{item.count}}</small></button></div><small class="app-case-directory-hint">分组在首个套件保存后出现</small></aside>
   <section class="app-case-list" aria-label="测试套件列表">
    <div class="app-case-toolbar"><a-input-search v-model="search" placeholder="搜索套件名称、描述" allow-clear/><a-select v-model="status" aria-label="筛选套件状态"><a-option value="">执行状态 全部</a-option><a-option value="passed">通过</a-option><a-option value="failed">失败</a-option><a-option value="running">执行中</a-option><a-option value="not_run">未执行</a-option></a-select><a-select v-model="app" aria-label="筛选关联应用"><a-option :value="0">关联应用 全部</a-option><a-option v-for="item in packages" :key="item.id" :value="item.id">{{item.name}}</a-option></a-select><div class="app-case-toolbar-actions"><a-dropdown><a-button :disabled="!selected.length"><icon-command/> 批量操作 <icon-down/></a-button><template #content><a-doption @click="exportSelected">导出所选套件</a-doption><a-doption @click="selected=[]">清空选择</a-doption></template></a-dropdown><a-button aria-label="刷新套件列表" @click="emit('reload')"><icon-refresh/> 刷新</a-button><a-button type="primary" @click="emit('create',group||'')"><icon-plus/> 新建套件</a-button></div></div>
    <p v-if="!metadataAvailable" class="app-case-notice">当前服务支持顺序执行；分组维护及多设备并行需加载新版 APP 服务。</p>
    <div v-if="selected.length" class="app-case-selection">已选择 {{selected.length}} 项 <a-button type="text" size="mini" @click="selected=[]">清空选择</a-button><span>每个套件独立配置执行设备</span></div>
    <a-table class="app-case-table" v-model:selected-keys="selected" :data="pageItems" :pagination="false" :loading="loading" :row-selection="{type:'checkbox',showCheckedAll:true}" :scroll="{x:1050}" row-key="id"><template #columns>
     <a-table-column title="套件名称" :width="240"><template #cell="{record}"><button class="app-case-name suite-name" @click="emit('detail',record)"><icon-layers/> {{record.name}}</button></template></a-table-column>
     <a-table-column title="用例数" :width="75"><template #cell="{record}">{{record.suite_cases?.length||0}}</template></a-table-column>
     <a-table-column title="关联应用" :width="170"><template #cell="{record}"><span :title="suiteApps(record).map(item=>item.name).join('、')"><template v-if="suiteApps(record).length"><PackagePlatformIcon :platform="suiteApps(record)[0].platform"/> {{suiteApps(record).map(item=>item.name).join('、')}}</template><span v-else class="app-case-muted">未关联</span></span></template></a-table-column>
     <a-table-column title="执行策略" :width="100"><template #cell="{record}"><a-tag :color="record.execution_strategy==='parallel'?'purple':'arcoblue'" size="small">{{record.execution_strategy==='parallel'?'并行执行':'顺序执行'}}</a-tag></template></a-table-column>
     <a-table-column title="执行结果" :width="110"><template #cell="{record}"><a-tag :color="statusMeta(record).color" size="small"><icon-check-circle v-if="record.execution_result==='passed'"/><icon-close-circle v-else-if="record.execution_result==='failed'"/><icon-clock-circle v-else/> {{statusMeta(record).label}}</a-tag></template></a-table-column>
     <a-table-column title="最近执行时间" :width="150"><template #cell="{record}">{{record.last_run_at?new Date(record.last_run_at).toLocaleString('zh-CN',{hour12:false}):'—'}}</template></a-table-column>
     <a-table-column title="创建人" :width="90"><template #cell="{record}">{{record.created_by||'未上报'}}</template></a-table-column>
     <a-table-column title="操作" :width="125" fixed="right"><template #cell="{record}"><div class="app-case-row-actions"><a-button type="text" :disabled="!executable(record)||record.execution_status==='running'" :aria-label="'执行 '+record.name" @click="emit('run',record)"><icon-play-arrow/></a-button><a-button type="text" :aria-label="'编辑 '+record.name" @click="emit('edit',record)"><icon-edit/></a-button><a-button type="text" :aria-label="'复制 '+record.name" @click="emit('duplicate',record)"><icon-copy/></a-button><a-dropdown><a-button type="text" :aria-label="'更多操作 '+record.name"><icon-more/></a-button><template #content><a-doption @click="emit('history',record)">执行历史与报告</a-doption><a-doption @click="emit('detail',record)">套件详情</a-doption><a-doption @click="emit('remove',record.id)">删除套件</a-doption></template></a-dropdown></div></template></a-table-column>
    </template><template #empty><a-empty :description="suites.length?'没有匹配的套件，请调整筛选条件':'暂无测试套件，先组织一组测试用例'"/></template></a-table>
    <footer class="app-case-pagination"><span>共 {{filtered.length}} 条</span><a-button v-if="search||status||app||group!==null" type="text" size="small" @click="reset">重置筛选</a-button><a-pagination v-model:current="page" v-model:page-size="pageSize" :total="filtered.length" :page-size-options="[10,20,50]" show-page-size :simple="width<650"/></footer>
   </section>
  </div>
  <SuiteAiDialog v-model:visible="aiVisible" :project-id="projectId" :cases="cases" @apply="emit('ai-apply',$event)"/>
 </div>
</template>
<script setup lang="ts">
import {ref,computed,watch} from 'vue'
import {useWindowSize} from '@vueuse/core'
import {IconStar,IconArrowRight,IconPlus,IconFolder,IconCommand,IconDown,IconRefresh,IconLayers,IconPlayArrow,IconCheckCircle,IconCloseCircle,IconClockCircle,IconEdit,IconCopy,IconMore} from '@arco-design/web-vue/es/icon'
import type {AppTestSuite,AppTestCase,AppPackage,AppExecution} from '../../types'
import {caseHasSteps} from '../test-cases/testCasePresentation'
import PackagePlatformIcon from '../packages/PackagePlatformIcon.vue'
import SuiteAiDialog from './SuiteAiDialog.vue'
import '../test-cases/test-cases-reference.css'
import './suites-reference.css'
const props=defineProps<{projectId:number;suites:AppTestSuite[];cases:AppTestCase[];packages:AppPackage[];executions:AppExecution[];loading:boolean;error:string;executionError:string;metadataAvailable:boolean;statusMeta:(record:AppTestSuite)=>{label:string;color:string}}>()
const emit=defineEmits<{create:[group:string];edit:[record:AppTestSuite];run:[record:AppTestSuite];detail:[record:AppTestSuite];history:[record:AppTestSuite];duplicate:[record:AppTestSuite];remove:[id:number];reload:[];'ai-apply':[proposal:{name:string;description:string;test_case_ids:number[]}]}>()
const {width}=useWindowSize(),search=ref(''),groupSearch=ref(''),group=ref<string|null>(null),status=ref(''),app=ref(0),page=ref(1),pageSize=ref(10),selected=ref<number[]>([]),aiVisible=ref(false)
const executable=(suite:AppTestSuite)=>Boolean(suite.suite_cases?.length)&&suite.suite_cases.every(member=>props.cases.some(item=>item.id===member.test_case_id&&caseHasSteps(item)))
const suiteApps=(suite:AppTestSuite)=>{const ids=new Set(suite.suite_cases?.map(member=>props.cases.find(item=>item.id===member.test_case_id)?.package_id));return props.packages.filter(item=>ids.has(item.id))}
const groups=computed(()=>{const map=new Map<string,number>();props.suites.forEach(item=>map.set(item.group||'',(map.get(item.group||'')||0)+1));return Array.from(map,([name,count])=>({name,count})).filter(item=>(item.name||'未分组').includes(groupSearch.value.trim()))})
const state=(item:AppTestSuite)=>item.execution_status==='running'?'running':!item.last_run_at?'not_run':item.execution_result
const filtered=computed(()=>props.suites.filter(item=>(!search.value||`${item.name} ${item.description}`.toLowerCase().includes(search.value.trim().toLowerCase()))&&(group.value===null||(item.group||'')===group.value)&&(!status.value||state(item)===status.value)&&(!app.value||suiteApps(item).some(pkg=>pkg.id===app.value))))
const pageItems=computed(()=>filtered.value.slice((page.value-1)*pageSize.value,page.value*pageSize.value))
const metrics=computed(()=>{const completed=props.suites.filter(item=>item.execution_status!=='running'&&item.last_run_at&&['passed','failed'].includes(item.execution_result)),passed=completed.filter(item=>item.execution_result==='passed').length;return [
 {label:'套件总数',value:props.suites.length,icon:IconLayers,tone:'teal',hint:'当前项目全部套件'},
 {label:'可执行套件',value:props.suites.filter(executable).length,icon:IconPlayArrow,tone:'teal',hint:'所含用例均已配置步骤'},
 {label:'最近通过率',value:completed.length?`${(passed/completed.length*100).toFixed(1)}%`:'—',icon:IconCheckCircle,tone:completed.length?(passed===completed.length?'green':'red'):'neutral',hint:'按已完成套件返回结果计算'},
 {label:'近 7 天执行',value:props.executionError?'—':props.executions.filter(item=>item.test_suite_id&&Date.parse(item.created_at)>=Date.now()-7*86400000&&Date.parse(item.created_at)<=Date.now()).length,icon:IconClockCircle,tone:'purple',hint:props.executionError||'套件内用例执行记录'},
]})
const reset=()=>{search.value='';group.value=null;status.value='';app.value=0}
const exportSelected=()=>{const data=props.suites.filter(item=>selected.value.includes(item.id));const url=URL.createObjectURL(new Blob([JSON.stringify({format:'feice-app-suites',suites:data},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='feice-app-suites.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
watch([search,group,status,app,pageSize],()=>{page.value=1;selected.value=[]})
watch(()=>filtered.value.length,()=>{page.value=Math.max(1,Math.min(page.value,Math.ceil(filtered.value.length/pageSize.value)||1))})
watch(()=>props.projectId,()=>{reset();groupSearch.value='';selected.value=[];aiVisible.value=false})
</script>
