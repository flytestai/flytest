<template>
  <div class="dashboard-view">
    <div v-if="!currentProjectId" class="empty-shell">
      <a-empty description="请先选择项目后查看 APP 自动化概览" />
    </div>
    <template v-else>
      <div class="page-header">
        <div>
          <h3>APP 自动化总控台</h3>
          <p>集中查看当前项目的 AI 编排状态、定时任务、执行健康度和最近回归动作。</p>
        </div>
        <a-space wrap class="page-actions">
          <a-tag :color="serviceStatusTagColor">{{ serviceStatusTagText }}</a-tag>
          <span class="header-tip">最近刷新：{{ lastUpdatedText }}</span>
          <a-button :loading="aiStatusLoading" @click="refreshAiStatus(true)">刷新 AI 状态</a-button>
          <a-button type="primary" :loading="loading" @click="loadDashboard">刷新总览</a-button>
        </a-space>
      </div>

      <div class="stats-grid">
        <a-card class="stat-card">
          <div class="stat-label">设备在线</div>
          <div class="stat-value">{{ statistics.devices.online }}</div>
          <div class="stat-meta">总设备 {{ statistics.devices.total }} / 锁定 {{ statistics.devices.locked }}</div>
        </a-card>
        <a-card class="stat-card">
          <div class="stat-label">应用包</div>
          <div class="stat-value">{{ statistics.packages.total }}</div>
          <div class="stat-meta">当前项目已登记应用</div>
        </a-card>
        <a-card class="stat-card">
          <div class="stat-label">元素资产</div>
          <div class="stat-value">{{ statistics.elements.total }}</div>
          <div class="stat-meta">用于定位与页面编排</div>
        </a-card>
        <a-card class="stat-card">
          <div class="stat-label">测试用例</div>
          <div class="stat-value">{{ statistics.test_cases.total }}</div>
          <div class="stat-meta">通过率 {{ statistics.executions.pass_rate }}%</div>
        </a-card>
        <a-card class="stat-card">
          <div class="stat-label">激活任务</div>
          <div class="stat-value">{{ activeTaskCount }}</div>
          <div class="stat-meta">暂停 {{ pausedTaskCount }} / 失败 {{ failedTaskCount }}</div>
        </a-card>
        <a-card class="stat-card">
          <div class="stat-label">AI 智能模式</div>
          <div class="stat-value">{{ aiStatus.ready ? 'ON' : aiStatus.hasConfig ? 'Fallback' : 'OFF' }}</div>
          <div class="stat-meta">{{ aiCapabilityDisplay }}</div>
        </a-card>
      </div>

      <div class="content-grid">
        <a-card class="panel-card" title="执行态势">
          <div class="summary-grid">
            <div class="summary-item">
              <span>总执行</span>
              <strong>{{ statistics.executions.total }}</strong>
            </div>
            <div class="summary-item">
              <span>运行中</span>
              <strong>{{ statistics.executions.running }}</strong>
            </div>
            <div class="summary-item">
              <span>通过</span>
              <strong class="success">{{ statistics.executions.passed }}</strong>
            </div>
            <div class="summary-item">
              <span>失败</span>
              <strong class="danger">{{ statistics.executions.failed }}</strong>
            </div>
          </div>
        </a-card>

        <a-card class="panel-card" title="AI 智能模式">
          <div class="ai-panel">
            <div class="ai-panel-head">
              <div class="ai-copy">
                <strong>{{ aiStatusTitle }}</strong>
                <p>{{ aiStatusDescription }}</p>
              </div>
              <a-tag :color="aiStatusTagColor">{{ aiStatusTagText }}</a-tag>
            </div>

            <div class="ai-grid">
              <div class="ai-item">
                <span>激活配置</span>
                <strong>{{ aiConfigDisplay }}</strong>
              </div>
              <div class="ai-item">
                <span>提供方</span>
                <strong>{{ aiProviderDisplay }}</strong>
              </div>
              <div class="ai-item">
                <span>模型</span>
                <strong>{{ aiModelDisplay }}</strong>
              </div>
              <div class="ai-item">
                <span>能力模式</span>
                <strong>{{ aiCapabilityDisplay }}</strong>
              </div>
            </div>

            <div class="ai-endpoint">{{ aiEndpointDisplay }}</div>

            <div class="ai-actions">
              <a-button type="primary" @click="openTab('scene-builder')">进入 AI 编排</a-button>
              <a-button @click="openLlmConfigManagement">模型配置</a-button>
            </div>
          </div>
        </a-card>
      </div>

      <a-card class="panel-card task-card" title="定时任务快照">
        <template #extra>
          <a-button type="text" @click="openTab('scheduled-tasks')">查看全部</a-button>
        </template>

        <div v-if="taskSnapshot.length" class="task-list">
          <div v-for="task in taskSnapshot" :key="task.id" class="task-item">
            <div class="task-head">
              <div class="task-copy">
                <strong>{{ task.name }}</strong>
                <span>{{ getTaskTypeLabel(task.task_type) }} · {{ getTriggerSummary(task) }}</span>
                <small>{{ getTaskTarget(task) }}</small>
                <small>下次执行：{{ formatDateTime(task.next_run_time) }}</small>
              </div>
              <a-tag :color="getTaskStatusColor(task.status)">{{ task.status }}</a-tag>
            </div>
            <div class="task-actions">
              <a-button type="text" size="small" @click="openScheduledTask(task)">详情</a-button>
              <a-button type="text" size="small" :loading="isTaskActionLoading('run', task.id)" @click="runTaskNow(task)">
                立即执行
              </a-button>
              <a-button
                v-if="task.status === 'PAUSED'"
                type="text"
                size="small"
                :loading="isTaskActionLoading('resume', task.id)"
                @click="resumeTask(task)"
              >
                恢复
              </a-button>
              <a-button v-if="getPrimaryExecutionId(task)" type="text" size="small" @click="openLatestExecution(task)">
                最新执行
              </a-button>
            </div>
          </div>
        </div>
        <a-empty v-else description="当前项目还没有定时任务" />
      </a-card>

      <a-card class="panel-card recent-card" title="最近执行">
        <template #extra>
          <a-button type="text" @click="openTab('executions')">查看全部</a-button>
        </template>

        <a-table :data="recentExecutions" :pagination="false" size="small" :bordered="false">
          <template #columns>
            <a-table-column title="用例" data-index="case_name" />
            <a-table-column title="设备" data-index="device_name" />
            <a-table-column title="状态">
              <template #cell="{ record }">
                <a-tag :color="getExecutionStatusColor(record)">{{ getExecutionStatusLabel(record) }}</a-tag>
              </template>
            </a-table-column>
            <a-table-column title="进度">
              <template #cell="{ record }">{{ formatProgress(record.progress) }}%</template>
            </a-table-column>
            <a-table-column title="时间">
              <template #cell="{ record }">{{ formatDateTime(record.started_at || record.created_at) }}</template>
            </a-table-column>
            <a-table-column title="操作" :width="160">
              <template #cell="{ record }">
                <a-space wrap>
                  <a-button type="text" @click="openExecution(record.id)">执行页</a-button>
                  <a-button v-if="canOpenReport(record)" type="text" @click="openReport(record.id)">报告</a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </a-card>

      <a-card class="panel-card quick-card" title="快速操作">
        <div class="quick-grid">
          <button class="quick-item" type="button" @click="openTab('devices')">
            <strong>设备管理</strong>
            <span>连接设备并查看在线状态</span>
          </button>
          <button class="quick-item" type="button" @click="openTab('elements')">
            <strong>元素管理</strong>
            <span>维护图片、OCR 与定位资产</span>
          </button>
          <button class="quick-item" type="button" @click="openTab('test-cases')">
            <strong>测试用例</strong>
            <span>快速进入用例列表与批量执行</span>
          </button>
          <button class="quick-item" type="button" @click="openTab('scene-builder')">
            <strong>场景编排</strong>
            <span>通过 AI 和组件库搭建测试步骤</span>
          </button>
          <button class="quick-item" type="button" @click="openTab('suites')">
            <strong>测试套件</strong>
            <span>组合回归套件并触发批量执行</span>
          </button>
          <button class="quick-item" type="button" @click="openTab('executions')">
            <strong>执行记录</strong>
            <span>跟踪运行进度、日志和证据</span>
          </button>
        </div>
      </a-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useRouter } from 'vue-router'
