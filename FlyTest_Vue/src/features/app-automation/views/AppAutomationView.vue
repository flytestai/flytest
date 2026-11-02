<template>
  <div class="app-automation-shell fc-page">
    <WorkspaceModuleHeader
      title="APP 自动化"
      description="管理设备与应用资产，编排场景并跟踪执行质量"
      :tabs="moduleTabs"
      :active-key="activeDefinition.key"
    />
    <div class="app-automation-layout">
      <component :is="activeDefinition.component" />
    </div>
  </div>
</template>

<script setup lang="ts">
import WorkspaceModuleHeader from "@/components/workspace/WorkspaceModuleHeader.vue";
import { computed } from "vue";
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

const tabDefinitions = appAutomationTabDefinitions;
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
