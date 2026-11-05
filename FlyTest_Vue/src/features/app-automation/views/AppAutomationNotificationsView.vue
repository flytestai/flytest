<template>
  <div class="page-shell fc-page">
    <a-empty v-if="!projectStore.currentProjectId" description="请选择项目后查看通知日志" />
    <NotificationsReferenceWorkspace v-else
      v-model:current="pagination.current" v-model:page-size="pagination.pageSize"
      :project-id="projectStore.currentProjectId" :all-logs="logs" :logs="filteredLogs" :statistics="statistics"
      :filters="filters" :loading="loading" :error="loadError" :task-id="currentTaskId" :task-name="taskContext?.name"
      :format-time="formatDateTime" @refresh="loadData" @reset="resetFilters" @detail="viewDetail"
      @task="openTaskDetail" @execution="openExecution" @clear-context="clearTaskContext"
    />

    <NotificationDetailDialog
      v-model:visible="detailVisible"
      :current-log="currentLog"
      :retrying="retrying"
      :parsed-content="parsedContent"
      :format-date-time="formatDateTime"
      :get-task-type-label="getTaskTypeLabel"
      :get-notification-type-label="getNotificationTypeLabel"
      :recipient-summary="recipientSummary"
      :get-primary-execution-id="getPrimaryExecutionId"
      @open-task-detail="openTaskDetail"
      @open-execution="openExecution"
      @retry="retryNotification"
    />
  </div>
</template>

<script setup lang="ts">
import NotificationsReferenceWorkspace from './notifications/NotificationsReferenceWorkspace.vue'

import {
  NotificationDetailDialog,
  useAppAutomationNotifications,
} from './notifications'

const {
  projectStore,
  logs,
  currentTaskId,
  loadError,
  loading,
  retrying,
  detailVisible,
  currentLog,
  taskContext,
  filters,
  pagination,
  filteredLogs,
  statistics,
  parsedContent,
  formatDateTime,
  getTaskTypeLabel,
  getNotificationTypeLabel,
  getPrimaryExecutionId,
  recipientSummary,
  loadData,
  resetFilters,
  openTaskDetail,
  clearTaskContext,
  openExecution,
  viewDetail,
  retryNotification,
} = useAppAutomationNotifications()
</script>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding: 0 !important;
}

.page-shell :deep(.arco-card),
.page-shell :deep(.notification-card),
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
