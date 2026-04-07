<template>
  <div class="page-shell">
    <div v-if="!projectStore.currentProjectId" class="empty-shell">
      <a-empty description="请先选择项目后再管理 APP 自动化元素" />
    </div>
    <template v-else>
      <div class="page-header">
        <div>
          <h3>元素管理</h3>
          <p>统一维护图片、坐标、区域等元素资源，供 APP 场景编排、步骤补全和执行复用。</p>
        </div>
        <a-space wrap>
          <a-input-search v-model="search" placeholder="搜索元素名称或定位值" allow-clear @search="handleSearch" />
          <a-select v-model="typeFilter" allow-clear placeholder="元素类型" style="width: 140px" @change="handleTypeChange">
            <a-option value="image">图片</a-option>
            <a-option value="pos">坐标</a-option>
            <a-option value="region">区域</a-option>
          </a-select>
          <a-button @click="loadElements">刷新</a-button>
          <a-button @click="captureVisible = true">从设备截图创建</a-button>
          <a-button type="primary" @click="openCreate">新增元素</a-button>
        </a-space>
      </div>

      <a-card class="table-card">
        <div v-if="selectedElementIds.length" class="batch-bar">
          <span>已选择 <strong>{{ selectedElementIds.length }}</strong> 个元素</span>
          <a-space wrap>
            <a-button type="primary" status="danger" size="small" :loading="batchDeleting" @click="removeSelected">
              批量删除
            </a-button>
            <a-button size="small" @click="clearSelection">取消选择</a-button>
          </a-space>
        </div>

        <a-table
          v-model:selectedKeys="selectedElementIds"
          :data="pagedElements"
          :loading="loading"
          :pagination="false"
          :row-selection="rowSelection"
          row-key="id"
        >
          <template #columns>
            <a-table-column title="名称" :width="180">
              <template #cell="{ record }">
                <a-button type="text" class="name-button" @click="openDetail(record)">
                  {{ record.name }}
                </a-button>
              </template>
            </a-table-column>
            <a-table-column title="类型" :width="100">
              <template #cell="{ record }">
                <a-tag :color="getTypeColor(record.element_type)">{{ getTypeLabel(record.element_type) }}</a-tag>
              </template>
            </a-table-column>
            <a-table-column title="预览" :width="220">
              <template #cell="{ record }">
                <div v-if="record.element_type === 'image' && record.image_path" class="table-preview">
                  <img :src="getPreviewUrl(record.image_path)" alt="element preview" class="preview-image" />
                </div>
                <div v-else-if="record.element_type === 'pos'" class="coordinate-preview">
                  {{ renderPos(record) }}
                </div>
                <div v-else-if="record.element_type === 'region'" class="coordinate-preview">
                  {{ renderRegion(record) }}
                </div>
                <span v-else class="muted-text">-</span>
              </template>
            </a-table-column>
            <a-table-column title="图片分类" :width="140">
              <template #cell="{ record }">{{ getImageCategory(record) || '-' }}</template>
            </a-table-column>
            <a-table-column title="定位方式" data-index="selector_type" :width="120" />
            <a-table-column title="定位值">
              <template #cell="{ record }">
                <span class="mono">{{ record.selector_value || '-' }}</span>
              </template>
            </a-table-column>
            <a-table-column title="状态" :width="120">
              <template #cell="{ record }">
                <a-switch :model-value="record.is_active" size="small" @change="value => toggleActive(record, Boolean(value))" />
              </template>
            </a-table-column>
            <a-table-column title="更新时间" :width="180">
              <template #cell="{ record }">{{ formatDateTime(record.updated_at) }}</template>
            </a-table-column>
            <a-table-column title="操作" :width="240" fixed="right">
              <template #cell="{ record }">
                <a-space>
                  <a-button type="text" @click="openDetail(record)">详情</a-button>
                  <a-button type="text" @click="duplicateElement(record)">复制</a-button>
                  <a-button type="text" @click="openEdit(record)">编辑</a-button>
                  <a-button type="text" status="danger" @click="remove(record.id)">删除</a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>

        <div class="pagination-row">
          <a-pagination
            v-model:current="pagination.current"
            v-model:page-size="pagination.pageSize"
            :total="elements.length"
            :show-total="true"
            :show-jumper="true"
            :show-page-size="true"
            :page-size-options="['10', '20', '50', '100']"
          />
        </div>
      </a-card>

      <a-modal
        v-model:visible="visible"
        :title="form.id ? '编辑元素' : '新增元素'"
        width="980px"
        @ok="submit"
        @cancel="closeEditor"
      >
        <a-form :model="form" layout="vertical">
          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item field="name" label="元素名称">
                <a-input v-model="form.name" placeholder="例如：登录按钮、首页搜索框" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item field="element_type" label="元素类型">
                <a-select v-model="form.element_type">
                  <a-option value="image">图片</a-option>
                  <a-option value="pos">坐标</a-option>
                  <a-option value="region">区域</a-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>

          <template v-if="form.element_type === 'image'">
            <div class="config-block">
              <div class="config-block-title">图片配置</div>
              <a-row :gutter="12">
                <a-col :span="12">
                  <a-form-item label="图片分类">
                    <a-select v-model="form.imageCategory" placeholder="选择分类">
                      <a-option v-for="category in imageCategories" :key="category.name" :value="category.name">
                        {{ category.name }} ({{ category.count }})
                      </a-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="新增分类">
                    <div class="inline-action">
                      <a-input v-model="newCategoryName" placeholder="输入新分类名称" />
                      <a-button :loading="categorySaving" @click="createCategory">创建</a-button>
                      <a-button
                        v-if="form.imageCategory && form.imageCategory !== 'common'"
                        status="danger"
                        :loading="categoryDeleting"
                        @click="deleteCurrentCategory"
                      >
                        删除
                      </a-button>
                    </div>
                  </a-form-item>
                </a-col>
              </a-row>

              <a-form-item label="图片资源">
                <div class="upload-shell">
                  <input ref="fileInputRef" type="file" accept="image/*" class="hidden-input" @change="handleFileChange" />
                  <a-space>
                    <a-button :loading="uploading" @click="triggerUpload">选择图片</a-button>
                    <span class="muted-text">{{ form.image_path || '未上传图片' }}</span>
                  </a-space>
                  <div v-if="imagePreviewUrl" class="form-preview">
                    <img :src="imagePreviewUrl" alt="uploaded preview" class="preview-image large" />
                  </div>
                </div>
              </a-form-item>

              <div class="summary-grid">
                <div class="summary-card">
                  <span class="summary-label">匹配阈值</span>
                  <a-input-number v-model="form.threshold" :min="0.5" :max="1" :step="0.05" />
                </div>
                <div class="summary-card">
                  <span class="summary-label">颜色模式</span>
                  <label class="switch-row">
                    <a-switch v-model="form.rgb" />
                    <span>{{ form.rgb ? 'RGB' : '灰度' }}</span>
                  </label>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="form.element_type === 'pos'">
            <div class="config-block">
              <div class="config-block-title">坐标配置</div>
              <a-row :gutter="12">
                <a-col :span="12">
                  <a-form-item label="坐标 X">
                    <a-input-number v-model="form.posX" :min="0" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="坐标 Y">
                    <a-input-number v-model="form.posY" :min="0" />
                  </a-form-item>
                </a-col>
              </a-row>
            </div>
          </template>

          <template v-else>
            <div class="config-block">
              <div class="config-block-title">区域配置</div>
              <a-row :gutter="12">
                <a-col :span="12">
                  <a-form-item label="左上角 X1">
                    <a-input-number v-model="form.regionX1" :min="0" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="左上角 Y1">
                    <a-input-number v-model="form.regionY1" :min="0" />
                  </a-form-item>
                </a-col>
              </a-row>
              <a-row :gutter="12">
                <a-col :span="12">
                  <a-form-item label="右下角 X2">
                    <a-input-number v-model="form.regionX2" :min="0" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="右下角 Y2">
                    <a-input-number v-model="form.regionY2" :min="0" />
                  </a-form-item>
                </a-col>
              </a-row>
            </div>
          </template>

          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item field="selector_type" label="定位方式">
                <a-input v-model="form.selector_type" placeholder="image / pos / region / text / xpath" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item field="selector_value" label="定位值">
                <a-input v-model="form.selector_value" placeholder="不填时会按元素类型自动生成默认值" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item field="tags" label="标签">
                <a-input v-model="form.tagsText" placeholder="使用逗号分隔，例如：登录, 首页, 支付" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="启用状态">
                <label class="switch-row">
                  <a-switch v-model="form.is_active" />
                  <span>{{ form.is_active ? '已启用' : '已停用' }}</span>
                </label>
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item field="description" label="描述">
            <a-textarea v-model="form.description" :auto-size="{ minRows: 3, maxRows: 6 }" />
          </a-form-item>

          <a-form-item field="config" label="扩展配置 JSON">
            <a-textarea v-model="form.configText" :auto-size="{ minRows: 6, maxRows: 10 }" />
          </a-form-item>
        </a-form>
      </a-modal>

      <a-modal v-model:visible="detailVisible" title="元素详情" width="760px" hide-cancel @ok="detailVisible = false">
        <div v-if="detailRecord" class="detail-layout">
          <div class="detail-preview">
            <img
              v-if="detailRecord.element_type === 'image' && detailRecord.image_path"
              :src="getPreviewUrl(detailRecord.image_path)"
              alt="element preview"
              class="preview-image large"
            />
            <div v-else class="detail-placeholder">
              <strong>{{ getTypeLabel(detailRecord.element_type) }}</strong>
              <span>{{ detailRecord.element_type === 'pos' ? renderPos(detailRecord) : renderRegion(detailRecord) }}</span>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">元素名称</span>
              <strong>{{ detailRecord.name }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">元素类型</span>
              <strong>{{ getTypeLabel(detailRecord.element_type) }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">定位方式</span>
              <strong>{{ detailRecord.selector_type || '-' }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">状态</span>
              <strong>{{ detailRecord.is_active ? '启用' : '停用' }}</strong>
            </div>
            <div class="detail-item detail-item-wide">
              <span class="detail-label">定位值</span>
              <strong class="mono">{{ detailRecord.selector_value || '-' }}</strong>
            </div>
            <div class="detail-item detail-item-wide">
              <span class="detail-label">标签</span>
              <div class="tag-row">
                <a-tag v-for="tag in detailRecord.tags" :key="tag" color="arcoblue">{{ tag }}</a-tag>
                <span v-if="!detailRecord.tags.length" class="muted-text">无</span>
              </div>
            </div>
            <div class="detail-item detail-item-wide">
              <span class="detail-label">描述</span>
              <strong>{{ detailRecord.description || '-' }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">创建时间</span>
              <strong>{{ formatDateTime(detailRecord.created_at || detailRecord.updated_at) }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">更新时间</span>
              <strong>{{ formatDateTime(detailRecord.updated_at) }}</strong>
            </div>
            <div class="detail-item detail-item-wide">
              <span class="detail-label">配置 JSON</span>
              <pre class="detail-json">{{ formatConfig(detailRecord.config) }}</pre>
            </div>
          </div>
        </div>
      </a-modal>

      <AppAutomationCaptureElementModal
        v-model:visible="captureVisible"
        :project-id="projectStore.currentProjectId"
        @success="handleCaptureSuccess"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { useProjectStore } from '@/store/projectStore'
import { AppAutomationService } from '../services/appAutomationService'
import type { AppElement, AppImageCategory } from '../types'
import AppAutomationCaptureElementModal from '../components/AppAutomationCaptureElementModal.vue'

const projectStore = useProjectStore()
const loading = ref(false)
const visible = ref(false)
const detailVisible = ref(false)
const captureVisible = ref(false)
const uploading = ref(false)
const batchDeleting = ref(false)
const categorySaving = ref(false)
const categoryDeleting = ref(false)
const search = ref('')
const typeFilter = ref<string>()
const elements = ref<AppElement[]>([])
const imageCategories = ref<AppImageCategory[]>([])
const newCategoryName = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const localPreviewUrl = ref('')
const detailRecord = ref<AppElement | null>(null)
const selectedElementIds = ref<number[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 10,
})

const rowSelection = {
  type: 'checkbox' as const,
  showCheckedAll: true,
}

const typeLabelMap: Record<string, string> = {
  image: '图片',
  pos: '坐标',
  region: '区域',
}

const typeColorMap: Record<string, string> = {
  image: 'arcoblue',
  pos: 'green',
  region: 'orange',
}

const form = reactive({
  id: 0,
  name: '',
  element_type: 'image',
  selector_type: 'image',
  selector_value: '',
  description: '',
  tagsText: '',
  configText: '{\n  "threshold": 0.7\n}',
  image_path: '',
  imageCategory: 'common',
  fileHash: '',
  is_active: true,
  threshold: 0.7,
  rgb: false,
  posX: 0,
  posY: 0,
  regionX1: 0,
  regionY1: 0,
  regionX2: 0,
  regionY2: 0,
})

const imagePreviewUrl = computed(() => {
  if (localPreviewUrl.value) {
    return localPreviewUrl.value
  }
  if (form.image_path) {
    return AppAutomationService.getElementAssetUrl(form.image_path)
  }
  return ''
})

const pagedElements = computed(() => {
  const start = (pagination.current - 1) * pagination.pageSize
  return elements.value.slice(start, start + pagination.pageSize)
})

const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const formatDateTime = (value?: string) => {
  if (!value) {
    return '-'
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('zh-CN')
}

const formatConfig = (value: Record<string, unknown>) => JSON.stringify(value || {}, null, 2)

const getTypeLabel = (value: string) => typeLabelMap[value] || value || '未知'

const getTypeColor = (value: string) => typeColorMap[value] || 'gray'

const updateLocalPreviewUrl = (value: string) => {
  if (localPreviewUrl.value && localPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(localPreviewUrl.value)
  }
  localPreviewUrl.value = value
}

const parseObjectText = (text: string) => {
  const raw = String(text || '').trim()
  if (!raw) {
    return {}
  }
  const parsed = JSON.parse(raw)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('扩展配置 JSON 必须是对象')
  }
  return parsed as Record<string, unknown>
}

const getPreviewUrl = (imagePath?: string) => (imagePath ? AppAutomationService.getElementAssetUrl(imagePath) : '')

const getImageCategory = (record: AppElement) => {
  const config = record.config as Record<string, unknown>
  if (config?.image_category) return String(config.image_category)
  if (record.image_path?.includes('/')) return record.image_path.split('/')[0]
  return ''
}

const renderPos = (record: AppElement) => {
  const config = record.config as Record<string, unknown>
  return `X: ${config?.x ?? '-'} / Y: ${config?.y ?? '-'}`
}

const renderRegion = (record: AppElement) => {
  const config = record.config as Record<string, unknown>
  return `(${config?.x1 ?? '-'}, ${config?.y1 ?? '-'}) - (${config?.x2 ?? '-'}, ${config?.y2 ?? '-'})`
}

const parseConfig = (record: AppElement) => {
  const config = cloneValue(record.config || {})
  const imageCategory =
    String((config as Record<string, unknown>).image_category || '') ||
    (record.image_path?.includes('/') ? record.image_path.split('/')[0] : '') ||
    'common'
  return {
    config,
    imageCategory,
    fileHash: String((config as Record<string, unknown>).file_hash || ''),
    threshold: Number((config as Record<string, unknown>).threshold ?? 0.7) || 0.7,
    rgb: Boolean((config as Record<string, unknown>).rgb),
    posX: Number((config as Record<string, unknown>).x ?? 0) || 0,
    posY: Number((config as Record<string, unknown>).y ?? 0) || 0,
    regionX1: Number((config as Record<string, unknown>).x1 ?? 0) || 0,
    regionY1: Number((config as Record<string, unknown>).y1 ?? 0) || 0,
    regionX2: Number((config as Record<string, unknown>).x2 ?? 0) || 0,
    regionY2: Number((config as Record<string, unknown>).y2 ?? 0) || 0,
  }
}

const resetForm = () => {
  form.id = 0
  form.name = ''
  form.element_type = 'image'
  form.selector_type = 'image'
  form.selector_value = ''
  form.description = ''
  form.tagsText = ''
  form.configText = '{\n  "threshold": 0.7\n}'
  form.image_path = ''
  form.imageCategory = 'common'
  form.fileHash = ''
  form.is_active = true
  form.threshold = 0.7
  form.rgb = false
  form.posX = 0
  form.posY = 0
  form.regionX1 = 0
  form.regionY1 = 0
  form.regionX2 = 0
  form.regionY2 = 0
  newCategoryName.value = ''
  updateLocalPreviewUrl('')
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const closeEditor = () => {
  visible.value = false
  resetForm()
}

const buildSelectorValue = () => {
  if (form.selector_value.trim()) {
    return form.selector_value.trim()
  }
  if (form.element_type === 'image') {
    return form.image_path.trim()
  }
  if (form.element_type === 'pos') {
    return `${form.posX},${form.posY}`
  }
  return `${form.regionX1},${form.regionY1},${form.regionX2},${form.regionY2}`
}

const buildSelectorType = () => {
  if (form.selector_type.trim()) {
    return form.selector_type.trim()
  }
  return form.element_type === 'image' ? 'image' : form.element_type
}

const buildConfigPayload = () => {
  const parsedConfig = parseObjectText(form.configText)
  if (form.element_type === 'image') {
    parsedConfig.image_category = form.imageCategory || 'common'
    parsedConfig.image_path = form.image_path
    parsedConfig.threshold = form.threshold
    parsedConfig.rgb = form.rgb
    if (form.fileHash) {
      parsedConfig.file_hash = form.fileHash
    } else {
      delete parsedConfig.file_hash
    }
    return parsedConfig
  }

  if (form.element_type === 'pos') {
    parsedConfig.x = form.posX
    parsedConfig.y = form.posY
    return parsedConfig
  }

  parsedConfig.x1 = form.regionX1
  parsedConfig.y1 = form.regionY1
  parsedConfig.x2 = form.regionX2
  parsedConfig.y2 = form.regionY2
  parsedConfig.width = Math.max(form.regionX2 - form.regionX1, 0)
  parsedConfig.height = Math.max(form.regionY2 - form.regionY1, 0)
  return parsedConfig
}

const buildPayloadFromForm = () => ({
  project_id: projectStore.currentProjectId as number,
  name: form.name.trim(),
  element_type: form.element_type,
  selector_type: buildSelectorType(),
  selector_value: buildSelectorValue(),
  description: form.description.trim(),
  tags: form.tagsText
    .split(',')
    .map(item => item.trim())
    .filter(Boolean),
  config: buildConfigPayload(),
  image_path: form.image_path,
  is_active: form.is_active,
})

const buildPayloadFromRecord = (record: AppElement, overrides?: Partial<AppElement> & { name?: string; is_active?: boolean }) => ({
  project_id: record.project_id,
  name: String(overrides?.name ?? record.name).trim(),
  element_type: String(overrides?.element_type ?? record.element_type),
  selector_type: String(overrides?.selector_type ?? record.selector_type),
  selector_value: String(overrides?.selector_value ?? record.selector_value),
  description: String(overrides?.description ?? record.description),
  tags: [...record.tags],
  config: cloneValue(record.config || {}),
  image_path: String(overrides?.image_path ?? record.image_path),
  is_active: typeof overrides?.is_active === 'boolean' ? overrides.is_active : record.is_active,
})

const findAvailableName = (baseName: string) => {
  const existingNames = new Set(elements.value.map(item => item.name.toLowerCase()))
  const baseCandidate = `${baseName}_副本`
  if (!existingNames.has(baseCandidate.toLowerCase())) {
    return baseCandidate
  }

  let index = 2
  while (existingNames.has(`${baseName}_副本(${index})`.toLowerCase())) {
    index += 1
  }
  return `${baseName}_副本(${index})`
}

const loadCategories = async () => {
  try {
    imageCategories.value = await AppAutomationService.getElementImageCategories()
    if (!imageCategories.value.some(item => item.name === form.imageCategory)) {
      form.imageCategory = imageCategories.value[0]?.name || 'common'
    }
  } catch (error: any) {
    Message.error(error.message || '加载图片分类失败')
  }
}

const loadElements = async () => {
  if (!projectStore.currentProjectId) {
    elements.value = []
    selectedElementIds.value = []
    return
  }

  loading.value = true
  try {
    elements.value = await AppAutomationService.getElements(projectStore.currentProjectId, search.value, typeFilter.value)
    selectedElementIds.value = selectedElementIds.value.filter(id => elements.value.some(item => item.id === id))
    const maxPage = Math.max(1, Math.ceil(elements.value.length / pagination.pageSize))
    if (pagination.current > maxPage) {
      pagination.current = maxPage
    }
  } catch (error: any) {
    Message.error(error.message || '加载元素失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = async () => {
  pagination.current = 1
  await loadElements()
}

const handleTypeChange = async () => {
  pagination.current = 1
  await loadElements()
}

const openCreate = async () => {
  resetForm()
  await loadCategories()
  visible.value = true
}

const openEdit = async (record: AppElement) => {
  resetForm()
  await loadCategories()
  form.id = record.id
  form.name = record.name
  form.element_type = record.element_type
  form.selector_type = record.selector_type
  form.selector_value = record.selector_value
  form.description = record.description
  form.tagsText = record.tags.join(', ')
  form.image_path = record.image_path
  form.is_active = record.is_active

  const parsed = parseConfig(record)
  form.imageCategory = parsed.imageCategory
  form.fileHash = parsed.fileHash
  form.threshold = parsed.threshold
  form.rgb = parsed.rgb
  form.posX = parsed.posX
  form.posY = parsed.posY
  form.regionX1 = parsed.regionX1
  form.regionY1 = parsed.regionY1
  form.regionX2 = parsed.regionX2
  form.regionY2 = parsed.regionY2
  form.configText = JSON.stringify(parsed.config, null, 2)
  visible.value = true
}

const openDetail = (record: AppElement) => {
  detailRecord.value = record
  detailVisible.value = true
}

const triggerUpload = () => {
  fileInputRef.value?.click()
}

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !projectStore.currentProjectId) {
    return
  }

  updateLocalPreviewUrl(URL.createObjectURL(file))
  uploading.value = true
  try {
    const result = await AppAutomationService.uploadElementAsset(
      file,
      projectStore.currentProjectId,
      form.imageCategory || 'common',
      form.id || undefined,
    )
    form.image_path = result.image_path
    form.imageCategory = result.image_category || form.imageCategory
    form.fileHash = result.file_hash
    if (!form.selector_value.trim()) {
      form.selector_type = 'image'
    }
    Message.success(result.duplicate ? '检测到重复图片，已复用现有资源' : '图片已上传')
    await loadCategories()
  } catch (error: any) {
    Message.error(error.message || '上传图片失败')
  } finally {
    uploading.value = false
  }
}

const createCategory = async () => {
  const name = newCategoryName.value.trim()
  if (!name) {
    Message.warning('请输入分类名称')
    return
  }
  categorySaving.value = true
  try {
    const created = await AppAutomationService.createElementImageCategory(name)
    form.imageCategory = created.name
    newCategoryName.value = ''
    Message.success('图片分类已创建')
    await loadCategories()
  } catch (error: any) {
    Message.error(error.message || '创建图片分类失败')
  } finally {
    categorySaving.value = false
  }
}

const deleteCurrentCategory = () => {
  if (!form.imageCategory || form.imageCategory === 'common') {
    Message.warning('默认分类不可删除')
    return
  }

  Modal.confirm({
    title: '删除图片分类',
    content: `确认删除分类 “${form.imageCategory}” 吗？分类必须为空才能删除。`,
    onOk: async () => {
      categoryDeleting.value = true
      try {
        await AppAutomationService.deleteElementImageCategory(form.imageCategory)
        form.imageCategory = 'common'
        Message.success('图片分类已删除')
        await loadCategories()
      } finally {
        categoryDeleting.value = false
      }
    },
  })
}

const duplicateElement = async (record: AppElement) => {
  try {
    const nextName = findAvailableName(record.name)
    await AppAutomationService.createElement(buildPayloadFromRecord(record, { name: nextName }))
    Message.success(`元素已复制为 ${nextName}`)
    await loadElements()
  } catch (error: any) {
    Message.error(error.message || '复制元素失败')
  }
}

const toggleActive = async (record: AppElement, nextValue: boolean) => {
  const previousValue = record.is_active
  record.is_active = nextValue
  try {
    await AppAutomationService.updateElement(record.id, buildPayloadFromRecord(record, { is_active: nextValue }))
    Message.success(nextValue ? '元素已启用' : '元素已停用')
  } catch (error: any) {
    record.is_active = previousValue
    Message.error(error.message || '更新元素状态失败')
  }
}

const submit = async () => {
  if (!projectStore.currentProjectId) {
    return
  }

  try {
    const payload = buildPayloadFromForm()
    if (!payload.name) {
      Message.warning('请输入元素名称')
      return
    }
    if (payload.element_type === 'image' && !payload.image_path) {
      Message.warning('请先上传图片资源')
      return
    }

    if (form.id) {
      await AppAutomationService.updateElement(form.id, payload)
      Message.success('元素已更新')
    } else {
      await AppAutomationService.createElement(payload)
      Message.success('元素已创建')
    }

    closeEditor()
    await Promise.all([loadElements(), loadCategories()])
  } catch (error: any) {
    Message.error(error.message || '保存元素失败，请检查扩展配置 JSON')
  }
}

const remove = (id: number) => {
  Modal.confirm({
    title: '删除元素',
    content: '确认删除这个元素吗？',
    onOk: async () => {
      await AppAutomationService.deleteElement(id)
      Message.success('元素已删除')
      await loadElements()
    },
  })
}

const clearSelection = () => {
  selectedElementIds.value = []
}

const removeSelected = () => {
  if (!selectedElementIds.value.length) {
    Message.warning('请先选择要删除的元素')
    return
  }

  const ids = [...selectedElementIds.value]
  Modal.confirm({
    title: '批量删除元素',
    content: `确认删除已选择的 ${ids.length} 个元素吗？此操作不可恢复。`,
    onOk: async () => {
      batchDeleting.value = true
      try {
        const results = await Promise.allSettled(ids.map(id => AppAutomationService.deleteElement(id)))
        const successCount = results.filter(result => result.status === 'fulfilled').length
        const failedCount = ids.length - successCount

        if (!successCount) {
          Message.error('批量删除失败')
          return
        }

        selectedElementIds.value = []
        if (failedCount) {
          Message.warning(`已删除 ${successCount} 个元素，${failedCount} 个删除失败`)
        } else {
          Message.success(`已删除 ${successCount} 个元素`)
        }
        await loadElements()
      } finally {
        batchDeleting.value = false
      }
    },
  })
}

const handleCaptureSuccess = async () => {
  await Promise.all([loadElements(), loadCategories()])
}

watch(
  () => form.element_type,
  value => {
    if (value === 'image' && !form.selector_type.trim()) {
      form.selector_type = 'image'
    }
    if (value === 'pos' && !form.selector_type.trim()) {
      form.selector_type = 'pos'
    }
    if (value === 'region' && !form.selector_type.trim()) {
      form.selector_type = 'region'
    }
  },
)

watch(
  () => projectStore.currentProjectId,
  () => {
    detailVisible.value = false
    detailRecord.value = null
    closeEditor()
    void Promise.all([loadElements(), loadCategories()])
  },
  { immediate: true },
)
</script>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-shell {
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-card-bg);
  border: 1px solid var(--theme-card-border);
  border-radius: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header h3 {
  margin: 0;
  color: var(--theme-text);
}

.page-header p {
  margin: 6px 0 0;
  color: var(--theme-text-secondary);
}

.table-card {
  border-radius: 16px;
  border: 1px solid var(--theme-card-border);
  background: var(--theme-card-bg);
  box-shadow: var(--theme-card-shadow);
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.16);
  background: rgba(var(--theme-accent-rgb), 0.05);
  color: var(--theme-text);
}

.name-button {
  padding: 0;
}

.table-preview,
.form-preview {
  display: flex;
  align-items: center;
}

.preview-image {
  width: 160px;
  height: 90px;
  object-fit: contain;
  border-radius: 12px;
  border: 1px solid var(--theme-card-border);
  background: rgba(255, 255, 255, 0.04);
}

.preview-image.large {
  width: min(100%, 360px);
  height: auto;
  max-height: 260px;
  padding: 8px;
}

.coordinate-preview,
.muted-text {
  color: var(--theme-text-secondary);
  font-size: 13px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.config-block {
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.16);
  border-radius: 14px;
  background: rgba(var(--theme-accent-rgb), 0.05);
}

.config-block-title {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-text);
}

.upload-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hidden-input {
  display: none;
}

.inline-action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--theme-card-border);
  background: var(--theme-card-bg);
}

.summary-label {
  color: var(--theme-text-secondary);
  font-size: 13px;
}

.switch-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.detail-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 20px;
}

.detail-preview {
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.detail-placeholder {
  width: 100%;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px dashed var(--theme-card-border);
  border-radius: 14px;
  color: var(--theme-text-secondary);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--theme-card-border);
  background: rgba(var(--theme-accent-rgb), 0.04);
}

.detail-item-wide {
  grid-column: 1 / -1;
}

.detail-label {
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.detail-json {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--theme-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 960px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .inline-action,
  .summary-grid,
  .detail-layout,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .batch-bar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
