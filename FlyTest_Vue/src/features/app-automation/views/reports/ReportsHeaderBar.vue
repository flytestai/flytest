<template>
  <WorkspacePageHeader>
        <template #title>执行报告</template>
        <template #description>从套件报告和执行明细两个维度查看 APP 自动化结果，支持快速定位报告、日志和执行证据。</template>
        <template #actions><a-space>
      <span class="header-tip">最近刷新：{{ lastUpdatedText }}</span>
      <a-button :loading="loading" @click="emit('refresh')">刷新</a-button>
    </a-space></template>
      </WorkspacePageHeader>
</template>

<script setup lang="ts">
import WorkspacePageHeader from '@/components/workspace/WorkspacePageHeader.vue'
import type { ReportsHeaderBarEmits } from './reportEventModels'
import type { ReportsHeaderBarProps } from './reportViewModels'

defineProps<ReportsHeaderBarProps>()

const emit = defineEmits<ReportsHeaderBarEmits>()
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
  border: 1px solid var(--theme-card-border);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(var(--theme-accent-rgb), 0.08), rgba(var(--theme-accent-rgb), 0.02)),
    var(--theme-card-bg);
  box-shadow: var(--theme-card-shadow);
}

.page-header h3 {
  margin: 0;
  color: var(--theme-text);
  font-size: 22px;
  line-height: 1.2;
}

.page-header p,
.header-tip {
  color: var(--theme-text-secondary);
}

.page-header p {
  max-width: 760px;
  margin: 8px 0 0;
  line-height: 1.7;
}

.header-tip {
  font-size: 13px;
}

.page-header :deep(.arco-btn) {
  min-width: 92px;
  border-radius: 12px;
}

@media (max-width: 900px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
  }
}
</style>
