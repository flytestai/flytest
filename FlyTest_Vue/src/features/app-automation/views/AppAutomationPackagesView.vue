<template>
  <div class="page-shell fc-page app-packages-page">
    <div v-if="!projectStore.currentProjectId" class="empty-shell fc-empty-state">
      <a-empty description="请先选择项目后管理 APP 应用包" />
    </div>
    <template v-else>
      <PackagesReferenceWorkspace
        :packages="packages"
        :project-id="projectStore.currentProjectId"
        :loading="loading"
        :file-support="fileSupport"
        :load-error="loadError"
        @refresh="loadPackages"
        @create="openCreate"
        @edit="openEdit"
        @remove="remove"
      />

      <PackageEditorDialog
        v-model:visible="visible"
        :form="form"
        :submitting="submitting"
        :file-support="fileSupport"
        :upload-progress="uploadProgress"
        :selected-file="selectedFile"
        :submit-package="submit"
        @select-file="selectedFile = $event"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  PackageEditorDialog,
  useAppAutomationPackages,
} from './packages'
import PackagesReferenceWorkspace from './packages/PackagesReferenceWorkspace.vue'

const {
  projectStore,
  loading,
  submitting,
  visible,
  packages,
  loadError,
  fileSupport,
  selectedFile,
  uploadProgress,
  form,
  loadPackages,
  openCreate,
  openEdit,
  submit,
  remove,
} = useAppAutomationPackages()
</script>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding: 8px 6px 10px;
}

.empty-shell {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    var(--theme-surface);
  border: 1px solid var(--theme-card-border);
  border-radius: 12px;
  box-shadow: var(--theme-card-shadow);
}

.page-shell :deep(.arco-card),
.page-shell :deep(.package-card),
.page-shell :deep(.stats-card) {
  border-radius: 12px;
  box-shadow: var(--theme-card-shadow);
}

.page-shell :deep(.arco-card-body) {
  padding: 20px;
}

@media (max-width: 900px) {
  .page-shell {
    gap: 16px;
    padding: 4px;
  }

  .page-shell :deep(.arco-card-body) {
    padding: 18px;
  }
}
</style>
<style>.app-automation-shell .app-packages-page{padding:0!important}</style>
