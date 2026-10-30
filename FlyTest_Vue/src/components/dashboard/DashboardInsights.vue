<template>
  <section class="dashboard-insights" aria-labelledby="insights-heading">
    <div class="insights-intro">
      <div>
        <h2 id="insights-heading">项目质量洞察</h2>
        <p>关注待办与风险，持续跟进测试资产和执行质量。</p>
      </div>
      <span class="insights-context"><span></span>当前项目</span>
    </div>

    <div class="insights-row insights-primary">
      <article class="insights-block" aria-labelledby="backlog-heading">
        <header class="insights-heading">
          <div class="insights-heading-copy">
            <h3 id="backlog-heading"><icon-check-circle />待处理事项</h3>
            <p>按事项类型梳理当前工作队列</p>
          </div>
          <span class="insights-badge">{{ number(backlogTotal) }} 项</span>
        </header>
        <div class="insights-queue">
          <div v-for="item in backlogItems" :key="item.label" class="insights-queue-item">
            <span :class="['insights-symbol', `tone-${item.tone}`]"><component :is="item.icon" /></span>
            <div class="insights-item-copy"><h4>{{ item.label }}</h4><p>{{ item.description }}</p></div>
            <div class="insights-item-number"><strong>{{ number(item.value) }}</strong><span>{{ item.unit }}</span></div>
          </div>
        </div>
        <footer class="insights-note">待办数量按事项类型分别统计</footer>
      </article>

      <article class="insights-block" aria-labelledby="risk-heading">
        <header class="insights-heading">
          <div class="insights-heading-copy"><h3 id="risk-heading"><icon-bug />缺陷风险</h3><p>识别重点风险，跟踪修复闭环</p></div>
          <span :class="['insights-badge', bugs.open ? 'tone-danger' : 'tone-success']">{{ bugs.open ? '需关注' : '无未关闭缺陷' }}</span>
        </header>
        <div class="insights-risk-overview">
          <div><span class="insights-muted">未关闭缺陷</span><div class="insights-risk-value"><strong>{{ number(bugs.open) }}</strong><span>/ {{ number(bugs.total) }} 个缺陷</span></div></div>
          <div class="insights-risk-signals">
            <span><i class="insights-dot tone-danger"></i>高优先级 <b>{{ number(bugs.high_severity) }}</b></span>
            <span><i class="insights-dot tone-warning"></i>待回归 <b>{{ number(bugs.pending_retest) }}</b></span>
          </div>
        </div>
        <div class="insights-risk-list">
          <div v-for="item in riskItems" :key="item.label" class="insights-risk-item">
            <div class="insights-metric-label"><span>{{ item.label }}</span><strong>{{ number(item.value) }}</strong></div>
            <div class="insights-meter" :aria-label="`${item.label}占全部缺陷 ${percent(item.value, bugs.total)}%`" role="img"><span :class="`tone-${item.tone}`" :style="{ width: `${percent(item.value, bugs.total)}%` }"></span></div>
          </div>
        </div>
        <footer class="insights-note">分布按全部缺陷计算，高优先级与处理状态可重叠</footer>
      </article>

      <article class="insights-block" aria-labelledby="automation-heading">
        <header class="insights-heading">
          <div class="insights-heading-copy"><h3 id="automation-heading"><icon-apps />自动化矩阵</h3><p>统一查看各类自动化的资产与运行概况</p></div>
          <span class="insights-badge">{{ activeAutomationCount }}/3 有数据</span>
        </header>
        <div class="insights-automation-list">
          <div v-for="item in automationItems" :key="item.key" class="insights-automation-item">
            <span class="insights-platform">{{ item.key }}</span>
            <div class="insights-item-copy">
              <div class="insights-automation-name"><h4>{{ item.label }}</h4><span :class="['insights-state', `tone-${item.tone}`]">{{ item.state }}</span></div>
              <p>{{ item.details }}</p>
            </div>
            <div class="insights-item-number"><strong>{{ item.total === null ? '—' : number(item.total) }}</strong><span>用例</span></div>
          </div>
        </div>
        <footer class="insights-note"><icon-info-circle />APP 汇总统计暂未接入，执行数据可在工作区查看</footer>
      </article>
    </div>

    <div class="insights-row insights-resources">
      <article class="insights-block" aria-labelledby="review-heading">
        <header class="insights-heading">
          <div class="insights-heading-copy"><h3 id="review-heading"><icon-file />测试用例审核分布</h3><p>掌握测试资产的审核与可用情况</p></div>
          <span class="insights-badge">{{ number(stats?.testcases?.total) }} 条</span>
        </header>
        <div class="insights-distribution" role="img" :aria-label="reviewItems.map(item => `${item.label} ${number(item.value)} 条`).join('，')">
          <span v-for="item in reviewItems" :key="item.label" :class="`tone-${item.tone}`" :style="{ width: `${ratio(item.value, stats?.testcases?.total)}%` }"></span>
        </div>
        <div class="insights-review-list">
          <div v-for="item in reviewItems" :key="item.label" class="insights-review-item">
            <span><i :class="['insights-dot', `tone-${item.tone}`]"></i>{{ item.label }}</span>
            <strong>{{ number(item.value) }}</strong><span class="insights-muted">{{ percent(item.value, stats?.testcases?.total) }}%</span>
          </div>
        </div>
      </article>

      <article class="insights-block insights-token" aria-labelledby="token-heading">
        <header class="insights-heading">
          <div class="insights-heading-copy"><h3 id="token-heading"><icon-thunderbolt />Token 使用概况</h3><p>查看 AI 资源消耗和调用活跃度</p></div>
          <div class="insights-period" role="group" aria-label="Token 统计分组">
            <button v-for="option in periods" :key="option.value" type="button" :aria-pressed="tokenPeriod === option.value" @click="emit('period-change', option.value)">{{ option.label }}</button>
          </div>
        </header>
        <div class="insights-token-overview">
          <div class="insights-token-total"><span class="insights-muted">总消耗 · Token</span><strong>{{ number(tokenStats?.total?.total_tokens) }}</strong><div class="insights-token-io"><span>输入 <b>{{ number(tokenStats?.total?.input_tokens) }}</b></span><span>输出 <b>{{ number(tokenStats?.total?.output_tokens) }}</b></span></div></div>
          <dl class="insights-token-metrics">
            <div><dt>请求次数</dt><dd>{{ number(tokenStats?.total?.request_count) }}</dd></div>
            <div><dt>会话数量</dt><dd>{{ number(tokenStats?.total?.session_count) }}</dd></div>
            <div><dt>平均每次请求</dt><dd>{{ number(averageTokens) }}<small>Token</small></dd></div>
          </dl>
        </div>
        <div class="insights-ranking">
          <div class="insights-ranking-heading"><h4>高使用用户</h4><span class="insights-muted">按消耗量排序</span></div>
          <ol v-if="rankedUsers.length" class="insights-ranking-list">
            <li v-for="(user, index) in rankedUsers" :key="user.user_id"><span class="insights-rank">{{ index + 1 }}</span><span class="insights-user" :title="getUserDisplayName(user)">{{ getUserDisplayName(user) }}</span><strong>{{ number(user.total_tokens) }}</strong><span class="insights-muted">Token</span></li>
          </ol>
          <div v-else class="insights-ranking-empty">暂无用户使用记录，AI 调用后将在这里展示消耗分布。</div>
        </div>
      </article>
    </div>

    <div class="insights-row insights-execution">
      <article class="insights-block" aria-labelledby="trend-heading">
        <header class="insights-heading">
          <div class="insights-heading-copy"><h3 id="trend-heading"><icon-bar-chart />近 7 天执行趋势</h3><p>每日通过与失败的用例结果</p></div>
          <div class="insights-chart-legend"><span><i class="insights-dot tone-success"></i>通过</span><span><i class="insights-dot tone-danger"></i>失败</span></div>
        </header>
        <div class="insights-trend-summary"><span>近 30 天执行 <strong>{{ number(stats?.execution_trend?.summary_30d?.execution_count) }}</strong><small>次</small></span><span>通过 <b class="insights-success-text">{{ number(stats?.execution_trend?.summary_30d?.passed) }}</b></span><span>失败 <b class="insights-danger-text">{{ number(stats?.execution_trend?.summary_30d?.failed) }}</b></span></div>
        <figure v-if="hasTrendData" class="insights-chart" aria-labelledby="trend-heading">
          <div class="insights-chart-scale" aria-hidden="true"><span>{{ number(trendMax) }}</span><span>{{ number(Math.round(trendMax / 2)) }}</span><span>0</span></div>
          <div class="insights-chart-plot">
            <div v-for="day in trendDays" :key="day.date" class="insights-chart-day">
              <div class="insights-chart-slot"><span class="insights-chart-count">{{ number(day.passed + day.failed) }}</span><div class="insights-chart-stack" role="img" :title="`${formatDate(day.date)}：通过 ${number(day.passed)}，失败 ${number(day.failed)}`" :aria-label="`${formatDate(day.date)}：通过 ${day.passed}，失败 ${day.failed}`" :style="{ height: `${(day.passed + day.failed) / trendMax * 100}%` }"><span class="tone-danger" :style="{ flexGrow: day.failed }"></span><span class="tone-success" :style="{ flexGrow: day.passed }"></span></div></div>
              <span class="insights-chart-date">{{ formatDate(day.date) }}</span>
            </div>
          </div>
        </figure>
        <div v-else class="insights-empty"><icon-bar-chart /><strong>暂无执行趋势</strong><span>完成测试执行后，这里将展示每日结果变化。</span></div>
      </article>

      <article class="insights-block" aria-labelledby="operations-heading">
        <header class="insights-heading"><div class="insights-heading-copy"><h3 id="operations-heading"><icon-dashboard />项目运营看板</h3><p>协作效率与资源活跃度</p></div></header>
        <dl class="insights-operations">
          <div v-for="item in operationItems" :key="item.label"><div><dt>{{ item.label }}</dt><p>{{ item.description }}</p></div><dd>{{ number(item.value) }}</dd></div>
        </dl>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IconApps, IconBarChart, IconBug, IconCheckCircle, IconDashboard, IconFile, IconHistory, IconInfoCircle, IconRefresh, IconThunderbolt } from '@arco-design/web-vue/es/icon'
