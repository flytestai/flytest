<template>
  <div class="dashboard-view">
    <div v-if="!isApproved" class="approval-pending-card">
      <div class="approval-shell">
        <div class="approval-kicker">Workspace Access</div>
        <a-result
          status="warning"
          title="账号等待管理员审核"
          :subtitle="approvalSubtitle"
        />
      </div>
    </div>

    <div v-else-if="!currentProjectId" class="no-project-selected">
      <div class="empty-project-shell">
        <div class="empty-project-icon">
          <icon-bar-chart />
        </div>
        <div class="empty-project-copy">
          <h2>当前还没有可用项目</h2>
          <p>请先创建项目，或联系管理员将你加入项目后，再查看管理首页。</p>
          <div class="empty-project-actions">
            <a-button type="primary" @click="goToProjectManagement">去创建项目</a-button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="dashboard-content">
      <a-spin :loading="loading" tip="正在加载首页数据..." class="dashboard-spin">
        <section class="hero-section">
          <div class="hero-main">
            <div class="hero-kicker-row">
              <span class="hero-eyebrow">Control Center</span>
              <span class="hero-project-chip">当前项目</span>
            </div>
            <div class="hero-title-row">
              <h1 class="hero-title">{{ currentProjectName }}</h1>
              <span class="hero-inline-status" :class="passRateTone">{{ passRateStatusText }}</span>
            </div>

            <p class="hero-description">
              汇总项目质量、执行结果与 AI 能力，优先暴露风险，帮助团队把今天的测试工作推进到可交付状态。
            </p>

            <div class="hero-actions">
              <button type="button" class="hero-action hero-action--primary" @click="goToProjectManagement">
                项目总览
              </button>
              <button type="button" class="hero-action" @click="goToTestcases">测试用例</button>
              <button type="button" class="hero-action" @click="goToExecutionReports">执行报告</button>
            </div>

            <div class="hero-highlights">
              <div v-for="item in heroHighlights" :key="item.label" class="hero-highlight-card">
                <span class="hero-highlight-label">{{ item.label }}</span>
                <strong class="hero-highlight-value">{{ item.value }}</strong>
              </div>
            </div>

          </div>

          <div class="hero-aside">
            <div class="hero-aside-panel">
              <div class="hero-aside-head">
                <span class="hero-aside-kicker">Quality Signal</span>
                <span class="hero-aside-badge" :class="passRateTone">{{ passRateStatusText }}</span>
              </div>
              <div class="hero-score-row">
                <div class="hero-score-ring">
                  <svg viewBox="0 0 120 120" class="hero-score-svg">
                    <circle cx="60" cy="60" r="48" class="hero-score-track" />
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      class="hero-score-progress"
                      :style="{ strokeDasharray: `${passRate * 3.02} 302`, stroke: rateColor }"
                    />
                  </svg>
                  <div class="hero-score-text">
                    <strong>{{ passRate }}</strong>
                    <span>%</span>
                  </div>
                </div>
                <div class="hero-score-meta">
                  <div class="hero-score-stat">
                    <span>通过</span>
                    <strong>{{ statistics?.executions?.case_results?.passed || 0 }}</strong>
                  </div>
                  <div class="hero-score-stat">
                    <span>失败</span>
                    <strong>{{ statistics?.executions?.case_results?.failed || 0 }}</strong>
                  </div>
                  <div class="hero-score-stat">
                    <span>跳过</span>
                    <strong>{{ statistics?.executions?.case_results?.skipped || 0 }}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div class="hero-aside-panel compact">
              <div class="hero-aside-head">
                <span class="hero-aside-kicker">Governance Snapshot</span>
              </div>
              <div class="governance-list">
                <div v-for="item in governanceSnapshot" :key="item.label" class="governance-item">
                  <span class="governance-label">{{ item.label }}</span>
                  <strong class="governance-value">{{ item.value }}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="kpi-grid" aria-label="工作概览">
          <article v-for="card in overviewCards" :key="card.title" class="kpi-card">
            <div class="kpi-top">
              <span class="kpi-label">{{ card.title }}</span>
              <span :class="['kpi-icon', card.tint]">
                <component :is="card.icon" />
              </span>
            </div>
            <div class="kpi-value">
              {{ card.value }}
              <small>{{ card.unit }}</small>
            </div>
            <div class="kpi-foot">
              <template v-for="(tag, index) in card.tags" :key="tag.label">
                <span :class="['kpi-foot-part', tag.tone]">{{ tag.label }} <b>{{ tag.value }}</b></span>
                <span v-if="index < card.tags.length - 1" class="kpi-foot-sep">·</span>
              </template>
            </div>
          </article>
        </section>

        <DashboardInsights
          :stats="statistics"
          :token-stats="tokenStats"
          :token-period="tokenPeriod"
          @period-change="changeTokenPeriod"
        />

      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useRouter } from 'vue-router'
