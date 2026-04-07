<template>
  <div class="page-shell">
    <div v-if="!projectStore.currentProjectId" class="empty-shell">
      <a-empty description="请先选择项目后再管理 APP 测试套件" />
    </div>
    <template v-else>
      <div class="page-header">
        <div>
          <h3>测试套件</h3>
          <p>组合多个 APP 用例形成可批量执行的回归套件，支持查看状态、历史、报告和套件详情。</p>
        </div>
        <a-space wrap>
          <a-input-search
            v-model="filters.search"
            allow-clear
            placeholder="搜索测试套件"
            @search="loadData"
          />
          <a-select v-model="filters.status" allow-clear placeholder="全部状态" style="width: 180px">
            <a-option value="">全部状态</a-option>
            <a-option value="not_run">未执行</a-option>
            <a-option value="running">执行中</a-option>
            <a-option value="passed">执行通过</a-option>
            <a-option value="failed">执行失败</a-option>
            <a-option value="stopped">已停止</a-option>
          </a-select>
          <a-button @click="resetFilters">重置</a-button>
          <a-button @click="loadData">刷新</a-button>
          <a-button type="primary" @click="openCreate">新建套件</a-button>
        </a-space>
      </div>

      <div class="stats-grid">
        <a-card class="stat-card">
          <span class="stat-label">套件总数</span>
          <strong>{{ suiteStats.total }}</strong>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">执行中</span>
          <strong>{{ suiteStats.running }}</strong>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">执行通过</span>
          <strong>{{ suiteStats.passed }}</strong>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">已停止</span>
          <strong>{{ suiteStats.stopped }}</strong>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">平均健康度</span>
          <strong>{{ suiteStats.health }}%</strong>
        </a-card>
      </div>

      <a-card class="table-card">
        <a-table :data="filteredSuites" :loading="loading" :pagination="false" row-key="id">
          <template #columns>
            <a-table-column title="套件 / 描述" :width="260">
              <template #cell="{ record }">
                <div class="stack">
                  <strong>{{ record.name }}</strong>
                  <span>{{ record.description || '暂无套件描述' }}</span>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="状态 / 健康度" :width="200">
              <template #cell="{ record }">
                <div class="stack">
                  <a-tag :color="getSuiteStatusMeta(record).color">{{ getSuiteStatusMeta(record).label }}</a-tag>
                  <small>健康度 {{ getSuiteHealthRate(record) }}%</small>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="用例 / 结果" :width="240">
              <template #cell="{ record }">
                <div class="stack">
                  <span>用例数 {{ record.test_case_count || 0 }}</span>
                  <small>通过 {{ record.passed_count || 0 }} / 失败 {{ record.failed_count || 0 }} / 停止 {{ record.stopped_count || 0 }}</small>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="最近执行" :width="180">
              <template #cell="{ record }">{{ formatDateTime(record.last_run_at) }}</template>
            </a-table-column>
            <a-table-column title="操作" :width="380" fixed="right">
              <template #cell="{ record }">
                <a-space wrap>
                  <a-button type="text" @click="openRun(record)">执行</a-button>
                  <a-button type="text" @click="openDetail(record)">详情</a-button>
                  <a-button type="text" @click="openHistory(record)">历史</a-button>
                  <a-button type="text" @click="duplicateSuite(record)">复制</a-button>
                  <a-button type="text" @click="openEdit(record)">编辑</a-button>
                  <a-button type="text" status="danger" @click="remove(record.id)">删除</a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </a-card>

      <a-modal
        v-model:visible="visible"
        :title="form.id ? '编辑测试套件' : '新建测试套件'"
        width="860px"
        @ok="saveSuite"
      >
        <a-form :model="form" layout="vertical">
          <a-form-item field="name" label="套件名称">
            <a-input v-model="form.name" />
          </a-form-item>
          <a-form-item field="description" label="描述">
            <a-textarea v-model="form.description" :auto-size="{ minRows: 3, maxRows: 5 }" />
          </a-form-item>
          <a-form-item field="test_case_ids" label="选择用例">
            <a-select v-model="form.test_case_ids" multiple allow-clear placeholder="选择要加入套件的测试用例">
              <a-option v-for="item in testCases" :key="item.id" :value="item.id">
                {{ item.name }}
              </a-option>
            </a-select>
          </a-form-item>
          <div v-if="selectedCases.length" class="selected-preview">
            <div class="preview-title">当前顺序</div>
            <div class="preview-list">
              <div v-for="(item, index) in selectedCases" :key="item.id" class="preview-item">
                <div class="stack">
                  <strong>{{ index + 1 }}. {{ item.name }}</strong>
                  <small>{{ item.description || '暂无用例描述' }}</small>
                </div>
                <a-space>
                  <a-button size="mini" type="text" :disabled="index === 0" @click="moveCase(index, -1)">上移</a-button>
                  <a-button size="mini" type="text" :disabled="index === selectedCases.length - 1" @click="moveCase(index, 1)">下移</a-button>
                </a-space>
              </div>
            </div>
          </div>
        </a-form>
      </a-modal>

      <a-modal v-model:visible="runVisible" title="执行测试套件" @ok="runSuite">
        <a-form :model="runForm" layout="vertical">
          <a-form-item field="device_id" label="执行设备">
            <a-select v-model="runForm.device_id" placeholder="请选择可用设备">
              <a-option v-for="item in availableDevices" :key="item.id" :value="item.id">
                {{ item.name || item.device_id }}
              </a-option>
            </a-select>
          </a-form-item>
        </a-form>
      </a-modal>

      <a-modal v-model:visible="detailVisible" title="套件详情" width="920px" :footer="false">
        <div v-if="selectedSuite" class="detail-shell">
          <div class="detail-grid">
            <div class="detail-card">
              <span class="detail-label">最近状态</span>
              <strong>{{ getSuiteStatusMeta(selectedSuite).label }}</strong>
            </div>
            <div class="detail-card">
              <span class="detail-label">套件用例数</span>
              <strong>{{ selectedSuite.test_case_count || 0 }}</strong>
            </div>
            <div class="detail-card">
              <span class="detail-label">平均健康度</span>
              <strong>{{ getSuiteHealthRate(selectedSuite) }}%</strong>
            </div>
            <div class="detail-card">
              <span class="detail-label">最近执行</span>
              <strong>{{ formatDateTime(selectedSuite.last_run_at) }}</strong>
            </div>
          </div>

          <a-card class="detail-panel" title="套件说明">
            <div class="summary-text">{{ selectedSuite.description || '暂无套件说明。' }}</div>
            <div class="meta-row">
              <span>创建人：{{ selectedSuite.created_by || '-' }}</span>
              <span>创建时间：{{ formatDateTime(selectedSuite.created_at) }}</span>
              <span>更新时间：{{ formatDateTime(selectedSuite.updated_at) }}</span>
            </div>
          </a-card>

          <a-card class="detail-panel" title="执行统计">
            <div class="metric-row">
              <div class="metric-chip success-chip">通过 {{ selectedSuite.passed_count || 0 }}</div>
              <div class="metric-chip danger-chip">失败 {{ selectedSuite.failed_count || 0 }}</div>
              <div class="metric-chip warning-chip">停止 {{ selectedSuite.stopped_count || 0 }}</div>
            </div>
          </a-card>

          <a-card class="detail-panel" title="套件用例清单">
            <div v-if="selectedSuite.suite_cases?.length" class="case-list">
              <div v-for="item in selectedSuite.suite_cases" :key="item.id" class="case-item">
                <strong>#{{ item.order }} {{ item.test_case.name }}</strong>
                <span>{{ item.test_case.description || '暂无用例描述' }}</span>
                <small>应用包：{{ item.test_case.package_name || '-' }}</small>
              </div>
            </div>
            <div v-else class="empty-note">该套件暂未配置用例</div>
          </a-card>
        </div>
      </a-modal>

      <a-modal
        v-model:visible="historyVisible"
        :title="selectedSuite ? `${selectedSuite.name} 执行历史` : '套件执行历史'"
        width="980px"
        :footer="false"
      >
        <a-table :data="history" :loading="historyLoading" :pagination="false" row-key="id">
          <template #columns>
            <a-table-column title="用例 / 设备" :width="240">
              <template #cell="{ record }">
                <div class="stack">
                  <strong>{{ record.case_name || `执行 #${record.id}` }}</strong>
                  <span>{{ record.device_name || record.device_serial || '-' }}</span>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="状态 / 通过率" :width="180">
              <template #cell="{ record }">
                <div class="stack">
                  <a-tag :color="getExecutionStatusMeta(record).color">{{ getExecutionStatusMeta(record).label }}</a-tag>
                  <small>通过率 {{ formatRate(record.pass_rate) }}%</small>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="时间 / 耗时" :width="220">
              <template #cell="{ record }">
                <div class="stack">
                  <span>{{ formatDateTime(record.started_at || record.created_at) }}</span>
                  <small>耗时 {{ formatDuration(record.duration) }}</small>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="220" fixed="right">
              <template #cell="{ record }">
                <a-space wrap>
                  <a-button type="text" @click="openExecutionDetail(record.id)">详情</a-button>
                  <a-button type="text" @click="openExecutionWorkspace(record.id, selectedSuite?.id || null)">执行页</a-button>
                  <a-button v-if="canOpenReport(record)" type="text" @click="openExecutionReport(record)">报告</a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </a-modal>

      <a-modal v-model:visible="executionDetailVisible" title="执行详情" width="920px" :footer="false">
        <div v-if="currentExecution" class="detail-shell">
          <div class="detail-grid">
            <div class="detail-card">
              <span class="detail-label">执行状态</span>
              <strong>{{ getExecutionStatusMeta(currentExecution).label }}</strong>
            </div>
            <div class="detail-card">
              <span class="detail-label">通过率</span>
              <strong>{{ formatRate(currentExecution.pass_rate) }}%</strong>
            </div>
            <div class="detail-card">
              <span class="detail-label">步骤统计</span>
              <strong>{{ currentExecution.passed_steps || 0 }}/{{ currentExecution.total_steps || 0 }}</strong>
            </div>
            <div class="detail-card">
              <span class="detail-label">执行耗时</span>
              <strong>{{ formatDuration(currentExecution.duration) }}</strong>
            </div>
          </div>

          <a-card class="detail-panel" title="执行摘要">
            <div class="summary-text">
              {{ currentExecution.report_summary || currentExecution.error_message || '暂无执行摘要。' }}
            </div>
            <div class="meta-row">
              <span>用例：{{ currentExecution.case_name || `执行 #${currentExecution.id}` }}</span>
              <span>设备：{{ currentExecution.device_name || currentExecution.device_serial || '-' }}</span>
              <span>触发人：{{ currentExecution.triggered_by || '-' }}</span>
              <span>触发方式：{{ currentExecution.trigger_mode || '-' }}</span>
              <span>开始时间：{{ formatDateTime(currentExecution.started_at || currentExecution.created_at) }}</span>
              <span>结束时间：{{ formatDateTime(currentExecution.finished_at) }}</span>
            </div>
            <a-space wrap>
              <a-button v-if="canOpenReport(currentExecution)" type="primary" @click="openExecutionReport(currentExecution)">
                打开执行报告
              </a-button>
              <a-button @click="openExecutionWorkspace(currentExecution.id, currentExecution.test_suite_id || selectedSuite?.id || null)">
                在执行记录页打开
              </a-button>
            </a-space>
          </a-card>

          <a-card class="detail-panel" title="执行证据">
            <div v-if="executionArtifacts.length" class="artifact-list">
              <div v-for="item in executionArtifacts" :key="item.key" class="artifact-item">
                <div class="artifact-meta">
                  <a-tag :color="item.level === 'error' ? 'red' : item.level === 'warning' ? 'orange' : 'arcoblue'">
                    {{ item.level }}
                  </a-tag>
                  <span>{{ item.message }}</span>
                </div>
                <a-button type="text" @click="openExecutionArtifact(currentExecution, item.relativePath)">查看文件</a-button>
              </div>
            </div>
            <div v-else class="empty-note compact">当前执行暂无可查看的证据文件</div>
          </a-card>

          <a-card class="detail-panel" title="执行日志">
            <div v-if="currentExecution.logs?.length" class="log-list">
              <div v-for="(log, index) in currentExecution.logs" :key="`${log.timestamp}-${index}`" class="log-item">
                <div class="log-meta">
                  <span>{{ formatDateTime(log.timestamp) }}</span>
                  <a-tag size="small" :color="getLogLevelColor(log.level)">{{ log.level || 'info' }}</a-tag>
                </div>
                <div class="log-message">{{ log.message || '-' }}</div>
              </div>
            </div>
            <div v-else class="empty-note">暂无执行日志</div>
          </a-card>
        </div>
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
import type { AppDevice, AppExecution, AppTestCase, AppTestSuite } from '../types'

