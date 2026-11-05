<template>
 <section class="web-record-preview">
  <header><strong>{{ titles[kind] }}详情</strong><a-button type="text" aria-label="关闭详情" @click="$emit('close')"><icon-close /></a-button></header>
  <div class="web-record-preview__body">
   <div class="web-record-title"><span>{{ titles[kind] }} · {{ record.id }}</span><h3>{{ record.name || record.test_case_name || record.key }}</h3><p v-if="record.description">{{ record.description }}</p></div>
   <dl class="web-record-facts"><template v-for="field in fields" :key="field[0]"><dt>{{ field[1] }}</dt><dd><a-tag v-if="field[0]==='status'" :color="record.status===2?'green':record.status===3||record.status===4?'red':record.status===1?'arcoblue':'gray'">{{ display(field[0]) }}</a-tag><template v-else>{{ display(field[0]) }}</template></dd></template></dl>
   <a-spin :loading="loading" style="width:100%">
    <a-alert v-if="error" type="warning">详情读取失败 <a-button type="text" size="mini" @click="load">重试</a-button></a-alert>
    <section v-if="steps.length" class="web-record-section"><h4>{{ kind==='pages'?'页面元素':'步骤概览' }}</h4><ol><li v-for="(step,index) in steps" :key="String(step.id??index)"><span>{{ index+1 }}</span><div><strong>{{ step.name || step.page_step_name || step.element_name || step.description || `步骤 ${index+1}` }}</strong><p v-if="step.locator_type">{{ step.locator_type }} · {{ step.locator_value }}</p><p v-else-if="step.step_type!==undefined">{{ stepTypes[Number(step.step_type)] || '操作步骤' }}</p></div></li></ol></section>
    <a-empty v-if="!loading && !error && !steps.length && ['pages','page-steps','testcases'].includes(kind)" :description="kind==='pages'?'暂无页面元素':'暂无配置步骤'" />
   </a-spin>
   <section v-if="kind==='batch-records'" class="web-record-section"><h4>执行汇总</h4><div class="web-result-counts"><span>总用例<strong>{{ record.total_cases ?? '—' }}</strong></span><span>已通过<strong>{{ record.passed_cases ?? '—' }}</strong></span><span>失败<strong>{{ record.failed_cases ?? '—' }}</strong></span></div></section>
   <section v-if="kind==='batch-records' && batchRate!==null" class="web-record-section web-batch-rate"><a-progress type="circle" :percent="batchRate/100" :color="passRateColor(batchRate)"/><div><h4 :style="{color:passRateColor(batchRate)}">{{formatQualityPercent(batchRate)}}</h4><p>用例通过率</p></div></section>
   <section v-if="executionSteps.length" class="web-record-section"><h4>执行过程</h4><ol><li v-for="(step,index) in executionSteps" :key="index"><span :class="{'web-step-failed':step.status==='failed'}">{{index+1}}</span><div><strong>{{step.description || `步骤 ${index+1}`}}</strong><p>{{step.message || step.status || '暂无结果说明'}}</p></div></li></ol></section>
   <a-alert v-if="record.error_message" type="error" title="失败原因">{{ record.error_message }}</a-alert>
   <section v-if="kind==='public-data'" class="web-record-section"><h4>数据值预览</h4><pre>{{ secret && !revealed?'••••••••':record.value }}</pre><a-button v-if="secret" size="small" type="text" @click="revealed=!revealed">{{ revealed?'隐藏内容':'显示内容' }}</a-button></section>
   <section v-if="kind==='env-config'" class="web-record-section"><h4>运行设置</h4><p>浏览器视口 {{ record.viewport_width }} × {{ record.viewport_height }}</p><p>配置状态与实际服务可达性需在执行时验证。</p></section>
   <section v-if="kind==='actuators'" class="web-record-section"><h4>连接信息</h4><p>当前节点已连接。任务接收和调试设置由执行器上报。</p></section>
  </div>
  <footer v-if="kind!=='actuators'"><a-button v-if="!['execution-records','batch-records'].includes(kind)" @click="$emit('edit')"><icon-edit /> 编辑{{ titles[kind] }}</a-button><a-button v-if="['pages','page-steps','testcases','execution-records','batch-records'].includes(kind)" type="primary" @click="$emit('inspect')">{{ inspectLabels[kind] }}</a-button></footer>
 </section>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {IconClose,IconEdit} from '@arco-design/web-vue/es/icon'
