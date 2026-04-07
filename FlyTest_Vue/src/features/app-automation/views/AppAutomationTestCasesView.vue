<template>
  <div class="page-shell">
    <div v-if="!projectStore.currentProjectId" class="empty-shell">
      <a-empty description="请先选择项目后再管理 APP 测试用例" />
    </div>
    <template v-else>
      <div class="page-header">
        <div>
          <h3>测试用例</h3>
          <p>维护 APP 自动化场景、最近执行结果与快速执行入口，让日常回归更高效。</p>
        </div>
        <a-space wrap>
          <a-input-search
            v-model="search"
            allow-clear
            placeholder="搜索测试用例"
            @search="loadData"
          />
          <a-select v-model="packageFilter" allow-clear placeholder="全部应用包" style="width: 220px">
            <a-option value="">全部应用包</a-option>
            <a-option v-for="pkg in packages" :key="pkg.id" :value="pkg.id">{{ pkg.name }}</a-option>
          </a-select>
          <a-button @click="resetFilters">重置</a-button>
          <a-button @click="openCreate">快速新建</a-button>
          <a-button type="primary" @click="openSceneBuilderDraft">新增测试用例</a-button>
        </a-space>
      </div>

      <div class="stats-grid">
        <a-card class="stat-card">
          <span class="stat-label">用例总数</span>
          <strong>{{ caseStats.total }}</strong>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">最近通过</span>
          <strong>{{ caseStats.passed }}</strong>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">最近失败</span>
          <strong>{{ caseStats.failed }}</strong>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">未执行</span>
          <strong>{{ caseStats.pending }}</strong>
        </a-card>
      </div>

      <div v-if="selectedCaseIds.length" class="batch-bar">
        <span>已选择 <strong>{{ selectedCaseIds.length }}</strong> 个用例</span>
        <a-space wrap>
          <a-button type="primary" size="small" @click="openBatchExecute">批量执行</a-button>
          <a-button size="small" @click="clearSelection">取消选择</a-button>
        </a-space>
      </div>

      <a-card class="table-card">
        <a-table
          v-model:selectedKeys="selectedCaseIds"
          :data="filteredCases"
          :loading="loading"
          :pagination="false"
          :row-selection="rowSelection"
          row-key="id"
        >
          <template #columns>
            <a-table-column title="用例名称" :width="240">
              <template #cell="{ record }">
                <div class="case-copy">
                  <strong>{{ record.name }}</strong>
                  <span>{{ record.description || '未填写描述' }}</span>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="应用包" :width="180">
              <template #cell="{ record }">{{ record.package_display_name || '-' }}</template>
            </a-table-column>
            <a-table-column title="步骤数" :width="100">
              <template #cell="{ record }">{{ getStepCount(record) }}</template>
            </a-table-column>
            <a-table-column title="最近结果" :width="120">
              <template #cell="{ record }">
                <a-tag :color="getResultColor(record.last_result)">{{ getResultLabel(record.last_result) }}</a-tag>
              </template>
            </a-table-column>
            <a-table-column title="最近运行" :width="180">
              <template #cell="{ record }">{{ formatDateTime(record.last_run_at) }}</template>
            </a-table-column>
            <a-table-column title="更新时间" :width="180">
              <template #cell="{ record }">{{ formatDateTime(record.updated_at) }}</template>
            </a-table-column>
            <a-table-column title="操作" :width="420" fixed="right">
              <template #cell="{ record }">
                <a-space wrap>
                  <a-button type="text" @click="openExecute(record)">执行</a-button>
                  <a-button type="text" @click="openSceneBuilder(record)">编辑</a-button>
                  <a-button type="text" @click="openEdit(record)">快速编辑</a-button>
                  <a-button type="text" @click="duplicateCase(record)">复制</a-button>
                  <a-button type="text" status="danger" @click="remove(record.id)">删除</a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </a-card>

      <a-card class="table-card">
        <template #title>最近执行记录</template>
        <a-table :data="recentExecutions" :loading="loading" :pagination="false" row-key="id">
          <template #columns>
            <a-table-column title="测试用例" :width="220">
              <template #cell="{ record }">{{ record.case_name || `执行 #${record.id}` }}</template>
            </a-table-column>
            <a-table-column title="设备" :width="180">
              <template #cell="{ record }">{{ record.device_name || record.device_serial || '-' }}</template>
            </a-table-column>
            <a-table-column title="状态" :width="120">
              <template #cell="{ record }">
                <a-tag :color="getResultColor(record.result || record.status)">{{ getExecutionResultLabel(record) }}</a-tag>
              </template>
            </a-table-column>
            <a-table-column title="进度 / 通过率" :width="220">
              <template #cell="{ record }">
                <div class="case-copy">
                  <span>进度 {{ formatProgress(record.progress) }}%</span>
                  <small>通过率 {{ formatRate(record.pass_rate) }}%</small>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="开始时间" :width="180">
              <template #cell="{ record }">{{ formatDateTime(record.started_at || record.created_at) }}</template>
            </a-table-column>
            <a-table-column title="操作" :width="220" fixed="right">
              <template #cell="{ record }">
                <a-space wrap>
                  <a-button type="text" @click="openExecutionWorkspace(record.id)">执行页</a-button>
                  <a-button v-if="canOpenExecutionReport(record)" type="text" @click="openExecutionReport(record.id)">报告</a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </a-card>

      <a-modal
        v-model:visible="visible"
        :title="form.id ? '编辑测试用例' : '新增测试用例'"
        width="860px"
        @ok="submit"
      >
        <a-form :model="form" layout="vertical">
          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item field="name" label="用例名称">
                <a-input v-model="form.name" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item field="package_id" label="应用包">
                <a-select v-model="form.package_id" allow-clear>
                  <a-option v-for="pkg in packages" :key="pkg.id" :value="pkg.id">{{ pkg.name }}</a-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item field="timeout" label="超时时间">
                <a-input-number v-model="form.timeout" :min="1" :max="7200" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item field="retry_count" label="失败重试">
                <a-input-number v-model="form.retry_count" :min="0" :max="10" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item field="description" label="描述">
            <a-textarea v-model="form.description" :auto-size="{ minRows: 3, maxRows: 6 }" />
          </a-form-item>
          <a-form-item field="variablesText" label="变量 JSON">
            <a-textarea v-model="form.variablesText" :auto-size="{ minRows: 4, maxRows: 8 }" />
          </a-form-item>
          <a-form-item field="uiFlowText" label="UI Flow JSON">
            <a-textarea v-model="form.uiFlowText" :auto-size="{ minRows: 8, maxRows: 14 }" />
          </a-form-item>
        </a-form>
      </a-modal>

      <a-modal v-model:visible="executeVisible" :title="executeMode === 'batch' ? '批量执行测试用例' : '执行测试用例'" @ok="executeCase">
        <a-form :model="executeForm" layout="vertical">
          <a-form-item field="device_id" label="执行设备">
            <a-select v-model="executeForm.device_id" placeholder="请选择设备">
              <a-option v-for="device in availableDevices" :key="device.id" :value="device.id">
                {{ device.name || device.device_id }}
              </a-option>
            </a-select>
          </a-form-item>
        </a-form>
      </a-modal>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/authStore'
