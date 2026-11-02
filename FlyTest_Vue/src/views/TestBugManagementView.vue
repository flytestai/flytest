<template>
  <div class="testbug-management-container fc-page">
    <div v-if="!currentProjectId" class="empty-state">
      <a-empty description="请先选择项目" />
    </div>

    <WorkspaceDirectoryLayout v-else storage-key="test-bugs" directory-label="套件目录" :prioritize-content="bugViewMode !== 'list'"
      :selection="selectedSuiteDetail?.name">
      <template #directory><TestSuiteTreePanel
          ref="suitePanelRef"
          :current-project-id="currentProjectId"
          @suite-selected="handleSuiteSelected"
          @suite-updated="handleSuiteUpdated"
        /></template>
<template v-if="!selectedSuiteId" #heading><WorkspacePageHeader local title="缺陷管理" description="从套件目录选择需要查看的内容" /></template>

        <template v-if="selectedSuiteId">
          <div class="bug-panel-shell">
            <TestBugManagementPanel
              @view-mode-change="bugViewMode = $event"
              :current-project-id="currentProjectId"
              :selected-suite-id="selectedSuiteId"
            />
          </div>
        </template>

        <div v-else class="suite-empty">
          <a-empty description="通过套件目录选择一个套件后，这里会显示对应套件中的 BUG 列表" />
        </div>
    </WorkspaceDirectoryLayout>
  </div>
</template>

<script setup lang="ts">
import WorkspaceDirectoryLayout from '@/components/workspace/WorkspaceDirectoryLayout.vue'
import WorkspacePageHeader from '@/components/workspace/WorkspacePageHeader.vue';

import { computed, onMounted, ref, watch } from 'vue';
import TestBugManagementPanel from '@/components/testcase/TestBugManagementPanel.vue';
import TestSuiteTreePanel from '@/components/testcase/TestSuiteTreePanel.vue';
import { getTestSuiteDetail, type TestSuite } from '@/services/testSuiteService';
import { useProjectStore } from '@/store/projectStore';

const projectStore = useProjectStore();
const currentProjectId = computed(() => projectStore.currentProjectId || null);

const suitePanelRef = ref<InstanceType<typeof TestSuiteTreePanel> | null>(null);
const selectedSuiteId = ref<number | null>(null);
const bugViewMode = ref<'list' | 'detail'>('list');
const selectedSuiteDetail = ref<TestSuite | null>(null);


const fetchSelectedSuiteDetail = async () => {
  if (!currentProjectId.value || !selectedSuiteId.value) {
    selectedSuiteDetail.value = null;
    return;
  }

  const response = await getTestSuiteDetail(currentProjectId.value, selectedSuiteId.value);
  selectedSuiteDetail.value = response.success && response.data ? response.data : null;
};

const syncSelectedSuiteFromPanel = async () => {
  const suiteId = suitePanelRef.value?.getSelectedSuiteId?.() ?? null;
  if (!suiteId || suiteId === selectedSuiteId.value) {
    return;
  }
  selectedSuiteId.value = suiteId;
  await fetchSelectedSuiteDetail();
};

const handleSuiteSelected = async (suiteId: number | null) => {
  selectedSuiteId.value = suiteId;
  await fetchSelectedSuiteDetail();
};

const handleSuiteUpdated = async () => {
  await syncSelectedSuiteFromPanel();
  await fetchSelectedSuiteDetail();
};



watch(currentProjectId, async () => {
  selectedSuiteId.value = null;
  selectedSuiteDetail.value = null;
});

onMounted(async () => {
  if (currentProjectId.value && selectedSuiteId.value) {
    await fetchSelectedSuiteDetail();
    return;
  }
  await syncSelectedSuiteFromPanel();
});

</script>

<style scoped>
.testbug-management-container {
  display: flex;
  height: 100%;
  background: transparent;
  overflow: hidden;
}

.empty-state {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--ui-panel-bg);
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-panel-border);
  box-shadow: var(--ui-panel-shadow);
}

.list-view-layout {
  display: flex;
  width: 100%;
  height: 100%;
  gap: 16px;
  overflow: hidden;
  padding: 4px;
}

.suite-panel-resizable-shell {
  flex: 0 0 auto;
  min-width: 180px;
  max-width: 45vw;
  height: 100%;
  overflow: hidden;
  border-radius: var(--ui-radius-md);
}

.suite-panel-resizer {
  width: 8px;
  flex: 0 0 8px;
  cursor: col-resize;
  border-radius: 999px;
  background: linear-gradient(to bottom, rgba(var(--theme-accent-rgb), 0.06), rgba(var(--theme-accent-rgb), 0.22));
  opacity: 0.85;
  transition: background-color 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
}

.suite-panel-resizer:hover {
  background: linear-gradient(to bottom, rgba(var(--theme-accent-rgb), 0.14), rgba(var(--theme-accent-rgb), 0.34));
  opacity: 1;
  transform: scaleX(1.05);
}

.right-content-area {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bug-toolbar {
  margin-bottom: 16px;
  padding: 18px 20px;
  background: var(--ui-panel-bg);
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-panel-border);
  box-shadow: var(--ui-panel-shadow);
  backdrop-filter: blur(16px);
}

.bug-toolbar-info {
  min-width: 0;
}

.bug-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--theme-text);
  letter-spacing: 0;
}

.bug-subtitle {
  margin-top: 8px;
  color: var(--theme-text-secondary);
  line-height: 1.7;
  word-break: break-word;
}

.bug-panel-shell {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: var(--ui-radius-md);
}

.suite-empty {
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
  background: var(--ui-panel-bg);
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-panel-border);
  box-shadow: var(--ui-panel-shadow);
}

@media (max-width: 768px) {
  .list-view-layout {
    flex-direction: column;
  }

  .suite-panel-resizable-shell {
    width: 100% !important;
    min-width: 100%;
    max-width: 100%;
    height: 220px;
  }

  .suite-panel-resizer {
    display: none;
  }
}
</style>