import type { ProjectStatistics, TokenUsageStats } from '@/services/projectService'
import { getUserDisplayName } from '@/utils/userDisplay'

type TokenPeriod = 'day' | 'week' | 'month'
const props = defineProps<{ stats: ProjectStatistics | null; tokenStats: TokenUsageStats | null; tokenPeriod: TokenPeriod }>()
const emit = defineEmits<{ 'period-change': [period: TokenPeriod] }>()
const periods = [{ label: '日', value: 'day' }, { label: '周', value: 'week' }, { label: '月', value: 'month' }] as const
const number = (value: number | undefined | null) => (value || 0).toLocaleString('zh-CN')
const ratio = (value: number, total: number | undefined) => total ? Math.min(100, value / total * 100) : 0
const percent = (value: number, total: number | undefined) => Math.round(ratio(value, total))
const formatDate = (date: string) => { const [, month, day] = date.split('T')[0].split('-'); return `${Number(month)}/${Number(day)}` }
const bugs = computed(() => ({ total: 0, open: 0, high_severity: 0, pending_retest: 0, closed: 0, ...props.stats?.bugs }))
const backlogItems = computed(() => [
  { label: '待审核用例', description: '等待评审确认', value: props.stats?.testcases?.by_review_status?.pending_review || 0, unit: '条', icon: IconCheckCircle, tone: 'warning' },
  { label: '待优化用例', description: '完善描述与覆盖范围', value: props.stats?.testcases?.by_review_status?.needs_optimization || 0, unit: '条', icon: IconFile, tone: 'info' },
  { label: '待回归缺陷', description: '修复后等待验证', value: bugs.value.pending_retest, unit: '个', icon: IconRefresh, tone: 'warning' },
  { label: 'UI 失败记录', description: '排查脚本与运行环境', value: props.stats?.ui_automation?.by_status?.failed || 0, unit: '次', icon: IconHistory, tone: 'danger' },
])
const backlogTotal = computed(() => backlogItems.value.reduce((sum, item) => sum + item.value, 0))
const riskItems = computed(() => [
  { label: '高优先级', value: bugs.value.high_severity, tone: 'danger' },
  { label: '已确认待修复', value: props.stats?.bugs?.by_status?.confirmed || 0, tone: 'warning' },
  { label: '处理中', value: props.stats?.bugs?.by_status?.assigned || 0, tone: 'info' },
  { label: '已关闭', value: bugs.value.closed, tone: 'success' },
])
const automationItems = computed(() => [
  { key: 'API', label: '接口自动化', total: props.stats?.api_automation?.test_cases || 0, state: props.stats?.api_automation?.test_cases ? '已接入' : '待建设', tone: props.stats?.api_automation?.test_cases ? 'success' : 'neutral', details: `请求 ${number(props.stats?.api_automation?.requests)} · 执行 ${number(props.stats?.api_automation?.executions)}` },
  { key: 'UI', label: 'Web 自动化', total: props.stats?.ui_automation?.total_cases || 0, state: props.stats?.ui_automation?.total_cases ? '已接入' : '待建设', tone: props.stats?.ui_automation?.total_cases ? 'success' : 'neutral', details: `成功 ${number(props.stats?.ui_automation?.by_status?.success)} · 失败 ${number(props.stats?.ui_automation?.by_status?.failed)}` },
  { key: 'APP', label: '移动端自动化', total: null, state: '统计待接入', tone: 'neutral', details: '设备与执行详情请查看工作区' },
])
const activeAutomationCount = computed(() => automationItems.value.filter(item => item.total !== null && item.total > 0).length)
const reviewItems = computed(() => [
  { label: '已通过', value: props.stats?.testcases?.by_review_status?.approved || 0, tone: 'success' },
  { label: '待审核', value: props.stats?.testcases?.by_review_status?.pending_review || 0, tone: 'warning' },
  { label: '待优化', value: props.stats?.testcases?.by_review_status?.needs_optimization || 0, tone: 'info' },
  { label: '优化待审', value: props.stats?.testcases?.by_review_status?.optimization_pending_review || 0, tone: 'subtle' },
  { label: '不可用', value: props.stats?.testcases?.by_review_status?.unavailable || 0, tone: 'danger' },
])
const averageTokens = computed(() => props.tokenStats?.total?.request_count ? Math.round(props.tokenStats.total.total_tokens / props.tokenStats.total.request_count) : 0)
const rankedUsers = computed(() => [...(props.tokenStats?.by_user || [])].sort((a, b) => b.total_tokens - a.total_tokens).slice(0, 3))
const trendDays = computed(() => props.stats?.execution_trend?.daily_7d || [])
const trendMax = computed(() => Math.max(1, ...trendDays.value.map(day => day.passed + day.failed)))
const hasTrendData = computed(() => trendDays.value.some(day => day.passed + day.failed > 0))
const operationItems = computed(() => [
  { label: '审核积压', description: '待进入正式可执行状态', value: props.stats?.testcases?.by_review_status?.pending_review || 0 },
  { label: '优化中用例', description: '待完善的测试资产', value: props.stats?.testcases?.by_review_status?.needs_optimization || 0 },
  { label: '自动化失败记录', description: '需回看脚本与环境', value: props.stats?.ui_automation?.by_status?.failed || 0 },
  { label: '资源请求量', description: '当前项目的 AI 调用次数', value: props.tokenStats?.total?.request_count || 0 },
])
</script>

