<template>
  <div class="dashboard-view fc-page">
    <div v-if="!currentProjectId" class="empty-shell fc-empty-state">
      <a-empty description="请先选择项目后查看 APP 自动化概览" />
    </div>
    <template v-else>
      <a-alert v-if="loadError" type="error" title="概览数据加载失败"><span>{{ loadError }}</span><a-button type="text" @click="loadDashboard">重试</a-button></a-alert>
      <DashboardReferenceMetrics :statistics="statistics" :pending-bugs="pendingBugs" :unavailable="loading || !!loadError" @navigate="navigateMetric" />
      <a-spin :loading="loading" style="width:100%"><DashboardReferenceCharts :statistics="statistics" @devices="openTab('devices')" /></a-spin>
      <div class="app-overview-bottom">
        <section class="app-overview-panel app-todo-panel"><header><h3><icon-schedule /> 我的待办 <small>项目协作</small></h3><a-button type="text" size="small" @click="openTab('scheduled-tasks')">查看更多 <icon-right /></a-button></header>
          <div v-if="todos.length" class="app-overview-todos"><button v-for="todo in todos" :key="todo.key" type="button" class="app-overview-todo" @click="todo.open()"><icon-file /><strong>{{todo.title}}</strong><a-tag :color="todo.color">{{todo.status}}</a-tag><time>{{todo.time}}</time><icon-right /></button></div><a-empty v-else description="当前项目暂无待办事项" />
          <p v-if="bugStatisticsError" class="app-overview-footnote">项目缺陷统计暂不可用，可刷新后重试。</p>
        </section>
        <section class="app-overview-panel app-assistant-panel"><header><h3><icon-robot /> AI 智能助手</h3><a-tag :color="aiStatusTagColor">{{aiStatusTagText}}</a-tag></header><div class="app-assistant-content"><div><h4>用 AI 提升 APP 测试效率</h4><ul><li><icon-check /> 根据目标规划测试场景与操作步骤</li><li><icon-check /> 辅助推荐页面元素与定位方式</li><li><icon-check /> 结合执行日志查看结果与失败原因</li></ul><p>{{aiStatusDescription}}</p><small v-if="aiStatus.hasConfig">{{aiConfigDisplay}} · {{aiCapabilityDisplay}}</small></div><div class="app-assistant-action"><span class="app-assistant-symbol" aria-hidden="true">AI</span><a-button class="fc-ai-action" type="primary" @click="openTab('scene-builder')">开始使用 <icon-right /></a-button></div></div><footer><a-button type="text" size="small" @click="openLlmConfigManagement">{{aiStatus.hasConfig?'管理模型配置':'配置 AI 模型'}}</a-button><a-button type="text" size="small" :loading="aiStatusLoading" @click="refreshAiStatus(true)">刷新 AI 状态</a-button></footer></section>
      </div>
      <details class="app-overview-details"><summary>任务与最近执行明细</summary><div class="app-overview-detail-grid">
      <DashboardTaskSnapshotCard
        :tasks="taskSnapshot"
        :get-task-type-label="getTaskTypeLabel"
        :get-trigger-summary="getTriggerSummary"
        :get-task-target="getTaskTarget"
        :format-date-time="formatDateTime"
        :get-task-status-color="getTaskStatusColor"
        :get-primary-execution-id="getPrimaryExecutionId"
        :is-task-action-loading="isTaskActionLoading"
        @open-all="openTab('scheduled-tasks')"
        @open-task="openScheduledTask"
        @run-task="runTaskNow"
        @resume-task="resumeTask"
        @open-latest-execution="openLatestExecution"
      />

      <DashboardRecentExecutionsCard
        :executions="recentExecutions"
        :get-execution-status-color="getExecutionStatusColor"
        :get-execution-status-label="getExecutionStatusLabel"
        :format-progress="formatProgress"
        :format-date-time="formatDateTime"
        :can-open-report="canOpenReport"
        @open-all="openTab('executions')"
        @open-execution="openExecution"
        @open-report="openReport"
      />

      </div></details>
      <footer class="app-overview-status"><div><a-tag :color="serviceStatusTagColor">{{serviceStatusTagText}}</a-tag><span>{{lastUpdatedText==='-'?'等待首次更新':'更新于 '+lastUpdatedText}}</span></div><a-button size="small" :loading="loading" @click="loadDashboard"><icon-refresh /> 刷新概览</a-button></footer>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { IconSchedule, IconFile, IconCheck, IconRobot, IconRight, IconRefresh } from '@arco-design/web-vue/es/icon'
import DashboardReferenceMetrics from './dashboard/DashboardReferenceMetrics.vue'
import DashboardReferenceCharts from './dashboard/DashboardReferenceCharts.vue'
import type { AppAutomationTab } from '../types'

import {
  DashboardRecentExecutionsCard,
  DashboardTaskSnapshotCard,
  useAppAutomationDashboard,
} from './dashboard'

const {
  currentProjectId,
  statistics,
  loadError,
  pendingBugs,
  bugStatisticsError,
  loading,
  aiStatusLoading,
  aiStatus,
  recentExecutions,
  taskSnapshot,
  lastUpdatedText,
  serviceStatusTagColor,
  serviceStatusTagText,
  aiConfigDisplay,
  aiCapabilityDisplay,
  aiStatusDescription,
  aiStatusTagColor,
  aiStatusTagText,
  getExecutionStatusColor,
  getExecutionStatusLabel,
  formatProgress,
  formatDateTime,
  canOpenReport,
  getTaskTypeLabel,
  getTaskTarget,
  getTaskStatusColor,
  getTriggerSummary,
  getPrimaryExecutionId,
  isTaskActionLoading,
  refreshAiStatus,
  loadDashboard,
  openTab,
  openExecution,
  openLatestExecution,
  openScheduledTask,
  openReport,
  openLlmConfigManagement,
  runTaskNow,
  resumeTask,
} = useAppAutomationDashboard()
const router = useRouter()
const navigateMetric = (target: string) => target==='bugs' ? router.push('/test-bugs') : openTab(target as AppAutomationTab)
const todos = computed(() => {
  const items = taskSnapshot.value.filter(task=>['ACTIVE','FAILED','PAUSED'].includes(task.status)).slice(0,1).map(task=>({key:'task-'+task.id,title:'定时任务：'+task.name,status:task.status==='ACTIVE'?'待执行':task.status==='PAUSED'?'已暂停':'待检查',color:task.status==='FAILED'?'red':task.status==='PAUSED'?'gray':'orange',time:task.next_run_time ? formatDateTime(task.next_run_time) : '未安排下次执行',open:()=>openScheduledTask(task)}))
  const report = recentExecutions.value.find(record=>canOpenReport(record))
  if(report) items.push({key:'report-'+report.id,title:'执行报告：'+(report.case_name || '#'+report.id),status:'查看结果',color:'purple',time:formatDateTime(report.started_at || report.created_at),open:()=>openExecution(report.id)})
  if(pendingBugs.value) items.push({key:'bugs',title:`项目缺陷待处理（${pendingBugs.value}）`,status:'待处理',color:'red',time:'当前项目',open:async()=>{await router.push('/test-bugs')}})
  return items.slice(0,4)
})
</script>
