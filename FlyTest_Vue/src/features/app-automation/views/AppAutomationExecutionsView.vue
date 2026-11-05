<template>
  <div class="page-shell fc-page">
    <div v-if="!projectStore.currentProjectId" class="empty-shell fc-empty-state">
      <a-empty description="请先选择项目后再查看 APP 自动化执行记录" />
    </div>
    <template v-else>
      <ExecutionsReferenceWorkspace :records="executions" :paged="pagedExecutions" :total="filteredExecutions.length" :filters="filters" :pagination="pagination" :devices="devices" :cases="cases" :packages="packages" :suites="suites" :tasks="tasks" :loading="loading" :error="loadError" :related-error="relatedError" :last-updated="lastUpdatedText" :status-meta="getExecutionStatusMeta" :can-report="canOpenReport" :stopping-ids="stoppingIds"
        @reload="loadData" @reset="resetFilters" @detail="openDetail" @logs="openLogs" @report="openReport" @stop="stopExecution" />

      <ExecutionsDetailDialog
        v-model:visible="detailVisible"
        v-model:section="detailSection"
        :detail-loading="detailLoading"
        :current-execution="currentExecution"
        :execution-artifacts="executionArtifacts"
        :stopping-ids="stoppingIds"
        :format-date-time="formatDateTime"
        :format-duration="formatDuration"
        :format-rate="formatRate"
        :format-progress="formatProgress"
        :get-execution-source="getExecutionSource"
        :get-execution-status-meta="getExecutionStatusMeta"
        :get-log-level-color="getLogLevelColor"
        :can-open-report="canOpenReport"
        :is-execution-running="isExecutionRunning"
        @open-report="openReport"
        @stop-execution="stopExecution"
        @open-artifact="openExecutionArtifact"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import {ref} from 'vue'
import ExecutionsReferenceWorkspace from './executions/ExecutionsReferenceWorkspace.vue'
import {
  ExecutionsDetailDialog,
  useAppAutomationExecutions,
} from './executions'

const {
  devices, packages, cases, tasks, executions, loadError, relatedError,
  projectStore,
  loading,
  detailLoading,
  detailVisible,
  lastUpdatedText,
  suites,
  currentExecution,
  stoppingIds,
  filters,
  pagination,
  formatDateTime,
  formatDuration,
  formatRate,
  formatProgress,
  getExecutionStatusMeta,
  getExecutionSource,
  isExecutionRunning,
  canOpenReport,
  getLogLevelColor,
  filteredExecutions,
  pagedExecutions,
  executionArtifacts,
  loadData,
  resetFilters,
  viewDetail,
  openReport,
  openExecutionArtifact,
  stopExecution,
} = useAppAutomationExecutions()
const detailSection=ref<'summary'|'logs'>('summary')
const openDetail=(id:number)=>{detailSection.value='summary';void viewDetail(id)}
const openLogs=(id:number)=>{detailSection.value='logs';void viewDetail(id)}
</script>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding: 0!important;
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
  box-shadow: var(--theme-card-shadow);
  color: var(--theme-text-secondary);
}

.page-shell :deep(.arco-card),
.page-shell :deep(.execution-card),
.page-shell :deep(.stats-card) {
  border-radius: 12px;
  box-shadow: var(--theme-card-shadow);
}

.page-shell :deep(.arco-card-header) {
  min-height: 58px;
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