<style scoped>
.dashboard-insights {
  --insight-success: #188267;
  --insight-warning: #b87916;
  --insight-danger: #d14d5c;
  --insight-info: #426ce1;
  --insight-subtle: #8391ac;
  --insight-success-soft: #eaf6f1;
  --insight-warning-soft: #fff5e4;
  --insight-danger-soft: #fceef0;
  --insight-info-soft: #edf2ff;
  display: flex; flex-direction: column; gap: 20px; min-width: 0;
  color: var(--theme-text); font-variant-numeric: tabular-nums;
}
.dashboard-insights *, .dashboard-insights *::before, .dashboard-insights *::after { box-sizing: border-box; }
.insights-intro { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 4px 0 0; }
.insights-intro h2 { margin: 0; font-size: 18px; font-weight: 700; }
.insights-intro p { margin: 5px 0 0; color: var(--theme-text-tertiary); font-size: 12px; }
.insights-context { display: inline-flex; align-items: center; gap: 7px; flex: none; color: var(--theme-text-tertiary); font-size: 11px; }
.insights-context > span { width: 6px; height: 6px; border-radius: 50%; background: var(--theme-accent); }
.insights-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: stretch; }
.insights-block { display: flex; flex-direction: column; min-width: 0; padding: 22px; border: 1px solid var(--theme-border); border-radius: 12px; background: var(--theme-surface); box-shadow: var(--theme-card-shadow); }
.insights-heading { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; min-height: 53px; margin-bottom: 18px; }
.insights-heading-copy { min-width: 0; }
.insights-heading h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; line-height: 1.5; font-weight: 700; }
.insights-heading h3 > svg { width: 17px; height: 17px; color: var(--theme-text-tertiary); flex: none; }
.insights-heading p { margin: 5px 0 0; color: var(--theme-text-tertiary); font-size: 11px; line-height: 1.6; }
.insights-badge { display: inline-flex; align-items: center; min-height: 24px; padding: 3px 8px; border-radius: 6px; background: var(--theme-surface-soft); color: var(--theme-text-secondary); font-size: 11px; font-weight: 600; white-space: nowrap; }
.insights-muted { color: var(--theme-text-tertiary); font-size: 11px; }
.insights-note { display: flex; align-items: flex-start; gap: 6px; margin-top: auto; padding-top: 16px; color: var(--theme-text-tertiary); font-size: 10px; line-height: 1.6; }
.insights-note svg { margin-top: 2px; flex: none; }
.insights-queue, .insights-risk-list, .insights-automation-list { display: flex; flex-direction: column; }
.insights-queue-item { display: flex; align-items: center; gap: 12px; padding: 13px 0; }
.insights-queue-item:first-child { padding-top: 0; }
.insights-queue-item + .insights-queue-item, .insights-automation-item + .insights-automation-item { border-top: 1px solid var(--theme-border); }
.insights-symbol { display: grid; place-items: center; width: 32px; height: 32px; flex: none; border-radius: 9px; }
.insights-symbol svg { width: 17px; height: 17px; }
.insights-item-copy { min-width: 0; flex: 1; }
.insights-item-copy h4 { margin: 0; color: var(--theme-text); font-size: 13px; font-weight: 600; line-height: 1.6; }
.insights-item-copy p { margin: 3px 0 0; color: var(--theme-text-tertiary); font-size: 11px; line-height: 1.6; overflow-wrap: anywhere; }
.insights-item-number { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; min-width: 36px; max-width: 44%; overflow-wrap: anywhere; }
.insights-item-number strong { color: var(--theme-text); font-size: 23px; font-weight: 700; line-height: 1.25; }
.insights-item-number > span { color: var(--theme-text-tertiary); font-size: 10px; }
.insights-risk-overview { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; padding: 14px; border-radius: 9px; background: var(--theme-surface-soft); }
.insights-risk-value { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.insights-risk-value strong { font-size: 30px; font-weight: 750; line-height: 1.2; }
.insights-risk-value > span { color: var(--theme-text-tertiary); font-size: 10px; }
.insights-risk-signals { display: flex; flex-direction: column; gap: 9px; color: var(--theme-text-secondary); font-size: 11px; }
.insights-risk-signals > span { display: flex; align-items: center; gap: 6px; }
.insights-risk-signals b { margin-left: auto; font-size: 12px; }
.insights-dot { display: inline-block; width: 6px; height: 6px; flex: none; border-radius: 50%; }
.insights-risk-list { gap: 13px; }
.insights-metric-label { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 7px; font-size: 11px; color: var(--theme-text-secondary); }
.insights-metric-label strong { color: var(--theme-text); font-size: 12px; }
.insights-meter { height: 5px; overflow: hidden; border-radius: 3px; background: var(--theme-surface-soft); }
.insights-meter > span { display: block; height: 100%; border-radius: inherit; }
.insights-automation-item { display: flex; align-items: center; gap: 12px; padding: 20px 0; }
.insights-automation-item:first-child { padding-top: 5px; }
.insights-platform { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border: 1px solid var(--theme-border); border-radius: 9px; color: var(--theme-text-secondary); font-size: 11px; font-weight: 750; letter-spacing: -.4px; }
.insights-automation-name { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.insights-state { padding: 2px 5px; border-radius: 4px; font-size: 9px; font-weight: 500; white-space: nowrap; }
.insights-token { grid-column: span 2; }
.insights-distribution { display: flex; height: 9px; margin: 4px 0 17px; border-radius: 5px; overflow: hidden; background: var(--theme-surface-soft); }
.insights-distribution > span { height: 100%; }
.insights-review-list { display: flex; flex-direction: column; gap: 0; }
.insights-review-item { display: grid; grid-template-columns: minmax(0, 1fr) auto 43px; align-items: center; gap: 12px; min-height: 37px; font-size: 12px; }
.insights-review-item > span:first-child { display: flex; align-items: center; gap: 9px; color: var(--theme-text-secondary); }
.insights-review-item > span:last-child { text-align: right; }
.insights-review-item strong { font-size: 13px; font-weight: 600; }
.insights-period { display: flex; gap: 2px; padding: 3px; border: 1px solid var(--theme-border); border-radius: 7px; background: var(--theme-surface-soft); }
.insights-period button { min-width: 32px; padding: 3px 8px; border: 0; border-radius: 4px; color: var(--theme-text-tertiary); background: transparent; font: inherit; font-size: 11px; cursor: pointer; }
.insights-period button[aria-pressed='true'] { background: var(--theme-surface); color: var(--theme-accent); box-shadow: 0 1px 3px rgb(20 40 70 / 8%); font-weight: 700; }
.insights-token-overview { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 24px; padding: 2px 0 20px; }
.insights-token-total { min-width: 0; }
.insights-token-total > strong { display: block; margin-top: 8px; color: var(--theme-text); font-size: clamp(24px, 2.4vw, 34px); font-weight: 750; line-height: 1.3; overflow-wrap: anywhere; letter-spacing: -.8px; }
.insights-token-io { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 9px; color: var(--theme-text-tertiary); font-size: 10px; }
.insights-token-io b { margin-left: 3px; color: var(--theme-text-secondary); font-weight: 500; }
.insights-token-metrics { display: flex; flex-wrap: wrap; align-content: center; gap: 12px; margin: 0; padding-left: 22px; border-left: 1px solid var(--theme-border); }
.insights-token-metrics > div { flex: 1 0 auto; min-width: 0; }
.insights-token-metrics dt { color: var(--theme-text-tertiary); font-size: 11px; }
.insights-token-metrics dd { margin: 10px 0 0; color: var(--theme-text); font-size: 21px; line-height: 1.4; font-weight: 650; white-space: nowrap; }
.insights-token-metrics small { display: block; margin-top: 2px; color: var(--theme-text-tertiary); font-size: 9px; font-weight: 400; }
.insights-ranking { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--theme-border); }
.insights-ranking-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.insights-ranking-heading h4 { margin: 0; font-size: 12px; font-weight: 600; }
.insights-ranking-list { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0 0; padding: 0; list-style: none; }
.insights-ranking-list li { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; gap: 5px 8px; flex: 1 1 140px; min-width: 0; align-items: center; font-size: 11px; }
.insights-ranking-list li > .insights-muted { grid-column: 3; font-size: 9px; text-align: right; }
.insights-rank { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 5px; background: var(--theme-surface-soft); color: var(--theme-text-tertiary); font-size: 10px; grid-row: span 2; }
.insights-user { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.insights-ranking-list strong { font-weight: 600; overflow-wrap: anywhere; }
.insights-ranking-empty { padding: 18px 0 4px; color: var(--theme-text-tertiary); font-size: 11px; line-height: 1.8; }
.insights-execution { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
.insights-chart-legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 3px; }
.insights-chart-legend > span { display: flex; align-items: center; gap: 7px; color: var(--theme-text-secondary); font-size: 11px; }
.insights-trend-summary { display: flex; align-items: baseline; flex-wrap: wrap; gap: 12px 20px; margin: 0 0 24px; color: var(--theme-text-tertiary); font-size: 11px; }
.insights-trend-summary strong { margin: 0 5px 0 7px; color: var(--theme-text); font-size: 23px; font-weight: 700; }
.insights-trend-summary small { font-size: 10px; }
.insights-trend-summary b { margin-left: 5px; font-size: 13px; }
.insights-chart { display: flex; gap: 12px; margin: auto 0 0; padding-top: 10px; height: 194px; }
.insights-chart-scale { display: flex; flex-direction: column; justify-content: space-between; flex: 0 0 auto; min-width: 20px; padding-bottom: 24px; color: var(--theme-text-tertiary); font-size: 10px; }
.insights-chart-plot { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; width: 100%; min-width: 0; }
.insights-chart-day { display: flex; flex-direction: column; min-width: 0; gap: 10px; }
.insights-chart-slot { position: relative; display: flex; justify-content: flex-end; align-items: center; flex-direction: column; height: 155px; border-bottom: 1px solid var(--theme-border); background: repeating-linear-gradient(to top, transparent 0, transparent calc(50% - 1px), var(--theme-border) calc(50% - 1px), var(--theme-border) 50%); }
.insights-chart-stack { display: flex; flex-direction: column; width: min(32px, 60%); max-height: 100%; flex: 0 0 auto; overflow: hidden; border-radius: 4px 4px 0 0; }
.insights-chart-stack > span { flex-basis: 0; min-height: 0; }
.insights-chart-count { position: absolute; top: -17px; color: var(--theme-text-secondary); font-size: 10px; }
.insights-chart-date { color: var(--theme-text-tertiary); font-size: 10px; text-align: center; white-space: nowrap; }
.insights-empty { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 9px; flex: 1; min-height: 190px; color: var(--theme-text-tertiary); text-align: center; font-size: 11px; }
.insights-empty svg { width: 30px; height: 30px; margin-bottom: 3px; color: var(--theme-text-tertiary); opacity: .55; }
.insights-empty strong { color: var(--theme-text-secondary); font-size: 13px; font-weight: 500; }
.insights-operations { margin: 0; }
.insights-operations > div { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 13px 0; }
.insights-operations > div:first-child { padding-top: 0; }
.insights-operations > div + div { border-top: 1px solid var(--theme-border); }
.insights-operations dt { font-size: 12px; font-weight: 600; }
.insights-operations p { margin: 4px 0 0; color: var(--theme-text-tertiary); font-size: 11px; }
.insights-operations dd { max-width: 45%; margin: 0; font-size: 23px; line-height: 1.3; font-weight: 650; overflow-wrap: anywhere; text-align: right; }
.tone-success { color: var(--insight-success); background: var(--insight-success-soft); }
.tone-warning { color: var(--insight-warning); background: var(--insight-warning-soft); }
.tone-danger { color: var(--insight-danger); background: var(--insight-danger-soft); }
.tone-info { color: var(--insight-info); background: var(--insight-info-soft); }
.tone-neutral, .tone-subtle { color: var(--theme-text-tertiary); background: var(--theme-surface-soft); }
:is(.insights-dot, .insights-meter > span, .insights-distribution > span, .insights-chart-stack > span).tone-success { background: var(--insight-success); }
:is(.insights-dot, .insights-meter > span, .insights-distribution > span, .insights-chart-stack > span).tone-warning { background: var(--insight-warning); }
:is(.insights-dot, .insights-meter > span, .insights-distribution > span, .insights-chart-stack > span).tone-danger { background: var(--insight-danger); }
:is(.insights-dot, .insights-meter > span, .insights-distribution > span, .insights-chart-stack > span).tone-info { background: var(--insight-info); }
:is(.insights-dot, .insights-distribution > span).tone-subtle { background: var(--insight-subtle); }
.insights-success-text { color: var(--insight-success); }
.insights-danger-text { color: var(--insight-danger); }
:global(html[data-theme='black'] .dashboard-insights) { --insight-success: #66c7a5; --insight-warning: #e2b45c; --insight-danger: #f08896; --insight-info: #8aa9ff; --insight-success-soft: #1c3a34; --insight-warning-soft: #39321f; --insight-danger-soft: #3e2834; --insight-info-soft: #283652; }
@container workspace (max-width: 1050px) {
  .insights-row { gap: 16px; }
  .insights-primary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .insights-primary > :last-child { grid-column: 1 / -1; }
  .insights-primary .insights-automation-list { flex-direction: row; gap: 20px; }
  .insights-automation-item { flex: 1; min-width: 0; padding: 6px 0; align-items: flex-start; }
  .insights-automation-item + .insights-automation-item { padding-left: 20px; border-top: 0; border-left: 1px solid var(--theme-border); }
  .insights-automation-item .insights-item-number { max-width: 40%; }
  .insights-resources { grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); }
  .insights-token { grid-column: auto; }
  .insights-token-overview { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .insights-token-metrics { padding: 0; border: 0; }
  .insights-execution { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); }
}
@container workspace (max-width: 680px) {
  .dashboard-insights { gap: 16px; }
  .insights-context { display: none; }
  .insights-row { grid-template-columns: minmax(0, 1fr); }
  .insights-block { padding: 18px; }
  .insights-primary > :last-child { grid-column: auto; }
  .insights-primary .insights-automation-list { flex-direction: column; gap: 0; }
  .insights-automation-item { padding: 16px 0; align-items: center; }
  .insights-automation-item + .insights-automation-item { padding-left: 0; border-left: 0; border-top: 1px solid var(--theme-border); }
  .insights-token-overview { grid-template-columns: minmax(0, 1fr); }
  .insights-token-metrics { flex-direction: column; flex-wrap: nowrap; align-content: stretch; gap: 12px; }
  .insights-token-metrics > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .insights-token-metrics dd { margin: 0; text-align: right; }
  .insights-token-metrics small { display: inline; margin-left: 5px; }
  .insights-ranking-list { flex-direction: column; }
  .insights-ranking-list li { flex-basis: auto; }
  .insights-chart-plot { gap: 4px; }
  .insights-chart-count { display: none; }
  .insights-chart { gap: 8px; }
  .insights-chart-legend { gap: 10px; }
}
</style>
