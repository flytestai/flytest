<template>
  <div class="page-shell fc-page scene-reference-page">
    <div v-if="!projectStore.currentProjectId" class="empty-shell fc-empty-state">
      <a-empty description="请先选择项目后再进行 APP 场景编排" />
    </div>
    <template v-else>
      <a-alert v-if="loadError" type="error" title="场景数据加载失败">{{ loadError }} <a-button size="small" @click="loadData">重试</a-button></a-alert>
      <section class="scene-reference-metrics" aria-label="场景统计">
        <article v-for="metric in sceneMetrics" :key="metric.label" class="scene-metric" :class="metric.tone">
          <span class="scene-metric-icon"><component :is="metric.icon" /></span>
          <div><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small>{{ metric.hint }}</small></div>
        </article>
        <article class="scene-ai-card"><strong><icon-star /> AI 生成场景</strong><p>基于业务描述辅助编排测试流程</p><a-button class="fc-ai-action" type="primary" size="small" :loading="aiGenerating" @click="openAiPlanDialog">立即生成 <icon-arrow-right /></a-button></article>
      </section>

      <SceneBuilderWorkspaceLayout
        v-model:component-search="componentSearch"
        v-model:palette-tab="paletteTab"
        v-model:steps="steps"
        v-model:step-config-text="stepConfigText"
        :library-panel="libraryPanelProps"
        :canvas-panel="canvasPanelProps"
        :config-panel="configPanelProps"
        @open-import-dialog="openComponentPackageDialog"
        @open-export-dialog="openComponentPackageExportDialog"
        @append-base="appendBaseComponent"
        @append-custom="appendCustomComponent"
        @edit-custom="openEditCustomComponent"
        @delete-custom="deleteCustomComponent"
        @select-step="selectStep"
        @toggle-expand="toggleExpand"
        @duplicate-step="duplicateStep"
        @remove-step="removeStep"
        @clear-steps="clearSteps"
        @select-sub-step="payload => selectSubStep(payload.index, payload.groupKey, payload.subIndex)"
        @update-sub-step-selection="payload => (subStepSelections[payload.key] = payload.value)"
        @add-sub-step="payload => addSubStep(payload.index, payload.groupKey)"
        @duplicate-sub-step="payload => duplicateSubStep(payload.index, payload.groupKey, payload.subIndex)"
        @remove-sub-step="payload => removeSubStep(payload.index, payload.groupKey, payload.subIndex)"
        @update-step-group-items="payload => updateStepGroupItems(payload.step, payload.groupKey, payload.items)"
        @open-ai-step-dialog="openAiStepDialog"
        @reset-selected-step-config="resetSelectedStepConfig"
        @apply-step-config="applyStepConfig"
      >
        <template #directory>
          <div class="scene-directory-heading"><h3>场景目录</h3><a-button aria-label="新建场景" type="text" @click="newScene"><icon-plus /></a-button></div>
          <a-input-search v-model="sceneSearch" allow-clear placeholder="搜索场景名称" />
          <div class="scene-tree">
            <details v-for="group in sceneGroups" :key="group.name" open>
              <summary><icon-folder /> {{ group.name }} <span>{{ group.items.length }}</span></summary>
              <button v-for="item in group.items" :key="item.id" :class="{active: selectedCaseId === item.id}" :aria-pressed="selectedCaseId === item.id" @click="chooseScene(item.id)"><icon-branch /><span>{{ item.name }}</span></button>
            </details>
            <a-empty v-if="!sceneGroups.length" :description="sceneSearch ? '没有匹配的场景' : '暂无已保存场景'" />
          </div>
          <div class="scene-directory-footer"><a-button long @click="newScene"><icon-plus /> 新建场景</a-button><small>场景与测试用例共用流程资产</small></div>
        </template>
        <template #toolbar>
          <header class="scene-editor-header">
            <div class="scene-editor-title"><icon-branch /><div><h3>{{ draftSectionProps.draft.name || '未命名场景' }} <a-tag :color="selectedCaseId && !isDirty ? 'green' : 'orange'" size="small">{{ isDirty ? '未保存' : selectedCaseId ? '已保存' : '新草稿' }}</a-tag></h3><p>{{ draftSectionProps.draft.description || '从右侧添加步骤，组合你的自动化测试流程' }}</p><small v-if="currentScene">最近更新：{{ formatDateTime(currentScene.updated_at) }}</small></div></div>
            <div class="scene-editor-actions">
              <a-button :disabled="!steps.length" :loading="executing" @click="openExecuteDialog"><icon-play-arrow /> 调试</a-button>
              <a-button @click="openExecutionWorkspace()"><icon-history /> 运行记录</a-button>
              <a-button @click="settingsOpen = true"><icon-settings /> 场景设置</a-button>
              <a-dropdown><a-button>更多 <icon-down /></a-button><template #content><a-doption @click="loadData">刷新目录</a-doption><a-doption @click="openCreateCustomComponent">保存为自定义组件</a-doption><a-doption @click="openTestCaseWorkspace">测试用例管理</a-doption><a-doption @click="openComponentPackageDialog">导入组件包</a-doption><a-doption @click="openComponentPackageExportDialog">导出组件包</a-doption></template></a-dropdown>
              <a-button type="primary" :loading="saving" :disabled="!steps.length" @click="saveScene"><icon-save /> 保存</a-button>
            </div>
          </header>
        </template>
      </SceneBuilderWorkspaceLayout>
      <a-drawer v-model:visible="settingsOpen" title="场景设置与变量" :width="settingsWidth" :footer="true" class="scene-settings-drawer">