import { getActiveLlmConfig, getLlmConfigDetails } from '@/features/langgraph/services/llmConfigService'
import { useAuthStore } from '@/store/authStore'
import { useProjectStore } from '@/store/projectStore'
import { AppAutomationService } from '../services/appAutomationService'
import type {
  AppAutomationTab,
  AppDashboardStatistics,
  AppExecution,
  AppLlmConfigSnapshot,
  AppScheduledTask,
  AppServiceHealth,
} from '../types'

interface AiRuntimeStatus {
  hasConfig: boolean
  ready: boolean
  configName: string
  provider: string
  model: string
  apiUrl: string
  supportsVision: boolean
  checkedAt: string
  error: string
}

const createEmptyStatistics = (): AppDashboardStatistics => ({
  devices: { total: 0, online: 0, locked: 0 },
  packages: { total: 0 },
  elements: { total: 0 },
  test_cases: { total: 0 },
  executions: { total: 0, running: 0, passed: 0, failed: 0, pass_rate: 0 },
  recent_executions: [],
})

const createAiStatusState = (): AiRuntimeStatus => ({
  hasConfig: false,
  ready: false,
  configName: '',
  provider: '',
  model: '',
  apiUrl: '',
  supportsVision: false,
  checkedAt: '',
  error: '',
})