import { useProjectStore } from '@/store/projectStore'
import { AppAutomationService } from '../services/appAutomationService'
import type { AppDevice, AppExecution, AppPackage, AppTestCase } from '../types'

const authStore = useAuthStore()
const projectStore = useProjectStore()
const router = useRouter()

const loading = ref(false)
const visible = ref(false)
const executeVisible = ref(false)
const executeMode = ref<'single' | 'batch'>('single')
const search = ref('')
const packageFilter = ref<number | ''>('')
const testCases = ref<AppTestCase[]>([])
const packages = ref<AppPackage[]>([])
const devices = ref<AppDevice[]>([])
const recentExecutionList = ref<AppExecution[]>([])
const currentExecutionCaseId = ref<number | null>(null)
const selectedCaseIds = ref<number[]>([])

const form = reactive({
  id: 0,
  name: '',
  description: '',
  package_id: undefined as number | undefined,
  timeout: 300,
  retry_count: 0,
  variablesText: '[]',
  uiFlowText: '{\n  "steps": []\n}',
})

const executeForm = reactive({
  device_id: undefined as number | undefined,
})

const rowSelection = {
  type: 'checkbox' as const,
  showCheckedAll: true,
}

const availableDevices = computed(() =>
  devices.value.filter(device => device.status === 'available' || device.status === 'online'),
)

const selectedCases = computed(() =>
  selectedCaseIds.value
    .map(id => filteredCases.value.find(item => item.id === id) || testCases.value.find(item => item.id === id))
    .filter(Boolean) as AppTestCase[],
)

const recentExecutions = computed(() =>
  [...recentExecutionList.value]
    .sort((left, right) => new Date(right.started_at || right.created_at).getTime() - new Date(left.started_at || left.created_at).getTime())
    .slice(0, 5),
)

const filteredCases = computed(() => {
  if (!packageFilter.value) return testCases.value
  return testCases.value.filter(item => item.package_id === packageFilter.value)
})