import {
  IconBarChart, IconFile, IconThunderbolt, IconApps, IconDesktop
} from '@arco-design/web-vue/es/icon'
import { getProjectStatistics, getTokenUsageStats, type ProjectStatistics, type TokenUsageStats } from '@/services/projectService'
import { useProjectStore } from '@/store/projectStore'
import { useAuthStore } from '@/store/authStore'
import DashboardInsights from '@/components/dashboard/DashboardInsights.vue'
import { fetchTokenUsageStats } from '@/features/langgraph/services/llmConfigService'
import type { TokenUsageStats as LlmTokenUsageStats } from '@/features/langgraph/types/llmConfig'

const projectStore = useProjectStore()
const authStore = useAuthStore()
const router = useRouter()
const loading = ref(false)
const statistics = ref<ProjectStatistics | null>(null)
const tokenStats = ref<TokenUsageStats | null>(null)
const tokenPeriod = ref<'day' | 'week' | 'month'>('day')
const tokenUsageStats = ref<LlmTokenUsageStats | null>(null)
const tokenUsageLoading = ref(false)
const usagePreset = ref<'today' | '7d' | '30d' | 'custom'>('today')
const usageSource = ref('')
const currentProjectName = computed(() => projectStore.currentProject?.name || 'FeiCe 飞测 Project')
const DASHBOARD_REFRESH_INTERVAL_MS = 120000
const DASHBOARD_FOCUS_REFRESH_COOLDOWN_MS = 15000
let dashboardRefreshTimer: ReturnType<typeof setTimeout> | null = null
let isDashboardRefreshing = false
let isSecondaryLoading = false
let lastRefreshStartedAt = 0
let lastLoadedProjectId: number | null = null

const currentProjectId = computed(() => projectStore.currentProjectId)
const currentUser = computed(() => authStore.currentUser)
const isApproved = computed(() => authStore.isApproved)
const approvalSubtitle = computed(() => {
  if (currentUser.value?.approval_status === 'rejected') {
    return currentUser.value.approval_review_note || '当前账号已被驳回，请联系管理员处理。'
  }
  return '新注册用户默认没有后台权限，请等待管理员审核并分配权限后再使用管理后台。'
})

const goToProjectManagement = () => {
  void router.push({ name: 'ProjectManagement' })
}

const goToTestcases = () => {
  void router.push({ path: '/testcases' })
}

const goToExecutionReports = () => {
  void router.push({ path: '/test-executions' })
}