const createServiceHealthState = (): AppServiceHealth => ({
  service: '',
  status: '',
  version: '',
  checked_at: '',
  scheduler: {
    running: false,
    running_tasks: 0,
    poll_interval_seconds: 0,
  },
})

const statusConfig = {
  pending: { label: '等待执行', color: 'gold' },
  running: { label: '执行中', color: 'arcoblue' },
  passed: { label: '执行通过', color: 'green' },
  failed: { label: '执行失败', color: 'red' },
  stopped: { label: '已停止', color: 'orange' },
  completed: { label: '已完成', color: 'cyan' },
  unknown: { label: '未知', color: 'gray' },
} as const

const projectStore = useProjectStore()
const authStore = useAuthStore()
const router = useRouter()
const currentProjectId = computed(() => projectStore.currentProjectId)

const statistics = reactive<AppDashboardStatistics>(createEmptyStatistics())
const scheduledTasks = ref<AppScheduledTask[]>([])
const loading = ref(false)
const aiStatusLoading = ref(false)
const lastUpdatedAt = ref<string | null>(null)
const aiStatus = reactive<AiRuntimeStatus>(createAiStatusState())
const serviceHealth = reactive<AppServiceHealth>(createServiceHealthState())
const taskActionLoading = reactive<Record<string, boolean>>({})

const resetAiStatus = () => {
  Object.assign(aiStatus, createAiStatusState())
}

const resetDashboardState = () => {
  Object.assign(statistics, createEmptyStatistics())
  scheduledTasks.value = []
  lastUpdatedAt.value = null
  Object.assign(serviceHealth, createServiceHealthState())
}

const normalizeErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error) {
    const normalized = error as { message?: string; error?: string }
    if (normalized.message || normalized.error) {
      return normalized.message || normalized.error || fallback
    }
  }
  return fallback
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString('zh-CN', { hour12: false })
}

const formatProgress = (value?: number | null) => {
  const progress = Number(value || 0)
  return Math.max(0, Math.min(100, Math.round(progress)))
}

