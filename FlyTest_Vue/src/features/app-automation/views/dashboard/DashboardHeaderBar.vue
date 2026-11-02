<template>
  <WorkspacePageHeader>
        <template #title>APP 自动化总控台</template>
        <template #description>集中查看当前项目的 AI 编排状态、定时任务、执行健康度和最近回归动作。</template>
        <template #actions><div class="page-actions">
      <a-tag :color="serviceStatusTagColor">{{ serviceStatusTagText }}</a-tag>
      <span class="header-tip" :title="'最近刷新：' + lastUpdatedText">{{ lastUpdatedText === '-' ? '等待首次更新' : '更新于 ' + lastUpdatedText }}</span>
      <a-button class="fc-ai-action" :loading="aiStatusLoading" @click="emit('refresh-ai-status')">刷新 AI 状态</a-button>
      <a-button :loading="loading" @click="emit('refresh-dashboard')">刷新总览</a-button>
    </div></template>
      </WorkspacePageHeader>
</template>

<script setup lang="ts">
import WorkspacePageHeader from '@/components/workspace/WorkspacePageHeader.vue'
import type { DashboardHeaderBarEmits } from './dashboardEventModels'
import type { DashboardHeaderBarProps } from './dashboardViewModels'

defineProps<DashboardHeaderBarProps>()

const emit = defineEmits<DashboardHeaderBarEmits>()
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
  border: 1px solid var(--theme-card-border);
  border-radius: 12px;
  background:
    var(--theme-surface);
  box-shadow: var(--theme-card-shadow);
}

.page-header h3 {
  margin: 0;
  color: var(--theme-text);
  font-size: 22px;
  line-height: 1.2;
}

.page-header p {
  max-width: 760px;
  margin: 8px 0 0;
  color: var(--theme-text-secondary);
  line-height: 1.7;
}

.page-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  align-items: center;
}
@media(max-width:767px) { .page-actions { justify-content:flex-start; } .header-tip { display:none; } }

.header-tip {
  color: var(--theme-text-secondary);
  font-size: 13px;
}

.page-header :deep(.arco-btn) {
  min-width: 104px;
  border-radius: 12px;
}

.page-header :deep(.arco-tag) {
  border-radius: 999px;
  padding-inline: 12px;
}

@media (max-width: 900px) {
  .page-header {
    flex-direction: column;
    padding: 16px;
  }
}
</style>
