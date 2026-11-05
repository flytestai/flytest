<template>
  <div class="app-overview-charts">
    <section class="app-overview-panel app-trend-panel" aria-label="执行趋势">
      <header><h3><icon-bar-chart /> 执行趋势</h3><a-select v-model="days" aria-label="趋势统计时间范围" style="width:112px"><a-option :value="7">近 7 天</a-option><a-option :value="30">近 30 天</a-option></a-select></header>
      <div class="app-chart-legend"><span><i class="app-legend-bar" />执行数</span><span><i class="app-legend-line" />通过率</span></div>
      <div v-if="series.length" ref="trendViewport" class="app-trend-scroll">
        <svg class="app-trend-svg" :viewBox="`0 0 ${chartWidth} 245`" :style="{width:chartWidth+'px'}" preserveAspectRatio="none" role="img" :aria-label="`近 ${days} 天执行趋势，按 UTC 日期统计`">
          <g v-for="tick in [0,1,2,3,4]" :key="tick" class="app-chart-grid"><line x1="44" :x2="chartWidth-45" :y1="205-tick*43" :y2="205-tick*43" /><text x="34" :y="209-tick*43" text-anchor="end">{{ Math.round(maxCount*tick/4) }}</text><text :x="chartWidth-35" :y="209-tick*43">{{tick*25}}%</text></g>
          <g v-for="(point,index) in series" :key="point.day"><rect :x="x(index)-barWidth/2" :y="205-point.total/maxCount*172" :width="barWidth" :height="point.total/maxCount*172" rx="3" fill="#00a65a" fill-opacity=".22"><title>{{point.day}} · 执行 {{point.total}} 次</title></rect><text :x="x(index)" y="230" text-anchor="middle" class="app-chart-date">{{point.day.slice(5)}}</text></g>
          <template v-for="(point,index) in series" :key="'rate-'+point.day"><line v-if="index && point.rate!==null && series[index-1].rate!==null" :x1="x(index-1)" :y1="rateY(series[index-1].rate!)" :x2="x(index)" :y2="rateY(point.rate)" :stroke="passRateColor(point.rate===100 && series[index-1].rate===100 ? 100 : 0)" stroke-width="2.5" /><circle v-if="point.rate!==null" :cx="x(index)" :cy="rateY(point.rate)" r="4" :fill="passRateColor(point.rate)"><title>{{point.day}} · 通过率 {{formatQualityPercent(point.rate)}}</title></circle></template>
        </svg>
      </div>
      <a-empty v-else description="暂无执行趋势数据" />
      <p class="app-overview-footnote">{{ total ? `所选时段共执行 ${total} 次` : '所选时段暂无执行' }} · 通过率按已完成结果计算 · UTC 日期</p>
      <details v-if="series.length" class="app-chart-data"><summary>查看趋势数据</summary><div><table><thead><tr><th>日期</th><th>执行数</th><th>通过</th><th>失败</th><th>通过率</th></tr></thead><tbody><tr v-for="point in series" :key="point.day"><td>{{point.day}}</td><td>{{point.total}}</td><td>{{point.passed}}</td><td>{{point.failed}}</td><td>{{formatQualityPercent(point.rate)}}</td></tr></tbody></table></div></details>
    </section>
    <section class="app-overview-panel app-device-panel" aria-label="设备运行状态">
      <header><h3>设备运行状态</h3><a-button type="text" size="small" @click="$emit('devices')">管理设备 <icon-right /></a-button></header>
      <div class="app-device-summary">
        <div class="app-device-ring"><svg viewBox="0 0 184 184" role="img" aria-label="共享设备状态分布"><circle cx="92" cy="92" r="68" fill="none" stroke="var(--theme-border)" stroke-width="22" /><circle v-for="part in distribution" :key="part.label" cx="92" cy="92" r="68" fill="none" :stroke="part.color" stroke-width="22" :stroke-dasharray="`${part.fraction* circumference} ${circumference}`" :stroke-dashoffset="-part.offset*circumference" transform="rotate(-90 92 92)"><title>{{part.label}} {{part.count}} 台</title></circle></svg><div><strong>{{ statistics.devices.total }}</strong><span>设备总数</span></div></div>
        <ul class="app-device-legend"><li v-for="part in distribution" :key="part.label"><span><i :style="{background:part.color}" />{{part.label}}</span><strong>{{part.count}}</strong><small>{{ statistics.devices.total ? (part.fraction*100).toFixed(1)+'%' : '—' }}</small></li></ul>
      </div>
      <p class="app-overview-footnote">{{ statistics.devices.total ? '设备为共享资源；忙碌包含已锁定及停止中的设备。' : '暂无设备，连接设备后可查看运行状态。' }}</p>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { IconBarChart, IconRight } from '@arco-design/web-vue/es/icon'
import { calculatePassRate, formatQualityPercent, passRateColor } from '@/utils/qualityStatus'
import type { AppDashboardStatistics } from '../../types'
const props = defineProps<{ statistics: AppDashboardStatistics }>()
defineEmits<{devices: []}>()
const days = ref(7), circumference = Math.PI*136
const trendViewport = ref<HTMLElement>()
const {width:viewportWidth} = useElementSize(trendViewport)
const series = computed(() => (props.statistics.trend || []).slice(-days.value).map(point => ({...point, rate: calculatePassRate(point.passed, point.passed+point.failed)})))
const total = computed(() => series.value.reduce((sum, point) => sum+point.total,0))
const maxCount = computed(() => Math.max(4,Math.ceil(Math.max(0,...series.value.map(point=>point.total))/4)*4))
const chartWidth = computed(() => Math.max(days.value===30 ? 1500 : 520, viewportWidth.value || 760))
const x = (index: number) => 44+(index+.5)*(chartWidth.value-89)/Math.max(1,series.value.length)
const barWidth = computed(() => Math.min(48,(chartWidth.value-89)/Math.max(1,series.value.length)*.55))
const rateY = (rate: number) => 205-rate/100*172
const distribution = computed(() => {
  const device=props.statistics.devices, total=device.total || 0
  const busy=device.busy ?? device.locked
  const parts=[['在线',device.online,'#00a65a'],['忙碌',busy,'#f5a623'],['离线',device.offline ?? 0,'#a7b3c3'],['不可用',device.unavailable ?? Math.max(0,total-device.online-busy-(device.offline || 0)),'#e53935']] as const
  let offset=0
  return parts.map(([label,count,color])=>{const fraction=total?count/total:0; const part={label,count,color,fraction,offset};offset+=fraction;return part})
})
</script>
