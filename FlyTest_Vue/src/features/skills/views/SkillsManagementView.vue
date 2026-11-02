<template>
  <div class="skills-management-view fc-page">
    <WorkspacePageHeader>
        <template #title>Skills 管理</template>
        <template #description>管理项目的 Agent Skills。Skills 是模块化的能力扩展，包含指令和可执行脚本。</template>
      </WorkspacePageHeader>

    <div v-if="currentProjectId" class="skills-container">
      <SkillManager :project-id="currentProjectId" :key="currentProjectId" />
    </div>
    <div v-else class="empty-state">
      <icon-apps style="font-size: 64px; color: #c0c4cc" />
      <p>请先在导航栏选择一个项目</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import WorkspacePageHeader from '@/components/workspace/WorkspacePageHeader.vue'
import { computed } from 'vue'
import { SkillManager } from '@/features/skills'
import { useProjectStore } from '@/store/projectStore'

const projectStore = useProjectStore()
const currentProjectId = computed(() => projectStore.currentProjectId)
</script>

<style scoped>
.skills-management-view {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100%;
  background:
    var(--theme-surface);
  border: 1px solid var(--ui-panel-border);
  border-radius: 12px;
  box-shadow: var(--theme-card-shadow);
}

.page-header {
  margin-bottom: 0;
  padding: 20px 22px;
  border-radius: 12px;
  border: 1px solid rgba(149, 161, 187, 0.14);
  background:
    var(--theme-surface);
  box-shadow: var(--theme-card-shadow);
}

.page-header h2 {
  margin: 0 0 8px 0;
  color: var(--theme-text);
  font-size: 24px;
  font-weight: 700;
}

.page-description {
  color: var(--color-text-2);
  margin: 0;
  max-width: 720px;
  line-height: 1.65;
}

.skills-container {
  background: var(--theme-surface);
  border-radius: 12px;
  border: 1px solid rgba(149, 161, 187, 0.14);
  box-shadow: var(--theme-card-shadow);
  min-height: 400px;
  overflow: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 420px;
  padding: 80px 24px;
  color: var(--color-text-3);
  border-radius: 12px;
  border: 1px solid rgba(149, 161, 187, 0.14);
  background: var(--theme-surface);
  box-shadow: var(--theme-card-shadow);
}
</style>
