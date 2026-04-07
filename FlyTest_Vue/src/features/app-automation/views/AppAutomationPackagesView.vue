<template>
  <div class="page-shell">
    <div v-if="!projectStore.currentProjectId" class="empty-shell">
      <a-empty description="请先选择项目后管理 APP 应用包" />
    </div>
    <template v-else>
      <div class="page-header">
        <div>
          <h3>应用包</h3>
          <p>集中维护 APP 包名、启动 Activity、平台信息与更新时间，方便设备执行与场景复用。</p>
        </div>
        <a-space wrap class="page-actions">
          <a-button :loading="loading" @click="loadPackages">刷新</a-button>
          <a-button type="primary" @click="openCreate">新增应用包</a-button>
        </a-space>
      </div>

      <div class="stats-grid">
        <a-card class="stat-card">
          <span class="stat-label">应用包总数</span>
          <strong>{{ packageStats.total }}</strong>
          <span class="stat-desc">当前筛选范围内可管理的 APP 包数量</span>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">Android 包</span>
          <strong>{{ packageStats.android }}</strong>
          <span class="stat-desc">适用于 Android 设备执行与调试</span>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">iOS 包</span>
          <strong>{{ packageStats.ios }}</strong>
          <span class="stat-desc">已登记的 iOS 包与启动信息</span>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">已配置 Activity</span>
          <strong>{{ packageStats.configuredActivity }}</strong>
          <span class="stat-desc">可直接用于启动或执行的应用包</span>
        </a-card>
      </div>

      <a-card class="filter-card">
        <div class="filter-grid">
          <a-input-search
            v-model="search"
            allow-clear
            placeholder="搜索应用名称、包名、Activity 或描述"
            @search="handleSearch"
          />
          <a-select v-model="platformFilter" allow-clear placeholder="全部平台">
            <a-option value="">全部平台</a-option>
            <a-option value="android">Android</a-option>
            <a-option value="ios">iOS</a-option>
          </a-select>
          <div class="filter-actions">
            <a-button @click="resetFilters">重置</a-button>
            <a-button type="primary" @click="handleSearch">查询</a-button>
          </div>
        </div>
      </a-card>

      <a-card class="table-card">
        <a-table :data="pagedPackages" :loading="loading" :pagination="false" row-key="id">
          <template #columns>
            <a-table-column title="应用名称" :width="260">
              <template #cell="{ record }">
                <div class="meta-stack">
                  <strong>{{ record.name }}</strong>
                  <span>{{ record.description || '未填写描述' }}</span>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="包名" :width="240">
              <template #cell="{ record }">
                <div class="meta-stack">
                  <strong>{{ record.package_name }}</strong>
                  <span>ID: {{ record.id }}</span>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="启动 Activity" :width="240">
              <template #cell="{ record }">
                <span>{{ record.activity_name || '未配置' }}</span>
              </template>
            </a-table-column>
            <a-table-column title="平台" :width="120">
              <template #cell="{ record }">
                <a-tag :color="getPlatformColor(record.platform)">{{ getPlatformLabel(record.platform) }}</a-tag>
              </template>
            </a-table-column>
            <a-table-column title="创建时间" :width="180">
              <template #cell="{ record }">
                <span>{{ formatDateTime(record.created_at) }}</span>
              </template>
            </a-table-column>
            <a-table-column title="更新时间" :width="180">
              <template #cell="{ record }">
                <span>{{ formatDateTime(record.updated_at) }}</span>
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="180" fixed="right">
              <template #cell="{ record }">
                <a-space wrap>
                  <a-button type="text" @click="openEdit(record)">编辑</a-button>
                  <a-button type="text" status="danger" @click="remove(record)">删除</a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>

        <div class="pagination-row">
          <a-pagination
            v-model:current="pagination.current"
            v-model:page-size="pagination.pageSize"
            :total="filteredPackages.length"
            :show-total="true"
            :show-jumper="true"
            :show-page-size="true"
            :page-size-options="['10', '20', '50']"
          />
        </div>
      </a-card>

      <a-modal
        v-model:visible="visible"
        :title="form.id ? '编辑应用包' : '新增应用包'"
        :ok-loading="submitting"
        width="640px"
        @ok="submit"
      >
        <a-form :model="form" layout="vertical">
          <div class="form-grid">
            <a-form-item field="name" label="应用名称">
              <a-input v-model="form.name" placeholder="例如：Android 设置" />
            </a-form-item>
            <a-form-item field="platform" label="平台">
              <a-select v-model="form.platform" placeholder="选择平台">
                <a-option value="android">Android</a-option>
                <a-option value="ios">iOS</a-option>
              </a-select>
            </a-form-item>
          </div>
          <a-form-item field="package_name" label="包名">
            <a-input v-model="form.package_name" placeholder="例如：com.android.settings" />
          </a-form-item>
          <a-form-item field="activity_name" label="启动 Activity">
            <a-input v-model="form.activity_name" placeholder="例如：.Settings" />
          </a-form-item>
          <a-form-item field="description" label="描述">
            <a-textarea
              v-model="form.description"
              placeholder="补充该应用包的用途、登录前置条件或注意事项"
              :auto-size="{ minRows: 3, maxRows: 6 }"
            />
          </a-form-item>
        </a-form>
      </a-modal>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { useProjectStore } from '@/store/projectStore'
