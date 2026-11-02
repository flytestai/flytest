<template>
  <div class="api-automation-shell fc-page">
    <div class="fc-module-heading">
      <div>
        <h2>接口自动化</h2>
        <p>连接接口设计、调试与自动化验证</p>
      </div>
    </div>
    <nav class="fc-inline-tabs" aria-label="接口自动化">
      <router-link
        v-for="tab in workspaceTabs"
        :key="tab.key"
        :to="{ path: '/api-automation', query: { tab: tab.key } }"
        :aria-current="activeTab === tab.key ? 'page' : undefined"
        >{{ tab.label }}</router-link
      >
    </nav>
    <WorkspaceDirectoryLayout
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
        />
      </WorkspacePane>
      <WorkspacePane
        v-if="mountedTabs.includes('environments')"
        :active="activeTab === 'environments'"
      >
        <EnvironmentList ref="environmentListRef" />
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
import WorkspaceDirectoryLayout from "@/components/workspace/WorkspaceDirectoryLayout.vue";
import WorkspacePane from "@/components/workspace/WorkspacePane.vue";

import { computed, defineAsyncComponent, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useProjectStore } from "@/store/projectStore";
import type {
  ApiAutomationSelection,
  ApiCollection,
  ApiRequest,
} from "../types";
import CollectionPanel from "../components/CollectionPanel.vue";
import RequestWorkbench from "../components/RequestWorkbench.vue";
import { collectionApi } from "../api";
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
  collectionPanelRef.value?.refresh?.();
  testCaseListRef.value?.refresh?.();
  environmentListRef.value?.refresh?.();
  testReportViewRef.value?.refresh?.();
};

const handleExecutionUpdated = () => {
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