const caseStats = computed(() => {
  const total = filteredCases.value.length
  const passed = filteredCases.value.filter(item => item.last_result === 'passed').length
  const failed = filteredCases.value.filter(item => item.last_result === 'failed').length
  const pending = filteredCases.value.filter(item => !item.last_result).length
  return { total, passed, failed, pending }
})

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

const getStepCount = (record: AppTestCase) => {
  const steps = record.ui_flow?.steps
  return Array.isArray(steps) ? steps.length : 0
}

const getResultLabel = (result?: string) => {
  if (result === 'passed') return '通过'
  if (result === 'failed') return '失败'
  if (result === 'stopped') return '已停止'
  return '未执行'
}

const getResultColor = (result?: string) => {
  if (result === 'passed') return 'green'
  if (result === 'failed') return 'red'
  if (result === 'stopped') return 'orange'
  if (result === 'running' || result === 'pending') return 'arcoblue'
  return 'gray'
}

const getExecutionResultLabel = (record: AppExecution) => {
  if (record.result === 'passed') return '通过'
  if (record.result === 'failed') return '失败'
  if (record.result === 'stopped') return '已停止'
  if (record.status === 'running') return '执行中'
  if (record.status === 'pending') return '等待中'
  return record.result || record.status || '未知'
}

const formatRate = (value?: number | null) => Math.round(Number(value || 0) * 10) / 10
const formatProgress = (value?: number | null) => Math.max(0, Math.min(100, Math.round(Number(value || 0))))

const canOpenExecutionReport = (record: AppExecution) =>
  Boolean(record.report_path) ||
  ['completed', 'failed', 'stopped'].includes(record.status) ||
  ['passed', 'failed', 'stopped'].includes(record.result)

const resetForm = () => {
  form.id = 0
  form.name = ''
  form.description = ''
  form.package_id = undefined
  form.timeout = 300
  form.retry_count = 0
  form.variablesText = '[]'
  form.uiFlowText = '{\n  "steps": []\n}'
}