const formatDashboardDate = (date: Date): string => {
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const usageStartDate = ref(formatDashboardDate(new Date()))
const usageEndDate = ref(formatDashboardDate(new Date()))

const passRate = computed(() => {
  const total = statistics.value?.executions?.case_results?.total || 0
  const passed = statistics.value?.executions?.case_results?.passed || 0
  if (total === 0) return 0
  return Math.round((passed / total) * 100)
})

const rateColor = computed(() => {
  if (passRate.value >= 80) return '#22c55e'
  if (passRate.value >= 60) return '#f59e0b'
  return '#ef4444'
})

const passRateTone = computed(() => {
  if (passRate.value >= 80) return 'good'
  if (passRate.value >= 60) return 'warning'
  return 'risk'
})

const passRateStatusText = computed(() => {
  if (passRate.value >= 80) return '质量稳定'
  if (passRate.value >= 60) return '需要关注'
  return '存在风险'
})

const heroHighlights = computed(() => [
  {
    label: '测试用例总量',
    value: statistics.value?.testcases?.total || 0,
  },
  {
    label: '近 30 天执行次数',
    value: statistics.value?.execution_trend?.summary_30d?.execution_count || 0,
  },
  {
    label: '自动化用例规模',
    value: statistics.value?.ui_automation?.total_cases || 0,
  },
])

const governanceSnapshot = computed(() => [
  { label: 'MCP 已启用', value: `${statistics.value?.mcp?.active || 0}/${statistics.value?.mcp?.total || 0}` },
  { label: 'Skills 已启用', value: `${statistics.value?.skills?.active || 0}/${statistics.value?.skills?.total || 0}` },
  { label: 'AI 会话数', value: tokenStats.value?.total?.session_count || 0 },
])

const overviewCards = computed(() => [
  {
    title: '测试用例库',
    caption: '需求与回归资产沉淀',
    value: statistics.value?.testcases?.total || 0,
    unit: '条',
    icon: IconFile,
    tint: 'tint-blue',
    tags: [
      { label: '通过', value: statistics.value?.testcases?.by_review_status?.approved || 0, tone: 'positive' },
      { label: '待审核', value: statistics.value?.testcases?.by_review_status?.pending_review || 0, tone: 'warning' },
      { label: '待优化', value: statistics.value?.testcases?.by_review_status?.needs_optimization || 0, tone: 'info' },
    ],
  },
  {
    title: 'UI 自动化',
    caption: '执行覆盖与自动化产出',
    value: statistics.value?.ui_automation?.total_cases || 0,
    unit: '条',
    icon: IconDesktop,
    tint: 'tint-purple',
    tags: [
      { label: '执行', value: statistics.value?.ui_automation?.total_executions || 0, tone: 'neutral' },
      { label: '成功', value: statistics.value?.ui_automation?.by_status?.success || 0, tone: 'positive' },
      { label: '失败', value: statistics.value?.ui_automation?.by_status?.failed || 0, tone: 'danger' },
    ],
  },
  {
    title: '执行结果',
    caption: '质量稳定性核心指标',
    value: statistics.value?.executions?.total_executions || 0,
    unit: '次',
    icon: IconThunderbolt,
    tint: 'tint-amber',
    tags: [
      { label: '通过', value: statistics.value?.executions?.case_results?.passed || 0, tone: 'positive' },
      { label: '失败', value: statistics.value?.executions?.case_results?.failed || 0, tone: 'danger' },
      { label: '跳过', value: statistics.value?.executions?.case_results?.skipped || 0, tone: 'warning' },
    ],
  },
  {
    title: 'MCP / Skills',
    caption: '扩展能力与智能工具底座',
    value: (statistics.value?.mcp?.total || 0) + (statistics.value?.skills?.total || 0),
    unit: '项',
    icon: IconApps,
    tint: 'tint-teal',
    tags: [
      { label: 'MCP', value: `${statistics.value?.mcp?.active || 0}/${statistics.value?.mcp?.total || 0}`, tone: 'neutral' },
      { label: 'Skills', value: `${statistics.value?.skills?.active || 0}/${statistics.value?.skills?.total || 0}`, tone: 'info' },
      { label: 'Token', value: formatTokenCount(tokenStats.value?.total?.total_tokens || 0), tone: 'accent' },
    ],
  },
])

const formatTokenCount = (count: number): string => {
  return count.toLocaleString('zh-CN')
}

const canTriggerRefresh = () => {
  const now = Date.now()
  return !isDashboardRefreshing && now - lastRefreshStartedAt >= DASHBOARD_FOCUS_REFRESH_COOLDOWN_MS
}

const clearDashboardRefreshTimer = () => {
  if (dashboardRefreshTimer !== null) {
    clearTimeout(dashboardRefreshTimer)
    dashboardRefreshTimer = null
  }
}

const scheduleDashboardRefresh = (delay = DASHBOARD_REFRESH_INTERVAL_MS) => {
  clearDashboardRefreshTimer()
  if (!isApproved.value || !currentProjectId.value) {
    return
  }
  dashboardRefreshTimer = setTimeout(() => {
    void refreshDashboardData({ silent: true })
  }, delay)
}

const fetchTokenStats = async () => {
  try {
    const response = await getTokenUsageStats({ group_by: tokenPeriod.value })
    if (response.success && response.data) {
      tokenStats.value = response.data
    }
  } catch (error) {
    console.error('获取 Token 统计数据出错:', error)
  }
}

const changeTokenPeriod = (period: 'day' | 'week' | 'month') => {
  tokenPeriod.value = period
  void fetchTokenStats()
}

const fetchTokenUsage = async () => {
  tokenUsageLoading.value = true
  try {
    const response = await fetchTokenUsageStats({
      preset: usagePreset.value === 'custom' ? undefined : usagePreset.value,
      start_date: usagePreset.value === 'custom' ? usageStartDate.value : undefined,
      end_date: usagePreset.value === 'custom' ? usageEndDate.value : undefined,
      source: usageSource.value || undefined,
    })
    if (response.status === 'success') {
      tokenUsageStats.value = response.data
    }
  } catch (error) {
    console.error('获取 Token 仪表盘数据出错:', error)
  } finally {
    tokenUsageLoading.value = false
  }
}

const handleUsagePresetChange = (preset: string) => {
  usagePreset.value = preset as typeof usagePreset.value
  const end = new Date()
  const start = new Date()
  if (preset === 'today') {
    usageStartDate.value = formatDashboardDate(end)
    usageEndDate.value = formatDashboardDate(end)
  } else if (preset === '7d') {
    start.setDate(end.getDate() - 6)
    usageStartDate.value = formatDashboardDate(start)
    usageEndDate.value = formatDashboardDate(end)
  } else if (preset === '30d') {
    start.setDate(end.getDate() - 29)
    usageStartDate.value = formatDashboardDate(start)
    usageEndDate.value = formatDashboardDate(end)
  }
  void fetchTokenUsage()
}

const handleUsageSourceChange = (source: string) => {
  usageSource.value = source
  void fetchTokenUsage()
}

const handleUsageDateRangeChange = (payload: { startDate: string; endDate: string }) => {
  usageStartDate.value = payload.startDate
  usageEndDate.value = payload.endDate
  usagePreset.value = 'custom'
  void fetchTokenUsage()
}

const fetchStatistics = async ({ controlLoading = true }: { controlLoading?: boolean } = {}) => {
  if (!currentProjectId.value) return
  if (!isApproved.value) return

  if (controlLoading) {
    loading.value = true
  }
  try {
    const response = await getProjectStatistics(currentProjectId.value)
    if (response.success && response.data) {
      statistics.value = response.data
    } else {
      Message.error(response.error || '获取统计数据失败')
    }
  } catch (error) {
    console.error('获取统计数据出错:', error)
    Message.error('获取统计数据时发生错误')
  } finally {
    if (controlLoading) {
      loading.value = false
    }
  }
}

const fetchDashboardSecondaryData = async () => {
  if (isSecondaryLoading || !isApproved.value || !currentProjectId.value) {
    return
  }

  isSecondaryLoading = true
  try {
    await Promise.allSettled([
      fetchTokenStats(),
      fetchTokenUsage(),
    ])
  } finally {
    isSecondaryLoading = false
  }
}

const refreshDashboardData = async ({
  silent = false,
  projectChanged = false,
}: {
  silent?: boolean
  projectChanged?: boolean
} = {}) => {
  if (!isApproved.value || !currentProjectId.value) {
    clearDashboardRefreshTimer()
    return
  }
  if (isDashboardRefreshing) {
    return
  }

  isDashboardRefreshing = true
  lastRefreshStartedAt = Date.now()
  if (!silent) {
    loading.value = true
  }

  try {
    await fetchStatistics({ controlLoading: false })
    if (projectChanged) {
      tokenStats.value = null
      tokenUsageStats.value = null
    }
    void fetchDashboardSecondaryData()
  } finally {
    isDashboardRefreshing = false
    if (!silent) {
      loading.value = false
    }
    scheduleDashboardRefresh()
  }
}

const handleWindowFocus = () => {
  if (!isApproved.value || !currentProjectId.value) {
    return
  }
  if (!canTriggerRefresh()) {
    return
  }
  void refreshDashboardData({ silent: true })
}

const handleVisibilityChange = () => {
  if (document.visibilityState !== 'visible') {
    clearDashboardRefreshTimer()
    return
  }
  if (!isApproved.value || !currentProjectId.value) {
    return
  }
  if (!canTriggerRefresh()) {
    return
  }
  void refreshDashboardData({ silent: true })
}

watch(currentProjectId, (newProjectId) => {
  if (!isApproved.value) {
    statistics.value = null
    tokenStats.value = null
    tokenUsageStats.value = null
    clearDashboardRefreshTimer()
    lastLoadedProjectId = null
  } else if (newProjectId) {
    const projectChanged = newProjectId !== lastLoadedProjectId
    lastLoadedProjectId = newProjectId
    void refreshDashboardData({ projectChanged })
  } else {
    statistics.value = null
    tokenStats.value = null
    tokenUsageStats.value = null
    clearDashboardRefreshTimer()
    lastLoadedProjectId = null
  }
}, { immediate: true })

onMounted(() => {
  window.addEventListener('focus', handleWindowFocus)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  clearDashboardRefreshTimer()
  window.removeEventListener('focus', handleWindowFocus)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style scoped>
.dashboard-view {
  min-height: 100%;
  padding: 16px;
  background:
    radial-gradient(circle at top left, rgba(var(--theme-accent-rgb), 0.16), transparent 24%),
    radial-gradient(circle at top right, rgba(var(--theme-accent-secondary-rgb), 0.12), transparent 20%),
    radial-gradient(circle at bottom right, rgba(var(--theme-accent-tertiary-rgb), 0.11), transparent 22%),
    linear-gradient(180deg, rgba(248, 251, 255, 0.98), rgba(240, 245, 252, 0.92));
  box-sizing: border-box;
  overflow-y: auto;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
}

.dashboard-spin {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:deep(.arco-spin-children) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.approval-pending-card,
.no-project-selected {
  min-height: calc(100vh - 180px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.approval-shell,
.empty-project-shell {
  width: min(760px, 100%);
  padding: 32px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
}

.approval-kicker {
  margin-bottom: 14px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--theme-accent);
}

.empty-project-shell {
  display: flex;
  align-items: center;
  gap: 20px;
}

.empty-project-icon {
  width: 80px;
  height: 80px;
  border-radius: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--theme-accent-rgb), 0.1);
  color: var(--theme-accent);
  font-size: 34px;
}

.empty-project-copy h2 {
  margin: 0 0 10px;
  font-size: 26px;
  color: var(--theme-text);
}

.empty-project-copy p {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--theme-text-secondary);
}

.empty-project-actions {
  margin-top: 18px;
}

.hero-section {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.95fr);
  gap: 12px;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background:
    radial-gradient(circle at top right, rgba(var(--theme-accent-rgb), 0.24), transparent 28%),
    radial-gradient(circle at bottom left, rgba(var(--theme-accent-secondary-rgb), 0.16), transparent 24%),
    linear-gradient(140deg, rgba(255, 255, 255, 0.99), rgba(243, 248, 255, 0.96));
  box-shadow: 0 30px 72px rgba(15, 23, 42, 0.1);
}

.hero-main {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
}

.hero-kicker-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hero-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.hero-eyebrow,
.hero-project-chip,
.hero-aside-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-eyebrow,
.hero-aside-kicker {
  color: var(--theme-accent);
}

.hero-project-chip {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: var(--theme-text-secondary);
  letter-spacing: 0;
  text-transform: none;
}

.hero-title {
  margin: 0;
  font-family: var(--theme-display-font);
  font-size: 28px;
  line-height: 1.1;
  color: var(--theme-text);
}

.hero-description {
  max-width: 560px;
  margin: 2px 0 0;
  color: rgba(214, 224, 245, 0.78);
  font-size: 13px;
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-action {
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: #e8eeff;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 32px;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.hero-action:hover {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.14);
}

.hero-action--primary {
  border-color: #ffffff;
  background: #ffffff;
  color: #253a72;
}

.hero-action--primary:hover {
  border-color: #edf1ff;
  background: #edf1ff;
  color: #1f3265;
}

.hero-highlights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.hero-kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.hero-highlight-card,
.hero-aside-panel,
.hero-kpi-card {
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(249, 251, 255, 0.88));
  box-shadow: 0 20px 46px rgba(15, 23, 42, 0.06);
}

.hero-highlight-card:nth-child(1) {
  background: linear-gradient(180deg, rgba(var(--theme-accent-rgb), 0.08), rgba(255, 255, 255, 0.94));
}

.hero-highlight-card:nth-child(2) {
  background: linear-gradient(180deg, rgba(var(--theme-accent-secondary-rgb), 0.08), rgba(255, 255, 255, 0.94));
}

.hero-highlight-card:nth-child(3) {
  background: linear-gradient(180deg, rgba(var(--theme-accent-tertiary-rgb), 0.08), rgba(255, 255, 255, 0.94));
}

.hero-highlight-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  min-height: 86px;
  padding: 12px 14px;
  border-radius: 12px;
}

