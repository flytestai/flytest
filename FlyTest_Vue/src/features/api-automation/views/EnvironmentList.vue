<template>
  <div class="environment-list">
    <div class="page-header api-page-header">
      <div class="header-left">
        <a-input-search
          v-model="searchKeyword"
          class="toolbar-search"
          placeholder="搜索环境名称"
          allow-clear
          @search="loadEnvironments"
          @clear="loadEnvironments"
        />
      </div>
      <div class="header-right">
        <a-button type="primary" @click="openCreateModal">新增环境</a-button>
      </div>
    </div>

    <div v-if="environmentSuggestions" class="env-suggestion-panel">
      <div class="env-suggestion-panel__copy">
        <div class="env-suggestion-panel__title">最近一次文档导入的环境建议</div>
        <div class="env-suggestion-panel__meta">
          <span v-if="primarySuggestedBaseUrl">推荐基础地址：{{ primarySuggestedBaseUrl.base_url }}</span>
          <span v-if="primaryAuthSuggestion">
            推荐登录接口：{{ primaryAuthSuggestion.request_name }} / Token 路径 {{ primaryAuthSuggestion.token_path }}
          </span>
          <span v-if="suggestedVariablePreview.length">
            建议补齐变量：{{ suggestedVariablePreview.map(item => item.name).join('、') }}
          </span>
        </div>
      </div>
      <div class="env-suggestion-panel__actions">
        <a-button type="primary" @click="openCreateModalWithSuggestions">应用建议并新建环境</a-button>
      </div>
    </div>

    <div class="content-section">
      <a-table :data="filteredEnvironments" :loading="loading" :pagination="false" row-key="id" size="large">
        <template #columns>
          <a-table-column title="环境名称" data-index="name" :width="220" />
          <a-table-column title="基础地址" data-index="base_url" ellipsis tooltip />
          <a-table-column title="默认" :width="90" align="center">
            <template #cell="{ record }">
              <a-tag :color="record.is_default ? 'green' : 'gray'">{{ record.is_default ? '是' : '否' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="超时" :width="120">
            <template #cell="{ record }">{{ record.timeout_ms }} ms</template>
          </a-table-column>
          <a-table-column title="更新时间" :width="180">
            <template #cell="{ record }">{{ formatDate(record.updated_at) }}</template>
          </a-table-column>
          <a-table-column title="操作" :width="180" align="center">
            <template #cell="{ record }">
              <a-space :size="4">
                <a-button type="text" size="small" @click="openEditModal(record)">编辑</a-button>
                <a-popconfirm content="确定删除该环境吗？" @ok="deleteEnvironment(record.id)">
                  <a-button type="text" size="small" status="danger">删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </div>

    <a-modal
      v-model:visible="editorVisible"
      :title="editingEnvironment ? '编辑环境' : '新增环境'"
      width="1080px"
      :ok-loading="submitLoading"
      :body-style="{ maxHeight: '72vh', overflow: 'auto' }"
      @before-ok="submitEnvironment"
      @cancel="resetEditor"
    >
      <div v-if="!editingEnvironment && environmentDraft" class="env-prefill-banner">
        <div class="env-prefill-copy">
          <div class="env-prefill-title">已根据最近一次文档解析准备环境草稿</div>
          <div class="env-prefill-description">
            {{ draftSummary || '基础地址、公共请求头、变量和 Cookie 已自动回填。' }}
          </div>
        </div>
        <div class="env-prefill-actions">
          <a-button @click="fillEnvironmentFromDraft">重新回填</a-button>
          <a-button type="text" @click="clearDrafts">清除草稿</a-button>
        </div>
      </div>

      <div v-if="!editingEnvironment && environmentSuggestions" class="env-suggestion-banner">
        <div class="env-suggestion-banner__copy">
          <div class="env-suggestion-banner__title">推荐鉴权与变量配置</div>
          <div class="env-suggestion-banner__desc">
            <template v-if="primaryAuthSuggestion">
              建议将“{{ primaryAuthSuggestion.request_name }}”作为自动获取 Token 的引导接口，推荐提取路径为
              <code>{{ primaryAuthSuggestion.token_path }}</code>。
            </template>
            <template v-else>
              已根据导入结果整理出可优先补齐的环境变量。
            </template>
          </div>
          <div v-if="suggestedVariablePreview.length" class="env-suggestion-banner__chips">
            <a-tag v-for="item in suggestedVariablePreview" :key="item.name" color="arcoblue">
              {{ item.name }}
            </a-tag>
          </div>
        </div>
        <div class="env-suggestion-banner__actions">
          <a-button @click="applyEnvironmentSuggestions">应用建议</a-button>
        </div>
      </div>

      <a-form :model="formState" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item field="name" label="环境名称" :rules="[{ required: true, message: '请输入环境名称' }]">
              <a-input v-model="formState.name" placeholder="例如：测试环境 / 预发环境" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item field="base_url" label="基础地址">
              <a-input v-model="formState.base_url" placeholder="例如：https://api.example.com/v1" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item field="timeout_ms" label="默认超时(ms)">
              <a-input-number v-model="formState.timeout_ms" :min="1000" :step="1000" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item field="is_default" label="设为默认环境">
              <a-switch v-model="formState.is_default" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="结构化环境配置">
          <StructuredEnvironmentEditor v-model="formState.editor" />
        </a-form-item>

        <a-alert type="info">
          <template #title>自动获取 Token</template>
          如果接口里使用了 <code v-pre>{{token}}</code> 且当前环境没有填写 token，系统会尝试自动执行登录接口。
          可在环境变量里配置 <code>auth_request_name</code> 或 <code>auth_request_id</code> 指定登录接口；
          如果返回结构特殊，可再配置 <code>auth_token_path</code>，例如 <code>data.token</code>。
        </a-alert>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useProjectStore } from '@/store/projectStore'
import { environmentApi } from '../api'
import StructuredEnvironmentEditor from '../components/StructuredEnvironmentEditor.vue'
import {
  createEnvironmentVariableSpec,
  createEmptyEnvironmentEditorModel,
  environmentEditorModelToHeaderMap,
  environmentEditorModelToPayload,
  environmentEditorModelToVariableMap,
  environmentToEditorModel,
} from '../state/environmentEditor'
import { useApiImportDrafts } from '../state/importDraft'
import type {
  ApiEnvironment,
  ApiEnvironmentAuthSuggestion,
  ApiEnvironmentEditorModel,
  ApiEnvironmentForm,
  ApiEnvironmentSuggestionBaseUrl,
  ApiEnvironmentSuggestionVariable,
} from '../types'

const projectStore = useProjectStore()
const projectId = computed(() => projectStore.currentProject?.id)
const {
  environmentDraft,
  environmentSuggestions,
  draftSummary,
  getEnvironmentDraft,
  getEnvironmentSuggestions,
  clearDrafts,
} = useApiImportDrafts()

const loading = ref(false)
const submitLoading = ref(false)
const searchKeyword = ref('')
const environments = ref<ApiEnvironment[]>([])
const editorVisible = ref(false)
const editingEnvironment = ref<ApiEnvironment | null>(null)

const createInitialFormState = () => ({
  name: '',
  base_url: '',
  timeout_ms: 30000,
  is_default: false,
  editor: createEmptyEnvironmentEditorModel(),
})

const formState = ref<{
  name: string
  base_url: string
  timeout_ms: number
  is_default: boolean
  editor: ApiEnvironmentEditorModel
}>(createInitialFormState())

const filteredEnvironments = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return environments.value
  return environments.value.filter(item => item.name.toLowerCase().includes(keyword))
})

