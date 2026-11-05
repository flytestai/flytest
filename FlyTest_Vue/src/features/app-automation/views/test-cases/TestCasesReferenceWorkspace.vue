<template>
  <div class="app-case-reference">
    <a-alert v-if="error" type="error" title="用例数据加载失败">{{ error }} <a-button size="small" @click="emit('reload')">重试</a-button></a-alert>
    <section class="app-case-metrics" aria-label="用例统计">
      <article v-for="metric in metrics" :key="metric.label" class="app-case-metric" :class="metric.tone"><span class="app-case-metric-icon"><component :is="metric.icon" /></span><div><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small>{{ metric.hint }}</small></div></article>
      <article class="app-case-ai"><strong><icon-star /> AI 生成用例</strong><p>基于业务描述辅助生成测试流程</p><a-button type="primary" class="fc-ai-action app-case-ai-button" size="small" @click="emit('ai')">立即生成 <icon-arrow-right /></a-button></article>
    </section>
    <div class="app-case-workspace">
      <aside class="app-case-directory" aria-label="用例分组">
        <header><h3>用例分组</h3><a-button type="text" aria-label="新建分组用例" title="保存首条用例后创建分组" @click="emit('create', '')"><icon-plus /></a-button></header>
        <a-input-search v-model="groupSearch" placeholder="搜索分组" allow-clear />
        <button class="app-case-group-root" :class="{active: group === null}" @click="group = null"><icon-folder /> 全部用例 <span>{{ cases.length }}</span></button>
        <div class="app-case-groups"><button v-for="item in groups" :key="item.name" :class="{active: group === item.name}" :aria-pressed="group === item.name" @click="group = item.name"><icon-folder /><span>{{ item.name || '未分组' }}</span><small>{{ item.count }}</small></button><a-empty v-if="!groups.length" description="没有匹配的分组" /></div>
        <small class="app-case-directory-hint">在用例编辑中填写分组名称即可归类</small>
      </aside>
      <section class="app-case-list" aria-label="测试用例列表">
        <div class="app-case-toolbar">
          <a-input-search v-model="search" allow-clear placeholder="搜索用例名称、编号或关键词" />
          <a-select v-model="priority" aria-label="筛选优先级"><a-option value="">优先级 全部</a-option><a-option v-for="p in ['P0','P1','P2','P3']" :key="p" :value="p">{{ p }}</a-option><a-option value="unset">未设置</a-option></a-select>
          <a-select v-model="result" aria-label="筛选执行结果"><a-option value="">状态 全部</a-option><a-option value="passed">通过</a-option><a-option value="failed">失败</a-option><a-option value="pending">未执行</a-option><a-option value="empty">空流程</a-option></a-select>
          <a-select v-model="suite" :disabled="!!suiteError" aria-label="筛选关联套件"><a-option :value="0">关联套件 全部</a-option><a-option v-for="item in suites" :key="item.id" :value="item.id">{{ item.name }}</a-option></a-select>
          <div class="app-case-toolbar-actions">
            <a-dropdown><a-button :disabled="!selected.length"><icon-command /> 批量操作 <icon-down /></a-button><template #content><a-doption @click="emit('batch-execute')">执行所选用例</a-doption><a-doption @click="transfer.exportCases(selectedRecords)">导出所选用例</a-doption><a-doption @click="selected = []">清空选择</a-doption></template></a-dropdown>
            <a-button @click="importFile?.click()"><icon-import /> 导入</a-button><a-button @click="transfer.exportCases(filtered)"><icon-export /> 导出</a-button>
            <a-button type="primary" @click="emit('create', group || '')"><icon-plus /> 新建用例</a-button>
            <a-button aria-label="刷新用例列表" @click="emit('reload')"><icon-refresh /></a-button>
          </div>
          <input ref="importFile" type="file" accept=".json,application/json" hidden @change="transfer.readFile" />
        </div>
        <p v-if="suiteError" class="app-case-notice">{{ suiteError }}，可刷新重试。</p>
        <div v-if="selected.length" class="app-case-selection">已选择 {{ selected.length }} 项 <a-button size="mini" type="text" @click="selected = []">清空选择</a-button><span>多条用例通过测试套件串行执行</span></div>
        <a-table class="app-case-table" v-model:selected-keys="selected" :data="pageCases" :loading="loading" :pagination="false" :scroll="{ x: 1110 }" :row-selection="{type:'checkbox',showCheckedAll:true}" row-key="id">
          <template #columns>
            <a-table-column title="用例编号" :width="100"><template #cell="{record}"><span class="app-case-code">{{ caseCode(record) }}</span></template></a-table-column>
            <a-table-column title="用例名称" :width="210"><template #cell="{record}"><button class="app-case-name" @click="emit('edit', record)">{{ record.name }}</button></template></a-table-column>
            <a-table-column title="优先级" :width="75"><template #cell="{record}"><a-tag v-if="casePriority(record)" :color="priorityColor(casePriority(record))" size="small">{{ casePriority(record) }}</a-tag><span v-else class="app-case-muted">未设置</span></template></a-table-column>
            <a-table-column title="所属分组" :width="120"><template #cell="{record}">{{ caseGroup(record) || '未分组' }}</template></a-table-column>
            <a-table-column title="步骤数" :width="70"><template #cell="{record}">{{ record.ui_flow?.steps?.length || 0 }}</template></a-table-column>
            <a-table-column title="关联套件" :width="120"><template #cell="{record}"><span :title="suiteNames(record.id)">{{ suiteError ? '暂不可用' : suiteNames(record.id) }}</span></template></a-table-column>
            <a-table-column title="最近执行结果" :width="120"><template #cell="{record}"><a-tag :color="resultColor(record.last_result)" size="small"><icon-check-circle v-if="record.last_result === 'passed'"/><icon-close-circle v-else-if="record.last_result === 'failed'"/><icon-clock-circle v-else/> {{ resultLabel(record.last_result) }}</a-tag></template></a-table-column>
            <a-table-column title="更新时间" :width="150"><template #cell="{record}">{{ formatTime(record.updated_at) }}</template></a-table-column>
            <a-table-column title="操作" :width="145" fixed="right"><template #cell="{record}"><div class="app-case-row-actions"><a-button type="text" :disabled="!caseHasSteps(record)" :aria-label="'执行 ' + record.name" @click="emit('execute',record)"><icon-play-arrow /></a-button><a-button type="text" :aria-label="'编辑 ' + record.name" @click="emit('edit',record)"><icon-edit /></a-button><a-button type="text" :aria-label="'复制 ' + record.name" @click="emit('duplicate',record)"><icon-copy /></a-button><a-dropdown><a-button type="text" :aria-label="'更多操作 ' + record.name"><icon-more /></a-button><template #content><a-doption @click="emit('scene',record)">场景编排</a-doption><a-doption @click="transfer.exportCases([record])">导出用例</a-doption><a-doption :disabled="record.can_delete === false" :title="record.delete_block_reason" @click="emit('remove',record.id)">删除用例</a-doption></template></a-dropdown></div></template></a-table-column>
          </template>
          <template #empty><a-empty :description="cases.length ? '没有匹配的用例，请调整筛选条件' : '暂无测试用例，创建用例或使用 AI 开始编排'" /></template>
        </a-table>
        <footer class="app-case-pagination"><span>共 {{ filtered.length }} 条</span><a-button v-if="search || priority || result || suite || group !== null" size="small" type="text" @click="reset">重置筛选</a-button><a-pagination v-model:current="page" v-model:page-size="pageSize" :total="filtered.length" :page-size-options="[10,20,50]" show-page-size :simple="width < 650" /></footer>
      </section>
    </div>
    <a-modal v-model:visible="transfer.visible.value" title="导入 APP 测试用例" :width="Math.min(640,width - 24)" :footer="false" :closable="!transfer.busy.value" :mask-closable="!transfer.busy.value">
      <p class="app-case-import-summary" role="status">{{ transfer.summary.value }}</p><p>待导入 {{ transfer.pending.value.length }} 条，目标：当前项目</p><ul class="app-case-import-preview"><li v-for="(item,index) in transfer.pending.value.slice(0,20)" :key="index">{{ item.name }}</li></ul><a-button type="primary" :loading="transfer.busy.value" :disabled="!transfer.pending.value.length" @click="transfer.importCases(packages.map(item => item.id))">确认导入</a-button>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { IconStar, IconArrowRight, IconPlus, IconFolder, IconCommand, IconDown, IconImport, IconExport, IconRefresh, IconPlayArrow, IconEdit, IconCopy, IconMore, IconCheckCircle, IconCloseCircle, IconClockCircle, IconLayers, IconExclamationCircle, IconApps } from '@arco-design/web-vue/es/icon'