const authStore = useAuthStore()
const projectStore = useProjectStore()
const router = useRouter()

const loading = ref(false)
const visible = ref(false)
const runVisible = ref(false)
const detailVisible = ref(false)
const historyVisible = ref(false)
const historyLoading = ref(false)
const executionDetailVisible = ref(false)

const suites = ref<AppTestSuite[]>([])
const testCases = ref<AppTestCase[]>([])
const devices = ref<AppDevice[]>([])
const history = ref<AppExecution[]>([])
const selectedSuite = ref<AppTestSuite | null>(null)
const currentExecution = ref<AppExecution | null>(null)
const currentSuiteId = ref<number | null>(null)

const filters = reactive({
  search: '',
  status: '',
})

const form = reactive({
  id: 0,
  name: '',
  description: '',
  test_case_ids: [] as number[],
})

const runForm = reactive({
  device_id: undefined as number | undefined,
})

const availableDevices = computed(() =>
  devices.value.filter(item => item.status === 'available' || item.status === 'online'),
)

const selectedCases = computed(() =>
  form.test_case_ids
    .map(id => testCases.value.find(item => item.id === id))
    .filter(Boolean) as AppTestCase[],
)

const getSuiteState = (record: AppTestSuite) => {
  if (record.execution_status === 'running') return 'running'
  if (!record.last_run_at) return 'not_run'
  if (record.execution_result === 'passed') return 'passed'
  if (record.execution_result === 'failed') return 'failed'
  if (record.execution_result === 'stopped') return 'stopped'
  return 'not_run'
}