const loadData = async () => {
  if (!projectStore.currentProjectId) {
    testCases.value = []
    packages.value = []
    return
  }

  loading.value = true
  try {
    const [caseList, packageList, deviceList, executionList] = await Promise.all([
      AppAutomationService.getTestCases(projectStore.currentProjectId, search.value.trim() || undefined),
      AppAutomationService.getPackages(projectStore.currentProjectId),
      AppAutomationService.getDevices(),
      AppAutomationService.getExecutions(projectStore.currentProjectId),
    ])
    testCases.value = caseList
    packages.value = packageList
    devices.value = deviceList
    recentExecutionList.value = executionList
  } catch (error: any) {
    Message.error(error.message || '加载测试用例失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = async () => {
  search.value = ''
  packageFilter.value = ''
  await loadData()
}

const openCreate = () => {
  resetForm()
  visible.value = true
}

const openSceneBuilderDraft = () => {
  void router.push({
    path: '/app-automation',
    query: {
      tab: 'scene-builder',
    },
  })
}

const openEdit = (record: AppTestCase) => {
  form.id = record.id
  form.name = record.name
  form.description = record.description
  form.package_id = record.package_id || undefined
  form.timeout = record.timeout
  form.retry_count = record.retry_count
  form.variablesText = JSON.stringify(record.variables, null, 2)
  form.uiFlowText = JSON.stringify(record.ui_flow, null, 2)
  visible.value = true
}

const submit = async () => {
  try {
    const payload = {
      project_id: projectStore.currentProjectId || 0,
      name: form.name,
      description: form.description,
      package_id: form.package_id ?? null,
      ui_flow: JSON.parse(form.uiFlowText || '{}'),
      variables: JSON.parse(form.variablesText || '[]'),
      tags: [],
      timeout: form.timeout,
      retry_count: form.retry_count,
    }

    if (form.id) {
      await AppAutomationService.updateTestCase(form.id, payload)
      Message.success('测试用例已更新')
    } else {
      await AppAutomationService.createTestCase(payload)
      Message.success('测试用例已创建')
    }

    visible.value = false
    await loadData()
  } catch (error: any) {
    Message.error(error.message || '保存测试用例失败，请检查 JSON')
  }
}

const duplicateCase = async (record: AppTestCase) => {
  try {
    await AppAutomationService.createTestCase({
      project_id: record.project_id,
      name: `${record.name}-副本`,
      description: record.description,
      package_id: record.package_id ?? null,
      ui_flow: record.ui_flow || { steps: [] },
      variables: record.variables || [],
      tags: record.tags || [],
      timeout: record.timeout,
      retry_count: record.retry_count,
    })
    Message.success('测试用例副本已创建')
    await loadData()
  } catch (error: any) {
    Message.error(error.message || '复制测试用例失败')
  }
}

const openExecute = (record: AppTestCase) => {
  executeMode.value = 'single'
  currentExecutionCaseId.value = record.id
  executeForm.device_id = availableDevices.value[0]?.id
  executeVisible.value = true
}

const openSceneBuilder = (record: AppTestCase) => {
  void router.push({
    path: '/app-automation',
    query: {
      tab: 'scene-builder',
      caseId: String(record.id),
    },
  })
}

const openExecutionWorkspace = async (executionId: number) => {
  await router.push({
    path: '/app-automation',
    query: {
      tab: 'executions',
      executionId: String(executionId),
    },
  })
}

const openExecutionReport = (executionId: number) => {
  window.open(AppAutomationService.getExecutionReportUrl(executionId), '_blank', 'noopener')
}

const openBatchExecute = () => {
  if (!selectedCaseIds.value.length) {
    Message.warning('请至少选择一个测试用例')
    return
  }

  executeMode.value = 'batch'
  executeForm.device_id = availableDevices.value[0]?.id
  executeVisible.value = true
}

const clearSelection = () => {
  selectedCaseIds.value = []
}

const executeCase = async () => {
  if (!executeForm.device_id) {
    Message.warning('请选择执行设备')
    return
  }

  try {
    if (executeMode.value === 'batch') {
      if (!selectedCases.value.length) {
        Message.warning('请至少选择一个测试用例')
        return
      }

      const results = await Promise.allSettled(
        selectedCases.value.map(item =>
          AppAutomationService.executeTestCase(item.id, {
            device_id: executeForm.device_id as number,
            trigger_mode: 'manual',
            triggered_by: authStore.currentUser?.username || 'FlyTest',
          }),
        ),
      )

      const executions = results
        .filter((item): item is PromiseFulfilledResult<AppExecution> => item.status === 'fulfilled')
        .map(item => item.value)

      executeVisible.value = false
      if (!executions.length) {
        Message.error('批量执行提交失败')
        return
      }

      if (executions.length === selectedCases.value.length) {
        Message.success(`已提交 ${executions.length} 个测试用例执行`)
      } else {
        Message.warning(`已提交 ${executions.length}/${selectedCases.value.length} 个测试用例执行`)
      }
      clearSelection()
      await openExecutionWorkspace(executions[0].id)
      return
    }

    if (!currentExecutionCaseId.value) {
      Message.warning('请先选择要执行的测试用例')
      return
    }

    const execution = await AppAutomationService.executeTestCase(currentExecutionCaseId.value, {
      device_id: executeForm.device_id,
      trigger_mode: 'manual',
      triggered_by: authStore.currentUser?.username || 'FlyTest',
    })
    executeVisible.value = false
    Message.success('执行任务已启动，正在跳转到执行记录')
    await openExecutionWorkspace(execution.id)
  } catch (error: any) {
    Message.error(error.message || '启动执行失败')
  }
}

const remove = (id: number) => {
  Modal.confirm({
    title: '删除测试用例',
    content: '确认删除该测试用例吗？',
    onOk: async () => {
      await AppAutomationService.deleteTestCase(id)
      Message.success('测试用例已删除')
      await loadData()
    },
  })
}

watch(
  () => projectStore.currentProjectId,
  () => {
    resetForm()
    packageFilter.value = ''
    selectedCaseIds.value = []
    currentExecutionCaseId.value = null
    recentExecutionList.value = []
    void loadData()
  },
  { immediate: true },
)
</script>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-shell {
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-card-bg);
  border: 1px solid var(--theme-card-border);
  border-radius: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header h3 {
  margin: 0;
  color: var(--theme-text);
}

.page-header p {
  margin: 6px 0 0;
  color: var(--theme-text-secondary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.18);
  background: rgba(var(--theme-accent-rgb), 0.08);
  color: var(--theme-text);
}

.batch-bar strong {
  color: var(--theme-accent);
}

.stat-card,
.table-card {
  border-radius: 16px;
  border: 1px solid var(--theme-card-border);
  background: var(--theme-card-bg);
  box-shadow: var(--theme-card-shadow);
}

.stat-card :deep(.arco-card-body) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  color: var(--theme-text-secondary);
  font-size: 13px;
}

.stat-card strong {
  color: var(--theme-text);
  font-size: 24px;
  line-height: 1.2;
}

.case-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.case-copy strong {
  color: var(--theme-text);
}

.case-copy span {
  color: var(--theme-text-secondary);
  font-size: 13px;
}

@media (max-width: 1080px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
