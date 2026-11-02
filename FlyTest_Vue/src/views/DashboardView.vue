<template>
  <div class="dashboard-view fc-page">
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

    <div v-else-if="projectStore.loading" class="fc-dashboard-loading" role="status" aria-label="正在加载项目">
      <a-skeleton :animation="true"><a-skeleton-line :rows="3" /></a-skeleton>
      <div class="kpi-grid"><a-skeleton v-for="index in 4" :key="index" :animation="true"><a-skeleton-shape /></a-skeleton></div>
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
        <section class="dashboard-heading">
          <div><h2>质量工作台</h2><p>掌握质量进展，让每次交付更有把握</p></div>
          <div class="dashboard-heading-actions"><a-button @click="refreshDashboardData()" :loading="loading">刷新数据</a-button><a-button type="outline" @click="goToExecutionReports">查看报告</a-button></div>
        </section>


        <div class="dashboard-project-strip"><span>当前项目</span><strong>{{ currentProjectName }}</strong><span>实时汇总 · 每 2 分钟刷新</span></div>
        <section class="kpi-grid" aria-label="工作概览">
          <article v-for="card in overviewCards" :key="card.title" class="kpi-card" :class="{ 'kpi-card--primary': card.primary }" :data-quality="card.tone" :data-metric="card.key" :title="card.rule">
            <span class="kpi-icon"><component :is="card.icon" /></span><div class="fc-kpi-copy"><span class="kpi-label">{{ card.title }}</span>
            <div class="kpi-value">{{ card.value }}</div>
            <div class="kpi-note">{{ card.note }}</div>
            </div>
          </article>
        </section>

        <section class="fc-quality-insight" aria-label="项目质量摘要"><span class="fc-quality-insight__label"><icon-bar-chart />质量摘要</span><p>{{ qualitySummary }}</p><router-link to="/langgraph-chat" title="进入 AI 对话，分析当前项目质量问题">AI 辅助分析 →</router-link></section>

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
  IconBarChart, IconFile, IconBug, IconCheck, IconClose
} from '@arco-design/web-vue/es/icon'
import { getProjectStatistics, getTokenUsageStats, type ProjectStatistics, type TokenUsageStats } from '@/services/projectService'
import { useProjectStore } from '@/store/projectStore'
import { useAuthStore } from '@/store/authStore'
import DashboardInsights from '@/components/dashboard/DashboardInsights.vue'
import { calculatePassRate, passRateTone, formatQualityPercent } from '@/utils/qualityStatus'
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

const rawPassRate = computed(() => calculatePassRate(statistics.value?.executions?.case_results?.passed || 0, statistics.value?.executions?.case_results?.total || 0))
const overviewCards = computed(() => [
  { key: 'total', title: '用例总量', value: (statistics.value?.testcases?.total || 0).toLocaleString('zh-CN'), icon: IconFile, primary: false, tone: undefined, note: '当前项目测试资产', rule: '当前项目的测试资产总量' },
  { key: 'pass-rate', title: '执行通过率', value: formatQualityPercent(rawPassRate.value), icon: passRateTone(rawPassRate.value) === 'success' ? IconCheck : IconClose, primary: false, tone: passRateTone(rawPassRate.value), note: rawPassRate.value === null ? '暂无执行数据' : '通过 ' + (statistics.value?.executions?.case_results?.passed || 0) + ' / ' + (statistics.value?.executions?.case_results?.total || 0), rule: '只有 100% 通过为绿色，其余为红色' },
  { key: 'open-defects', title: '待处理缺陷', value: (statistics.value?.bugs?.open || 0).toLocaleString('zh-CN'), icon: IconBug, primary: false, tone: 'danger', note: '高优先级 ' + (statistics.value?.bugs?.high_severity || 0) + ' 项', rule: '待处理缺陷使用红色' },
  { key: 'pending-review', title: '待审核用例', value: (statistics.value?.testcases?.by_review_status?.pending_review || 0).toLocaleString('zh-CN'), icon: IconFile, primary: false, tone: 'ai', note: '待人工审核后使用', rule: '审核状态与最近执行结果独立统计' },
])
const qualitySummary = computed(() => {
  if (!statistics.value) return '暂无项目统计，加载后可查看质量风险摘要。'
  const bugs = statistics.value.bugs?.high_severity || 0, review = statistics.value.testcases?.by_review_status?.pending_review || 0
  return bugs ? `当前项目有 ${bugs} 项高严重度缺陷，建议优先回归验证；另有 ${review} 条用例待审核。` : `当前项目无高严重度缺陷，${review} 条用例待审核。可进入 AI 对话进一步分析测试覆盖与执行风险。`
})

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
.dashboard-view{min-height:100%;box-sizing:border-box}
.dashboard-content,.dashboard-spin{display:flex;flex-direction:column;min-width:0}
:deep(.arco-spin-children){display:block;min-width:0}
.approval-pending-card,.no-project-selected{display:grid;place-items:center;min-height:calc(100dvh - 180px)}
.approval-shell,.empty-project-shell{width:min(760px,100%);padding:30px;border:1px solid var(--theme-border);border-radius:20px;background:var(--theme-surface);box-shadow:var(--theme-card-shadow)}
.approval-kicker{font-size:12px;color:var(--theme-text-tertiary)}
.empty-project-shell{display:flex;align-items:center;gap:20px}
.empty-project-icon{display:grid;place-items:center;flex:none;width:62px;height:62px;border-radius:16px;background:var(--theme-accent-soft);color:var(--theme-accent);font-size:30px}
.empty-project-copy h2{margin:0;font-size:23px}.empty-project-copy p{margin:10px 0 20px;color:var(--theme-text-secondary);line-height:1.8}
@media(max-width:640px){.empty-project-shell{flex-direction:column;align-items:flex-start;padding:24px}.empty-project-copy h2{font-size:21px}}
</style>
