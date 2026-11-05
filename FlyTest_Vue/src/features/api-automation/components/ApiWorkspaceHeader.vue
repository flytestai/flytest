<template>
  <div class="api-workspace-header">
    <header class="api-page-hero"><div><h2>{{ title }}</h2><p>{{ description }}</p></div><div ref="actions" class="api-page-actions" /></header>
    <section class="asset-metrics api-workspace-metrics" aria-label="接口自动化统计"><article v-for="(metric,index) in metrics" :key="metric.label" class="asset-metric" :class="'asset-metric--' + (metric.tone || 'teal')"><span class="asset-metric__icon" aria-hidden="true"><component :is="icons[index]" /></span><div><h3>{{ metric.label }}</h3><strong>{{ metric.value == null ? '—' : typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value }}</strong></div><svg viewBox="0 0 180 50" preserveAspectRatio="none" aria-hidden="true"><path d="M0 50C50 0 75 50 115 20S180 12 180 12V50Z" fill="currentColor" opacity=".1"/><path d="M40 50C90 45 85 0 145 10S180 20 180 20V50Z" fill="currentColor" opacity=".08"/></svg></article></section>
    <WorkspaceModuleHeader navigation-only title="接口自动化" :tabs="tabs" :active-key="activeKey" />
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { IconCode, IconFile, IconPlayArrow, IconSafe } from '@arco-design/web-vue/es/icon'
import WorkspaceModuleHeader from '@/components/workspace/WorkspaceModuleHeader.vue'
import type { ApiWorkspaceMetric } from '../state/workspacePresentation'
import '@/components/workspace/asset-workspace.css'
import '../views/api-workspace.css'
defineProps<{title:string;description:string;metrics:ApiWorkspaceMetric[];activeKey:string;tabs:Array<{key:string;label:string;to:RouteLocationRaw}>}>()
const actions=ref<HTMLElement>(), icons=[IconCode,IconFile,IconPlayArrow,IconSafe]
defineExpose({actions})
</script>