<SceneBuilderTopSection
        :header="headerSectionProps"
        :ai-status-card="aiStatusSectionProps"
        :draft-form="draftSectionProps"
        :selected-case-id="selectedCaseId"
        @open-ai-plan="openAiPlanDialog"
        @reload-data="loadData"
        @open-testcase-workspace="openTestCaseWorkspace"
        @open-execution-workspace="openExecutionWorkspace()"
        @create-draft="createDraft"
        @open-create-custom-component="openCreateCustomComponent"
        @save-draft="saveDraft"
        @open-execute-dialog="openExecuteDialog"
        @refresh-ai-status="refreshAiRuntimeStatus(true)"
        @open-llm-config="openLlmConfigManagement"
        @update:selected-case-id="selectedCaseId = $event"
        @case-change="handleCaseChange"
        @add-variable="addVariable"
        @remove-variable="removeVariable"
      />
        <template #footer><a-space><a-button @click="settingsOpen = false">返回画布</a-button><a-button type="primary" :loading="saving" :disabled="!steps.length" @click="saveScene">保存场景</a-button></a-space></template>
      </a-drawer>

      <SceneBuilderDialogsHost
        v-model:component-package-visible="componentPackageVisible"
        v-model:component-package-overwrite="componentPackageOverwrite"
        v-model:component-package-export-visible="componentPackageExportVisible"
        v-model:component-package-include-disabled="componentPackageIncludeDisabled"
        v-model:ai-plan-visible="aiPlanVisible"
        v-model:ai-plan-prompt="aiPlanForm.prompt"
        v-model:ai-plan-apply-mode="aiPlanForm.applyMode"
        v-model:ai-step-visible="aiStepVisible"
        v-model:ai-step-prompt="aiStepForm.prompt"
        v-model:execute-visible="executeVisible"
        v-model:custom-component-visible="customComponentVisible"
        :component-package-loading="componentPackageLoading"
        :component-package-uploading="componentPackageUploading"
        :component-package-file-list="componentPackageFileList"
        :component-package-records="componentPackageRecords"
        :component-package-exporting="componentPackageExporting"
        :component-package-export-form="componentPackageExportForm"
        :ai-dialog-engine-name="aiDialogEngineName"
        :ai-dialog-mode-text="aiDialogModeText"
        :ai-checked-at-display="formatDateTime(aiStatus.checked_at)"
        :ai-generating="aiGenerating"
        :ai-step-suggesting="aiStepSuggesting"
        :execution-case-name="executionCaseName"
        :available-devices="availableDevices"
        :execute-form="executeForm"
        :saving="saving"
        :executing="executing"
        :custom-component-mode="customComponentMode"
        :custom-component-form="customComponentForm"
        :custom-component-saving="customComponentSaving"
        @file-change="handleComponentPackageFileChange"
        @delete-record="deleteComponentPackageRecord"
        @submit-component-package-import="submitComponentPackageImport"
        @submit-export-json="downloadComponentPackage('json')"
        @submit-export-yaml="downloadComponentPackage('yaml')"
        @submit-ai-plan="generateAiPlan"
        @submit-ai-step="generateAiStepSuggestion"
        @reload-devices="reloadDevices"
        @submit-execute="executeCurrentDraft"
        @submit-custom-component="saveCustomComponent"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWindowSize } from '@vueuse/core'