const formatInterval = (seconds?: number | null) => {
  const totalSeconds = Number(seconds || 0)
  if (!totalSeconds) return '-'
  if (totalSeconds < 3600) return `${Math.round(totalSeconds / 60)} 分钟`

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.round((totalSeconds % 3600) / 60)
  return minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`
}

const formatProviderLabel = (provider?: string) => {
  const value = String(provider || '').trim().toLowerCase()
  const mapping: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google Gemini',
    google: 'Google Gemini',
    deepseek: 'DeepSeek',
    siliconflow: '硅基流动',
    azure_openai: 'Azure OpenAI',
  }

  if (!value) return '未识别供应方'
  return mapping[value] || value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

const formatEndpointDisplay = (url?: string) => {
  if (!url) return '未配置接口地址'

  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname}`
  } catch {
    return url
  }
}

const getExecutionState = (record: AppExecution) => {
  if (record.result === 'passed') return 'passed'
  if (record.result === 'failed' || record.status === 'failed') return 'failed'
  if (record.result === 'stopped' || record.status === 'stopped') return 'stopped'
  if (record.status === 'running') return 'running'
  if (record.status === 'pending') return 'pending'
  if (record.status === 'completed') return 'completed'
  return 'unknown'
}

const getExecutionStatusColor = (record: AppExecution) => statusConfig[getExecutionState(record)].color
const getExecutionStatusLabel = (record: AppExecution) => statusConfig[getExecutionState(record)].label

const canOpenReport = (record: AppExecution) =>
  Boolean(record.report_path) ||
  ['completed', 'failed', 'stopped'].includes(record.status) ||
  ['passed', 'failed', 'stopped'].includes(record.result)

const recentExecutions = computed(() =>
  [...(statistics.recent_executions || [])]
    .sort((left, right) => {
      const leftTime = new Date(left.started_at || left.created_at).getTime()
      const rightTime = new Date(right.started_at || right.created_at).getTime()
      return rightTime - leftTime
    })
    .slice(0, 8),
)

const activeTaskCount = computed(() => scheduledTasks.value.filter(task => task.status === 'ACTIVE').length)
const pausedTaskCount = computed(() => scheduledTasks.value.filter(task => task.status === 'PAUSED').length)
const failedTaskCount = computed(() => scheduledTasks.value.filter(task => task.status === 'FAILED').length)

const taskSnapshot = computed(() =>
  [...scheduledTasks.value]
    .sort((left, right) => {
      const leftTime = left.next_run_time ? new Date(left.next_run_time).getTime() : Number.MAX_SAFE_INTEGER
      const rightTime = right.next_run_time ? new Date(right.next_run_time).getTime() : Number.MAX_SAFE_INTEGER
      if (leftTime !== rightTime) {
        return leftTime - rightTime
      }
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
    })
    .slice(0, 5),
)

const lastUpdatedText = computed(() => (lastUpdatedAt.value ? formatDateTime(lastUpdatedAt.value) : '-'))
const serviceStatusTagColor = computed(() => {
  if (serviceHealth.status !== 'ok') return 'red'
  return serviceHealth.scheduler.running ? 'green' : 'orange'
})
const serviceStatusTagText = computed(() => {
  if (serviceHealth.status !== 'ok') return '服务异常'
  if (serviceHealth.scheduler.running) {
    return `调度器运行中 · ${serviceHealth.scheduler.running_tasks} 个在途任务`
  }
  return '调度器未运行'
})

