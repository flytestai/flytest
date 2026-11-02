<template>
  <div class="ui-automation-shell fc-page">
    <WorkspaceModuleHeader title="Web 自动化" description="从页面元素、步骤设计到执行与回归验证" :tabs="moduleTabs" :active-key="activeTab" />
    <WorkspaceDirectoryLayout ref="workspaceRef" storage-key="ui-automation" :directory="needsDirectory" directory-label="模块目录"
      :selection="needsDirectory ? selectedModuleName : ''" :clearable="needsDirectory" @clear="clearSelection">
      <template #directory>
        <ModulePanel ref="modulePanelRef" :selected-id="selectedModuleId" @select="onModuleSelect" @navigate="workspaceRef?.closeDirectory()" @updated="onModuleUpdated" />
      </template>
      <WorkspacePane v-if="isTabReady('pages')" :active="activeTab === 'pages'">
      <PageList
        ref="pageListRef"
        :selected-module-id="selectedModuleId"
      />
      </WorkspacePane>
      <WorkspacePane v-if="isTabReady('page-steps')" :active="activeTab === 'page-steps'">
      <PageStepList
        ref="pageStepListRef"
        :selected-module-id="selectedModuleId"
      />
      </WorkspacePane>
      <WorkspacePane v-if="isTabReady('testcases')" :active="activeTab === 'testcases'">
      <TestCaseList
        ref="testCaseListRef"
        :selected-module-id="selectedModuleId"
      />
      </WorkspacePane>
      <WorkspacePane v-if="isTabReady('ai-intelligent')" :active="activeTab === 'ai-intelligent'">
      <AiIntelligentModeView
        ref="aiIntelligentModeRef"
      />
      </WorkspacePane>
      <WorkspacePane v-if="isTabReady('execution-records')" :active="activeTab === 'execution-records'">
      <ExecutionRecordList
        ref="executionRecordListRef"
      />
      </WorkspacePane>
      <WorkspacePane v-if="isTabReady('batch-records')" :active="activeTab === 'batch-records'">
      <BatchRecordList
        ref="batchRecordListRef"
      />
      </WorkspacePane>
      <WorkspacePane v-if="isTabReady('public-data')" :active="activeTab === 'public-data'">
      <PublicDataList
        ref="publicDataListRef"
      />
      </WorkspacePane>
      <WorkspacePane v-if="isTabReady('env-config')" :active="activeTab === 'env-config'">
      <EnvConfigList
        ref="envConfigListRef"
      />
      </WorkspacePane>
      <WorkspacePane v-if="isTabReady('actuators')" :active="activeTab === 'actuators'">
      <ActuatorList
        ref="actuatorListRef"
      />
      </WorkspacePane>
    </WorkspaceDirectoryLayout>
  </div>
</template>

<script setup lang="ts">
import WorkspaceModuleHeader from '@/components/workspace/WorkspaceModuleHeader.vue'
import WorkspaceDirectoryLayout from '@/components/workspace/WorkspaceDirectoryLayout.vue'
import WorkspacePane from '@/components/workspace/WorkspacePane.vue'

import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ModulePanel from '../components/ModulePanel.vue'
import type { UiModule } from '../types'

const PageList = defineAsyncComponent(() => import('./PageList.vue'))
const PageStepList = defineAsyncComponent(() => import('./PageStepList.vue'))
const TestCaseList = defineAsyncComponent(() => import('./TestCaseList.vue'))
const AiIntelligentModeView = defineAsyncComponent(() => import('./AiIntelligentModeView.vue'))
const ExecutionRecordList = defineAsyncComponent(() => import('./ExecutionRecordList.vue'))
const BatchRecordList = defineAsyncComponent(() => import('./BatchRecordList.vue'))
const PublicDataList = defineAsyncComponent(() => import('./PublicDataList.vue'))
const EnvConfigList = defineAsyncComponent(() => import('./EnvConfigList.vue'))
const ActuatorList = defineAsyncComponent(() => import('./ActuatorList.vue'))

type UiAutomationTab =
  | 'pages'
  | 'page-steps'
  | 'testcases'
  | 'ai-intelligent'
  | 'execution-records'
  | 'batch-records'
  | 'public-data'
  | 'env-config'
  | 'actuators'

const moduleTabs = [["pages","页面管理"],["page-steps","页面步骤"],["testcases","测试用例"],["ai-intelligent","AI 智能模式"],["execution-records","执行记录"],["batch-records","批量执行"],["public-data","公共数据"],["env-config","环境配置"],["actuators","执行器"]].map(([key,label])=>({key,label,to:{path:'/ui-automation',query:{tab:key}}}))
const route = useRoute()
const router = useRouter()

const modulePanelRef = ref()
const pageListRef = ref()
const pageStepListRef = ref()
const testCaseListRef = ref()
const aiIntelligentModeRef = ref()
const executionRecordListRef = ref()
const batchRecordListRef = ref()
const publicDataListRef = ref()
const envConfigListRef = ref()
const actuatorListRef = ref()

const selectedModuleId = ref<number | undefined>(undefined)
const selectedModuleName = ref('')
const workspaceRef = ref<InstanceType<typeof WorkspaceDirectoryLayout>>()
const needsDirectory = computed(() => ['pages', 'page-steps', 'testcases'].includes(activeTab.value))
const clearSelection = () => { selectedModuleId.value = undefined; selectedModuleName.value = '' }
import { useProjectStore } from '@/store/projectStore'
const projectStore = useProjectStore()
watch(() => projectStore.currentProject?.id, clearSelection)

const normalizeTab = (value: unknown): UiAutomationTab => {
  const tab = String(value || 'pages')

  if (
    tab === 'page-steps' ||
    tab === 'testcases' ||
    tab === 'ai-intelligent' ||
    tab === 'execution-records' ||
    tab === 'batch-records' ||
    tab === 'public-data' ||
    tab === 'env-config' ||
    tab === 'actuators'
  ) {
    return tab
  }

  return 'pages'
}

const activeTab = computed<UiAutomationTab>(() => normalizeTab(route.query.tab))
const visitedTabs = ref<Set<UiAutomationTab>>(new Set([activeTab.value]))

const isTabReady = (tab: UiAutomationTab) => visitedTabs.value.has(tab)

watch(
  () => route.query.tab,
  tab => {
    const normalizedTab = normalizeTab(tab)

    if (tab !== normalizedTab) {
      void router.replace({
        path: '/ui-automation',
        query: {
          ...route.query,
          tab: normalizedTab,
        },
      })
    }
  },
  { immediate: true }
)

watch(
  activeTab,
  newTab => {
    if (visitedTabs.value.has(newTab)) {
      return
    }

    visitedTabs.value = new Set([...visitedTabs.value, newTab])
  },
  { immediate: true }
)

const onModuleSelect = (module: UiModule | null) => {
  selectedModuleId.value = module?.id
  selectedModuleName.value = module?.name || ''
}

const onModuleUpdated = () => {
  pageListRef.value?.refresh?.()
  pageStepListRef.value?.refresh?.()
  testCaseListRef.value?.refresh?.()
}
</script>

<style scoped>
.ui-automation-shell { min-width: 0; min-height: 0; }
</style>
