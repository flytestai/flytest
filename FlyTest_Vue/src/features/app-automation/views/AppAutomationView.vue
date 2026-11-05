<template>
  <div class="app-automation-shell fc-page">
    <header v-if="heroCopy" class="app-overview-hero" :class="{ 'app-devices-hero': activeDefinition.key === 'devices' }">
      <span class="app-overview-hero__icon"><icon-scan v-if="activeDefinition.key === 'elements'"/><icon-archive v-else-if="activeDefinition.key === 'packages'"/><icon-layers v-else-if="activeDefinition.key === 'suites'"/><icon-calendar v-else-if="activeDefinition.key === 'scheduled-tasks'"/><icon-notification v-else-if="activeDefinition.key === 'notifications'"/><icon-bar-chart v-else-if="activeDefinition.key === 'reports'"/><icon-storage v-else-if="activeDefinition.key === 'settings'"/><icon-mobile v-else/></span>
      <div><h2>{{heroCopy.title}}</h2><p>{{heroCopy.description}}</p></div>
      <svg v-if="activeDefinition.key === 'packages'" class="app-overview-hero__art" viewBox="0 0 330 140" aria-hidden="true"><ellipse cx="198" cy="130" rx="90" ry="8" fill="#d2eee8"/><path d="m145 44 55-28 55 28-55 29z" fill="#4dcfb8"/><path d="m145 44 55 29v56l-55-29z" fill="#00a38e"/><path d="m200 73 55-29v56l-55 29z" fill="#8bded0"/><path d="m172 30 56 29v55l-15 8V67l-56-29z" fill="#e1f7f1"/><g fill="#fff" font-size="14" font-family="sans-serif" font-weight="700"><rect x="87" y="51" width="48" height="30" rx="8" fill="#5dd5c3" transform="rotate(15 110 65)"/><text x="95" y="72">APK</text><rect x="271" y="71" width="48" height="30" rx="8" fill="#88b8e6" transform="rotate(15 295 86)"/><text x="279" y="92">IPA</text></g></svg>
      <svg v-else-if="activeDefinition.key === 'suites'" class="app-overview-hero__art" viewBox="0 0 330 140" aria-hidden="true"><ellipse cx="215" cy="132" rx="85" ry="9" fill="#c6ebe3"/><path d="m143 103 72-35 72 35-72 35z" fill="#b7eee1"/><path d="m143 83 72-35 72 35-72 35z" fill="#35c7b3"/><path d="m143 61 72-35 72 35-72 35z" fill="#04ab98"/><path d="m143 38 72-35 72 35-72 35z" fill="#d5f7ec" stroke="#fff" stroke-width="4"/><circle cx="215" cy="35" r="16" fill="#008f83"/><path d="m207 35 6 6 11-13" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="m105 72 10-5 10 5-10 5z" fill="#83decd"/><path d="m292 102 9-5 9 5-9 5z" fill="#a4e8da"/></svg>
      <svg v-else-if="activeDefinition.key === 'scheduled-tasks'" class="app-overview-hero__art" viewBox="0 0 330 140" aria-hidden="true"><g transform="translate(170 4) rotate(12 55 65)"><rect x="0" y="10" width="115" height="130" rx="15" fill="#99e4d7"/><rect x="7" y="17" width="101" height="115" rx="10" fill="#e3faf3"/><path d="M7 49h101" stroke="#9de7d9" stroke-width="4"/><path d="M30 25V9a8 8 0 0 1 16 0v16m25 0V9a8 8 0 0 1 16 0v16" fill="none" stroke="#00a18e" stroke-width="7" stroke-linecap="round"/><path d="m33 85 17 17 34-39" fill="none" stroke="#00ac98" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g><circle cx="135" cy="90" r="12" fill="#b9eee2"/></svg>
      <svg v-else-if="activeDefinition.key === 'notifications'" class="app-overview-hero__art" viewBox="0 0 330 140" aria-hidden="true"><g transform="translate(166 28) rotate(10 55 55)"><rect x="0" y="25" width="115" height="88" rx="12" fill="#73daca"/><rect x="12" y="0" width="92" height="90" rx="9" fill="#c7f3e9"/><path d="M27 21h60M27 34h55M27 47h45" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="m0 38 57 45 58-45v75H0z" fill="#15baa5"/><path d="m0 113 57-42 58 42z" fill="#4bcdb8"/></g><circle cx="270" cy="34" r="25" fill="#008f83"/><path d="M260 40h20l-3-7v-6a7 7 0 0 0-14 0v6zm8 6h4m-2-28v-3" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="123" y="75" width="23" height="23" rx="7" fill="#c2f2e7" transform="rotate(15 135 87)"/></svg>
      <svg v-else-if="activeDefinition.key === 'reports'" class="app-overview-hero__art" viewBox="0 0 330 140" aria-hidden="true"><g transform="translate(165 8) rotate(17 60 70)"><rect width="115" height="150" rx="18" fill="#a1e8da"/><rect x="7" y="8" width="101" height="134" rx="12" fill="#e5faf3"/><path d="M28 34h60M28 47h44" stroke="#9fe4d4" stroke-width="6" stroke-linecap="round"/><rect x="26" y="89" width="15" height="35" rx="4" fill="#63d7bd"/><rect x="50" y="71" width="15" height="53" rx="4" fill="#1bb9a1"/><rect x="74" y="56" width="15" height="68" rx="4" fill="#008f83"/></g><circle cx="270" cy="24" r="19" fill="#00aa95"/><path d="m261 24 6 6 12-13" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="125" y="70" width="23" height="23" rx="7" fill="#bcf0e3" transform="rotate(15 135 82)"/></svg>
      <svg v-else-if="activeDefinition.key === 'settings'" class="app-overview-hero__art" viewBox="0 0 330 140" aria-hidden="true"><g transform="translate(170 28) rotate(12 55 55)"><rect x="0" y="65" width="110" height="40" rx="10" fill="#55cdb9"/><rect x="0" y="35" width="110" height="40" rx="10" fill="#1db59e"/><rect x="0" y="5" width="110" height="40" rx="10" fill="#94e3d3"/><g fill="#e0faf2"><circle cx="19" cy="22" r="4"/><circle cx="19" cy="52" r="4"/><circle cx="19" cy="82" r="4"/><rect x="74" y="19" width="22" height="5" rx="2"/><rect x="74" y="49" width="22" height="5" rx="2"/><rect x="74" y="79" width="22" height="5" rx="2"/></g></g><circle cx="270" cy="23" r="19" fill="#00a78f"/><path d="m262 23 5 5 10-11" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><rect x="125" y="77" width="24" height="24" rx="7" fill="#b9eddf" transform="rotate(15 137 89)"/></svg>
      <svg v-else class="app-overview-hero__art" viewBox="0 0 330 140" aria-hidden="true"><ellipse cx="194" cy="132" rx="125" ry="10" fill="#c3ebe5"/><g transform="translate(145,-20) rotate(28 55 85)"><rect width="102" height="180" rx="20" fill="#d6f2ee" stroke="#ffffff" stroke-width="5"/><rect x="8" y="8" width="86" height="164" rx="14" fill="#00a798"/><rect x="33" y="12" width="36" height="5" rx="3" fill="#a4e6dd"/><path d="m35 89 14 14 28-31" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g><rect x="75" y="35" width="32" height="32" rx="10" fill="#aaebe0" transform="rotate(-12 90 50)"/><path d="m85 51 5-6 5 6m-5-6v13" fill="none" stroke="#fff" stroke-width="2"/></svg>
    </header>
    <WorkspaceModuleHeader
      :navigation-only="Boolean(heroCopy)"
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
import { IconMobile, IconArchive, IconScan, IconLayers, IconCalendar, IconNotification, IconBarChart, IconStorage } from '@arco-design/web-vue/es/icon';
import './dashboard/app-overview.css';
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
const heroDefinitions: Record<string, {title:string;description:string}> = {
  overview: {title:'APP 自动化',description:'面向移动端的自动化测试与质量验证，支持设备管理、场景编排与定时执行。'},
  devices: {title:'设备管理',description:'管理测试设备，查看在线状态、设备信息与使用情况'},
  packages: {title:'应用包',description:'管理移动应用安装包（APK / AAB / IPA），支持版本管理、安装与分发'},
  elements: {title:'元素管理',description:'维护页面元素定位，支持多种定位方式与跨版本复用'},
  'scheduled-tasks': {title:'定时任务',description:'安排周期回归，管理触发规则与任务状态'},
  notifications: {title:'通知日志',description:'查看测试执行、任务调度等通知消息的发送记录与结果'},
  settings: {title:'环境设置',description:'配置与管理自动化运行环境，检查设备、网络与执行器状态'},
  reports: {title:'执行报告',description:'查看自动化测试结果、步骤通过情况与问题分析，支持报告查看与摘要导出'},
  executions: {title:'执行记录',description:'查看自动化任务的执行历史、运行详情与日志'},
  suites: {title:'测试套件',description:'管理测试用例集合，按业务、版本或发布周期组织并执行'},
  'test-cases': {title:'测试用例',description:'管理 APP 自动化测试用例，支持分组、批量维护与执行'},
  'scene-builder': {title:'场景编排',description:'通过可视化流程编排，组合元素与步骤，构建可复用的自动化测试场景'},
};
const heroCopy = computed(() => heroDefinitions[activeDefinition.value.key]);
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
