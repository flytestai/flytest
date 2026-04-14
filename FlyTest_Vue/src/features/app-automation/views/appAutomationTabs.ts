import { defineAsyncComponent, type Component } from 'vue'

import type { AppAutomationTab } from '../types'

export interface AppAutomationTabDefinition {
  key: AppAutomationTab
  title: string
  component: Component
}

export const appAutomationAllowedTabs: AppAutomationTab[] = [
  'overview',
  'devices',
  'packages',
  'elements',
  'scene-builder',
  'test-cases',
  'suites',
  'executions',
  'scheduled-tasks',
  'notifications',
  'reports',
  'settings',
]

export const appAutomationTabDefinitions: AppAutomationTabDefinition[] = [
  {
    key: 'overview',
    title: '概览',
    component: defineAsyncComponent(() => import('./AppAutomationDashboardView.vue')),
  },
  {
    key: 'devices',
    title: '设备管理',
    component: defineAsyncComponent(() => import('./AppAutomationDevicesView.vue')),
  },
  {
    key: 'packages',
    title: '应用包',
    component: defineAsyncComponent(() => import('./AppAutomationPackagesView.vue')),
  },
  {
    key: 'elements',
    title: '元素管理',
    component: defineAsyncComponent(() => import('./AppAutomationElementsView.vue')),
  },
  {
    key: 'scene-builder',
    title: '场景编排',
    component: defineAsyncComponent(() => import('./AppAutomationSceneBuilderView.vue')),
  },
  {
    key: 'test-cases',
    title: '测试用例',
    component: defineAsyncComponent(() => import('./AppAutomationTestCasesView.vue')),
  },
  {
    key: 'suites',
    title: '测试套件',
    component: defineAsyncComponent(() => import('./AppAutomationSuitesView.vue')),
  },
  {
    key: 'executions',
    title: '执行记录',
    component: defineAsyncComponent(() => import('./AppAutomationExecutionsView.vue')),
  },
  {
    key: 'scheduled-tasks',
    title: '定时任务',
    component: defineAsyncComponent(() => import('./AppAutomationScheduledTasksView.vue')),
  },
  {
    key: 'notifications',
    title: '通知日志',
    component: defineAsyncComponent(() => import('./AppAutomationNotificationsView.vue')),
  },
  {
    key: 'reports',
    title: '执行报告',
    component: defineAsyncComponent(() => import('./AppAutomationReportsView.vue')),
  },
  {
    key: 'settings',
    title: '环境设置',
    component: defineAsyncComponent(() => import('./AppAutomationSettingsView.vue')),
  },
]

export const normalizeAppAutomationTab = (value: unknown): AppAutomationTab => {
  const tab = String(value || 'overview') as AppAutomationTab
  return appAutomationAllowedTabs.includes(tab) ? tab : 'overview'
}