const getSuiteStatusMeta = (record: AppTestSuite) => {
  const state = getSuiteState(record)
  if (state === 'running') return { label: '执行中', color: 'arcoblue' }
  if (state === 'passed') return { label: '执行通过', color: 'green' }
  if (state === 'failed') return { label: '执行失败', color: 'red' }
  if (state === 'stopped') return { label: '已停止', color: 'orange' }
  return { label: '未执行', color: 'gray' }
}

const getSuiteHealthRate = (record: AppTestSuite) => {
  const passed = Number(record.passed_count || 0)
  const failed = Number(record.failed_count || 0)
  const stopped = Number(record.stopped_count || 0)
  const total = passed + failed + stopped
  return total ? Math.round((passed / total) * 1000) / 10 : 0
}

const getExecutionState = (record: AppExecution) => {
  if (record.result === 'passed') return 'passed'
  if (record.result === 'failed' || record.status === 'failed') return 'failed'
  if (record.result === 'stopped' || record.status === 'stopped') return 'stopped'
  if (record.status === 'running') return 'running'
  if (record.status === 'pending') return 'pending'
  return 'unknown'
}

const getExecutionStatusMeta = (record: AppExecution) => {
  const state = getExecutionState(record)
  if (state === 'running') return { label: '执行中', color: 'arcoblue' }
  if (state === 'pending') return { label: '等待执行', color: 'gold' }
  if (state === 'passed') return { label: '执行通过', color: 'green' }
  if (state === 'failed') return { label: '执行失败', color: 'red' }
  if (state === 'stopped') return { label: '已停止', color: 'orange' }
  return { label: record.result || record.status || '未知', color: 'gray' }
}

