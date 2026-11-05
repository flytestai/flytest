<template>
 <div class="app-case-reference app-execution-reference">
  <a-alert v-if="error" type="error" title="执行记录加载失败">{{error}} <a-button size="small" @click="emit('reload')">重试</a-button></a-alert>
  <section class="app-case-metrics" aria-label="执行统计">
   <article v-for="metric in metrics" :key="metric.label" class="app-case-metric" :class="metric.tone"><span class="app-case-metric-icon"><component :is="metric.icon"/></span><div><span>{{metric.label}}</span><strong>{{metric.value}}</strong><small>{{metric.hint}}</small></div></article>
   <article class="execution-trend"><header><strong>近 7 天通过率趋势</strong><b :class="trendRate===100?'rate-success':'rate-danger'">{{trendRate===null?'—':trendRate.toFixed(1)+'%'}}</b></header><svg viewBox="0 0 280 85" role="img" aria-label="近七天执行通过率，UTC 日期，无结果日期留空"><path d="M24 9H270M24 62H270" stroke="var(--theme-border)" stroke-dasharray="3 3"/><text x="0" y="13">100%</text><text x="8" y="64">0%</text><path v-for="(line,index) in trendPaths" :key="index" :d="line" fill="none" :stroke="trendRate===100?'#16a34a':'#dc2626'" stroke-width="2"/><template v-for="(point,index) in trend" :key="point.day"><circle v-if="point.rate!==null" :cx="24+index*41" :cy="62-point.rate*.53" r="3" :fill="point.rate===100?'#16a34a':'#dc2626'"><title>{{point.day}}：{{point.rate.toFixed(1)}}%（{{point.passed}}/{{point.total}}）</title></circle><text v-if="index===0||index===6" :x="index===0?24:239" y="81">{{point.day.slice(5)}}</text></template></svg><small>UTC · 按明确完成结果计算 · 无数据留空</small></article>
  </section>
  <section class="app-case-list execution-list" aria-label="执行记录列表">
   <div class="app-case-toolbar execution-toolbar">
    <a-input-search v-model="filters.search" allow-clear placeholder="搜索用例、套件、任务、设备或执行编号" />
    <a-select v-model="filters.source" aria-label="筛选执行来源"><a-option value="">执行来源 全部</a-option><a-option v-for="source in sources" :key="source" :value="source">{{sourceLabel(source)}}</a-option></a-select>
    <a-select v-model="filters.status" aria-label="筛选执行状态"><a-option value="">执行状态 全部</a-option><a-option v-for="item in states" :key="item.value" :value="item.value">{{item.label}}</a-option></a-select>
    <a-select v-model="filters.app" aria-label="筛选执行应用"><a-option :value="0">应用 全部</a-option><a-option v-for="item in packages" :key="item.id" :value="item.id">{{item.name}}</a-option></a-select>
    <a-range-picker v-model="filters.dates" class="execution-date-range" format="YYYY-MM-DD" value-format="YYYY-MM-DD" allow-clear aria-label="筛选执行日期" />
    <div class="app-case-toolbar-actions"><a-button @click="emit('reset')">重置</a-button><a-button type="primary" :loading="loading" @click="emit('reload')"><icon-search/> 查询</a-button><a-button aria-label="刷新执行记录" :loading="loading" @click="emit('reload')"><icon-refresh/></a-button></div>
   </div>
   <div class="execution-secondary-filters">
    <a-select v-model="filters.suite" allow-search aria-label="筛选执行套件"><a-option value="all">套件 全部</a-option><a-option value="standalone">独立用例</a-option><a-option v-for="item in suites" :key="item.id" :value="String(item.id)">{{item.name}}</a-option></a-select>
    <a-select v-model="filters.device" allow-search aria-label="筛选执行设备"><a-option :value="0">设备 全部</a-option><a-option v-for="item in deviceOptions" :key="item.id" :value="item.id">{{item.name}}</a-option></a-select>
    <a-select v-model="filters.task" allow-search aria-label="筛选执行任务"><a-option :value="0">任务 全部</a-option><a-option v-for="item in taskOptions" :key="item.id" :value="item.id">{{item.name}}</a-option></a-select>
    <a-button size="small" :type="filters.status==='failed'?'primary':'outline'" status="danger" @click="filters.status=filters.status==='failed'?'':'failed'">失败 {{counts.failed}}</a-button><a-button size="small" :type="filters.status==='error'?'primary':'outline'" status="warning" @click="filters.status=filters.status==='error'?'':'error'">异常 {{counts.error}}</a-button><small>更新于 {{lastUpdated}}</small>
   </div>
   <p v-if="relatedError" class="app-case-notice">{{relatedError}}</p>
   <a-table class="app-case-table execution-table" :data="paged" :loading="loading" :pagination="false" :scroll="{x:1390}" row-key="id">
    <template #columns>
     <a-table-column title="执行任务 / ID" :width="235"><template #cell="{record}"><div class="execution-identity"><span class="execution-result-icon" :class="executionState(record)"><icon-check-circle v-if="executionState(record)==='passed'"/><icon-close-circle v-else-if="executionState(record)==='failed'"/><icon-exclamation-circle v-else-if="executionState(record)==='error'"/><icon-play-arrow v-else/></span><div><button class="app-case-name" @click="emit('detail',record.id)">{{record.case_name||`用例 #${record.test_case_id}`}}</button><small>{{executionCode(record)}}<span v-if="taskName(record)"> · {{taskName(record)}}</span></small><small v-if="['failed','error'].includes(executionState(record))&&record.error_message" class="execution-error-preview" :title="record.error_message">{{record.error_message}}</small></div></div></template></a-table-column>
     <a-table-column title="类型 / 来源" :width="120"><template #cell="{record}"><div class="execution-cell-stack"><a-tag :color="record.test_suite_id?'purple':'arcoblue'" size="small">{{record.test_suite_id?'套件内用例':'测试用例'}}</a-tag><small>{{sourceLabel(record.trigger_mode)}}</small></div></template></a-table-column>
     <a-table-column title="关联对象" :width="165"><template #cell="{record}"><span :title="objectName(record)">{{objectName(record)}}</span></template></a-table-column>
     <a-table-column title="应用 / 版本" :width="190"><template #cell="{record}"><div class="execution-cell-stack"><span><PackagePlatformIcon :platform="appInfo(record).platform"/> {{appInfo(record).name}}</span><small>{{appInfo(record).version||'版本未记录'}}<template v-if="!appInfo(record).snapshot"> · 当前关联</template></small></div></template></a-table-column>
     <a-table-column title="设备" :width="140"><template #cell="{record}"><icon-mobile/> {{deviceName(record)}}</template></a-table-column>
     <a-table-column title="执行时长" :width="105"><template #cell="{record}"><span class="execution-duration">{{['pending','running'].includes(executionState(record))?'—':clockDuration(record.duration)}}</span></template></a-table-column>
     <a-table-column title="执行结果" :width="110"><template #cell="{record}"><a-tag :color="statusMeta(record).color" size="small">{{statusMeta(record).label}}</a-tag></template></a-table-column>
     <a-table-column title="开始时间" :width="170"><template #cell="{record}">{{record.started_at?formatTime(record.started_at):'尚未开始'}}<div v-if="!record.started_at" class="execution-created">创建 {{formatTime(record.created_at)}}</div></template></a-table-column>
     <a-table-column title="操作" :width="115" fixed="right"><template #cell="{record}"><div class="app-case-row-actions"><a-button type="text" :aria-label="'查看详情 '+executionCode(record)" @click="emit('detail',record.id)"><icon-file/></a-button><a-button type="text" :disabled="!canReport(record)" :aria-label="'查看报告 '+executionCode(record)" @click="emit('report',record)"><icon-bar-chart/></a-button><a-dropdown><a-button type="text" :aria-label="'更多操作 '+executionCode(record)"><icon-more/></a-button><template #content><a-doption @click="emit('logs',record.id)">运行日志</a-doption><a-doption v-if="['running','pending'].includes(record.status)" :disabled="stoppingIds[record.id]" @click="emit('stop',record)">停止执行</a-doption></template></a-dropdown></div></template></a-table-column>
    </template><template #empty><a-empty :description="records.length?'没有匹配的执行记录，请调整筛选条件':'暂无执行记录，运行用例或套件后可在此查看'"/></template>
   </a-table>
   <footer class="app-case-pagination"><span>共 {{total}} 条筛选结果 · 项目累计 {{records.length}} 条</span><a-pagination v-model:current="pagination.current" v-model:page-size="pagination.pageSize" :total="total" show-page-size :page-size-options="[10,20,50]" :simple="width<650"/></footer>
  </section>
 </div>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {useWindowSize} from '@vueuse/core'
