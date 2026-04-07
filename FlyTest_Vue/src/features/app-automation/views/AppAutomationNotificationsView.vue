<template>
  <div class="page-shell">
    <div class="page-header">
      <div>
        <h3>通知日志</h3>
        <p>查看 APP 自动化任务的通知投递结果、重试状态和关联执行上下文。</p>
      </div>
      <a-space>
        <a-button @click="loadData" :loading="loading">刷新</a-button>
      </a-space>
    </div>

    <a-alert v-if="taskContext" type="info" class="context-alert">
      当前仅查看任务“{{ taskContext.name }}”的通知日志。
      <template #action>
        <a-space>
          <a-button size="mini" type="text" @click="openTaskDetail(taskContext.id)">查看任务</a-button>
          <a-button size="mini" type="text" @click="clearTaskContext">清除筛选</a-button>
        </a-space>
      </template>
    </a-alert>

    <a-card class="filter-card">
      <div class="filter-grid">
        <a-input-search
          v-model="filters.search"
          allow-clear
          placeholder="搜索任务名称、通知内容或错误信息"
          @search="handleSearch"
        />
        <a-select v-model="filters.status" allow-clear placeholder="发送状态">
          <a-option value="success">success</a-option>
          <a-option value="failed">failed</a-option>
          <a-option value="pending">pending</a-option>
        </a-select>
        <a-select v-model="filters.notification_type" allow-clear placeholder="通知类型">
          <a-option value="email">email</a-option>
          <a-option value="webhook">webhook</a-option>
          <a-option value="both">both</a-option>
        </a-select>
        <a-date-picker
          v-model="filters.start_date"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          placeholder="开始日期"
        />
        <a-date-picker
          v-model="filters.end_date"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          placeholder="结束日期"
        />
        <div class="filter-actions">
          <a-button @click="resetFilters">重置</a-button>
          <a-button type="primary" @click="handleSearch">查询</a-button>
        </div>
      </div>
    </a-card>

    <div class="stats-grid">
      <a-card class="stat-card">
        <span class="stat-label">日志总数</span>
        <strong>{{ statistics.total }}</strong>
        <span class="stat-desc">当前筛选范围内的通知记录数量</span>
      </a-card>
      <a-card class="stat-card">
        <span class="stat-label">发送成功</span>
        <strong>{{ statistics.success }}</strong>
        <span class="stat-desc">成功送达邮箱或 Webhook 的记录</span>
      </a-card>
      <a-card class="stat-card">
        <span class="stat-label">发送失败</span>
        <strong>{{ statistics.failed }}</strong>
        <span class="stat-desc">失败记录可进入详情查看并重试</span>
      </a-card>
      <a-card class="stat-card">
        <span class="stat-label">已重试</span>
        <strong>{{ statistics.retried }}</strong>
        <span class="stat-desc">已经触发过重试的通知条目</span>
      </a-card>
    </div>

    <a-card class="table-card">
      <a-table :data="pagedLogs" :loading="loading" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="任务" :width="220">
            <template #cell="{ record }">
              <div class="meta-stack">
                <strong>{{ record.task_name || '-' }}</strong>
                <span>{{ getTaskTypeLabel(record.task_type) }}</span>
              </div>
            </template>
          </a-table-column>

          <a-table-column title="通知类型" :width="150">
            <template #cell="{ record }">
              <a-tag :color="getNotificationTypeColor(record.actual_notification_type || record.notification_type)">
                {{ getNotificationTypeLabel(record.actual_notification_type || record.notification_type) }}
              </a-tag>
            </template>
          </a-table-column>

          <a-table-column title="接收对象" :width="240">
            <template #cell="{ record }">
              <div class="meta-stack">
                <span>{{ recipientSummary(record) }}</span>
                <small>发送者：{{ record.sender_name || 'FlyTest' }}</small>
              </div>
            </template>
          </a-table-column>

          <a-table-column title="状态 / 结果" :width="200">
            <template #cell="{ record }">
              <div class="meta-stack">
                <a-tag :color="getStatusColor(record.status)">{{ record.status }}</a-tag>
                <small>{{ getDeliverySummary(record) }}</small>
              </div>
            </template>
          </a-table-column>

          <a-table-column title="通知时间" :width="210">
            <template #cell="{ record }">
              <div class="meta-stack">
                <span>创建：{{ formatDateTime(record.created_at) }}</span>
                <small>发送：{{ formatDateTime(record.sent_at) }}</small>
              </div>
            </template>
          </a-table-column>

          <a-table-column title="操作" :width="280" fixed="right">
            <template #cell="{ record }">
              <a-space wrap>
                <a-button type="text" @click="viewDetail(record)">详情</a-button>
                <a-button v-if="record.task_id" type="text" @click="openTaskDetail(record.task_id)">任务</a-button>
                <a-button
                  v-if="getPrimaryExecutionId(record)"
                  type="text"
                  @click="openExecution(record)"
                >
                  执行
                </a-button>
                <a-button
                  v-if="record.status !== 'success'"
                  type="text"
                  :loading="retryingId === record.id"
                  @click="retry(record.id)"
                >
                  重试
                </a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>

      <div class="pagination-row">
        <a-pagination
          v-model:current="pagination.current"
          v-model:page-size="pagination.pageSize"
          :total="filteredLogs.length"
          :show-total="true"
          :show-jumper="true"
          :show-page-size="true"
          :page-size-options="['10', '20', '50']"
        />
      </div>
    </a-card>

    <a-modal v-model:visible="detailVisible" title="通知详情" width="900px" :footer="false">
      <div v-if="currentLog" class="detail-shell">
        <div class="detail-grid">
          <div class="detail-card">
            <span class="detail-label">任务名称</span>
            <strong>{{ currentLog.task_name || '-' }}</strong>
          </div>
          <div class="detail-card">
            <span class="detail-label">任务类型</span>
            <strong>{{ getTaskTypeLabel(currentLog.task_type) }}</strong>
          </div>
          <div class="detail-card">
            <span class="detail-label">通知类型</span>
            <strong>{{ getNotificationTypeLabel(currentLog.actual_notification_type || currentLog.notification_type) }}</strong>
          </div>
          <div class="detail-card">
            <span class="detail-label">发送状态</span>
            <strong>{{ currentLog.status }}</strong>
          </div>
        </div>

        <a-card class="detail-panel" title="投递信息">
          <div class="meta-row">
            <span>发送者：{{ currentLog.sender_name || '-' }}</span>
            <span>发送邮箱：{{ currentLog.sender_email || '-' }}</span>
            <span>接收对象：{{ recipientSummary(currentLog) }}</span>
            <span>创建时间：{{ formatDateTime(currentLog.created_at) }}</span>
            <span>发送时间：{{ formatDateTime(currentLog.sent_at) }}</span>
            <span>重试次数：{{ currentLog.retry_count || 0 }}</span>
          </div>
          <a-space wrap>
            <a-button v-if="currentLog.task_id" @click="openTaskDetail(currentLog.task_id)">查看任务</a-button>
            <a-button v-if="getPrimaryExecutionId(currentLog)" type="primary" @click="openExecution(currentLog)">
              查看执行
            </a-button>
            <a-button
              v-if="currentLog.status !== 'success'"
              :loading="retryingId === currentLog.id"
              @click="retry(currentLog.id)"
            >
              立即重试
            </a-button>
          </a-space>
        </a-card>

        <a-card class="detail-panel" title="通知内容">
          <div v-if="parsedContent.length" class="parsed-content">
            <div v-for="item in parsedContent" :key="`${item.label}-${item.value}`" class="parsed-row">
              <span class="parsed-label">{{ item.label }}</span>
              <span class="parsed-value">{{ item.value }}</span>
            </div>
          </div>
          <a-textarea
            v-else
            :model-value="currentLog.notification_content || '-'"
            readonly
            :auto-size="{ minRows: 8, maxRows: 16 }"
          />
        </a-card>

        <a-card class="detail-panel" title="响应 / 错误信息">
          <a-alert v-if="currentLog.error_message" type="error" class="detail-alert">
            {{ currentLog.error_message }}
          </a-alert>
          <a-textarea
            :model-value="JSON.stringify(currentLog.response_info || {}, null, 2)"
            readonly
            :auto-size="{ minRows: 8, maxRows: 16 }"
          />
        </a-card>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useRoute, useRouter } from 'vue-router'