const canOpenReport = (record: AppExecution) =>
  Boolean(record.report_path) ||
  ['completed', 'failed', 'stopped'].includes(record.status) ||
  ['passed', 'failed', 'stopped'].includes(record.result)

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'

const formatRate = (value?: number | null) => Math.round(Number(value || 0) * 10) / 10

const formatDuration = (value?: number | null) => {
  const seconds = Number(value || 0)
  if (!seconds) return '-'
  if (seconds < 60) return `${Math.round(seconds)} 秒`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = Math.round(seconds % 60)
  if (minutes < 60) return `${minutes} 分 ${remainSeconds} 秒`
  const hours = Math.floor(minutes / 60)
  return `${hours} 小时 ${minutes % 60} 分`
}

const resolveArtifactRelativePath = (artifact?: string | null) => {
  const value = String(artifact || '').trim()
  if (!value) return ''
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
    return value
  }

  const normalized = value.replace(/\\/g, '/')
  const marker = '/artifacts/'
  const index = normalized.lastIndexOf(marker)
  if (index >= 0) {
    return normalized.slice(index + 1)
  }
  if (normalized.startsWith('artifacts/')) {
    return normalized
  }
  return normalized
}

const getLogLevelColor = (value?: string) => {
  if (value === 'error') return 'red'
  if (value === 'warning') return 'orange'
  if (value === 'success') return 'green'
  return 'arcoblue'
}

const filteredSuites = computed(() =>
  suites.value.filter(item => {
    if (filters.status && getSuiteState(item) !== filters.status) return false
    return true
  }),
)

