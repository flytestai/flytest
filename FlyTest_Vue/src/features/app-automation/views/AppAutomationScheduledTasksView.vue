<template>
  <div class="page-shell fc-page">
    <div v-if="!projectStore.currentProjectId" class="empty-shell fc-empty-state">
      <a-empty description="请选择项目后再配置 APP 定时任务" />
    </div>
    <template v-else>
      <ScheduledTasksReferenceWorkspace
        v-model:current="pagination.current" v-model:page-size="pagination.pageSize"
        :loading="loading" :error="loadError" :tasks="pagedTasks" :total="filteredTasks.length"
        :statistics="statistics" :filters="filters" :format-time="formatDateTime"
        :trigger-summary="getTriggerSummary" :result-meta="getLastResultMeta" :is-action-loading="isActionLoading"
        @refresh="loadData" @reset="resetFilters" @create="openCreate" @ai="aiVisible=true"
        @detail="openDetail" @run="runNow" @edit="openEdit" @copy="copyTask"
        @pause="pause" @resume="resume" @remove="remove" @execution="openLatestExecution" @notifications="openTaskNotifications"
      />
      <ScheduledTaskAiDialog v-model:visible="aiVisible" :project-id="projectStore.currentProjectId" @apply="applyProposal" />

      <ScheduledTaskDetailDialog
        v-model:visible="detailVisible"
        :detail-loading="detailLoading"
        :task-notifications-loading="taskNotificationsLoading"
        :current-task="currentTask"
        :recent-task-notifications="recentTaskNotifications"
        :format-date-time="formatDateTime"
        :get-task-type-label="getTaskTypeLabel"
        :get-task-target="getTaskTarget"
        :get-notification-label="getNotificationLabel"
        :get-notification-color="getNotificationColor"
        :get-notification-status-color="getNotificationStatusColor"
        :get-last-result-meta="getLastResultMeta"
        :get-task-success-rate="getTaskSuccessRate"
        :get-last-result-summary="getLastResultSummary"
        :get-notification-detail="getNotificationDetail"
        :get-primary-execution-id-from-log="getPrimaryExecutionIdFromLog"
        :get-trigger-summary="getTriggerSummary"
        :get-notification-summary="getNotificationSummary"
        :has-execution-result="hasExecutionResult"
        :has-latest-report="hasLatestReport"
        @open-latest-execution="openLatestExecution"
        @open-latest-report="openLatestReport"
        @open-task-notifications="openTaskNotifications"
        @open-notification-execution="openNotificationExecution"
      />

      <ScheduledTaskFormDialog
        v-model:visible="visible"
        v-model:notify-emails-text="notifyEmailsText"
        :form="form"
        :devices="devices"
        :suites="suites"
        :test-cases="testCases"
        :packages="packages"
        :notifications-enabled="notificationsEnabled"
        :needs-email-recipients="needsEmailRecipients"
        @before-ok="handleBeforeOk"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import {ref,nextTick} from 'vue'
import ScheduledTasksReferenceWorkspace from './scheduled-tasks/ScheduledTasksReferenceWorkspace.vue'
import ScheduledTaskAiDialog, {type ScheduleProposal} from './scheduled-tasks/ScheduledTaskAiDialog.vue'

import {
  ScheduledTaskDetailDialog,
  ScheduledTaskFormDialog,
  useAppAutomationScheduledTasks,
} from './scheduled-tasks'

const {
  projectStore,
  loading,
  loadError,
  visible,
  detailVisible,
  detailLoading,
  taskNotificationsLoading,
  notifyEmailsText,
  suites,
  testCases,
  devices,
  packages,
  currentTask,
  filters,
  pagination,
  form,
  notificationsEnabled,
  needsEmailRecipients,
  recentTaskNotifications,
  filteredTasks,
  pagedTasks,
  statistics,
  isActionLoading,
  formatDateTime,
  getTaskTypeLabel,
  getTriggerTypeLabel,
  getNotificationLabel,
  getNotificationColor,
  getStatusColor,
  getNotificationStatusColor,
  getTaskTarget,
  getPackageLabel,
  getTriggerSummary,
  getNotificationSummary,
  hasExecutionResult,
  hasLatestReport,
  getTaskSuccessRate,
  getLastResultMeta,
  getLastResultSummary,
  getNotificationDetail,
  getPrimaryExecutionIdFromLog,
  loadData,
  openCreate,
  openDetail,
  openEdit,
  resetFilters,
  handleBeforeOk,
  openLatestExecution,
  openLatestReport,
  openTaskNotifications,
  openNotificationExecution,
  runNow,
  pause,
  resume,
  remove,
} = useAppAutomationScheduledTasks()
const aiVisible=ref(false)
const copyTask=(task:Parameters<typeof openEdit>[0])=>{openEdit(task);form.id=0;form.name=task.name+'（副本）';form.status='PAUSED'}
const applyProposal=async(proposal:ScheduleProposal)=>{openCreate();form.trigger_type=proposal.trigger_type;await nextTick();Object.assign(form,proposal,{status:'PAUSED',notify_on_failure:false,notification_type:''})}

</script>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding: 0 !important;
}

.empty-shell {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    var(--theme-surface);
  border: 1px solid var(--theme-card-border);
  border-radius: 12px;
  color: var(--theme-text-secondary);
  box-shadow: var(--theme-card-shadow);
}

.page-shell :deep(.arco-card),
.page-shell :deep(.task-card),
.page-shell :deep(.stats-card) {
  border-radius: 12px;
  box-shadow: var(--theme-card-shadow);
}

.page-shell :deep(.arco-card-body) {
  padding: 20px;
}

@media (max-width: 900px) {
  .page-shell {
    gap: 16px;
    padding: 4px;
  }

  .page-shell :deep(.arco-card-body) {
    padding: 18px;
  }
}
</style>
