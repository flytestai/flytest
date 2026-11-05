<template>
  <section class="app-case-reference scheduled-reference">
    <div class="app-case-metrics">
      <article v-for="item in metrics" :key="item.label" class="app-case-metric" :class="item.tone">
        <span class="app-case-metric-icon"><component :is="item.icon" /></span><div><p>{{ item.label }}</p><strong>{{ item.value }}</strong><small>{{ item.note }}</small></div>
      </article>
      <article class="app-case-ai"><div><h3><icon-star /> AI 生成定时任务</h3><p>根据回归目标，辅助设计调度规则</p></div><a-button class="fc-ai-action app-case-ai-button" type="primary" @click="emit('ai')">立即生成 <icon-arrow-right /></a-button></article>
    </div>
    <section class="app-case-list scheduled-list" aria-label="定时任务列表">
      <div class="app-case-toolbar scheduled-toolbar">
        <a-input v-model="filters.search" allow-clear placeholder="搜索任务名称、描述或关联对象" :input-attrs="{'aria-label':'搜索定时任务'}"><template #prefix><icon-search /></template></a-input>
        <a-select v-model="filters.task_type" aria-label="筛选任务类型"><a-option value="">任务类型 · 全部</a-option><a-option value="TEST_SUITE">测试套件</a-option><a-option value="TEST_CASE">测试用例</a-option></a-select>
        <a-select v-model="filters.status" aria-label="筛选任务状态"><a-option value="">状态 · 全部</a-option><a-option value="ACTIVE">激活</a-option><a-option value="PAUSED">暂停</a-option><a-option value="FAILED">触发失败</a-option><a-option value="COMPLETED">已完成</a-option></a-select>
        <a-select v-model="filters.trigger_type" aria-label="筛选触发方式"><a-option value="">触发方式 · 全部</a-option><a-option value="CRON">Cron 表达式</a-option><a-option value="INTERVAL">周期执行</a-option><a-option value="ONCE">单次执行</a-option></a-select>
        <div class="scheduled-toolbar-actions"><a-button aria-label="重置筛选" @click="emit('reset')"><icon-refresh /> 重置</a-button><a-button :loading="loading" aria-label="刷新定时任务" @click="emit('refresh')"><icon-refresh /> 刷新</a-button><a-button type="primary" @click="emit('create')"><icon-plus /> 新建任务</a-button></div>
      </div>
      <p class="scheduled-hint">Cron 按 UTC 调度；下次执行时间按本地时区显示。触发成功仅表示已提交执行，可从详情查看测试结果。</p>
      <a-alert v-if="error" type="error">任务加载失败，请刷新重试。</a-alert>
      <a-table class="app-case-table" :data="tasks" row-key="id" :pagination="false" :loading="loading" :bordered="false" :scroll="{x:1320}">
        <template #columns>
          <a-table-column title="任务名称" :width="210"><template #cell="{record}"><button class="scheduled-name" @click="emit('detail',record)"><icon-schedule /><span>{{record.name}}<small :title="record.description">{{record.description || `TASK-${record.id}`}}</small></span></button></template></a-table-column>
          <a-table-column title="任务类型" :width="100"><template #cell="{record}"><a-tag :color="record.task_type==='TEST_SUITE'?'purple':'arcoblue'">{{record.task_type==='TEST_SUITE'?'测试套件':'测试用例'}}</a-tag></template></a-table-column>
          <a-table-column title="触发方式" :width="105"><template #cell="{record}"><span class="scheduled-trigger"><icon-clock-circle />{{triggerLabels[record.trigger_type as keyof typeof triggerLabels]||record.trigger_type}}</span></template></a-table-column>
          <a-table-column title="调度规则" :width="155"><template #cell="{record}"><code v-if="record.trigger_type==='CRON'" class="scheduled-cron">{{record.cron_expression}}</code><span v-else>{{triggerSummary(record)}}</span><small v-if="record.trigger_type==='CRON'" class="scheduled-subtle">UTC · 分 时 日 月 周</small></template></a-table-column>
          <a-table-column title="关联对象" :width="160"><template #cell="{record}"><span class="scheduled-target" :title="record.test_suite_name || record.test_case_name"><icon-layers />{{record.test_suite_name || record.test_case_name || '未关联'}}</span></template></a-table-column>
          <a-table-column title="下次执行时间" :width="160"><template #cell="{record}"><span>{{record.status==='ACTIVE'?formatTime(record.next_run_time):'—'}}</span></template></a-table-column>
          <a-table-column title="状态" :width="92"><template #cell="{record}"><a-tag :color="statusMeta(record.status).color">{{statusMeta(record.status).label}}</a-tag></template></a-table-column>
          <a-table-column title="启用" :width="75"><template #cell="{record}"><a-switch :model-value="record.status==='ACTIVE'" :loading="busy(record)" :disabled="record.status==='COMPLETED'||busy(record)" :aria-label="`启用 ${record.name}`" @change="value=>value?emit('resume',record.id):emit('pause',record.id)" /></template></a-table-column>
          <a-table-column title="最近触发结果" :width="115"><template #cell="{record}"><a-tag :color="resultMeta(record).color">{{resultMeta(record).label}}</a-tag></template></a-table-column>
          <a-table-column title="操作" :width="148" fixed="right"><template #cell="{record}"><div class="app-case-row-actions">
            <a-button type="text" :aria-label="`立即执行 ${record.name}`" :loading="isActionLoading('run',record.id)" :disabled="busy(record)" @click="emit('run',record.id)"><icon-play-arrow /></a-button>
            <a-button type="text" :aria-label="`编辑 ${record.name}`" :disabled="busy(record)" @click="emit('edit',record)"><icon-edit /></a-button>
            <a-button type="text" :aria-label="`复制 ${record.name}`" @click="emit('copy',record)"><icon-copy /></a-button>
            <a-dropdown trigger="click"><a-button type="text" :aria-label="`更多 ${record.name}`"><icon-more /></a-button><template #content><a-doption @click="emit('detail',record)">任务详情与报告</a-doption><a-doption @click="emit('execution',record)">查看执行记录</a-doption><a-doption @click="emit('notifications',record)">查看通知</a-doption><a-doption :disabled="busy(record)" @click="emit('remove',record.id)"><span class="scheduled-danger">删除任务</span></a-doption></template></a-dropdown>
          </div></template></a-table-column>
        </template>
        <template #empty><a-empty :description="filtered?'没有符合筛选条件的任务':'暂无定时任务，创建周期回归计划'" /></template>
      </a-table>
      <footer class="app-case-pagination"><span>共 {{total}} 条</span><a-pagination v-model:current="current" v-model:page-size="pageSize" :total="total" :show-page-size="width>650" :simple="width<650" :page-size-options="[10,20,50]" /></footer>
    </section>
  </section>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {useWindowSize} from '@vueuse/core'