const suiteStats = computed(() => ({
  total: filteredSuites.value.length,
  running: filteredSuites.value.filter(item => getSuiteState(item) === 'running').length,
  passed: filteredSuites.value.filter(item => getSuiteState(item) === 'passed').length,
  stopped: filteredSuites.value.filter(item => getSuiteState(item) === 'stopped').length,
  health: filteredSuites.value.length
    ? Math.round(
        (filteredSuites.value.reduce((sum, item) => sum + getSuiteHealthRate(item), 0) / filteredSuites.value.length) * 10,
      ) / 10
    : 0,
}))

const executionArtifacts = computed(() => {
  if (!currentExecution.value?.logs?.length) return []

  const seen = new Set<string>()
  return currentExecution.value.logs
    .map((item, index) => {
      const relativePath = resolveArtifactRelativePath(item.artifact)
      if (!relativePath || seen.has(relativePath)) return null

      seen.add(relativePath)
      return {
        key: `${relativePath}-${index}`,
        relativePath,
        message: item.message || '执行证据',
        level: item.level || 'info',
      }
    })
    .filter(Boolean) as Array<{ key: string; relativePath: string; message: string; level: string }>
})

const resetForm = () => {
  form.id = 0
  form.name = ''
  form.description = ''
  form.test_case_ids = []
}

