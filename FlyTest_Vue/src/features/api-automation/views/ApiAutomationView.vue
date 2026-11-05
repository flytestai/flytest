<template>
  <div class="api-automation-shell fc-page">
    <ApiWorkspaceHeader ref="presentationRef" :title="activeTab === 'requests' ? '接口自动化' : workspaceTabs.find(tab => tab.key === activeTab)?.label || '接口自动化'" :description="pageDescription" :metrics="workspaceMetrics" :tabs="workspaceTabs.map(tab => ({...tab,to:{path:'/api-automation',query:{tab:tab.key}}}))" :active-key="activeTab" />
    <WorkspaceDirectoryLayout compact-header
      ref="workspaceRef"
      storage-key="api-automation"
      :directory="needsDirectory"
      directory-label="接口目录"
      :selection="activeTab === 'environments' ? '' : selectedCollection?.name"
      :clearable="activeTab !== 'environments'"
      @clear="clearSelection"
    >
      <template #directory>
        <CollectionPanel
          ref="collectionPanelRef"
          :selected-collection-id="selectedCollectionId"
          @select="onCollectionSelect"
          @navigate="workspaceRef?.closeDirectory()"
          @updated="onCollectionUpdated"
        />
        <section v-if="activeTab === 'requests' && recentExecutions.length" class="api-directory-recent"><h4>最近执行</h4><button v-for="record in recentExecutions" :key="record.id" type="button" @click="router.push('/api-automation?tab=execution-records')"><span :class="record.passed ? 'quality-success' : 'quality-danger'">{{ record.passed ? '✓' : '×' }}</span><span>{{ record.interface_name || record.request_name }}</span><small>{{ new Date(record.created_at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) }}</small></button></section>
      </template>
      <template v-if="isSummaryTab" #filters>
        <a-select
          :model-value="selectedCollectionId"
          aria-label="筛选接口目录"
          placeholder="全部接口目录"
          allow-clear
          allow-search
          :loading="catalogLoading"
          class="fc-context-filter"
          @change="selectCollectionFilter"
        >
          <a-option
            v-for="item in collectionOptions"
            :key="item.id"
            :value="item.id"
            :label="item.name"
          />
        </a-select>
      </template>
      <WorkspacePane
        v-if="mountedTabs.includes('requests')"
        :active="activeTab === 'requests' && !selectedRequestId"
      >
        <RequestList
          ref="requestListRef"
          :selected-collection-id="selectedCollectionId"
          :selected-collection-name="selectedCollection?.name"
          @executed="handleExecutionUpdated"
          @updated="onRequestUpdated"
        />
      </WorkspacePane>
      <WorkspacePane
        v-if="mountedTabs.includes('requests') && selectedRequestId"
        :active="activeTab === 'requests'"
        ><RequestWorkbench
          ref="requestWorkbenchRef"
          :project-id="currentProjectId"
          :request-id="selectedRequestId"
          @close="closeRequest"
          @updated="onRequestUpdated"
          @executed="handleExecutionUpdated"
      /></WorkspacePane>
      <WorkspacePane
        v-if="mountedTabs.includes('test-cases')"
        :active="activeTab === 'test-cases'"
      >
        <TestCaseList
          ref="testCaseListRef"
          :selected-collection-id="selectedCollectionId"
          :selected-collection-name="selectedCollection?.name"
          :selected-request-id="selectedRequestId"
          :selected-request-name="selectedRequest?.name"
          @executed="handleExecutionUpdated"
          @updated="onRequestUpdated"
        />
      </WorkspacePane>
      <WorkspacePane
        v-if="mountedTabs.includes('environments')"
        :active="activeTab === 'environments'"
      >
        <EnvironmentList ref="environmentListRef" @updated="onEnvironmentUpdated" />
      </WorkspacePane>
      <WorkspacePane
        v-if="mountedTabs.includes('execution-records')"
        :active="activeTab === 'execution-records'"
      >
        <ExecutionRecordList
          ref="executionRecordListRef"
          :selected-collection-id="selectedCollectionId"
          :selected-collection-name="selectedCollection?.name"
        />
      </WorkspacePane>
      <WorkspacePane
        v-if="mountedTabs.includes('execution-report')"
        :active="activeTab === 'execution-report'"
      >
        <TestReportView
          ref="testReportViewRef"
          :project-id="currentProjectId"
          :selected-collection-id="selectedCollectionId"
          :selected-collection-name="selectedCollection?.name"
        />
      </WorkspacePane>
    </WorkspaceDirectoryLayout>
  </div>