import type { AppTestCase, AppPackage, AppTestSuite } from '../../types'
import { caseGroup, casePriority, caseCode, caseHasSteps } from './testCasePresentation'
import { useCaseTransfer } from './useCaseTransfer'
import './test-cases-reference.css'
const props = defineProps<{ cases:AppTestCase[]; packages:AppPackage[]; suites:AppTestSuite[]; projectId:number; loading:boolean; error:string; suiteError:string }>()
const selected = defineModel<number[]>('selected', {required:true})
const emit = defineEmits<{ create:[group:string]; edit:[record:AppTestCase]; execute:[record:AppTestCase]; scene:[record:AppTestCase]; duplicate:[record:AppTestCase]; remove:[id:number]; ai:[]; reload:[]; 'batch-execute':[] }>()
const {width} = useWindowSize(), groupSearch=ref(''), search=ref(''), group=ref<string|null>(null), priority=ref(''), result=ref(''), suite=ref(0), page=ref(1), pageSize=ref(10), importFile=ref<HTMLInputElement>()
const transfer=useCaseTransfer(()=>props.projectId,()=>props.cases,()=>emit('reload'))
const groupCounts=computed(()=> {const map=new Map<string,number>();props.cases.forEach(item=>map.set(caseGroup(item),(map.get(caseGroup(item))||0)+1));return Array.from(map,([name,count])=>({name,count}))})
const groups=computed(()=>groupCounts.value.filter(item=>(item.name||'未分组').includes(groupSearch.value.trim())))
const suiteNames=(id:number)=>props.suites.filter(item=>item.suite_cases?.some(member=>member.test_case_id===id)).map(item=>item.name).join('、')||'—'
const filtered=computed(()=>props.cases.filter(item=> {
  const term=search.value.trim().toLowerCase()
  return (!term||`${item.name} ${caseCode(item)} ${item.description}`.toLowerCase().includes(term))&&(group.value===null||caseGroup(item)===group.value)&&(!priority.value||(priority.value==='unset'?!casePriority(item):casePriority(item)===priority.value))&&(!result.value||(result.value==='empty'?!caseHasSteps(item):result.value==='pending'?!item.last_result:item.last_result===result.value))&&(!suite.value||props.suites.find(s=>s.id===suite.value)?.suite_cases?.some(member=>member.test_case_id===item.id))
}))
const pageCases=computed(()=>filtered.value.slice((page.value-1)*pageSize.value,page.value*pageSize.value))
const selectedRecords=computed(()=>props.cases.filter(item=>selected.value.includes(item.id)))
const metrics=computed(()=>[
  {label:'用例总数',value:props.cases.length,icon:IconLayers,tone:'teal',hint:'当前项目全部用例'},
  {label:'可执行',value:props.cases.filter(caseHasSteps).length,icon:IconPlayArrow,tone:'teal',hint:'已配置流程步骤'},
  {label:'空流程',value:props.cases.filter(item=>!caseHasSteps(item)).length,icon:IconClockCircle,tone:'orange',hint:'需补充执行步骤'},
  {label:'未通过',value:props.cases.filter(item=>['failed','error'].includes(item.last_result)).length,icon:IconExclamationCircle,tone:'red',hint:'最近一次执行失败'},
  {label:'关联应用',value:new Set(props.cases.map(item=>item.package_id).filter(Boolean)).size,icon:IconApps,tone:'purple',hint:'已绑定的应用包'},
])
const priorityColor=(value:string)=>({P0:'red',P1:'orange',P2:'arcoblue',P3:'gray'}[value]||'gray')
const resultColor=(value:string)=>value==='passed'?'green':['failed','error'].includes(value)?'red':['running','pending'].includes(value)?'arcoblue':'gray'
const resultLabel=(value:string)=>({passed:'通过',failed:'失败',error:'错误',running:'执行中',pending:'等待中',stopped:'已停止'}[value]||'未执行')
const formatTime=(value:string)=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'—'
const reset=()=>{search.value='';group.value=null;priority.value='';result.value='';suite.value=0}
watch([search,group,priority,result,suite,pageSize],()=>{page.value=1;selected.value=[]})
watch(()=>filtered.value.length,()=>{page.value=Math.max(1,Math.min(page.value,Math.ceil(filtered.value.length/pageSize.value)||1))})
watch(()=>props.projectId,()=>{reset();selected.value=[];transfer.visible.value=false;transfer.pending.value=[]})
</script>