const primarySuggestedBaseUrl = computed<ApiEnvironmentSuggestionBaseUrl | null>(() => {
  const items = environmentSuggestions.value?.base_url_candidates || []
  return items.find(item => item.selected) || items[0] || null
})

const primaryAuthSuggestion = computed<ApiEnvironmentAuthSuggestion | null>(() => {
  return environmentSuggestions.value?.auth_suggestions?.[0] || null
})

const suggestedVariablePreview = computed<ApiEnvironmentSuggestionVariable[]>(() => {
  return (environmentSuggestions.value?.variable_suggestions || []).slice(0, 8)
})

const formatDate = (value?: string) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN')
}

const loadEnvironments = async () => {
  if (!projectId.value) {
    environments.value = []
    return
  }
  loading.value = true
  try {
    const res = await environmentApi.list({ project: projectId.value })
    const data = res.data?.data || []
    environments.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('[EnvironmentList] 获取环境失败:', error)
    Message.error('获取环境列表失败')
  } finally {
    loading.value = false
  }
}

const resetEditor = () => {
  editingEnvironment.value = null
  formState.value = createInitialFormState()
}

const fillEnvironmentFromDraft = () => {
  const draft = getEnvironmentDraft()
  if (!draft) return
  formState.value = {
    name: draft.name || '文档解析环境草稿',
    base_url: draft.base_url || '',
    timeout_ms: draft.timeout_ms || 30000,
    is_default: draft.is_default || false,
    editor: environmentToEditorModel(draft),
  }
}

const applyEnvironmentSuggestions = () => {
  const suggestions = getEnvironmentSuggestions()
  if (!suggestions) return

  if (suggestions.environment_patch?.base_url && !formState.value.base_url) {
    formState.value.base_url = suggestions.environment_patch.base_url
  }

  const nextVariables = [...formState.value.editor.variables]
  for (const item of suggestions.environment_patch?.variables || []) {
    const name = String(item.name || '').trim()
    if (!name) continue
    const existing = nextVariables.find(variable => variable.name === name)
    if (existing) {
      if (existing.value === '' || existing.value === null || existing.value === undefined) {
        existing.value = item.value || ''
      }
      if (item.is_secret !== undefined) {
        existing.is_secret = item.is_secret
      }
      continue
    }
    nextVariables.push(
      createEnvironmentVariableSpec({
        name,
        value: item.value || '',
        enabled: true,
        is_secret: item.is_secret ?? false,
        order: nextVariables.length,
      })
    )
  }
  formState.value.editor.variables = nextVariables.map((item, index) => ({
    ...item,
    order: index,
  }))
  Message.success('已将推荐鉴权与变量建议应用到环境表单')
}