import { Modal } from '@arco-design/web-vue'
import { IconStar, IconArrowRight, IconPlus, IconFolder, IconBranch, IconPlayArrow, IconHistory, IconSettings, IconDown, IconSave, IconLayers, IconCheckCircle, IconEdit, IconClockCircle } from '@arco-design/web-vue/es/icon'
import './scene-builder/scene-reference.css'

import {
  SceneBuilderDialogsHost,
  SceneBuilderTopSection,
  SceneBuilderWorkspaceLayout,
  useAppAutomationSceneBuilder,
} from './scene-builder'

const {
  loadError,
  projectStore,
  aiGenerating,
  saving,
  executing,
  steps,
  headerSectionProps,
  aiStatusSectionProps,
  draftSectionProps,
  openAiPlanDialog,
  loadData,
  openTestCaseWorkspace,
  openExecutionWorkspace,
  createDraft,
  openCreateCustomComponent,
  saveDraft,
  openExecuteDialog,
  formatDateTime,
  refreshAiRuntimeStatus,
  openLlmConfigManagement,
  selectedCaseId,
  handleCaseChange,
  addVariable,
  removeVariable,
  componentSearch,
  paletteTab,
  libraryPanelProps,
  canvasPanelProps,
  configPanelProps,
  subStepSelections,
  stepConfigText,
  openComponentPackageDialog,
  openComponentPackageExportDialog,
  appendBaseComponent,
  appendCustomComponent,
  openEditCustomComponent,
  deleteCustomComponent,
  selectStep,
  toggleExpand,
  duplicateStep,
  removeStep,
  clearSteps,
  selectSubStep,
  addSubStep,
  duplicateSubStep,
  removeSubStep,
  updateStepGroupItems,
  openAiStepDialog,
  resetSelectedStepConfig,
  applyStepConfig,
  componentPackageVisible,
  componentPackageOverwrite,
  componentPackageLoading,
  componentPackageUploading,
  componentPackageFileList,
  componentPackageRecords,
  handleComponentPackageFileChange,
  deleteComponentPackageRecord,
  submitComponentPackageImport,
  componentPackageExportVisible,
  componentPackageIncludeDisabled,
  componentPackageExporting,
  componentPackageExportForm,
  downloadComponentPackage,
  aiStatus,
  aiPlanVisible,
  aiPlanForm,
  aiDialogEngineName,
  aiDialogModeText,
  generateAiPlan,
  aiStepVisible,
  aiStepForm,
  aiStepSuggesting,
  generateAiStepSuggestion,
  executeVisible,
  executionCaseName,
  availableDevices,
  executeForm,
  reloadDevices,
  executeCurrentDraft,
  customComponentVisible,
  customComponentMode,
  customComponentForm,
  customComponentSaving,
  saveCustomComponent,
} = useAppAutomationSceneBuilder()
const route = useRoute(), router = useRouter()
watch(() => [route.query.aiPlan, headerSectionProps.value.loading], () => {
  if (route.query.aiPlan === '1' && route.query.tab === 'scene-builder' && !headerSectionProps.value.loading) { openAiPlanDialog(); const query = {...route.query}; delete query.aiPlan; void router.replace({query}) }
}, {immediate: true})
const settingsOpen = ref(false)
const sceneSearch = ref('')
const { width } = useWindowSize()
const settingsWidth = computed(() => Math.min(820, width.value))
const scenes = computed(() => draftSectionProps.value.testCases.filter(item => Array.isArray(item.ui_flow?.steps) && item.ui_flow.steps.length > 0))
const currentScene = computed(() => scenes.value.find(item => item.id === selectedCaseId.value))
const sceneGroups = computed(() => {
  const groups = new Map<string, typeof scenes.value>()
  for (const item of scenes.value.filter(item => item.name.toLowerCase().includes(sceneSearch.value.toLowerCase()))) {
    const name = draftSectionProps.value.packages.find(pkg => pkg.id === item.package_id)?.name || '未关联应用'
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name)!.push(item)
  }
  return Array.from(groups, ([name, items]) => ({ name, items }))
})
const sceneMetrics = computed(() => {
  const run = scenes.value.filter(item => item.last_run_at && ['passed', 'failed', 'success', 'failure'].includes(item.last_result))
  const passed = run.filter(item => ['passed', 'success'].includes(item.last_result)).length
  return [
    { label: '场景总数', value: scenes.value.length, icon: IconLayers, tone: 'teal', hint: '当前项目已保存流程' },
    { label: '有执行记录', value: scenes.value.filter(item => item.last_run_at).length, icon: IconPlayArrow, tone: 'teal', hint: '已完成至少一次执行' },
    { label: '当前步骤', value: steps.value.length, icon: IconEdit, tone: 'blue', hint: '拖动节点调整顺序' },
    { label: '场景变量', value: draftSectionProps.value.variableItems.length, icon: IconClockCircle, tone: 'purple', hint: '在场景设置中维护' },
    { label: '最近执行通过率', value: run.length ? `${(passed / run.length * 100).toFixed(1)}%` : '—', icon: IconCheckCircle, tone: run.length ? (passed === run.length ? 'green' : 'red') : 'neutral', hint: '各场景最近一次明确结果' },
  ]
})
// Directory switches protect unsaved steps, metadata and variables.
const baseline = ref('')
const fingerprint = () => JSON.stringify({ draft: draftSectionProps.value.draft, steps: steps.value.map(({ _expanded, ...step }) => step), variables: draftSectionProps.value.variableItems })
const isDirty = computed(() => Boolean(baseline.value && fingerprint() !== baseline.value))
const rememberDraft = () => { baseline.value = fingerprint() }
const switchScene = (action: () => void) => {
  if (baseline.value && fingerprint() !== baseline.value) Modal.warning({ title: '切换场景', content: '当前场景有未保存的修改，切换后将丢弃这些修改。', hideCancel: false, okText: '丢弃并切换', onOk: () => { action(); rememberDraft() } })
  else { action(); rememberDraft() }
}
const chooseScene = (id: number) => { if (id !== selectedCaseId.value) switchScene(() => handleCaseChange(id)) }
const newScene = () => switchScene(() => { createDraft(); settingsOpen.value = true })
watch([() => headerSectionProps.value.loading, selectedCaseId], async () => { await nextTick(); rememberDraft() }, { immediate: true })
const saveScene = async () => { if (!draftSectionProps.value.draft.name.trim()) { settingsOpen.value = true; return } if (await saveDraft()) { rememberDraft(); settingsOpen.value = false } }

</script>

<style scoped>
.page-shell { display:flex; flex-direction:column; gap:22px; min-width:0; padding:0!important }
.empty-shell { min-height:420px; display:grid; place-items:center }
</style>
