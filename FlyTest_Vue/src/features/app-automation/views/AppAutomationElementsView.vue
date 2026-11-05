<template>
  <div class="page-shell fc-page app-elements-page">
    <div v-if="!projectStore.currentProjectId" class="empty-shell fc-empty-state">
      <a-empty description="请先选择项目后再管理 APP 自动化元素" />
    </div>
    <template v-else>
      <ElementsReferenceWorkspace
        :elements="elements"
        :loading="loading"
        :load-error="loadError"
        :project-id="projectStore.currentProjectId"
        :project-name="projectStore.projectList.find(item=>item.id === projectStore.currentProjectId)?.name || ''"
        @refresh="loadElements"
        @create="openCreate"
        @detail="openDetail"
        @duplicate="duplicateElement"
        @edit="openEdit"
        @remove="remove"
        @toggle="toggleActive"
        @recognize="openRecognition"
      />

      <ElementsEditorDialog
        v-model:visible="visible"
        v-model:new-category-name="newCategoryName"
        :form="form"
        :image-categories="imageCategories"
        :image-preview-url="imagePreviewUrl"
        :uploading="uploading"
        :category-saving="categorySaving"
        :category-deleting="categoryDeleting"
        :saving="saving"
        :submit-element="submit"
        @cancel="closeEditor"
        @file-change="handleFileChange"
        @create-category="createCategory"
        @delete-current-category="deleteCurrentCategory"
      />

      <ElementsDetailDialog
        v-model:visible="detailVisible"
        :detail-record="detailRecord"
        :get-preview-url="getPreviewUrl"
        :get-type-label="getTypeLabel"
        :render-pos="renderPos"
        :render-region="renderRegion"
        :format-date-time="formatDateTime"
        :format-config="formatConfig"
      />

      <AppAutomationCaptureElementModal
        v-model:visible="captureVisible"
        :project-id="projectStore.currentProjectId"
        :page-name="recognitionPage"
        @success="handleCaptureSuccess"
      />
      <ElementRecognitionDialog v-model:visible="recognitionVisible" :project-id="projectStore.currentProjectId" :default-page="recognitionPage" @draft="openDraft" @capture="openCapture"/>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ElementsReferenceWorkspace from './elements/ElementsReferenceWorkspace.vue'
import ElementRecognitionDialog from './elements/ElementRecognitionDialog.vue'
import AppAutomationCaptureElementModal from '../components/AppAutomationCaptureElementModal.vue'
import {
  ElementsDetailDialog,
  ElementsEditorDialog,
  useAppAutomationElements,
} from './elements'

const {
  loadError,
  saving,
  projectStore,
  loading,
  visible,
  detailVisible,
  captureVisible,
  uploading,
  categorySaving,
  categoryDeleting,
  elements,
  imageCategories,
  newCategoryName,
  detailRecord,
  form,
  imagePreviewUrl,
  formatDateTime,
  formatConfig,
  getTypeLabel,
  getPreviewUrl,
  renderPos,
  renderRegion,
  loadElements,
  openCreate,
  openEdit,
  openDetail,
  openDraft,
  handleFileChange,
  createCategory,
  deleteCurrentCategory,
  submit,
  closeEditor,
  duplicateElement,
  toggleActive,
  remove,
  handleCaptureSuccess,
} = useAppAutomationElements()
const recognitionVisible = ref(false), recognitionPage = ref('')
function openRecognition(pageName: string) { recognitionPage.value = pageName; recognitionVisible.value = true }
function openCapture(pageName: string) { recognitionPage.value = pageName; captureVisible.value = true }
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
.page-shell :deep(.element-card),
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
<style>.app-automation-shell .app-elements-page{padding:0!important}</style>
