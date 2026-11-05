<template>
  <div class="page-shell fc-page">
    <div v-if="!projectStore.currentProjectId" class="empty-shell fc-empty-state">
      <a-empty description="请先选择项目后再管理 APP 测试用例" />
    </div>
    <template v-else>
      <TestCasesReferenceWorkspace v-model:selected="selectedCaseIds" :cases="testCases" :packages="packages" :suites="suites" :project-id="projectStore.currentProjectId" :loading="loading" :error="loadError" :suite-error="suiteError"
        @reload="loadData" @create="openCreate" @edit="openEdit" @execute="openExecute" @scene="openSceneBuilder" @duplicate="duplicateCase" @remove="remove" @ai="openAiGeneration" @batch-execute="openBatchExecute" />
      <details class="app-case-recent"><summary>最近执行记录</summary>
      <TestCasesRecentExecutionsCard
        :executions="recentExecutions"
        :loading="loading"
        :format-date-time="formatDateTime"
        :get-result-color="getResultColor"
        :get-execution-result-label="getExecutionResultLabel"
        :format-progress="formatProgress"
        :format-rate="formatRate"
        :can-open-execution-report="canOpenExecutionReport"
        @open-execution-workspace="openExecutionWorkspace"
        @open-execution-report="openExecutionReport"
      />

      </details>

      <TestCaseEditorDialog
        v-model:visible="visible"
        :form="form"
        :packages="packages"
        :submit="submit" :saving="saving"
      />

      <TestCaseExecuteDialog
        v-model:visible="executeVisible"
        :mode="executeMode"
        :execute-form="executeForm"
        :available-devices="availableDevices"
        :packages="packages"
        :execute="executeCase"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import TestCasesReferenceWorkspace from './test-cases/TestCasesReferenceWorkspace.vue'

import {
  TestCaseEditorDialog,
  TestCaseExecuteDialog,
  TestCasesRecentExecutionsCard,
  useAppAutomationTestCases,
} from './test-cases'

const {
  saving, loadError, suiteError, suites, testCases,
  projectStore,
  loading,
  visible,
  executeVisible,
  executeMode,
  packages,
  recentExecutions,
  selectedCaseIds,
  form,
  executeForm,
  availableDevices,
  formatDateTime,
  getResultColor,
  getExecutionResultLabel,
  formatRate,
  formatProgress,
  canOpenExecutionReport,
  loadData,
  openCreate,
  openEdit,
  submit,
  duplicateCase,
  openExecute,
  openSceneBuilder,
  openExecutionWorkspace,
  openExecutionReport,
  openBatchExecute,
  executeCase,
  remove,
} = useAppAutomationTestCases()
const router = useRouter()
const openAiGeneration = () => router.push({path:'/app-automation',query:{tab:'scene-builder',aiPlan:'1'}})
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
  min-height: 420px;
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
.page-shell :deep(.case-card),
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
