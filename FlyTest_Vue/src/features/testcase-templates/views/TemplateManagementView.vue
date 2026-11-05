<template>
  <div class="template-management-view fc-page">
    <AssetModuleHeader :metrics="templateMetrics">
      <template #actions>
        <a-button type="primary" @click="handleCreate">
          <template #icon><icon-plus /></template>
          新建模板
        </a-button>
      </template>
    </AssetModuleHeader>

    <a-card class="template-list-card fc-panel">
      <!-- 筛选栏 -->
      <div class="filter-bar fc-toolbar">
        <a-input-search v-model="searchKeyword" placeholder="搜索模板名称或描述" allow-clear class="asset-template-search" />
        <a-space>
          <a-select
            v-model="filters.template_type"
            placeholder="模板类型"
            allow-clear
            style="width: 120px"
          >
            <a-option value="import">导入</a-option>
            <a-option value="export">导出</a-option>
            <a-option value="both">导入/导出</a-option>
          </a-select>
          <a-select
            v-model="filters.is_active"
            placeholder="状态"
            allow-clear
            style="width: 100px"
          >
            <a-option :value="true">启用</a-option>
            <a-option :value="false">禁用</a-option>
          </a-select>
        </a-space>
        <a-button @click="resetFilters">重置</a-button>
      </div>

      <!-- 模板列表 -->
      <a-table class="fc-table"
        :columns="columns"
        :data="visibleTemplates"
        :loading="loading"
        :pagination="false"
        row-key="id"
        :scroll="{ x: 900 }"
      >
        <template #empty>
          <WorkspaceEmptyState :title="hasFilters ? '没有匹配的用例模板' : '暂无用例模板'" :description="hasFilters ? '调整搜索条件或重置筛选，查看其他模板。' : '创建导入或导出模板，统一团队的用例字段与文件格式。'" :action-label="hasFilters ? '重置筛选' : '新建模板'" @action="hasFilters ? resetFilters() : handleCreate()" />
        </template>
        <template #template_type="{ record }">
          <a-tag :color="getTypeColor(record.template_type)">
            {{ record.template_type_display }}
          </a-tag>
        </template>

        <template #is_active="{ record }">
          <a-switch
            :model-value="record.is_active"
            @change="(val: string | number | boolean) => handleToggleActive(record, Boolean(val))"
          />
        </template>

        <template #created_at="{ record }">
          {{ formatDate(record.created_at) }}
        </template>

        <template #actions="{ record }">
          <a-space>
            <a-button size="small" @click="handleEdit(record)">编辑</a-button>
            <a-button size="small" @click="handleDuplicate(record)">复制</a-button>
            <a-popconfirm
              content="确定要删除此模板吗？"
              @ok="handleDelete(record)"
            >
              <a-button size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 创建/编辑模板弹窗 -->
    <TemplateFormModal
      ref="formModalRef"
      @success="loadTemplates"
    />
  </div>
</template>

<script setup lang="ts">
import AssetModuleHeader from '@/components/workspace/AssetModuleHeader.vue'
import { ref, reactive, onMounted, computed } from 'vue';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState.vue';
import { Message } from '@arco-design/web-vue';
import { IconPlus, IconFileImage } from '@arco-design/web-vue/es/icon';
import {
  getTemplateList,
  deleteTemplate,
  updateTemplate,
  duplicateTemplate,
  type ImportExportTemplateListItem,
  type TemplateType,
} from '../services/templateService';
import TemplateFormModal from '../components/TemplateFormModal.vue';

const loading = ref(false);
const templates = ref<ImportExportTemplateListItem[]>([]);
const templatesLoaded = ref(false), searchKeyword = ref('');
const formModalRef = ref<InstanceType<typeof TemplateFormModal> | null>(null);

const filters = reactive({
  template_type: undefined as TemplateType | undefined,
  is_active: undefined as boolean | undefined,
});
const hasFilters = computed(() => Boolean(searchKeyword.value || filters.template_type || filters.is_active !== undefined));
const visibleTemplates = computed(() => templates.value.filter(template => (!filters.template_type || template.template_type === filters.template_type) && (filters.is_active === undefined || template.is_active === filters.is_active) && (!searchKeyword.value.trim() || (template.name + ' ' + (template.description || '')).toLowerCase().includes(searchKeyword.value.trim().toLowerCase()))));
const templateMetrics = computed(() => [
  {label:'模板总量',value:templatesLoaded.value ? templates.value.length : null,tone:'teal'},
  {label:'启用模板',value:templatesLoaded.value ? templates.value.filter(template => template.is_active).length : null,tone:'success'},
  {label:'支持导入',value:templatesLoaded.value ? templates.value.filter(template => template.template_type !== 'export').length : null,tone:'blue',description:'包含导入/导出两用模板'},
  {label:'支持导出',value:templatesLoaded.value ? templates.value.filter(template => template.template_type !== 'import').length : null,tone:'violet',description:'包含导入/导出两用模板'},
]);
function resetFilters() { searchKeyword.value = ''; filters.template_type = undefined; filters.is_active = undefined; }

