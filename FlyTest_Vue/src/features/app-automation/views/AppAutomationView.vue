<template>
  <div class="app-automation-shell fc-page">
    <div class="app-automation-layout">
      <component :is="activeDefinition.component" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { appAutomationTabDefinitions, normalizeAppAutomationTab } from './appAutomationTabs'

const route = useRoute()

const tabDefinitions = appAutomationTabDefinitions
const activeDefinition = computed(
  () => tabDefinitions.find(tab => tab.key === normalizeAppAutomationTab(route.query.tab)) ?? tabDefinitions[0],
)
</script>

<style scoped>
.app-automation-shell,.app-automation-layout{display:flex;flex-direction:column;min-width:0;min-height:0}
:deep(.page-shell),:deep(.dashboard-view){display:flex;flex-direction:column;gap:16px;min-width:0;min-height:0;padding:0}
:deep(.builder-grid){align-items:start;grid-template-columns:.94fr 1.26fr 1.02fr;gap:16px;min-height:620px}
:deep(.report-tabs .arco-tabs-nav){margin-bottom:16px}
:deep(.report-tabs .arco-tabs-tab-active){background:var(--theme-accent-soft)}
@container workspace (max-width:1050px){:deep(.builder-grid){grid-template-columns:1fr}}
</style>
