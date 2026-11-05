<template>
  <div class="page-shell fc-page">
    <div v-if="!projectStore.currentProjectId" class="empty-shell fc-empty-state">
      <a-empty description="请先选择项目后再查看 APP 自动化执行报告" />
    </div>
    <template v-else>
      <ReportsReferenceWorkspace :project-id="projectStore.currentProjectId" :executions="executions" :suites="suites" :loading="loading" :error="loadError" :focus-id="currentExecution?.id"
        @refresh="loadData" @suites="suiteOverviewVisible=true" @detail="openExecutionDetail" @report="openExecutionReport" @suite="openAssociatedSuite" />
      <a-modal v-model:visible="suiteOverviewVisible" title="套件报告概览" :width="Math.min(1120,width-24)" :footer="false">
        <ReportsSuitePanel :loading="loading" :filters="suiteFilters" :pagination="suitePagination" :statistics="suiteStats" :suites="pagedSuites" :total="filteredSuites.length" :format-date-time="formatDateTime" :get-suite-status="getSuiteStatus" :get-suite-health-rate="getSuiteHealthRate" @search="handleSuiteSearch" @reset="resetSuiteFilters" @open-detail="openSuiteDetail" @open-executions="openSuiteExecutions" @open-report="openSuiteReport" />
      </a-modal>

      <ReportsSuiteDetailDialog
        v-model:visible="suiteDetailVisible"
        :selected-suite="selectedSuite"
        :format-date-time="formatDateTime"
        :get-suite-status="getSuiteStatus"
        :get-suite-health-rate="getSuiteHealthRate"
      />

      <ReportsSuiteExecutionsDialog
        v-model:visible="suiteExecutionsVisible"
        :selected-suite="selectedSuite"
        :suite-executions="suiteExecutions"
        :loading="suiteExecutionsLoading"
        :format-rate="formatRate"
        :get-execution-status="getExecutionStatus"
        :can-open-report="canOpenReport"
        @open-detail="openExecutionDetail"
        @open-report="openExecutionReport"
      />

      <ReportsExecutionDetailDialog
        v-model:visible="executionDetailVisible"
        :current-execution="currentExecution"
        :execution-artifacts="executionArtifacts"
        :execution-log-text="executionLogText"
        :format-date-time="formatDateTime"
        :format-rate="formatRate"
        :format-duration="formatDuration"
        :get-execution-status="getExecutionStatus"
        :get-execution-source="getExecutionSource"
        :can-open-report="canOpenReport"
        @open-report="openExecutionReport"
        @open-artifact="openExecutionArtifact"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import {ref,watch} from 'vue'
import {useWindowSize} from '@vueuse/core'
import ReportsReferenceWorkspace from './reports/ReportsReferenceWorkspace.vue'
const suiteOverviewVisible=ref(false)
const {width}=useWindowSize()

import {
  ReportsExecutionDetailDialog,
  ReportsSuiteDetailDialog,
  ReportsSuiteExecutionsDialog,
  ReportsSuitePanel,
  useAppAutomationReports,
} from './reports'

const {
  projectStore,
  executions,
  suites,
  loadError,
  loading,
  selectedSuite,
  suiteExecutions,
  suiteExecutionsVisible,
  suiteExecutionsLoading,
  suiteDetailVisible,
  executionDetailVisible,
  currentExecution,
  suiteFilters,
  suitePagination,
  formatDateTime,
  formatRate,
  formatDuration,
  getSuiteStatus,
  getExecutionStatus,
  getSuiteHealthRate,
  getExecutionSource,
  canOpenReport,
  filteredSuites,
  pagedSuites,
  suiteStats,
  executionArtifacts,
  executionLogText,
  loadData,
  handleSuiteSearch,
  resetSuiteFilters,
  openSuiteDetail,
  openSuiteExecutions,
  openExecutionDetail,
  openExecutionReport,
  openExecutionArtifact,
  openSuiteReport,
} = useAppAutomationReports()
watch(()=>projectStore.currentProjectId,()=>{suiteOverviewVisible.value=false})
const openAssociatedSuite=(id:number)=>{const suite=suites.value.find(item=>item.id===id);if(suite)void openSuiteDetail(suite)}

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
  color: var(--theme-text-secondary);
  background:
    var(--theme-surface);
  border: 1px solid var(--theme-card-border);
  border-radius: 12px;
  box-shadow: var(--theme-card-shadow);
}

.page-shell :deep(.arco-tabs-content),
.page-shell :deep(.arco-card),
.page-shell :deep(.report-panel-card) {
  border-radius: 12px;
}

.page-shell :deep(.arco-card),
.page-shell :deep(.report-panel-card) {
  box-shadow: var(--theme-card-shadow);
}

.report-tabs :deep(.arco-tabs-nav) {
  margin-bottom: 16px;
}

.report-tabs :deep(.arco-tabs-nav::before) {
  border-bottom-color: rgba(149, 161, 187, 0.14);
}

.report-tabs :deep(.arco-tabs-tab) {
  min-height: 42px;
  padding: 0 16px;
  border-radius: 14px 14px 0 0;
}

.report-tabs :deep(.arco-tabs-tab-active) {
  background: rgba(var(--theme-accent-rgb), 0.08);
}

@media (max-width: 900px) {
  .page-shell {
    gap: 16px;
    padding: 4px;
  }
}
</style>
