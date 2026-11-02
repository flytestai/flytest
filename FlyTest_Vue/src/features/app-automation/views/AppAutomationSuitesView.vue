<template>
  <div class="page-shell fc-page">
    <div v-if="!projectStore.currentProjectId" class="empty-shell fc-empty-state">
      <a-empty description="请先选择项目后再管理 APP 测试套件" />
    </div>
    <template v-else>
      <SuitesHeaderBar
        v-model:search="filters.search"
        v-model:status="filters.status"
        @search="loadData"
        @reset="resetFilters"
        @refresh="loadData"
        @create="openCreate"
      />

      <SuitesStatsGrid :statistics="suiteStats" />

      <SuitesTableCard
        :loading="loading"
        :suites="filteredSuites"
        :format-date-time="formatDateTime"
        :get-suite-status-meta="getSuiteStatusMeta"
        :get-suite-health-rate="getSuiteHealthRate"
        @open-run="openRun"
        @open-detail="openDetail"
        @open-history="openHistory"
        @duplicate-suite="duplicateSuite"
        @open-edit="openEdit"
        @remove="remove"
      />

      <SuiteEditorDialog
        v-model:visible="visible"
        :form="form"
        :test-cases="testCases"
        :selected-cases="selectedCases"
        @save="saveSuite"
        @move-case="moveCase"
      />

      <SuiteRunDialog
        v-model:visible="runVisible"
        :run-form="runForm"
        :available-devices="availableDevices"
        :packages="packages"
        @run="runSuite"
      />

      <SuiteDetailDialog
        v-model:visible="detailVisible"
        :selected-suite="selectedSuite"
        :format-date-time="formatDateTime"
        :get-suite-status-meta="getSuiteStatusMeta"
        :get-suite-health-rate="getSuiteHealthRate"
      />

      <SuiteHistoryDialog
        v-model:visible="historyVisible"
        :selected-suite="selectedSuite"
        :history="history"
        :loading="historyLoading"
        :format-date-time="formatDateTime"
        :format-rate="formatRate"
        :format-duration="formatDuration"
        :get-execution-status-meta="getExecutionStatusMeta"
        :can-open-report="canOpenReport"
        @open-execution-detail="openExecutionDetail"
        @open-workspace="openExecutionWorkspace"
        @open-report="openExecutionReport"
      />

      <SuiteExecutionDetailDialog
        v-model:visible="executionDetailVisible"
        :current-execution="currentExecution"
        :selected-suite-id="selectedSuite?.id || null"
        :execution-artifacts="executionArtifacts"
        :format-date-time="formatDateTime"
        :format-rate="formatRate"
        :format-duration="formatDuration"
        :get-execution-status-meta="getExecutionStatusMeta"
        :can-open-report="canOpenReport"
        :get-log-level-color="getLogLevelColor"
        @open-report="openExecutionReport"
        @open-workspace="openExecutionWorkspace"
        @open-artifact="openExecutionArtifact"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  SuiteDetailDialog,
  SuiteEditorDialog,
  SuiteExecutionDetailDialog,
  SuiteHistoryDialog,
  SuiteRunDialog,
  SuitesHeaderBar,
  SuitesStatsGrid,
  SuitesTableCard,
  useAppAutomationSuites,
} from './suites'

const {
  projectStore,
  loading,
  visible,
  runVisible,
  detailVisible,
  historyVisible,
  historyLoading,
  executionDetailVisible,
  suites,
  testCases,
  packages,
  history,
  selectedSuite,
  currentExecution,
  filters,
  form,
  runForm,
  availableDevices,
  selectedCases,
  getSuiteStatusMeta,
  getSuiteHealthRate,
  getExecutionStatusMeta,
  canOpenReport,
  formatDateTime,
  formatRate,
  formatDuration,
  getLogLevelColor,
  filteredSuites,
  suiteStats,
  executionArtifacts,
  loadData,
  resetFilters,
  openCreate,
  openEdit,
  saveSuite,
  moveCase,
  openRun,
  runSuite,
  openDetail,
  openHistory,
  openExecutionDetail,
  openExecutionReport,
  openExecutionWorkspace,
  openExecutionArtifact,
  duplicateSuite,
  remove,
} = useAppAutomationSuites()
</script>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding: 8px 6px 10px;
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
}

.page-shell :deep(.arco-card),
.page-shell :deep(.suite-card),
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