const loadData = async () => {
  if (!projectStore.currentProjectId) {
    suites.value = []
    return
  }

  loading.value = true
  try {
    const [suiteList, caseList, deviceList] = await Promise.all([
      AppAutomationService.getTestSuites(projectStore.currentProjectId, filters.search.trim() || undefined),
      AppAutomationService.getTestCases(projectStore.currentProjectId),
      AppAutomationService.getDevices(),
    ])
    suites.value = suiteList
    testCases.value = caseList
    devices.value = deviceList
  } catch (error: any) {
    Message.error(error.message || '加载测试套件失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = async () => {
  filters.search = ''
  filters.status = ''
  await loadData()
}

const openCreate = () => {
  resetForm()
  visible.value = true
}

const openEdit = (record: AppTestSuite) => {
  form.id = record.id
  form.name = record.name
  form.description = record.description
  form.test_case_ids = record.suite_cases.map(item => item.test_case_id)
  visible.value = true
}

const saveSuite = async () => {
  if (!projectStore.currentProjectId) return
  if (!form.name.trim()) {
    Message.warning('请输入套件名称')
    return
  }

  const payload = {
    project_id: projectStore.currentProjectId,
    name: form.name.trim(),
    description: form.description.trim(),
    test_case_ids: form.test_case_ids,
  }

  try {
    if (form.id) {
      await AppAutomationService.updateTestSuite(form.id, payload)
      Message.success('测试套件已更新')
    } else {
      await AppAutomationService.createTestSuite(payload)
      Message.success('测试套件已创建')
    }
    visible.value = false
    resetForm()
    await loadData()
  } catch (error: any) {
    Message.error(error.message || '保存测试套件失败')
  }
}

const moveCase = (index: number, delta: -1 | 1) => {
  const targetIndex = index + delta
  if (targetIndex < 0 || targetIndex >= form.test_case_ids.length) return
  const next = [...form.test_case_ids]
  const [current] = next.splice(index, 1)
  next.splice(targetIndex, 0, current)
  form.test_case_ids = next
}

const openRun = (record: AppTestSuite) => {
  currentSuiteId.value = record.id
  runForm.device_id = availableDevices.value[0]?.id
  runVisible.value = true
}

const openExecutionWorkspace = async (executionId?: number, suiteId?: number | null) => {
  await router.push({
    path: '/app-automation',
    query: {
      tab: 'executions',
      executionId: executionId ? String(executionId) : undefined,
      suiteId: suiteId ? String(suiteId) : undefined,
    },
  })
}

const runSuite = async () => {
  if (!currentSuiteId.value || !runForm.device_id) {
    Message.warning('请选择执行设备')
    return
  }

  try {
    const result = await AppAutomationService.runTestSuite(currentSuiteId.value, {
      device_id: runForm.device_id,
      triggered_by: authStore.currentUser?.username || 'FlyTest',
    })
    runVisible.value = false
    Message.success(`测试套件已提交执行，共创建 ${result.test_case_count} 条执行记录`)
    await openExecutionWorkspace(result.execution_ids?.[0], result.suite_id || currentSuiteId.value)
  } catch (error: any) {
    Message.error(error.message || '执行测试套件失败')
  }
}

const openDetail = async (record: AppTestSuite) => {
  try {
    selectedSuite.value = await AppAutomationService.getTestSuite(record.id)
    detailVisible.value = true
  } catch (error: any) {
    Message.error(error.message || '加载套件详情失败')
  }
}

const openHistory = async (record: AppTestSuite) => {
  selectedSuite.value = record
  historyVisible.value = true
  historyLoading.value = true
  try {
    history.value = await AppAutomationService.getTestSuiteExecutions(record.id)
  } catch (error: any) {
    Message.error(error.message || '加载执行历史失败')
    history.value = []
  } finally {
    historyLoading.value = false
  }
}

const openExecutionDetail = async (executionId: number) => {
  try {
    currentExecution.value = await AppAutomationService.getExecutionDetail(executionId)
    executionDetailVisible.value = true
  } catch (error: any) {
    Message.error(error.message || '加载执行详情失败')
  }
}

const openExecutionReport = (record: AppExecution) => {
  window.open(AppAutomationService.getExecutionReportUrl(record.id), '_blank', 'noopener')
}

const openExecutionArtifact = (record: AppExecution, relativePath: string) => {
  if (!relativePath) return

  if (relativePath.startsWith('http://') || relativePath.startsWith('https://') || relativePath.startsWith('data:')) {
    window.open(relativePath, '_blank', 'noopener')
    return
  }

  window.open(AppAutomationService.getExecutionReportAssetUrl(record.id, relativePath), '_blank', 'noopener')
}

const duplicateSuite = async (record: AppTestSuite) => {
  try {
    await AppAutomationService.createTestSuite({
      project_id: record.project_id,
      name: `${record.name}-副本`,
      description: record.description,
      test_case_ids: record.suite_cases.map(item => item.test_case_id),
    })
    Message.success('测试套件副本已创建')
    await loadData()
  } catch (error: any) {
    Message.error(error.message || '复制测试套件失败')
  }
}

const remove = (id: number) => {
  Modal.confirm({
    title: '删除测试套件',
    content: '确认删除该测试套件吗？',
    onOk: async () => {
      await AppAutomationService.deleteTestSuite(id)
      Message.success('测试套件已删除')
      await loadData()
    },
  })
}

watch(
  () => projectStore.currentProjectId,
  () => {
    resetForm()
    filters.status = ''
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
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

.stat-label,
.detail-label {
  color: var(--theme-text-secondary);
  font-size: 13px;
}

.stat-card strong,
.detail-card strong,
.detail-panel strong {
  color: var(--theme-text);
  font-size: 24px;
  line-height: 1.2;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stack strong {
  color: var(--theme-text);
}

.stack span,
.stack small {
  color: var(--theme-text-secondary);
}

.selected-preview {
  margin-top: 8px;
  border-radius: 14px;
  border: 1px dashed var(--theme-card-border);
  padding: 14px;
}

.preview-title {
  margin-bottom: 10px;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(var(--theme-accent-rgb), 0.06);
}

.detail-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.detail-card,
.detail-panel {
  border-radius: 16px;
  border: 1px solid var(--theme-card-border);
  background: var(--theme-card-bg);
  box-shadow: var(--theme-card-shadow);
}

.detail-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.summary-text {
  color: var(--theme-text);
  line-height: 1.7;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-top: 12px;
  color: var(--theme-text-secondary);
  font-size: 13px;
}

.metric-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.metric-chip {
  padding: 10px 14px;
  border-radius: 999px;
  font-weight: 700;
}

.success-chip {
  background: rgba(0, 180, 42, 0.12);
  color: #00b42a;
}

.danger-chip {
  background: rgba(245, 63, 63, 0.12);
  color: #f53f3f;
}

.warning-chip {
  background: rgba(255, 125, 0, 0.12);
  color: #ff7d00;
}

.case-list,
.artifact-list,
.log-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.case-item,
.artifact-item,
.log-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
}

.case-item strong,
.artifact-meta,
.log-message {
  color: var(--theme-text);
}

.case-item span,
.case-item small,
.log-meta {
  color: var(--theme-text-secondary);
}

.artifact-item {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.14);
  background: rgba(var(--theme-accent-rgb), 0.05);
}

.artifact-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.log-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.empty-note {
  color: var(--theme-text-secondary);
}

.empty-note.compact {
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(var(--theme-accent-rgb), 0.14);
  border-radius: 14px;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .stats-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .preview-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .artifact-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