import {IconCheckCircle,IconCloseCircle,IconExclamationCircle,IconPlayArrow,IconRefresh,IconSearch,IconMobile,IconFile,IconBarChart,IconMore,IconList} from '@arco-design/web-vue/es/icon'
import type {AppExecution,AppDevice,AppTestCase,AppPackage,AppTestSuite,AppScheduledTask} from '../../types'
import type {ExecutionFilters,ExecutionPaginationState,ExecutionStatusMeta} from './executionViewModels'
import {executionState,executionCode,executionApp,executionTask,executionTrend,clockDuration} from './executionPresentation'
import PackagePlatformIcon from '../packages/PackagePlatformIcon.vue'
import '../test-cases/test-cases-reference.css'
import './executions-reference.css'
const props=defineProps<{records:AppExecution[];paged:AppExecution[];total:number;filters:ExecutionFilters;pagination:ExecutionPaginationState;devices:AppDevice[];cases:AppTestCase[];packages:AppPackage[];suites:AppTestSuite[];tasks:AppScheduledTask[];loading:boolean;error:string;relatedError:string;lastUpdated:string;statusMeta:(record:AppExecution)=>ExecutionStatusMeta;canReport:(record:AppExecution)=>boolean;stoppingIds:Record<number,boolean>}>()
const emit=defineEmits<{reload:[];reset:[];detail:[id:number];logs:[id:number];report:[record:AppExecution];stop:[record:AppExecution]}>()
const {width}=useWindowSize()
const appInfo=(record:AppExecution)=>executionApp(record,props.cases,props.packages)
const taskName=(record:AppExecution)=>executionTask(record,props.tasks)?.name||(record.task_id?`任务 #${record.task_id}`:'')
const objectName=(record:AppExecution)=>record.test_suite_id?(props.suites.find(item=>item.id===record.test_suite_id)?.name||`套件 #${record.test_suite_id}`):'独立用例'
const deviceName=(record:AppExecution)=>record.device_name||record.device_serial||props.devices.find(item=>item.id===record.device_id)?.name||`设备 #${record.device_id}`
const deviceOptions=computed(()=>Array.from(new Map([...props.devices.map(item=>[item.id,{id:item.id,name:item.name||item.device_id}] as const),...props.records.map(item=>[item.device_id,{id:item.device_id,name:deviceName(item)}] as const)]).values()))
const taskOptions=computed(()=>Array.from(new Map([...props.tasks.map(item=>[item.id,{id:item.id,name:item.name}] as const),...props.records.filter(item=>item.task_id).map(item=>[item.task_id!,{id:item.task_id!,name:taskName(item)}] as const)]).values()))
const sources=computed(()=>Array.from(new Set(props.records.map(item=>item.trigger_mode).filter(Boolean))))
const sourceLabel=(value:string)=>({manual:'手动执行',scheduled:'定时任务',scheduler:'定时任务',api:'API 触发',ci:'CI 触发'}[value]||value||'未上报')
const states=[{value:'passed',label:'通过'},{value:'failed',label:'失败'},{value:'error',label:'异常'},{value:'running',label:'执行中'},{value:'pending',label:'等待执行'},{value:'stopped',label:'已停止'},{value:'completed',label:'已完成／结果未上报'}]
const counts=computed(()=>({passed:props.records.filter(item=>executionState(item)==='passed').length,failed:props.records.filter(item=>executionState(item)==='failed').length,error:props.records.filter(item=>executionState(item)==='error').length}))
const metrics=computed(()=>[{label:'执行总数',value:props.records.length,icon:IconList,tone:'teal',hint:'项目内单条用例执行记录'},{label:'通过',value:counts.value.passed,icon:IconCheckCircle,tone:'green',hint:'明确通过的执行结果'},{label:'失败',value:counts.value.failed,icon:IconCloseCircle,tone:'red',hint:'点击下方快捷筛选定位问题'},{label:'异常',value:counts.value.error,icon:IconExclamationCircle,tone:'orange',hint:'已明确记录的执行异常'}])
const trend=computed(()=>executionTrend(props.records))
const trendRate=computed(()=>{const total=trend.value.reduce((n,p)=>n+p.total,0);return total?trend.value.reduce((n,p)=>n+p.passed,0)/total*100:null})
const trendPaths=computed(()=>{const lines:string[]=[];let current='';trend.value.forEach((p,index)=>{if(p.rate===null){if(current)lines.push(current);current=''}else current+=`${current?' L':'M'}${24+index*41},${62-p.rate*.53}`});if(current)lines.push(current);return lines})
const formatTime=(value:string)=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'—'
</script>