</template>

<script setup lang="ts">
import WorkspaceModuleHeader from "@/components/workspace/WorkspaceModuleHeader.vue";
import WorkspaceDirectoryLayout from "@/components/workspace/WorkspaceDirectoryLayout.vue";
import WorkspacePane from "@/components/workspace/WorkspacePane.vue";

import { computed, defineAsyncComponent, ref, watch, provide } from "vue";
import ApiWorkspaceHeader from '../components/ApiWorkspaceHeader.vue';
import { apiWorkspaceKey, type ApiWorkspaceMetric } from '../state/workspacePresentation';
import { getProjectStatistics } from '@/services/projectService';
import { calculatePassRate, formatQualityPercent, passRateTone } from '@/utils/qualityStatus';
import { useRoute, useRouter } from "vue-router";
import { useProjectStore } from "@/store/projectStore";
import type {
  ApiAutomationSelection,
  ApiCollection,
  ApiRequest,
  ApiExecutionRecord,
} from "../types";
import CollectionPanel from "../components/CollectionPanel.vue";
import RequestWorkbench from "../components/RequestWorkbench.vue";
import { collectionApi, executionRecordApi } from "../api";
import { Message } from "@arco-design/web-vue";

const EnvironmentList = defineAsyncComponent(
  () => import("./EnvironmentList.vue"),
);
const ExecutionRecordList = defineAsyncComponent(
  () => import("./ExecutionRecordList.vue"),
);
const RequestList = defineAsyncComponent(() => import("./RequestList.vue"));
const TestCaseList = defineAsyncComponent(() => import("./TestCaseList.vue"));
const TestReportView = defineAsyncComponent(
  () => import("./TestReportView.vue"),
);

type ApiAutomationTab =
  | "requests"
  | "test-cases"
  | "environments"
  | "execution-records"
  | "execution-report";
const workspaceTabs = [
  { key: "requests", label: "接口目录" },
  { key: "test-cases", label: "测试用例" },
  { key: "environments", label: "环境配置" },
  { key: "execution-records", label: "执行记录" },
  { key: "execution-report", label: "测试报告" },
] as const;
const requestWorkbenchRef = ref<InstanceType<typeof RequestWorkbench>>();
async function closeRequest() {
  if (
    requestWorkbenchRef.value &&
    !(await requestWorkbenchRef.value.confirmLeave())
  )
    return;
  selectedRequestId.value = undefined;
  selectedRequest.value = null;
}

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();

const selectedCollectionId = ref<number | undefined>(undefined);
const selectedCollection = ref<ApiCollection | null>(null);
const selectedRequestId = ref<number | undefined>(undefined);
const selectedRequest = ref<ApiRequest | null>(null);
const currentProjectId = computed(() => projectStore.currentProject?.id);

const collectionPanelRef = ref();
const requestListRef = ref();
const environmentListRef = ref();
const executionRecordListRef = ref();
const testCaseListRef = ref();
const testReportViewRef = ref();

const normalizeTab = (value: unknown): ApiAutomationTab => {
  const tab = String(value || "requests");
  if (
    tab === "test-cases" ||
    tab === "environments" ||
    tab === "execution-records" ||
    tab === "execution-report"
  ) {
    return tab;
  }
  return "requests";
};