const aiConfigDisplay = computed(() => aiStatus.configName || '未激活 LLM 配置')
const aiProviderDisplay = computed(() => formatProviderLabel(aiStatus.provider))
const aiModelDisplay = computed(() => aiStatus.model || '未配置模型名称')
const aiEndpointDisplay = computed(() => formatEndpointDisplay(aiStatus.apiUrl))
const aiCapabilityDisplay = computed(() => {
  if (!aiStatus.hasConfig) return '规则规划兜底'
  return aiStatus.supportsVision ? '视觉 + 文本智能' : '文本智能'
})
const aiStatusTitle = computed(() => {
  if (aiStatus.ready) {
    return `${aiConfigDisplay.value} 已接入 APP 智能编排`
  }
  if (aiStatus.hasConfig) {
    return '已检测到模型配置，但当前会优先回退到规则规划'
  }
  return '当前未启用 LLM，系统会自动使用规则规划'
})
const aiStatusDescription = computed(() => {
  if (aiStatus.ready) {
    return 'AI 场景生成、步骤补全和智能调度会优先走激活模型，失败时自动回退到规则规划，保证流程不中断。'
  }
  if (aiStatus.error) {
    return aiStatus.error
  }
  if (aiStatus.hasConfig) {
    return '已存在激活配置，但模型名称或接口地址不完整，当前生成链路仍可继续使用规则规划。'
  }
  return '建议先配置并激活一个 LLM 模型，这样 APP 自动化编排、智能补全和回归执行会更稳定高效。'
})
const aiStatusTagColor = computed(() => {
  if (aiStatus.ready) return 'green'
  if (aiStatus.hasConfig) return 'orange'
  return 'gray'
})
const aiStatusTagText = computed(() => {
  if (aiStatus.ready) return 'LLM 已启用'
  if (aiStatus.hasConfig) return '规则回退'
  return '未配置'
})

const getTaskActionKey = (action: string, taskId: number) => `${action}:${taskId}`
const isTaskActionLoading = (action: string, taskId: number) => Boolean(taskActionLoading[getTaskActionKey(action, taskId)])
const setTaskActionLoading = (action: string, taskId: number, state: boolean) => {
  taskActionLoading[getTaskActionKey(action, taskId)] = state
}

const getTaskTypeLabel = (value: string) => (value === 'TEST_SUITE' ? '测试套件' : '测试用例')
const getTaskTarget = (task: AppScheduledTask) => task.test_suite_name || task.test_case_name || '未绑定目标'
const getTaskStatusColor = (value: string) =>
  value === 'ACTIVE' ? 'green' : value === 'PAUSED' ? 'orange' : value === 'FAILED' ? 'red' : value === 'COMPLETED' ? 'arcoblue' : 'gray'

const getTriggerSummary = (task: AppScheduledTask) => {
  if (task.trigger_type === 'CRON') return task.cron_expression || '-'
  if (task.trigger_type === 'INTERVAL') return `每 ${formatInterval(task.interval_seconds)} 执行一次`
  return formatDateTime(task.execute_at)
}

const getExecutionIds = (task: AppScheduledTask) => {
  const ids = task.last_result.execution_ids || []
  return ids.filter((item): item is number => Number.isFinite(Number(item)))
}

const getPrimaryExecutionId = (task: AppScheduledTask) =>
  task.last_result.execution_id || getExecutionIds(task)[0] || undefined

const refreshAiStatus = async (showMessage = false): Promise<AppLlmConfigSnapshot | null> => {
  aiStatusLoading.value = true
  try {
    const activeResponse = await getActiveLlmConfig()
    const activeConfig = activeResponse.data

    if (!activeConfig?.id) {
      resetAiStatus()
      aiStatus.checkedAt = new Date().toISOString()
      if (showMessage) {
        Message.info('当前没有激活的 LLM 配置，APP AI 会回退到规则规划')
      }
      return null
    }

    const detailResponse = await getLlmConfigDetails(activeConfig.id)
    const detail = detailResponse.data || activeConfig
    const snapshot: AppLlmConfigSnapshot | null =
      detail?.name && detail?.api_url
        ? {
            config_name: detail.config_name,
            provider: detail.provider,
            name: detail.name,
            api_url: detail.api_url,
            api_key: detail.api_key,
            system_prompt: detail.system_prompt,
            supports_vision: detail.supports_vision,
          }
        : null

    Object.assign(aiStatus, {
      hasConfig: true,
      ready: Boolean(snapshot),
      configName: detail?.config_name || '',
      provider: detail?.provider || '',
      model: detail?.name || '',
      apiUrl: detail?.api_url || '',
      supportsVision: Boolean(detail?.supports_vision),
      checkedAt: new Date().toISOString(),
      error: snapshot ? '' : '激活的 LLM 配置缺少模型名称或接口地址，当前会回退到规则规划。',
    })

    if (!snapshot && showMessage) {
      Message.warning(aiStatus.error || 'AI 状态已刷新')
    }

    if (snapshot && showMessage) {
      Message.success('AI 模型状态已刷新')
    }

    return snapshot
  } catch (error: unknown) {
    resetAiStatus()
    aiStatus.checkedAt = new Date().toISOString()
    aiStatus.error = normalizeErrorMessage(error, '加载激活 LLM 配置失败，当前会回退到规则规划。')
    if (showMessage) {
      Message.error(aiStatus.error)
    }
    return null
  } finally {
    aiStatusLoading.value = false
  }
}