import {IconSchedule,IconPlayArrow,IconPause,IconCheck,IconStar,IconArrowRight,IconSearch,IconRefresh,IconPlus,IconClockCircle,IconLayers,IconEdit,IconCopy,IconMore} from '@arco-design/web-vue/es/icon'
import type {AppScheduledTask} from '../../types'
import type {ScheduledTaskFilters,ScheduledTaskStatistics,ScheduledTaskResultMeta} from './scheduledTaskViewModels'
import '../test-cases/test-cases-reference.css'
import './scheduled-reference.css'
const props=defineProps<{tasks:AppScheduledTask[];total:number;statistics:ScheduledTaskStatistics;filters:ScheduledTaskFilters;loading:boolean;error:boolean;formatTime:(value:string|null)=>string;triggerSummary:(task:AppScheduledTask)=>string;resultMeta:(task:AppScheduledTask)=>ScheduledTaskResultMeta;isActionLoading:(action:string,id:number)=>boolean}>()
const current=defineModel<number>('current',{required:true}),pageSize=defineModel<number>('pageSize',{required:true})
const emit=defineEmits<{ai:[];refresh:[];reset:[];create:[];detail:[task:AppScheduledTask];run:[id:number];edit:[task:AppScheduledTask];copy:[task:AppScheduledTask];pause:[id:number];resume:[id:number];remove:[id:number];execution:[task:AppScheduledTask];notifications:[task:AppScheduledTask]}>()
const {width}=useWindowSize()
const filtered=computed(()=>Object.values(props.filters).some(Boolean))
const triggerLabels={CRON:'Cron 表达式',INTERVAL:'周期执行',ONCE:'单次执行'}
const statusMeta=(status:string)=>({ACTIVE:{label:'激活',color:'green'},PAUSED:{label:'暂停',color:'orange'},FAILED:{label:'触发失败',color:'red'},COMPLETED:{label:'已完成',color:'gray'}}[status]||{label:status,color:'gray'})
const busy=(task:AppScheduledTask)=>['run','pause','resume','delete'].some(action=>props.isActionLoading(action,task.id))
const metrics=computed(()=>{const s=props.statistics;return [
  {label:'任务总数',value:s.total,note:'当前项目全部任务',tone:'teal',icon:IconSchedule},
  {label:'激活任务',value:s.active,note:s.total?`${(s.active/s.total*100).toFixed(1)}% 正在调度`:'暂无任务',tone:'blue',icon:IconPlayArrow},
  {label:'暂停任务',value:s.paused,note:s.total?`${(s.paused/s.total*100).toFixed(1)}% 已暂停`:'暂无任务',tone:'orange',icon:IconPause},
  {label:'触发成功率',value:s.totalRuns?`${s.successRate}%`:'—',note:`成功 ${s.successfulRuns} / 总触发 ${s.totalRuns}`,tone:s.totalRuns?(s.successfulRuns===s.totalRuns?'teal':'red'):'neutral',icon:IconCheck},
]})
</script>