import {pageApi,pageStepsApi,testCaseApi,executionRecordApi,batchRecordApi} from '../api'
import {calculatePassRate,passRateColor,formatQualityPercent} from '@/utils/qualityStatus'
import {extractResponseData,STATUS_LABELS,BATCH_STATUS_LABELS,PUBLIC_DATA_TYPE_LABELS} from '../types'
const props=defineProps<{kind:string;record:Record<string,unknown>}>()
defineEmits<{close:[];edit:[];inspect:[]}>()
const titles:Record<string,string>={pages:'页面','page-steps':'步骤',testcases:'用例','execution-records':'执行','batch-records':'批次','public-data':'数据','env-config':'环境',actuators:'执行器'}
const inspectLabels:Record<string,string>={pages:'查看元素','page-steps':'管理操作步骤',testcases:'管理用例步骤','execution-records':'查看日志与产物','batch-records':'查看执行明细'}
const stepTypes=['元素操作','断言操作','SQL 操作','自定义变量','条件判断']
const definitions:Record<string,string[][]>={
 pages:[['module_name','所属模块'],['url','页面地址'],['element_count','元素数量'],['creator_name','创建者'],['updated_at','最近更新']],
 'page-steps':[['page_name','所属页面'],['module_name','所属模块'],['status','最近执行'],['step_count','操作数量'],['updated_at','最近更新']],
 testcases:[['level','优先级'],['module_name','所属模块'],['status','最近执行'],['step_count','步骤数量'],['creator_name','创建者'],['updated_at','最近更新']],
 'execution-records':[['status','执行结果'],['executor_name','执行人'],['trigger_type','触发类型'],['duration','耗时（秒）'],['start_time','开始时间'],['end_time','结束时间']],
 'batch-records':[['status','批次状态'],['executor_name','执行人'],['duration','耗时（秒）'],['start_time','开始时间'],['end_time','结束时间']],
 'public-data':[['key','变量名'],['type','数据类型'],['is_enabled','启用状态'],['creator_name','创建者'],['updated_at','最近更新']],
 'env-config':[['base_url','基础地址'],['browser','浏览器'],['headless','无头模式'],['is_default','默认环境'],['timeout','超时（毫秒）']],
 actuators:[['ip','IP 地址'],['type','执行器类型'],['browser_type','浏览器'],['headless','无头模式'],['is_open','接收任务'],['debug','调试模式'],['connected_at','连接时间']]
}
const fields=computed(()=>definitions[props.kind]||[])
function display(key:string){const value=props.record[key];if(value===null||value===undefined||value==='')return '—';if(key==='status')return (props.kind==='batch-records'?BATCH_STATUS_LABELS:STATUS_LABELS)[value as 0]||'已取消';if(key==='type'&&props.kind==='public-data')return PUBLIC_DATA_TYPE_LABELS[value as 0];if(key==='trigger_type')return ({manual:'手动执行',scheduled:'定时任务',api:'API 触发'} as Record<string,string>)[String(value)]||value;if(typeof value==='boolean')return value?'是':'否';if(key.endsWith('_at')||key.endsWith('_time'))return new Date(String(value)).toLocaleString('zh-CN');return value}
const secret=computed(()=>/password|passwd|secret|token|credential|private.?key/i.test(String(props.record.key)))
const revealed=ref(false),loading=ref(false),error=ref(false),detail=ref<Record<string,unknown>>({})
const steps=computed(()=>{const value=detail.value.elements||detail.value.step_details||detail.value.case_steps;return Array.isArray(value)?value as Record<string,unknown>[]:[]})
const executionSteps=computed(()=>{const value=detail.value.step_results;return Array.isArray(value)?value as Record<string,unknown>[]:[]})
const batchRate=computed(()=>calculatePassRate(Number(props.record.passed_cases),Number(props.record.total_cases)))
let version=0
async function load(){const generation=++version;detail.value={};error.value=false;revealed.value=false;const loaders:Record<string,(id:number)=>Promise<{data:unknown}>>={pages:pageApi.get,'page-steps':pageStepsApi.get,testcases:testCaseApi.get,'execution-records':executionRecordApi.get,'batch-records':batchRecordApi.get};const loader=loaders[props.kind];if(!loader){loading.value=false;return}loading.value=true;try{const result=await loader(Number(props.record.id));if(generation===version)detail.value=extractResponseData(result) as unknown as Record<string,unknown>||{}}catch{if(generation===version)error.value=true}finally{if(generation===version)loading.value=false}}
watch(()=>[props.kind,props.record],load,{immediate:true})
</script>