.hero-highlight-label,
.kpi-caption,
.hero-highlight-foot,
.governance-label {
  color: var(--theme-text-secondary);
}

.hero-highlight-label {
  font-size: 12px;
  font-weight: 600;
}

.hero-highlight-value {
  font-size: 22px;
  line-height: 1;
  color: var(--theme-text);
}

.hero-kpi-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 82px;
  padding: 10px 12px;
  border-radius: 12px;
}

.hero-kpi-card:nth-child(1) {
  background: linear-gradient(180deg, rgba(var(--theme-accent-rgb), 0.09), rgba(255, 255, 255, 0.95));
}

.hero-kpi-card:nth-child(2) {
  background: linear-gradient(180deg, rgba(var(--theme-accent-secondary-rgb), 0.09), rgba(255, 255, 255, 0.95));
}

.hero-kpi-card:nth-child(3) {
  background: linear-gradient(180deg, rgba(var(--theme-accent-tertiary-rgb), 0.09), rgba(255, 255, 255, 0.95));
}

.hero-kpi-card:nth-child(4) {
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.08), rgba(255, 255, 255, 0.95));
}

.hero-kpi-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hero-kpi-icon {
  font-size: 15px;
  color: var(--theme-accent);
}

.hero-kpi-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--theme-text-secondary);
}