const loadDashboardState = async (options: { includeAi?: boolean; silent?: boolean } = {}) => {
  if (!currentProjectId.value) {
    resetDashboardState()
    return
  }

  const { includeAi = true, silent = false } = options

  if (!silent) {
    loading.value = true
  }

  try {
    const [dashboardData, taskList, healthData] = await Promise.all([
      AppAutomationService.getDashboardStatistics(currentProjectId.value),
      AppAutomationService.getScheduledTasks(currentProjectId.value),
      AppAutomationService.getHealthStatus().catch(() => null),
    ])

    Object.assign(statistics, createEmptyStatistics(), dashboardData, {
      recent_executions: dashboardData.recent_executions || [],
    })
    scheduledTasks.value = taskList
    if (healthData) {
      Object.assign(serviceHealth, createServiceHealthState(), healthData)
    }

    if (includeAi) {
      await refreshAiStatus()
    }

    lastUpdatedAt.value = new Date().toISOString()
  } catch (error: unknown) {
    Message.error(normalizeErrorMessage(error, '加载 APP 自动化总览失败'))
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

const loadDashboard = async () => {
  await loadDashboardState({ includeAi: true })
}

const openTab = async (tab: AppAutomationTab) => {
  await router.push({
    path: '/app-automation',
    query: { tab },
  })
}

const openExecution = async (executionId: number) => {
  await router.push({
    path: '/app-automation',
    query: {
      tab: 'executions',
      executionId: String(executionId),
    },
  })
}

const openLatestExecution = async (task: AppScheduledTask) => {
  const executionId = getPrimaryExecutionId(task)
  if (!executionId) {
    Message.warning('当前任务还没有可查看的执行记录')
    return
  }
  await openExecution(executionId)
}

const openScheduledTask = async (task: AppScheduledTask) => {
  await router.push({
    path: '/app-automation',
    query: {
      tab: 'scheduled-tasks',
      taskId: String(task.id),
    },
  })
}

const openReport = (executionId: number) => {
  window.open(AppAutomationService.getExecutionReportUrl(executionId), '_blank', 'noopener')
}

const openLlmConfigManagement = async () => {
  await router.push({ name: 'LlmConfigManagement' })
}

const runTaskNow = async (task: AppScheduledTask) => {
  setTaskActionLoading('run', task.id, true)
  try {
    const result = await AppAutomationService.runScheduledTaskNow(task.id, authStore.currentUser?.username || 'FlyTest')
    const createdCount = result.trigger_payload?.execution_ids?.length || (result.trigger_payload?.execution_id ? 1 : 0)
    Message.success(createdCount > 1 ? `任务已触发，已创建 ${createdCount} 条执行记录` : '定时任务已触发执行')
    await loadDashboardState({ includeAi: false })
  } catch (error: unknown) {
    Message.error(normalizeErrorMessage(error, '执行定时任务失败'))
  } finally {
    setTaskActionLoading('run', task.id, false)
  }
}

const resumeTask = async (task: AppScheduledTask) => {
  setTaskActionLoading('resume', task.id, true)
  try {
    await AppAutomationService.resumeScheduledTask(task.id)
    Message.success('任务已恢复')
    await loadDashboardState({ includeAi: false })
  } catch (error: unknown) {
    Message.error(normalizeErrorMessage(error, '恢复任务失败'))
  } finally {
    setTaskActionLoading('resume', task.id, false)
  }
}

let timer: number | null = null
let polling = false

watch(
  () => projectStore.currentProjectId,
  projectId => {
    Object.keys(taskActionLoading).forEach(key => {
      delete taskActionLoading[key]
    })

    if (!projectId) {
      resetDashboardState()
      resetAiStatus()
      return
    }

    void loadDashboardState({ includeAi: true })
  },
  { immediate: true },
)

onMounted(() => {
  timer = window.setInterval(() => {
    if (polling || !currentProjectId.value) {
      return
    }

    polling = true
    void loadDashboardState({ includeAi: false, silent: true }).finally(() => {
      polling = false
    })
  }, 15000)
})

onUnmounted(() => {
  if (timer) {
    window.clearInterval(timer)
  }
})
</script>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
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
  align-items: flex-start;
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
  line-height: 1.7;
}

.page-actions {
  justify-content: flex-end;
}

.header-tip {
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.stat-card,
.panel-card {
  background: var(--theme-card-bg);
  border: 1px solid var(--theme-card-border);
  box-shadow: var(--theme-card-shadow);
  border-radius: 16px;
}

.stat-label {
  color: var(--theme-text-secondary);
  font-size: 13px;
}

.stat-value {
  margin-top: 10px;
  font-size: 30px;
  font-weight: 700;
  color: var(--theme-text);
}

.stat-meta {
  margin-top: 8px;
  color: var(--theme-text-tertiary);
  font-size: 12px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1.1fr 1.4fr;
  gap: 16px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.summary-item {
  padding: 16px;
  border-radius: 14px;
  background: rgba(var(--theme-accent-rgb), 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-item span {
  color: var(--theme-text-secondary);
}

.summary-item strong {
  font-size: 28px;
  color: var(--theme-text);
}

.summary-item .success {
  color: var(--theme-success);
}

.summary-item .danger {
  color: var(--theme-danger);
}

.ai-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-panel-head,
.task-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ai-copy,
.task-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-copy strong,
.task-copy strong {
  color: var(--theme-text);
  font-size: 16px;
}

.ai-copy p,
.task-copy span,
.task-copy small,
.ai-endpoint {
  margin: 0;
  color: var(--theme-text-secondary);
  line-height: 1.7;
}

.ai-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ai-item,
.task-item {
  border-radius: 14px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.16);
  background: rgba(var(--theme-accent-rgb), 0.05);
}

.ai-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
}

.ai-item span {
  font-size: 12px;
  color: var(--theme-text-secondary);
}

.ai-item strong {
  color: var(--theme-text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.ai-endpoint {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(var(--theme-surface-rgb), 0.72);
  word-break: break-word;
}

.ai-actions,
.task-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  padding: 14px 16px;
}

.task-copy small {
  font-size: 12px;
}

.recent-card :deep(.arco-table-th),
.recent-card :deep(.arco-table-td) {
  background: transparent;
}

.recent-card :deep(.arco-table-tr:hover > .arco-table-td) {
  background: rgba(var(--theme-accent-rgb), 0.04);
}

.quick-card {
  overflow: hidden;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.quick-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.16);
  border-radius: 14px;
  background: rgba(var(--theme-accent-rgb), 0.06);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.quick-item:hover {
  transform: translateY(-1px);
  border-color: rgba(var(--theme-accent-rgb), 0.34);
  background: rgba(var(--theme-accent-rgb), 0.1);
}

.quick-item strong {
  color: var(--theme-text);
  font-size: 15px;
}

.quick-item span {
  color: var(--theme-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 1100px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .ai-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .page-header,
  .ai-panel-head,
  .task-head {
    flex-direction: column;
  }

  .quick-grid {
    grid-template-columns: 1fr;
  }
}
</style>