import { AppAutomationService } from '../services/appAutomationService'
import type { AppPackage } from '../types'

const projectStore = useProjectStore()
const loading = ref(false)
const submitting = ref(false)
const visible = ref(false)
const search = ref('')
const platformFilter = ref('')
const packages = ref<AppPackage[]>([])
const pagination = reactive({
  current: 1,
  pageSize: 10,
})
const form = reactive({
  id: 0,
  project_id: 0,
  name: '',
  package_name: '',
  activity_name: '',
  platform: 'android',
  description: '',
})

const filteredPackages = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return packages.value.filter(item => {
    if (platformFilter.value && item.platform !== platformFilter.value) {
      return false
    }

    if (!keyword) {
      return true
    }

    return [item.name, item.package_name, item.activity_name, item.description]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const pagedPackages = computed(() => {
  const start = (pagination.current - 1) * pagination.pageSize
  return filteredPackages.value.slice(start, start + pagination.pageSize)
})

const packageStats = computed(() => ({
  total: filteredPackages.value.length,
  android: filteredPackages.value.filter(item => item.platform === 'android').length,
  ios: filteredPackages.value.filter(item => item.platform === 'ios').length,
  configuredActivity: filteredPackages.value.filter(item => Boolean(item.activity_name?.trim())).length,
}))

const resetForm = () => {
  form.id = 0
  form.project_id = projectStore.currentProjectId || 0
  form.name = ''
  form.package_name = ''
  form.activity_name = ''
  form.platform = 'android'
  form.description = ''
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

const getPlatformLabel = (platform: string) => {
  if (platform === 'android') return 'Android'
  if (platform === 'ios') return 'iOS'
  return platform || '-'
}

const getPlatformColor = (platform: string) => {
  if (platform === 'android') return 'green'
  if (platform === 'ios') return 'arcoblue'
  return 'gray'
}

const loadPackages = async () => {
  if (!projectStore.currentProjectId) {
    packages.value = []
    return
  }
  loading.value = true
  try {
    packages.value = await AppAutomationService.getPackages(projectStore.currentProjectId)
  } catch (error: any) {
    Message.error(error.message || '加载应用包失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.current = 1
}

const resetFilters = () => {
  search.value = ''
  platformFilter.value = ''
  pagination.current = 1
}

const openCreate = () => {
  resetForm()
  visible.value = true
}

const openEdit = (record: AppPackage) => {
  form.id = record.id
  form.project_id = record.project_id
  form.name = record.name
  form.package_name = record.package_name
  form.activity_name = record.activity_name
  form.platform = record.platform || 'android'
  form.description = record.description
  visible.value = true
}

const submit = async () => {
  if (!form.name.trim() || !form.package_name.trim()) {
    Message.warning('请先填写应用名称和包名')
    return
  }

  submitting.value = true
  try {
    const payload = {
      project_id: projectStore.currentProjectId || form.project_id,
      name: form.name.trim(),
      package_name: form.package_name.trim(),
      activity_name: form.activity_name.trim(),
      platform: form.platform || 'android',
      description: form.description.trim(),
    }
    if (form.id) {
      await AppAutomationService.updatePackage(form.id, payload)
      Message.success('应用包已更新')
    } else {
      await AppAutomationService.createPackage(payload)
      Message.success('应用包已创建')
    }
    visible.value = false
    await loadPackages()
  } catch (error: any) {
    Message.error(error.message || '保存应用包失败')
  } finally {
    submitting.value = false
  }
}

const remove = (record: AppPackage) => {
  Modal.confirm({
    title: '删除应用包',
    content: `确认删除应用包“${record.name}”吗？`,
    onOk: async () => {
      try {
        await AppAutomationService.deletePackage(record.id)
        Message.success('应用包已删除')
        await loadPackages()
      } catch (error: any) {
        Message.error(error.message || '删除应用包失败')
      }
    },
  })
}

watch([search, platformFilter, () => pagination.pageSize], () => {
  pagination.current = 1
})

watch(
  () => filteredPackages.value.length,
  total => {
    const maxPage = Math.max(1, Math.ceil(total / pagination.pageSize))
    if (pagination.current > maxPage) {
      pagination.current = maxPage
    }
  },
)

watch(
  () => projectStore.currentProjectId,
  () => {
    resetForm()
    resetFilters()
    void loadPackages()
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

.page-actions,
.filter-actions,
.pagination-row {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.filter-card,
.table-card,
.stat-card {
  border-radius: 16px;
  border: 1px solid var(--theme-card-border);
  background: var(--theme-card-bg);
  box-shadow: var(--theme-card-shadow);
}

.filter-grid {
  display: grid;
  grid-template-columns: minmax(260px, 1.6fr) 180px auto;
  gap: 12px;
  align-items: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  color: var(--theme-text-secondary);
}

.stat-card strong {
  font-size: 28px;
  color: var(--theme-text);
}

.stat-desc {
  font-size: 12px;
  color: var(--theme-text-secondary);
  line-height: 1.6;
}

.meta-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meta-stack strong {
  color: var(--theme-text);
}

.meta-stack span {
  color: var(--theme-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.pagination-row {
  margin-top: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-grid {
    grid-template-columns: minmax(240px, 1fr) 180px;
  }

  .filter-actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-actions,
  .filter-actions,
  .pagination-row {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .stats-grid,
  .filter-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