import { AppAutomationService } from '../services/appAutomationService'
import type { AppNotificationLog, AppScheduledTask } from '../types'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const retryingId = ref<number | null>(null)
const detailVisible = ref(false)
const currentLog = ref<AppNotificationLog | null>(null)
const logs = ref<AppNotificationLog[]>([])
const taskContext = ref<AppScheduledTask | null>(null)

const filters = reactive({
  search: '',
  status: '',
  notification_type: '',
  start_date: '',
  end_date: '',
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
})

const currentTaskId = computed(() => {
  const value = Number(route.query.taskId || 0)
  return value > 0 ? value : null
})

const filteredLogs = computed(() => {
  const keyword = filters.search.trim().toLowerCase()

  return logs.value.filter(log => {
    if (filters.status && log.status !== filters.status) return false

    const notificationType = String(log.actual_notification_type || log.notification_type || '')
    if (filters.notification_type && notificationType !== filters.notification_type) return false

    if (!keyword) return true

    return [
      log.task_name,
      log.notification_content,
      notificationType,
      recipientSummary(log),
      log.error_message,
      JSON.stringify(log.response_info || {}),
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const pagedLogs = computed(() => {
  const start = (pagination.current - 1) * pagination.pageSize
  return filteredLogs.value.slice(start, start + pagination.pageSize)
})

const statistics = computed(() => ({
  total: filteredLogs.value.length,
  success: filteredLogs.value.filter(item => item.status === 'success').length,
  failed: filteredLogs.value.filter(item => item.status === 'failed').length,
  retried: filteredLogs.value.filter(item => item.is_retried).length,
}))

const parsedContent = computed(() => {
  const content = currentLog.value?.notification_content
  if (!content) return []

  try {
    const payload = JSON.parse(content)
    const rawText =
      payload.markdown?.content ||
      payload.markdown?.text ||
      payload.card?.elements?.[0]?.text?.content ||
      ''

    if (!rawText) {
      return []
    }

    return rawText
      .split('\n')
      .map(item => item.trim())
      .filter(item => item && !item.includes('**'))
      .map(item => {
        const index = item.indexOf(':')
        return index > 0
          ? { label: item.slice(0, index).trim(), value: item.slice(index + 1).trim() }
          : null
      })
      .filter(Boolean) as Array<{ label: string; value: string }>
  } catch {
    return content
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => {
        const index = item.indexOf(':')
        return index > 0
          ? { label: item.slice(0, index).trim(), value: item.slice(index + 1).trim() }
          : null
      })
      .filter(Boolean) as Array<{ label: string; value: string }>
  }
})

const recipientSummary = (record: AppNotificationLog) =>
  record.recipient_info.map(item => item.email || item.name || '').filter(Boolean).join(', ') || '-'

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

const getTaskTypeLabel = (value: string) => {
  if (value === 'TEST_SUITE') return '测试套件'
  if (value === 'TEST_CASE') return '测试用例'
  return value || '-'
}

const getNotificationTypeLabel = (value: string) => {
  if (value === 'email') return '邮件'
  if (value === 'webhook') return 'Webhook'
  if (value === 'both') return '邮件 + Webhook'
  return value || '-'
}

const getNotificationTypeColor = (value: string) => {
  if (value === 'email') return 'arcoblue'
  if (value === 'webhook') return 'green'
  if (value === 'both') return 'orange'
  return 'gray'
}

const getStatusColor = (value: string) => {
  if (value === 'success') return 'green'
  if (value === 'failed') return 'red'
  if (value === 'pending') return 'orange'
  return 'gray'
}

const getPrimaryExecutionId = (record: AppNotificationLog) =>
  record.response_info.execution_id || record.response_info.execution_ids?.[0] || undefined

const getDeliverySummary = (record: AppNotificationLog) => {
  if (record.error_message) return record.error_message
  if (record.response_info.retry_status) return `重试状态：${String(record.response_info.retry_status)}`
  if (record.response_info.detail) return String(record.response_info.detail)
  return `重试 ${record.retry_count || 0} 次`
}

const loadTaskContext = async () => {
  if (!currentTaskId.value) {
    taskContext.value = null
    return
  }

  try {
    taskContext.value = await AppAutomationService.getScheduledTask(currentTaskId.value)
  } catch {
    taskContext.value = null
  }
}

const loadData = async () => {
  loading.value = true
  try {
    logs.value = await AppAutomationService.getNotificationLogs({
      search: filters.search || undefined,
      status: filters.status || undefined,
      notification_type: filters.notification_type || undefined,
      task_id: currentTaskId.value || undefined,
      start_date: filters.start_date || undefined,
      end_date: filters.end_date || undefined,
    })
  } catch (error: any) {
    Message.error(error.message || '加载通知日志失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.current = 1
  void loadData()
}

const resetFilters = () => {
  filters.search = ''
  filters.status = ''
  filters.notification_type = ''
  filters.start_date = ''
  filters.end_date = ''
  pagination.current = 1
  void loadData()
}

const openTaskDetail = async (taskId: number) => {
  await router.replace({
    path: '/app-automation',
    query: {
      ...route.query,
      tab: 'scheduled-tasks',
      taskId: String(taskId),
      executionId: undefined,
      suiteId: undefined,
    },
  })
}

const clearTaskContext = async () => {
  await router.replace({
    path: '/app-automation',
    query: {
      ...route.query,
      taskId: undefined,
    },
  })
}

const openExecution = (record: AppNotificationLog) => {
  const executionId = getPrimaryExecutionId(record)
  if (!executionId) {
    Message.warning('该通知没有关联执行记录')
    return
  }

  void router.replace({
    path: '/app-automation',
    query: {
      ...route.query,
      tab: 'executions',
      taskId: undefined,
      executionId: String(executionId),
      suiteId: record.response_info.test_suite_id ? String(record.response_info.test_suite_id) : undefined,
    },
  })
}

const retry = async (id: number) => {
  retryingId.value = id
  try {
    const updated = await AppAutomationService.retryNotification(id)
    Message.success('通知已重试')
    logs.value = logs.value.map(item => (item.id === updated.id ? updated : item))
    if (currentLog.value?.id === updated.id) {
      currentLog.value = updated
    }
    await loadData()
  } catch (error: any) {
    Message.error(error.message || '重试通知失败')
  } finally {
    retryingId.value = null
  }
}

const viewDetail = (record: AppNotificationLog) => {
  currentLog.value = record
  detailVisible.value = true
}

watch(
  () => filteredLogs.value.length,
  total => {
    const maxPage = Math.max(1, Math.ceil(total / pagination.pageSize))
    if (pagination.current > maxPage) {
      pagination.current = maxPage
    }
  },
)

watch(
  () => route.query.taskId,
  () => {
    pagination.current = 1
    void Promise.all([loadTaskContext(), loadData()])
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

.context-alert,
.filter-card,
.table-card,
.stat-card,
.detail-panel {
  border-radius: 16px;
  border: 1px solid var(--theme-card-border);
  background: var(--theme-card-bg);
  box-shadow: var(--theme-card-shadow);
}

.filter-grid {
  display: grid;
  grid-template-columns: minmax(240px, 1.4fr) 180px 180px 180px 180px auto;
  gap: 12px;
  align-items: center;
}

.filter-actions,
.pagination-row {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card :deep(.arco-card-body) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  color: var(--theme-text-secondary);
  font-size: 13px;
}

.stat-card strong {
  font-size: 30px;
  color: var(--theme-text);
  line-height: 1;
}

.stat-desc {
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.meta-stack,
.detail-shell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-stack strong,
.meta-stack span,
.detail-card strong {
  color: var(--theme-text);
}

.meta-stack small,
.detail-label,
.meta-row {
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.detail-shell {
  gap: 16px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.detail-card {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--theme-card-border);
  background: rgba(var(--theme-accent-rgb), 0.04);
}

.detail-label {
  display: block;
  margin-bottom: 8px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 14px;
}

.detail-alert {
  margin-bottom: 14px;
}

.parsed-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.parsed-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(var(--theme-accent-rgb), 0.1);
}

.parsed-row:last-child {
  border-bottom: none;
}

.parsed-label {
  color: var(--theme-text-secondary);
  font-weight: 600;
}

.parsed-value {
  color: var(--theme-text);
  word-break: break-word;
}

@media (max-width: 1260px) {
  .filter-grid,
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 900px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-grid,
  .stats-grid,
  .parsed-row {
    grid-template-columns: 1fr;
  }

  .filter-actions,
  .pagination-row {
    justify-content: flex-start;
  }
}
</style>