const activeTab = computed<ApiAutomationTab>(() =>
  normalizeTab(route.query.tab),
);
const presentationRef = ref<InstanceType<typeof ApiWorkspaceHeader>>();
const presentedMetrics = ref<Record<string, ApiWorkspaceMetric[]>>({});
const recentExecutions=ref<ApiExecutionRecord[]>([]);
const defaultMetrics = ref<ApiWorkspaceMetric[]>([{label:'接口总数',value:null},{label:'测试用例',value:null,tone:'purple'},{label:'近 7 天执行',value:null,tone:'blue'},{label:'通过率',value:null,tone:'neutral'}]);
provide(apiWorkspaceKey, {actions:computed(() => presentationRef.value?.actions), publish:(tab,metrics) => {presentedMetrics.value[tab]=metrics}});
const workspaceMetrics = computed(() => activeTab.value === 'requests' ? defaultMetrics.value : presentedMetrics.value[activeTab.value] || Array.from({length:4},(_,index) => ({label:['当前总量','配置状态','执行情况','通过率'][index],value:null,tone:'neutral'})));
const pageDescription = computed(() => ({requests:'连接接口设计、调试与自动化验证','test-cases':'按接口管理自动化用例，连接配置、执行与验证结果',environments:'统一管理环境地址、变量与公共请求头','execution-records':'追踪运行批次、耗时、响应与失败信息','execution-report':'汇总执行趋势与问题分布，为质量决策提供依据'}[activeTab.value]));
let summaryRequest=0;
async function refreshWorkspaceSummary() {
  const project=currentProjectId.value,id=++summaryRequest;
  if(!project) return;
  const [stats,report]=await Promise.allSettled([getProjectStatistics(project),executionRecordApi.report({project,days:7})]);
  if(id!==summaryRequest || project!==currentProjectId.value) return;
  const data=stats.status==='fulfilled' && stats.value.success ? stats.value.data?.api_automation : undefined;
  const summary=report.status==='fulfilled' ? report.value.data?.data?.summary : undefined;
  recentExecutions.value=report.status==='fulfilled' ? (report.value.data?.data?.recent_records || []).slice(0,3) : [];
  const rate=summary ? calculatePassRate(summary.passed_count,summary.total_count) : null;
  defaultMetrics.value=[{label:'接口总数',value:data?.requests ?? null},{label:'测试用例',value:data?.test_cases ?? null,tone:'purple'},{label:'近 7 天执行',value:summary?.total_count ?? null,tone:'blue'},{label:'通过率',value:formatQualityPercent(rate),tone:passRateTone(rate)}];
}
watch(currentProjectId,() => {++summaryRequest;presentedMetrics.value={};defaultMetrics.value=defaultMetrics.value.map(item=>({...item,value:null}));void refreshWorkspaceSummary()},{immediate:true});
const workspaceRef = ref<InstanceType<typeof WorkspaceDirectoryLayout>>();
const needsDirectory = computed(
  () => activeTab.value === "requests" || activeTab.value === "test-cases",
);
const isSummaryTab = computed(
  () =>
    activeTab.value === "execution-records" ||
    activeTab.value === "execution-report",
);
const collectionOptions = ref<ApiCollection[]>([]);
const catalogLoading = ref(false);
let catalogProject: number | undefined;
let catalogRequest = 0;
const resetSelection = () => {
  selectedCollectionId.value = undefined;
  selectedCollection.value = null;
  selectedRequestId.value = undefined;
  selectedRequest.value = null;
};
const clearSelection = async () => {
  if (
    requestWorkbenchRef.value &&
    !(await requestWorkbenchRef.value.confirmLeave())
  )
    return;
  resetSelection();
};
const selectCollectionFilter = async (value: unknown) => {
  const item = collectionOptions.value.find(
    (item) => item.id === Number(value),
  );
  if (
    requestWorkbenchRef.value &&
    !(await requestWorkbenchRef.value.confirmLeave())
  )
    return;
  resetSelection();
  selectedCollectionId.value = item?.id;
  selectedCollection.value = item || null;
};
async function loadCollectionOptions() {
  const project = currentProjectId.value;
  const request = ++catalogRequest;
  if (!project) {
    collectionOptions.value = [];
    return;
  }
  catalogLoading.value = true;
  try {
    const response = await collectionApi.tree(project);
    if (request !== catalogRequest || project !== currentProjectId.value)
      return;
    const flatten = (items: ApiCollection[], prefix = ""): ApiCollection[] =>
      items.flatMap((item) => [
        { ...item, name: prefix + item.name },
        ...flatten(item.children || [], prefix + item.name + " / "),
      ]);
    collectionOptions.value = flatten(
      Array.isArray(response.data?.data) ? response.data.data : [],
    );
    catalogProject = project;
  } catch {
    if (request === catalogRequest) Message.error("加载接口目录失败，请重试");
  } finally {
    if (request === catalogRequest) catalogLoading.value = false;
  }
}
watch(
  [currentProjectId, isSummaryTab],
  ([project, summary], previous) => {
    if (previous && previous[0] !== project) {
      resetSelection();
      catalogProject = undefined;
      collectionOptions.value = [];
    }
    if (summary && project && catalogProject !== project)
      void loadCollectionOptions();
  },
  { immediate: true },
);

