<template>
  <section class="report-summary-panel" aria-label="报告摘要">
    <header><h3>报告详情</h3><a-button v-if="record" type="text" size="mini" :disabled="!reportAvailable(record)||disabled" @click="emit('report',record)">查看完整报告 <icon-launch /></a-button></header>
    <a-empty v-if="!record" description="选择一份报告查看详情" />
    <template v-else>
      <dl class="report-detail-meta"><dt><icon-file /> 报告 ID</dt><dd>{{executionCode(record)}}</dd><dt><icon-layers /> 用例名称</dt><dd>{{record.case_name||'未记录'}}</dd><dt><icon-layers /> 关联套件</dt><dd>{{reportSuite(record,suites)}}</dd><dt><icon-mobile /> 应用 / 版本</dt><dd>{{reportApp(record)}}<small>{{reportVersion(record)}}</small></dd><dt><icon-mobile /> 执行设备</dt><dd>{{record.device_name||record.device_serial||'未记录'}}</dd><dt><icon-clock-circle /> 执行时间</dt><dd>{{Number.isFinite(reportTime(record))?new Date(reportTime(record)).toLocaleString('zh-CN',{hour12:false}):'—'}}</dd><dt><icon-schedule /> 执行时长</dt><dd>{{clockDuration(record.duration)}}</dd><dt><icon-user /> 执行来源</dt><dd>{{sourceLabel(record.trigger_mode)}} · {{record.triggered_by||'未记录执行人'}}</dd></dl>
      <h3>执行结论</h3><div class="report-verdict" :class="executionState(record)"><a-tag :color="reportStatus(record).color">{{reportStatus(record).label}}</a-tag><p>{{record.report_summary||record.error_message||'服务未提供执行摘要'}}</p><div class="report-step-summary"><span>总步骤 <b>{{record.total_steps??'—'}}</b></span><span>通过 <b>{{record.passed_steps??'—'}}</b></span><span>失败 <b>{{record.failed_steps??'—'}}</b></span></div><p>步骤通过率 <strong :class="rate===null?'muted':rate===100?'passed-rate':'failed-rate'">{{rateText(rate)}}</strong></p></div>
      <div class="report-failure-title"><h3>失败步骤 / 日志 TOP 3</h3><a-button type="text" size="mini" :disabled="disabled" @click="emit('detail',record.id)">查看全部</a-button></div>
      <ol v-if="failures.length" class="report-failures"><li v-for="(item,index) in failures.slice(0,3)" :key="index"><icon-close-circle /><div><strong>{{item.message}}</strong><small>{{item.timestamp||'未记录时间'}}</small></div></li></ol><a-empty v-else :description="['running','pending'].includes(executionState(record))?'执行尚未结束':'未记录失败步骤或错误日志'" />
      <div class="report-summary-actions"><a-button :disabled="disabled" @click="emit('detail',record.id)"><icon-file /> 日志与执行证据</a-button><a-button type="primary" :disabled="disabled||!reportAvailable(record)" @click="emit('report',record)">打开完整报告 <icon-launch /></a-button></div>
    </template>
  </section>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {IconFile,IconLaunch,IconLayers,IconMobile,IconClockCircle,IconSchedule,IconUser,IconCloseCircle} from '@arco-design/web-vue/es/icon'
import type {AppExecution,AppTestSuite} from '../../types'
import {executionCode,executionState,reportAvailable,reportStatus,reportSuite,reportApp,reportVersion,reportTime,clockDuration,sourceLabel,reportRate,rateText} from './reportPresentation'
const props=defineProps<{record:AppExecution|null;suites:AppTestSuite[];disabled:boolean}>()
const emit=defineEmits<{report:[record:AppExecution];detail:[id:number]}>()
const rate=computed(()=>props.record?reportRate(props.record):null)
const failures=computed(()=>{if(!props.record)return [];const values=(props.record.logs||[]).filter(log=>['error','critical','fatal'].includes(log.level?.toLowerCase()));return values.length?values:props.record.error_message?[{message:props.record.error_message,timestamp:''}]:[]})
</script>
