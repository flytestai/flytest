<template>
  <div class="asset-module-header">
    <header class="asset-page-hero"><svg class="asset-page-hero__waves" viewBox="0 0 1200 150" preserveAspectRatio="none" aria-hidden="true"><path d="M420 150C680 150 730 -50 960 65S1200 15 1200 15V150Z" fill="currentColor" opacity=".08"/><path d="M600 150C900 150 880 20 1080 30S1200 -40 1200 -40V150Z" fill="currentColor" opacity=".05"/></svg><div class="asset-page-hero__copy"><h2>{{ definitions.find(tab => tab.key === route.path)?.label || '测试资产' }}</h2><p>{{ description }}</p></div><div ref="actionsTarget" class="asset-page-actions"><slot name="actions" /></div></header>
    <section class="asset-metrics" aria-label="测试资产统计" :aria-busy="loading"><article v-for="(metric,index) in displayMetrics" :key="metric.label" class="asset-metric" :class="'asset-metric--' + (metric.tone || 'teal')" :title="metric.description"><span class="asset-metric__icon" aria-hidden="true"><component :is="icons[index]" /></span><div><h3>{{ metric.label }}</h3><strong>{{ metric.value === null || metric.value === undefined ? '—' : typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value }}</strong></div><svg viewBox="0 0 180 50" preserveAspectRatio="none" aria-hidden="true"><path d="M0 50C50 0 75 50 115 20S180 12 180 12V50Z" fill="currentColor" opacity=".12"/><path d="M40 50C90 45 85 0 145 10S180 20 180 20V50Z" fill="currentColor" opacity=".08"/></svg></article></section>
    <a-alert v-if="error" type="warning" class="asset-statistics-error">统计暂不可用，仍可操作下方内容。<template #action><a-button type="text" size="small" @click="refresh">重试</a-button></template></a-alert>
    <WorkspaceModuleHeader navigation-only
    title="测试资产"
    :page-title="definitions.find(tab => tab.key === route.path)?.label || '测试资产'"
    :active-key="route.path"
    :tabs="tabs"
  /></div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { IconFile, IconClockCircle, IconPlayArrow, IconSafe } from '@arco-design/web-vue/es/icon';
import { getProjectStatistics, type ProjectStatistics } from '@/services/projectService';
import { calculatePassRate, formatQualityPercent, passRateTone } from '@/utils/qualityStatus';
import { useRoute } from "vue-router";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import WorkspaceModuleHeader from "./WorkspaceModuleHeader.vue";
import './asset-workspace.css';
const route = useRoute(),
  auth = useAuthStore(),
  project = useProjectStore();
interface AssetMetric { label:string; value:number|string|null; tone?:string; description?:string }
const props = defineProps<{metrics?:AssetMetric[]}>();
const actionsTarget = ref<HTMLElement>();
const statistics = ref<ProjectStatistics|null>(null), loading = ref(false), error = ref(false);
const icons = [IconFile, IconClockCircle, IconPlayArrow, IconSafe];
let requestId = 0;
async function refresh() {
  if (!project.currentProjectId || props.metrics) return;
  const id = ++requestId, projectId = project.currentProjectId; loading.value = true; error.value = false;
  try { const response = await getProjectStatistics(projectId); if(id !== requestId || project.currentProjectId !== projectId) return; statistics.value = response.success ? response.data || null : null; error.value = !response.success; }
  catch { if(id === requestId) { statistics.value = null; error.value = true; } }
  finally { if(id === requestId) loading.value = false; }
}
watch(() => project.currentProjectId, () => { ++requestId; statistics.value = null; loading.value = false; error.value = false; void refresh(); }, { immediate:true });
const description = computed(() => ({'/testcases':'统一管理用例、套件、缺陷与执行结果，让测试资产可沉淀、可复用、可追踪','/testsuites':'按业务场景组织回归范围，集中维护测试用例与执行计划','/test-bugs':'聚焦缺陷风险、处理状态与验证结果，推动问题闭环','/testcase-templates':'统一导入与导出格式，沉淀团队可复用的用例规范','/test-executions':'选择测试范围，汇总执行结果、质量结论与报告快照'}[route.path] || '统一管理团队测试资产'));
const displayMetrics = computed<AssetMetric[]>(() => {
  if(props.metrics) return props.metrics;
  const data = statistics.value;
  const rate = data ? calculatePassRate(data.executions?.case_results?.passed ?? 0,data.executions?.case_results?.total ?? 0) : null;
  const rateMetric = {label:'通过率',value:formatQualityPercent(rate),tone:passRateTone(rate),description:'项目累计执行结果；仅 100% 通过为绿色'};
  if(route.path === '/test-bugs') return [{label:'缺陷总量',value:data?.bugs?.total ?? null},{label:'待处理缺陷',value:data?.bugs?.open ?? null,tone:'danger'},{label:'待验证',value:data?.bugs?.pending_retest ?? null,tone:'amber'},{label:'高风险缺陷',value:data?.bugs?.high_severity ?? null,tone:'danger'}];
  if(route.path === '/test-executions') return [{label:'执行记录',value:data?.executions?.total_executions ?? null},{label:'通过用例',value:data?.executions?.case_results?.passed ?? null,tone:'success'},{label:'失败用例',value:data?.executions?.case_results?.failed ?? null,tone:'danger'},rateMetric];
  const pending = data?.testcases?.by_review_status;
  return [{label:'用例总量',value:data?.testcases?.total ?? null},{label:'待审核',value:pending ? (pending.pending_review || 0) + (pending.optimization_pending_review || 0) : null,tone:'amber'},{label:'近 7 天执行',value:data?.execution_trend?.daily_7d ? data.execution_trend.daily_7d.reduce((total,day) => total + (day.execution_count || 0),0) : null,tone:'blue',description:'最近 7 个自然日的执行记录数量'},rateMetric];
});
defineExpose({ actionsTarget, refresh });
const definitions = [
  {
    key: "/testcases",
    label: "测试用例",
    permission: "testcases.view_testcase",
  },
  {
    key: "/testsuites",
    label: "测试套件",
    permission: "testcases.view_testsuite",
  },
  {
    key: "/test-bugs",
    label: "缺陷管理",
    permission: "testcases.view_testsuite",
  },
  {
    key: "/testcase-templates",
    label: "用例模板",
    permission: "testcases.view_testcase",
  },
  {
    key: "/test-executions",
    label: "执行报告",
    permission: "testcases.view_testexecution",
  },
];
const tabs = computed(() =>
  definitions
    .filter(
      (tab) =>
        project.projectList.length > 0 || auth.hasPermission(tab.permission),
    )
    .map((tab) => ({ ...tab, to: tab.key })),
);
</script>
