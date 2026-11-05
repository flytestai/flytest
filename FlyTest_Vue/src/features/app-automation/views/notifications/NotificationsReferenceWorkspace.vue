<template>
  <section class="app-case-reference notification-reference">
    <div class="notification-metrics">
      <article v-for="item in metrics" :key="item.label" class="app-case-metric" :class="item.tone"><span class="app-case-metric-icon"><component :is="item.icon" /></span><div><span>{{item.label}}</span><strong>{{item.value}}</strong><small>{{item.note}}</small></div></article>
      <figure class="notification-trend"><figcaption><icon-bar-chart /><span>近 7 天趋势<small>按通知创建时间统计</small></span></figcaption><div class="notification-trend-bars" role="img" :aria-label="trendDescription"><span v-for="day in statistics.days" :key="day.key" :title="`${day.key}：${day.count} 条`"><i :style="{height:day.count?`${Math.max(8,day.count/trendMax*32)}px`:'1px'}" /><small>{{day.label}}</small></span></div></figure>
    </div>
    <a-alert v-if="taskId" class="notification-context">当前仅显示任务「{{taskName||`#${taskId}`}}」的通知，顶部统计为整个项目。<template #action><a-space><a-button size="mini" @click="emit('task',taskId)">查看任务</a-button><a-button size="mini" @click="emit('clear-context')">查看全部通知</a-button></a-space></template></a-alert>
    <section class="app-case-list notification-list" aria-label="通知日志列表">
      <div class="app-case-toolbar notification-toolbar">
        <a-input v-model="filters.search" placeholder="搜索标题、内容或关联任务 ID" allow-clear :input-attrs="{'aria-label':'搜索通知日志'}"><template #prefix><icon-search /></template></a-input>
        <a-select v-model="filters.event_type" aria-label="筛选通知类型"><a-option value="">通知类型 · 全部</a-option><a-option v-for="event in eventOptions" :key="event" :value="event">{{eventLabel(event)}}</a-option></a-select>
        <a-select v-model="filters.notification_type" aria-label="筛选发送渠道"><a-option value="">发送渠道 · 全部</a-option><a-option v-for="(label,key) in channelLabels" :key="key" :value="key">{{label}}</a-option></a-select>
        <a-select v-model="filters.status" aria-label="筛选发送结果"><a-option value="">发送结果 · 全部</a-option><a-option value="success">成功</a-option><a-option value="failed">失败</a-option><a-option value="pending">待发送</a-option><a-option value="simulated">模拟投递</a-option></a-select>
        <a-range-picker v-model="dates" class="notification-date-range" value-format="YYYY-MM-DD" format="YYYY-MM-DD" :allow-clear="true" :placeholder="['开始日期','结束日期']" aria-label="筛选通知日期" />
        <div class="notification-toolbar-actions"><a-button aria-label="重置通知筛选" @click="emit('reset')"><icon-refresh /></a-button><a-button :loading="loading" aria-label="刷新通知日志" @click="emit('refresh')"><icon-refresh /> 刷新</a-button><a-button type="primary" :disabled="!logs.length||error||loading" @click="exportLogs(logs)"><icon-download /> 导出日志</a-button></div>
      </div>
      <div class="notification-list-hint"><span v-if="statistics.simulated">含 {{statistics.simulated}} 条模拟投递记录，不计入实际发送成功／失败统计。</span><span v-else>通知类型与发送结果分别展示，测试执行失败不代表通知发送失败。</span><a-button type="text" size="mini" @click="filters.status='failed'">追踪失败记录 <icon-arrow-right /></a-button></div>
      <a-alert v-if="error" type="error">通知日志加载失败，请刷新重试。<template #action><a-button size="mini" @click="emit('refresh')">重试</a-button></template></a-alert>
      <div v-if="selected.length" class="app-case-selection">已选择 {{selected.length}} 条<a-button type="text" size="mini" @click="exportLogs(logs.filter(log=>selected.includes(log.id)))">导出所选日志</a-button><a-button type="text" size="mini" @click="selected=[]">清空选择</a-button></div>
      <a-table class="app-case-table notification-table" row-key="id" :data="pageLogs" :loading="loading" :pagination="false" :bordered="false" :scroll="{x:1280}" :row-selection="{type:'checkbox',showCheckedAll:true}" v-model:selected-keys="selected">
        <template #columns>
          <a-table-column :width="175"><template #title><button class="notification-sort" @click="ascending=!ascending;current=1">通知时间 <icon-arrow-up v-if="ascending"/><icon-arrow-down v-else/></button></template><template #cell="{record}">{{formatTime(record.created_at)}}</template></a-table-column>
          <a-table-column title="通知类型" :width="110"><template #cell="{record}"><a-tag :color="eventColor(notificationEvent(record))">{{eventLabel(notificationEvent(record))}}</a-tag></template></a-table-column>
          <a-table-column title="通知标题" :width="200"><template #cell="{record}"><button class="notification-title" :title="notificationTitle(record)" @click="emit('detail',record)">{{notificationTitle(record)}}</button></template></a-table-column>
          <a-table-column title="通知内容摘要" :width="235"><template #cell="{record}"><span :title="notificationSummary(record)">{{notificationSummary(record)}}</span><small v-if="record.error_message" class="notification-error" :title="record.error_message">{{record.error_message}}</small></template></a-table-column>
          <a-table-column title="关联对象" :width="150"><template #cell="{record}"><button v-if="record.task_id" class="notification-target" :title="`任务 #${record.task_id} · ${record.task_name}`" @click="emit('task',record.task_id)"><icon-layers />{{record.task_name||`任务 #${record.task_id}`}}</button><button v-else-if="executionId(record)" class="notification-target" @click="emit('execution',record)"><icon-file />#EX-{{executionId(record)}}</button><span v-else class="notification-muted">—</span></template></a-table-column>
          <a-table-column title="发送渠道" :width="115"><template #cell="{record}"><span class="notification-channel"><component :is="channelIcon(notificationChannel(record))" :class="`channel-${notificationChannel(record)}`" />{{channelLabels[notificationChannel(record)]}}</span></template></a-table-column>
          <a-table-column title="发送结果" :width="108"><template #cell="{record}"><a-tag :color="deliveryMeta(record).color"><icon-check-circle v-if="record.status==='success'&&!simulatedDelivery(record)"/><icon-close-circle v-else-if="record.status==='failed'&&!simulatedDelivery(record)"/>{{deliveryMeta(record).label}}</a-tag><small v-if="record.is_retried" class="notification-muted">重试 {{record.retry_count}} 次</small></template></a-table-column>
          <a-table-column title="操作" :width="86" fixed="right"><template #cell="{record}"><div class="app-case-row-actions"><a-button type="text" :aria-label="`查看通知 ${record.id}`" @click="emit('detail',record)"><icon-eye /></a-button><a-dropdown trigger="click"><a-button type="text" :aria-label="`更多通知 ${record.id}`"><icon-more /></a-button><template #content><a-doption @click="emit('detail',record)">详情与失败原因</a-doption><a-doption :disabled="!executionId(record)" @click="emit('execution',record)">查看关联执行</a-doption><a-doption :disabled="!record.task_id" @click="emit('task',record.task_id)">查看关联任务</a-doption><a-doption @click="exportLogs([record])">导出此条日志</a-doption></template></a-dropdown></div></template></a-table-column>
        </template>
        <template #empty><a-empty :description="allLogs.length?'没有符合筛选条件的通知':'暂无通知日志，执行任务后可在此追踪通知结果'" /></template>
      </a-table>
      <footer class="app-case-pagination"><span>共 {{logs.length}} 条</span><a-pagination v-model:current="current" v-model:page-size="pageSize" :total="logs.length" :show-page-size="width>650" :simple="width<650" :page-size-options="[10,20,50]" /></footer>
    </section>
  </section>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useWindowSize} from '@vueuse/core'