const openCreateModal = () => {
  resetEditor()
  fillEnvironmentFromDraft()
  editorVisible.value = true
}

const openCreateModalWithSuggestions = () => {
  openCreateModal()
  applyEnvironmentSuggestions()
}

const openEditModal = (record: ApiEnvironment) => {
  editingEnvironment.value = record
  formState.value = {
    name: record.name,
    base_url: record.base_url,
    timeout_ms: record.timeout_ms,
    is_default: record.is_default,
    editor: environmentToEditorModel(record),
  }
  editorVisible.value = true
}

const submitEnvironment = async (done: (closed: boolean) => void) => {
  if (!projectId.value) {
    Message.warning('请先选择项目')
    done(false)
    return
  }
  if (!formState.value.name.trim()) {
    Message.warning('请输入环境名称')
    done(false)
    return
  }

  submitLoading.value = true
  try {
    const environmentSpecs = environmentEditorModelToPayload(formState.value.editor)
    const payload: ApiEnvironmentForm = {
      project: projectId.value,
      name: formState.value.name.trim(),
      base_url: formState.value.base_url.trim(),
      common_headers: environmentEditorModelToHeaderMap(formState.value.editor),
      variables: environmentEditorModelToVariableMap(formState.value.editor),
      environment_specs: environmentSpecs,
      timeout_ms: formState.value.timeout_ms,
      is_default: formState.value.is_default,
    }

    if (editingEnvironment.value) {
      await environmentApi.update(editingEnvironment.value.id, payload)
      Message.success('环境更新成功')
    } else {
      await environmentApi.create(payload)
      Message.success('环境创建成功')
    }

    done(true)
    editorVisible.value = false
    resetEditor()
    loadEnvironments()
  } catch (error: any) {
    console.error('[EnvironmentList] 保存环境失败:', error)
    Message.error(error?.error || '保存环境失败')
    done(false)
  } finally {
    submitLoading.value = false
  }
}

const deleteEnvironment = async (id: number) => {
  try {
    await environmentApi.delete(id)
    Message.success('环境删除成功')
    loadEnvironments()
  } catch (error: any) {
    Message.error(error?.error || '删除环境失败')
  }
}

watch(
  () => projectId.value,
  () => {
    loadEnvironments()
  },
  { immediate: true }
)

defineExpose({
  refresh: loadEnvironments,
})
</script>

<style scoped>
.environment-list {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.api-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 24px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.9));
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.06);
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.header-left {
  flex: 1 1 260px;
  min-width: 220px;
}

.header-right {
  justify-content: flex-end;
}

.toolbar-search {
  width: 320px;
  max-width: 100%;
}

.header-left :deep(.arco-input-wrapper),
.header-right :deep(.arco-btn) {
  min-height: 42px;
}

.header-right :deep(.arco-btn) {
  padding-inline: 18px;
  border-radius: 14px;
}

.content-section :deep(.arco-table-container) {
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.12);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
}

.content-section :deep(.arco-table-th) {
  padding-top: 16px;
  padding-bottom: 16px;
}

.content-section :deep(.arco-table-td) {
  padding-top: 15px;
  padding-bottom: 15px;
}

.env-prefill-banner,
.env-suggestion-panel,
.env-suggestion-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 22px;
}

.env-prefill-banner {
  margin-bottom: 18px;
  border: 1px solid rgba(59, 130, 246, 0.14);
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(20, 184, 166, 0.08)),
    rgba(255, 255, 255, 0.92);
}

.env-suggestion-panel {
  border: 1px solid rgba(14, 165, 233, 0.14);
  background:
    linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(16, 185, 129, 0.08)),
    rgba(255, 255, 255, 0.92);
}

.env-suggestion-banner {
  margin-bottom: 18px;
  border: 1px solid rgba(16, 185, 129, 0.14);
  background:
    linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(59, 130, 246, 0.08)),
    rgba(255, 255, 255, 0.92);
}

.env-prefill-copy,
.env-suggestion-panel__copy,
.env-suggestion-banner__copy {
  min-width: 0;
}

.env-prefill-title,
.env-suggestion-panel__title,
.env-suggestion-banner__title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.env-prefill-description,
.env-suggestion-panel__meta,
.env-suggestion-banner__desc {
  margin-top: 6px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  line-height: 1.7;
  color: #64748b;
}

.env-prefill-actions,
.env-suggestion-panel__actions,
.env-suggestion-banner__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.env-suggestion-banner__chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

@media (max-width: 768px) {
  .api-page-header,
  .env-prefill-banner,
  .env-suggestion-panel,
  .env-suggestion-banner {
    align-items: stretch;
  }

  .header-left,
  .header-right,
  .toolbar-search {
    width: 100%;
  }

  .header-right {
    justify-content: flex-start;
  }
}
</style>