const mountedTabs = ref<ApiAutomationTab[]>([activeTab.value]);

const onCollectionSelect = async (selection: ApiAutomationSelection) => {
  if (
    selection.request?.id !== selectedRequestId.value &&
    requestWorkbenchRef.value &&
    !(await requestWorkbenchRef.value.confirmLeave())
  ) {
    collectionPanelRef.value?.restoreSelection(
      selectedRequestId.value,
      selectedCollectionId.value,
    );
    return;
  }
  selectedCollectionId.value = selection.collection?.id;
  selectedCollection.value = selection.collection;
  selectedRequestId.value = selection.request?.id;
  selectedRequest.value = selection.request;

  if (
    selection.type === "request" &&
    activeTab.value !== "test-cases" &&
    activeTab.value !== "requests"
  ) {
    router.replace({
      path: "/api-automation",
      query: {
        ...route.query,
        tab: "requests",
      },
    });
  }
};

const onCollectionUpdated = () => {
  catalogProject = undefined;
  if (isSummaryTab.value) void loadCollectionOptions();
  requestListRef.value?.refresh?.();
  testCaseListRef.value?.refresh?.();
  testReportViewRef.value?.refresh?.();
};

const onRequestUpdated = () => {
  void refreshWorkspaceSummary();
  collectionPanelRef.value?.refresh?.();
  testCaseListRef.value?.refresh?.();
  environmentListRef.value?.refresh?.();
  testReportViewRef.value?.refresh?.();
};
const onEnvironmentUpdated = () => {
  requestListRef.value?.refreshEnvironments?.();
  requestWorkbenchRef.value?.refreshEnvironments?.();
  testCaseListRef.value?.refreshEnvironments?.();
};

const handleExecutionUpdated = () => {
  void refreshWorkspaceSummary();
  testCaseListRef.value?.refresh?.();
  executionRecordListRef.value?.refresh?.();
  testReportViewRef.value?.refresh?.();
};

watch(
  () => route.query.tab,
  (tab) => {
    const normalizedTab = normalizeTab(tab);
    if (tab !== normalizedTab) {
      router.replace({
        path: "/api-automation",
        query: {
          ...route.query,
          tab: normalizedTab,
        },
      });
    }
  },
  { immediate: true },
);

watch(activeTab, (newTab) => {
  if (!mountedTabs.value.includes(newTab)) {
    mountedTabs.value = [...mountedTabs.value, newTab];
  }
});
</script>

<style scoped>
.api-automation-shell {
  min-width: 0;
  min-height: 0;
}
</style>
