<template>
  <div class="stats-grid fc-metric-grid">
    <a-card class="stat-card fc-metric fc-panel">
      <div class="stat-label">设备在线</div>
      <div class="stat-value">{{ statistics.devices.online }}</div>
      <div class="stat-meta">总设备 {{ statistics.devices.total }} / 锁定 {{ statistics.devices.locked }}</div>
    </a-card>
    <a-card class="stat-card fc-metric fc-panel">
      <div class="stat-label">应用包</div>
      <div class="stat-value">{{ statistics.packages.total }}</div>
      <div class="stat-meta">当前项目已登记应用</div>
    </a-card>
    <a-card class="stat-card fc-metric fc-panel">
      <div class="stat-label">元素资产</div>
      <div class="stat-value">{{ statistics.elements.total }}</div>
      <div class="stat-meta">用于定位与页面编排</div>
    </a-card>
    <a-card class="stat-card fc-metric fc-panel">
      <div class="stat-label">测试用例</div>
      <div class="stat-value">{{ statistics.test_cases.total }}</div>
      <div class="stat-meta">通过率 <span :class="'quality-' + passRateTone(statistics.executions.total ? statistics.executions.pass_rate : null)">{{ formatQualityPercent(statistics.executions.total ? statistics.executions.pass_rate : null) }}</span></div>
    </a-card>
    <a-card class="stat-card fc-metric fc-panel">
      <div class="stat-label">激活任务</div>
      <div class="stat-value">{{ activeTaskCount }}</div>
      <div class="stat-meta">暂停 {{ pausedTaskCount }} / 失败 {{ failedTaskCount }}</div>
    </a-card>
    <a-card class="stat-card fc-metric fc-panel fc-ai-metric">
      <div class="stat-label">AI 智能模式</div>
      <div class="stat-value stat-value--state">{{ aiReady ? '已启用' : aiHasConfig ? '待就绪' : '未配置' }}</div>
      <div class="stat-meta">{{ aiCapabilityDisplay }}</div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { passRateTone, formatQualityPercent } from '@/utils/qualityStatus'
import type { DashboardStatsGridProps } from './dashboardViewModels'

defineProps<DashboardStatsGridProps>()
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.stat-card {
  position: relative;
  overflow: hidden;
  background: var(--theme-card-bg);
  border: 1px solid var(--theme-card-border);
  box-shadow: var(--theme-card-shadow);
  border-radius: 12px;
}

.stat-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: none;
  pointer-events: none;
}

.stat-card :deep(.arco-card-body) {
  min-height: 96px;
  padding: 20px;
}

.stat-label {
  color: var(--theme-text-secondary);
  font-size: 13px;
  letter-spacing: 0.2px;
}

.stat-value {
  margin-top: 10px;
  font-size: 32px;
  font-weight: 700;
  color: var(--theme-text);
  line-height: 1.1;
}

.stat-meta {
  margin-top: 8px;
  color: var(--theme-text-tertiary);
  font-size: 12px;
  line-height: 1.65;
}
.stat-value--state { font-size: 22px; line-height: 1.5; }

@media (max-width: 900px) {
  .stat-card :deep(.arco-card-body) {
    min-height: 96px;
    padding: 18px;
  }
}
@container workspace (min-width: 1400px) {
  .stats-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
}
@container workspace (max-width: 680px) {
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container workspace (max-width: 420px) {
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
