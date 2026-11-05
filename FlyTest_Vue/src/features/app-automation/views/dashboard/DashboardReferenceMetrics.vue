<template>
  <div class="app-overview-metrics">
    <button v-for="metric in metrics" :key="metric.label" type="button" class="app-overview-metric" :class="metric.tone" :aria-label="`${metric.label}：${metric.value}，${metric.hint}`" @click="$emit('navigate', metric.target)">
      <span class="app-overview-metric__icon"><component :is="metric.icon" /></span>
      <span class="app-overview-metric__copy"><span>{{ metric.label }}</span><strong>{{ unavailable ? '—' : metric.value }}</strong><small>{{ metric.hint }}</small></span>
    </button>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { IconMobile, IconLayers, IconFile, IconPlayArrow, IconCheckCircle, IconBug } from '@arco-design/web-vue/es/icon'
import { calculatePassRate, formatQualityPercent, passRateTone } from '@/utils/qualityStatus'
import type { AppDashboardStatistics } from '../../types'

const props = defineProps<{ statistics: AppDashboardStatistics; pendingBugs: number | null; unavailable: boolean }>()
defineEmits<{ navigate: [target: string] }>()
const rate = computed(() => calculatePassRate(props.statistics.executions.passed, props.statistics.executions.passed + props.statistics.executions.failed))
const metrics = computed(() => [
  { label: '设备总数', value: props.statistics.devices.total, hint: '共享测试设备', icon: IconMobile, target: 'devices', tone: '' },
  { label: '应用包', value: props.statistics.packages.total, hint: '当前项目应用资产', icon: IconLayers, target: 'packages', tone: '' },
  { label: '测试用例', value: props.statistics.test_cases.total, hint: '可复用的自动化用例', icon: IconFile, target: 'test-cases', tone: '' },
  { label: '执行总数', value: props.statistics.executions.total, hint: `运行中 ${props.statistics.executions.running}`, icon: IconPlayArrow, target: 'executions', tone: '' },
  { label: '通过率', value: formatQualityPercent(rate.value), hint: '按已完成的通过／失败结果', icon: IconCheckCircle, target: 'reports', tone: 'quality-' + passRateTone(rate.value) },
  { label: '待处理缺陷', value: props.pendingBugs ?? '—', hint: '当前项目 · 未解决及待验证', icon: IconBug, target: 'bugs', tone: props.pendingBugs ? 'quality-danger' : '' },
])
</script>