import {IconSend,IconCheck,IconClose,IconClockCircle,IconBarChart,IconSearch,IconRefresh,IconDownload,IconArrowRight,IconArrowUp,IconArrowDown,IconLayers,IconFile,IconEmail,IconMessage,IconLink,IconEye,IconMore,IconCheckCircle,IconCloseCircle} from '@arco-design/web-vue/es/icon'
import type {AppNotificationLog} from '../../types'
import type {NotificationFilters} from './notificationViewModels'
import {channelLabels,notificationChannel,notificationEvent,eventLabel,notificationTitle,notificationSummary,notificationOverview,notificationTime,deliveryMeta,simulatedDelivery,notificationCsv} from './notificationPresentation'
import '../test-cases/test-cases-reference.css'
import './notifications-reference.css'
const props=defineProps<{projectId:number;allLogs:AppNotificationLog[];logs:AppNotificationLog[];statistics:ReturnType<typeof notificationOverview>;filters:NotificationFilters;loading:boolean;error:boolean;taskId:number|null;taskName?:string;formatTime:(value?:string|null)=>string}>()
const current=defineModel<number>('current',{required:true}),pageSize=defineModel<number>('pageSize',{required:true})
const emit=defineEmits<{refresh:[];reset:[];detail:[record:AppNotificationLog];task:[id:number];execution:[record:AppNotificationLog];'clear-context':[]}>()
const {width}=useWindowSize(),selected=ref<(string|number)[]>([]),ascending=ref(false)
const pageLogs=computed(()=>{const sorted=[...props.logs].sort((a,b)=>(notificationTime(a.created_at)||0)-(notificationTime(b.created_at)||0)||a.id-b.id);if(!ascending.value)sorted.reverse();return sorted.slice((current.value-1)*pageSize.value,current.value*pageSize.value)})
const dates=computed({get:()=>props.filters.start_date?[props.filters.start_date,props.filters.end_date]:[],set:(value:(string|number|Date|undefined)[]|undefined)=>{props.filters.start_date=String(value?.[0]||'');props.filters.end_date=String(value?.[1]||'')}})
const eventOptions=computed(()=>[...new Set(props.allLogs.map(notificationEvent))])
const eventColor=(event:string)=>({execution_completed:'green',execution_passed:'green',execution_failed:'red',execution_error:'orange',task_triggered:'purple',task_schedule:'purple',report_generated:'purple'}[event]||'arcoblue')
const executionId=(record:AppNotificationLog)=>record.response_info?.execution_id||record.response_info?.execution_ids?.[0]
const channelIcon=(channel:string)=>channel==='email'?IconEmail:['feishu','dingtalk','wecom'].includes(channel)?IconMessage:IconLink
const trendMax=computed(()=>Math.max(1,...props.statistics.days.map(item=>item.count)))
const trendDescription=computed(()=>props.statistics.days.map(day=>`${day.key} ${day.count} 条`).join('，'))
const metrics=computed(()=>{const s=props.statistics;return [
  {label:'通知总数',value:s.total,note:'当前项目全部记录',tone:'teal',icon:IconSend},
  {label:'发送成功',value:s.success,note:'实际投递成功',tone:'teal',icon:IconCheck},
  {label:'发送失败',value:s.failed,note:'实际投递失败',tone:'red',icon:IconClose},
  {label:'今日通知',value:s.today,note:'按本地日期统计',tone:'purple',icon:IconClockCircle},
]})
const exportLogs=(records:AppNotificationLog[])=>{if(props.error||props.loading||!records.length)return;const url=URL.createObjectURL(new Blob([notificationCsv(records)],{type:'text/csv;charset=utf-8;'})),link=document.createElement('a');link.href=url;link.download=`FeiCe-通知日志-项目${props.projectId}-${new Date().toISOString().slice(0,10)}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
watch(()=>props.logs,logs=>{const ids=new Set(logs.map(log=>log.id));selected.value=selected.value.filter(id=>ids.has(Number(id)))})
watch(()=>props.projectId,()=>{selected.value=[];ascending.value=false})
</script>