.hero-kpi-value-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.hero-kpi-value {
  font-size: 22px;
  line-height: 1;
  color: var(--theme-text);
}

.hero-kpi-unit {
  font-size: 10px;
  color: var(--theme-text-tertiary);
  margin-bottom: 2px;
}

.hero-aside {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hero-aside-panel {
  padding: 12px;
  border-radius: 14px;
}

.hero-aside-panel.compact {
  padding-top: 12px;
}

.hero-inline-status {
  flex-shrink: 0;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.hero-inline-status.good {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.hero-inline-status.warning {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.hero-inline-status.risk {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.hero-aside-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hero-aside-badge,
.kpi-tag {
  border-radius: 999px;
}

.hero-aside-badge {
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 700;
}

.hero-aside-badge.good {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.hero-aside-badge.warning {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.hero-aside-badge.risk {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.hero-score-row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-top: 8px;
}

.hero-score-ring {
  position: relative;
  width: 96px;
  height: 96px;
}

.hero-score-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.hero-score-track,
.hero-score-progress,
.execution-ring-track,
.execution-ring-progress {
  fill: none;
  stroke-linecap: round;
}

.hero-score-track {
  stroke: rgba(148, 163, 184, 0.2);
  stroke-width: 10;
}

.hero-score-progress {
  stroke-width: 10;
  transition: stroke-dasharray 0.4s ease;
}

.hero-score-text,
.execution-ring-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.hero-score-text strong {
  font-size: 22px;
  color: var(--theme-text);
  line-height: 1;
}

.hero-score-text span {
  margin-top: 4px;
  font-size: 11px;
  color: var(--theme-text-secondary);
}

.hero-score-meta {
  display: grid;
  gap: 6px;
}

.hero-score-stat {
  display: flex;
  justify-content: space-between;
  padding: 7px 9px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.88);
}

.hero-score-stat span {
  font-size: 11px;
  color: var(--theme-text-secondary);
}

.hero-score-stat strong,
.governance-value,
.kpi-value {
  color: var(--theme-text);
}

.hero-score-stat strong {
  font-size: 13px;
}

.governance-list {
  display: grid;
  gap: 6px;
  margin-top: 6px;
}

.governance-item {
  display: flex;
  justify-content: space-between;
  padding: 7px 9px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.9);
}

.governance-label {
  font-size: 11px;
}

.governance-value {
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 1400px) {
  .hero-kpi-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1200px) {
  .hero-section {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .dashboard-view {
    padding: 12px;
  }

  .hero-section,
  .approval-shell,
  .empty-project-shell {
    padding: 18px;
    border-radius: 20px;
  }

  .hero-title {
    font-size: 28px;
  }

  .hero-highlights,
  .hero-kpi-strip {
    grid-template-columns: 1fr;
  }

  .hero-score-row {
    grid-template-columns: 1fr;
  }

  .empty-project-shell {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

