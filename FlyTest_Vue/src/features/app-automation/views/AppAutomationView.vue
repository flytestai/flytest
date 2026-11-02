<template>
  <div class="app-automation-shell fc-page">
    <WorkspaceModuleHeader
      title="APP 自动化"
      :page-title="activeDefinition.key === 'overview' ? 'APP 自动化概览' : activeDefinition.title"
      :description="pageDescriptions[activeDefinition.key]"
      :tabs="moduleTabs"
      :active-key="activeDefinition.key"
    />
    <div class="app-automation-layout">
      <div v-if="projectStore.loading && !projectStore.currentProjectId" class="fc-app-project-loading" role="status" aria-label="正在加载项目"><a-skeleton :animation="true"><a-skeleton-line :rows="4" /></a-skeleton></div>
      <component v-else :is="activeDefinition.component" />
    </div>
  </div>
</template>

<script setup lang="ts">
import WorkspaceModuleHeader from "@/components/workspace/WorkspaceModuleHeader.vue";
import { computed, provide } from "vue";
import { workspaceCompactHeadingKey } from '@/components/workspace/workspaceContext';
import { useRoute } from "vue-router";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";

import {
  appAutomationTabDefinitions,
  normalizeAppAutomationTab,
} from "./appAutomationTabs";

const route = useRoute();
const authStore = useAuthStore();
const projectStore = useProjectStore();
provide(workspaceCompactHeadingKey, computed(() => true));

const tabDefinitions = appAutomationTabDefinitions;
const pageDescriptions: Record<string, string> = {
  overview: '掌握设备、执行与任务状态，快速开始一次自动化回归',
  devices: '连接与管理测试设备，查看在线状态和调试环境',
  packages: '集中管理应用版本，为测试设备准备可追溯的安装包',
  elements: '沉淀可复用的定位元素与图像资产',
  'scene-builder': '组合测试步骤，构建可复用的自动化场景',
  'test-cases': '管理自动化用例，发起执行并跟踪验证结果',
  suites: '组织回归用例，统一管理执行范围与测试计划',
  executions: '追踪执行进度，定位失败步骤与运行日志',
  'scheduled-tasks': '安排周期回归，管理触发规则与任务状态',
  notifications: '查看任务通知、发送记录与处理结果',
  reports: '汇总自动化结果，评估执行质量与失败风险',
  settings: '配置运行环境，检查服务、ADB 与执行能力',
};
const tabPermissions: Record<string, string> = {
  overview: "overview",
  devices: "device",
  packages: "package",
  elements: "element",
  "scene-builder": "scenebuilder",
  "test-cases": "testcase",
  suites: "suite",
  executions: "execution",
  "scheduled-tasks": "scheduledtask",
  notifications: "notification",
  reports: "report",
  settings: "settings",
};
const moduleTabs = computed(() =>
  tabDefinitions
    .filter(
      (tab) =>
        projectStore.projectList.length > 0 ||
        authStore.hasPermission(
          "app_automation.view_appautomation" + tabPermissions[tab.key],
        ),
    )
    .map((tab) => ({
      key: tab.key,
      label: tab.title,
      to: { path: "/app-automation", query: { tab: tab.key } },
    })),
);
const activeDefinition = computed(
  () =>
    tabDefinitions.find(
      (tab) => tab.key === normalizeAppAutomationTab(route.query.tab),
    ) ?? tabDefinitions[0],
);
</script>

<style scoped>
.app-automation-shell,
.app-automation-layout {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.fc-app-project-loading { padding:24px 0; }
:deep(.page-shell),
:deep(.dashboard-view) {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  min-height: 0;
  padding: 0;
}
:deep(.builder-grid) {
  align-items: start;
  grid-template-columns: 0.94fr 1.26fr 1.02fr;
  gap: 16px;
  min-height: 620px;
}
:deep(.report-tabs .arco-tabs-nav) {
  margin-bottom: 16px;
}
:deep(.report-tabs .arco-tabs-tab-active) {
  background: var(--theme-accent-soft);
}
@container workspace (max-width:1050px) {
  :deep(.builder-grid) {
    grid-template-columns: 1fr;
  }
}
</style>