const columns = [
  { title: '模板名称', dataIndex: 'name', width: 200 },
  { title: '类型', dataIndex: 'template_type', slotName: 'template_type', width: 100 },
  { title: '描述', dataIndex: 'description', ellipsis: true },
  { title: '状态', dataIndex: 'is_active', slotName: 'is_active', width: 80 },
  { title: '创建人', dataIndex: 'creator_name', width: 100 },
  { title: '创建时间', dataIndex: 'created_at', slotName: 'created_at', width: 160 },
  { title: '操作', slotName: 'actions', width: 180, fixed: 'right' },
];

const getTypeColor = (type: TemplateType) => {
  const colors: Record<TemplateType, string> = {
    import: 'green',
    export: 'blue',
    both: 'purple',
  };
  return colors[type] || 'gray';
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const loadTemplates = async () => {
  loading.value = true;
  try {
    const result = await getTemplateList();
    if (result.success && result.data) {
      templates.value = result.data;
      templatesLoaded.value = true;
    } else {
      Message.error(result.error || '加载模板列表失败');
    }
  } finally {
    loading.value = false;
  }
};

const handleCreate = () => {
  formModalRef.value?.open();
};

const handleEdit = (record: ImportExportTemplateListItem) => {
  formModalRef.value?.open(record.id);
};

const handleToggleActive = async (record: ImportExportTemplateListItem, isActive: boolean) => {
  const result = await updateTemplate(record.id, { is_active: isActive });
  if (result.success) {
    Message.success(isActive ? '已启用' : '已禁用');
    loadTemplates();
  } else {
    Message.error(result.error || '操作失败');
  }
};

const handleDuplicate = async (record: ImportExportTemplateListItem) => {
  const result = await duplicateTemplate(record.id);
  if (result.success) {
    Message.success('复制成功');
    loadTemplates();
  } else {
    Message.error(result.error || '复制失败');
  }
};

const handleDelete = async (record: ImportExportTemplateListItem) => {
  const result = await deleteTemplate(record.id);
  if (result.success) {
    Message.success('删除成功');
    loadTemplates();
  } else {
    Message.error(result.error || '删除失败');
  }
};

onMounted(() => {
  loadTemplates();
});
</script>

<style scoped>
.template-management-view {
  padding: 20px 24px;
  min-height: 100%;
  background:
    var(--theme-surface);
}

.template-list-card {
  margin-top: 20px;
  border-radius: 12px;
  border: 1px solid rgba(149, 161, 187, 0.14);
  box-shadow: var(--theme-card-shadow);
}

.filter-bar {
  margin-bottom: 20px;
  padding: 16px 20px;
  background:
    var(--theme-surface);
  border: 1px solid rgba(149, 161, 187, 0.14);
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.template-management-view :deep(.arco-page-header) {
  padding: 18px 20px;
  border-radius: 12px;
  border: 1px solid var(--ui-panel-border);
  background:
    var(--theme-surface);
  box-shadow: var(--theme-card-shadow);
}

.template-management-view :deep(.arco-page-header-wrapper) {
  padding: 0;
}

.template-management-view :deep(.arco-page-header-title) {
  color: var(--theme-text);
  font-weight: 700;
}

.template-management-view :deep(.arco-select-view),
.template-management-view :deep(.arco-btn),
.template-management-view :deep(.arco-input-wrapper) {
  border-radius: 10px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .template-management-view {
    padding: 12px 16px;
  }

  .filter-bar {
    padding: 12px;
  }

  .template-list-card :deep(.arco-table-th),
  .template-list-card :deep(.arco-table-td) {
    padding: 10px 8px;
    font-size: 13px;
  }
}

@media (max-width: 576px) {
  .template-management-view {
    padding: 8px 12px;
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-bar :deep(.arco-select) {
    width: 100% !important;
  }
}

/* 表格优化 */
.template-list-card :deep(.arco-table) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--theme-card-shadow);
}

.template-list-card :deep(.arco-table-container) {
  border: 1px solid rgba(149, 161, 187, 0.14);
  border-radius: 12px;
}

.template-list-card :deep(.arco-table-th) {
  background: rgba(248, 250, 252, 0.92);
  font-weight: 600;
  color: var(--theme-text-secondary);
}

.template-list-card :deep(.arco-table-tr:hover .arco-table-td) {
  background: rgba(var(--theme-accent-rgb), 0.035);
}

/* 操作按钮组优化 */
.template-list-card :deep(.arco-btn-size-small) {
  padding: 0 10px;
  height: 28px;
  font-size: 13px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
}

.empty-text {
  margin: 16px 0 8px;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-2);
}

.empty-desc {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-3);
}

.template-list-card :deep(.arco-card-body) {
  padding: 20px;
}
</style>
