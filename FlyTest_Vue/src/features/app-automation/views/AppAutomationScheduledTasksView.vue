<template>
  <div class="page-shell">
    <div v-if="!projectStore.currentProjectId" class="empty-shell">
      <a-empty description="请选择项目后再配置 APP 定时任务" />
    </div>
    <template v-else>
      <div class="page-header">
        <div>
          <h3>定时任务</h3>
          <p>统一管理 APP 自动化调度任务，支持触发、排查、通知回看和最近执行追踪。</p>
        </div>
        <a-space>
          <a-button @click="loadData" :loading="loading">刷新</a-button>
          <a-button type="primary" @click="openCreate">新建任务</a-button>
        </a-space>
      </div>

      <a-card class="filter-card">
        <div class="filter-grid">
          <a-input-search
            v-model="filters.search"
            allow-clear
            placeholder="搜索任务名称、描述或目标"
            @search="handleSearch"
          />
          <a-select v-model="filters.task_type" allow-clear placeholder="任务类型">
            <a-option value="TEST_SUITE">测试套件执行</a-option>
            <a-option value="TEST_CASE">测试用例执行</a-option>
          </a-select>
          <a-select v-model="filters.trigger_type" allow-clear placeholder="触发方式">
            <a-option value="CRON">CRON</a-option>
            <a-option value="INTERVAL">INTERVAL</a-option>
            <a-option value="ONCE">ONCE</a-option>
          </a-select>
          <a-select v-model="filters.status" allow-clear placeholder="任务状态">
            <a-option value="ACTIVE">ACTIVE</a-option>
            <a-option value="PAUSED">PAUSED</a-option>
            <a-option value="COMPLETED">COMPLETED</a-option>
            <a-option value="FAILED">FAILED</a-option>
          </a-select>
          <div class="filter-actions">
            <a-button @click="resetFilters">重置</a-button>
            <a-button type="primary" @click="handleSearch">查询</a-button>
          </div>
        </div>
      </a-card>

      <div class="stats-grid">
        <a-card class="stat-card">
          <span class="stat-label">任务总数</span>
          <strong>{{ statistics.total }}</strong>
          <span class="stat-desc">当前筛选结果中的调度任务数量</span>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">激活任务</span>
          <strong>{{ statistics.active }}</strong>
          <span class="stat-desc">仍在自动调度中的任务</span>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">暂停任务</span>
          <strong>{{ statistics.paused }}</strong>
          <span class="stat-desc">已保留配置但暂停调度的任务</span>
        </a-card>
        <a-card class="stat-card">
          <span class="stat-label">触发成功率</span>
          <strong>{{ statistics.successRate }}%</strong>
          <span class="stat-desc">成功 {{ statistics.successfulRuns }} / 总触发 {{ statistics.totalRuns }}</span>
        </a-card>
      </div>

      <a-card class="table-card">
        <a-table :data="pagedTasks" :loading="loading" :pagination="false" row-key="id">
          <template #columns>
            <a-table-column title="任务" :width="260">
              <template #cell="{ record }">
                <div class="stack">
                  <strong>{{ record.name }}</strong>
                  <span>{{ record.description || '暂无任务描述' }}</span>
                </div>
              </template>
            </a-table-column>

            <a-table-column title="类型 / 目标" :width="240">
              <template #cell="{ record }">
                <div class="stack">
                  <a-tag :color="record.task_type === 'TEST_SUITE' ? 'green' : 'arcoblue'">
                    {{ getTaskTypeLabel(record.task_type) }}
                  </a-tag>
                  <span>{{ getTaskTarget(record) }}</span>
                  <small>{{ getPackageLabel(record) }}</small>
                </div>
              </template>
            </a-table-column>

            <a-table-column title="调度配置" :width="220">
              <template #cell="{ record }">
                <div class="stack">
                  <a-tag color="purple">{{ getTriggerTypeLabel(record.trigger_type) }}</a-tag>
                  <span>{{ getTriggerSummary(record) }}</span>
                  <small>下次执行：{{ formatDateTime(record.next_run_time) }}</small>
                </div>
              </template>
            </a-table-column>

            <a-table-column title="执行概况" :width="220">
              <template #cell="{ record }">
                <div class="stack">
                  <div class="inline-meta">
                    <a-tag :color="getLastResultMeta(record).color">{{ getLastResultMeta(record).label }}</a-tag>
                    <span class="plain-text">成功率 {{ getTaskSuccessRate(record) }}%</span>
                  </div>
                  <small>{{ getLastResultSummary(record) }}</small>
                  <small>最近触发：{{ formatDateTime(record.last_run_time) }}</small>
                </div>
              </template>
            </a-table-column>

            <a-table-column title="通知 / 状态" :width="220">
              <template #cell="{ record }">
                <div class="stack">
                  <div class="inline-meta">
                    <a-tag :color="getStatusColor(record.status)">{{ record.status }}</a-tag>
                    <a-tag v-if="record.notification_type" :color="getNotificationColor(record.notification_type)">
                      {{ getNotificationLabel(record.notification_type) }}
                    </a-tag>
                  </div>
                  <span>{{ record.device_name || '未指定设备' }}</span>
                  <small>{{ getNotificationSummary(record) }}</small>
                </div>
              </template>
            </a-table-column>

            <a-table-column title="操作" :width="360" fixed="right">
              <template #cell="{ record }">
                <a-space wrap>
                  <a-button type="text" @click="openDetail(record)">详情</a-button>
                  <a-button
                    type="text"
                    :loading="isActionLoading('run', record.id)"
                    @click="runNow(record.id)"
                  >
                    立即执行
                  </a-button>
                  <a-button
                    v-if="hasExecutionResult(record)"
                    type="text"
                    @click="openLatestExecution(record)"
                  >
                    最新执行
                  </a-button>
                  <a-button type="text" @click="openEdit(record)">编辑</a-button>
                  <a-button
                    v-if="record.status === 'ACTIVE'"
                    type="text"
                    :loading="isActionLoading('pause', record.id)"
                    @click="pause(record.id)"
                  >
                    暂停
                  </a-button>
                  <a-button
                    v-else-if="record.status === 'PAUSED'"
                    type="text"
                    :loading="isActionLoading('resume', record.id)"
                    @click="resume(record.id)"
                  >
                    恢复
                  </a-button>
                  <a-button
                    type="text"
                    status="danger"
                    :loading="isActionLoading('delete', record.id)"
                    @click="remove(record.id)"
                  >
                    删除
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
            :total="filteredTasks.length"
            :show-total="true"
            :show-jumper="true"
            :show-page-size="true"
            :page-size-options="['10', '20', '50']"
          />
        </div>
      </a-card>

      <a-modal v-model:visible="detailVisible" title="任务详情" width="980px" :footer="false">
        <div v-if="detailLoading" class="modal-state">正在加载任务详情...</div>
        <div v-else-if="currentTask" class="detail-shell">
          <div class="detail-grid">
            <div class="detail-card">
              <span class="detail-label">任务状态</span>
              <strong>{{ currentTask.status }}</strong>
            </div>
            <div class="detail-card">
              <span class="detail-label">最近结果</span>
              <strong>{{ getLastResultMeta(currentTask).label }}</strong>
            </div>
            <div class="detail-card">
              <span class="detail-label">下次执行</span>
              <strong>{{ formatDateTime(currentTask.next_run_time) }}</strong>
            </div>
            <div class="detail-card">
              <span class="detail-label">触发成功率</span>
              <strong>{{ getTaskSuccessRate(currentTask) }}%</strong>
            </div>
          </div>

          <a-card class="detail-panel" title="任务配置">
            <div class="summary-text">{{ currentTask.description || '暂无任务描述。' }}</div>
            <div class="meta-row">
              <span>任务类型：{{ getTaskTypeLabel(currentTask.task_type) }}</span>
              <span>任务目标：{{ getTaskTarget(currentTask) }}</span>
              <span>执行设备：{{ currentTask.device_name || '-' }}</span>
              <span>应用包：{{ currentTask.app_package_name || '-' }}</span>
              <span>触发方式：{{ getTriggerSummary(currentTask) }}</span>
              <span>创建人：{{ currentTask.created_by || '-' }}</span>
            </div>
            <div class="meta-row">
              <span>通知渠道：{{ getNotificationLabel(currentTask.notification_type) }}</span>
              <span>通知对象：{{ getNotificationSummary(currentTask) }}</span>
              <span>创建时间：{{ formatDateTime(currentTask.created_at) }}</span>
              <span>更新时间：{{ formatDateTime(currentTask.updated_at) }}</span>
            </div>
          </a-card>

          <a-card class="detail-panel" title="最近触发结果">
            <div class="summary-text">{{ getLastResultSummary(currentTask) }}</div>
            <div class="meta-row">
              <span>最近触发时间：{{ formatDateTime(currentTask.last_run_time) }}</span>
              <span>累计触发：{{ currentTask.total_runs || 0 }}</span>
              <span>成功次数：{{ currentTask.successful_runs || 0 }}</span>
              <span>失败次数：{{ currentTask.failed_runs || 0 }}</span>
            </div>
            <a-alert v-if="currentTask.error_message" type="error" class="detail-alert">
              {{ currentTask.error_message }}
            </a-alert>
            <a-space wrap>
              <a-button v-if="hasExecutionResult(currentTask)" type="primary" @click="openLatestExecution(currentTask)">
                查看执行记录
              </a-button>
              <a-button v-if="hasLatestReport(currentTask)" @click="openLatestReport(currentTask)">
                打开最近报告
              </a-button>
              <a-button @click="openTaskNotifications(currentTask)">查看通知日志</a-button>
            </a-space>
          </a-card>

          <a-card class="detail-panel" title="最近通知">
            <div v-if="taskNotificationsLoading" class="modal-state small">正在加载通知日志...</div>
            <div v-else-if="recentTaskNotifications.length" class="notification-list">
              <div
                v-for="item in recentTaskNotifications"
                :key="item.id"
                class="notification-item"
              >
                <div class="notification-head">
                  <div class="inline-meta">
                    <a-tag :color="getNotificationStatusColor(item.status)">{{ item.status }}</a-tag>
                    <a-tag :color="getNotificationColor(item.actual_notification_type || item.notification_type)">
                      {{ getNotificationLabel(item.actual_notification_type || item.notification_type) }}
                    </a-tag>
                  </div>
                  <span>{{ formatDateTime(item.created_at) }}</span>
                </div>
                <div class="notification-body">
                  {{ item.error_message || getNotificationDetail(item) }}
                </div>
                <div class="notification-actions">
                  <a-button type="text" @click="openTaskNotifications(currentTask)">查看日志</a-button>
                  <a-button
                    v-if="getPrimaryExecutionIdFromLog(item)"
                    type="text"
                    @click="openNotificationExecution(item)"
                  >
                    关联执行
                  </a-button>
                </div>
              </div>
            </div>
            <div v-else class="empty-note">当前任务还没有通知日志。</div>
          </a-card>
        </div>
      </a-modal>

      <a-modal
        v-model:visible="visible"
        :title="form.id ? '编辑定时任务' : '新建定时任务'"
        width="820px"
        @before-ok="handleBeforeOk"
      >
        <a-form :model="form" layout="vertical">
          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item field="name" label="任务名称">
                <a-input v-model="form.name" placeholder="请输入任务名称" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item field="status" label="初始状态">
                <a-select v-model="form.status">
                  <a-option value="ACTIVE">ACTIVE</a-option>
                  <a-option value="PAUSED">PAUSED</a-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item field="description" label="任务描述">
            <a-textarea
              v-model="form.description"
              :auto-size="{ minRows: 3, maxRows: 5 }"
              placeholder="描述任务执行目标、前置条件或业务说明"
            />
          </a-form-item>

          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item field="task_type" label="任务类型">
                <a-radio-group v-model="form.task_type" type="button">
                  <a-radio value="TEST_SUITE">测试套件</a-radio>
                  <a-radio value="TEST_CASE">测试用例</a-radio>
                </a-radio-group>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item field="device_id" label="执行设备">
                <a-select v-model="form.device_id" allow-search placeholder="请选择执行设备">
                  <a-option v-for="item in devices" :key="item.id" :value="item.id">
                    {{ item.name || item.device_id }}
                  </a-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item v-if="form.task_type === 'TEST_SUITE'" field="test_suite_id" label="测试套件">
                <a-select v-model="form.test_suite_id" allow-search allow-clear placeholder="请选择测试套件">
                  <a-option v-for="item in suites" :key="item.id" :value="item.id">
                    {{ item.name }}
                  </a-option>
                </a-select>
              </a-form-item>
              <a-form-item v-else field="test_case_id" label="测试用例">
                <a-select v-model="form.test_case_id" allow-search allow-clear placeholder="请选择测试用例">
                  <a-option v-for="item in testCases" :key="item.id" :value="item.id">
                    {{ item.name }}
                  </a-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item field="package_id" label="应用包">
                <a-select v-model="form.package_id" allow-search allow-clear placeholder="可选，用于指定运行包">
                  <a-option v-for="item in packages" :key="item.id" :value="item.id">
                    {{ item.name }}
                  </a-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item field="trigger_type" label="触发方式">
            <a-radio-group v-model="form.trigger_type" type="button">
              <a-radio value="CRON">CRON</a-radio>
              <a-radio value="INTERVAL">INTERVAL</a-radio>
              <a-radio value="ONCE">ONCE</a-radio>
            </a-radio-group>
          </a-form-item>

          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item v-if="form.trigger_type === 'CRON'" field="cron_expression" label="Cron 表达式">
                <a-input v-model="form.cron_expression" placeholder="例如：0 0 * * *" />
              </a-form-item>
              <a-form-item v-else-if="form.trigger_type === 'INTERVAL'" field="interval_seconds" label="间隔秒数">
                <a-input-number v-model="form.interval_seconds" :min="60" :step="60" />
              </a-form-item>
              <a-form-item v-else field="execute_at" label="执行时间">
                <a-date-picker
                  v-model="form.execute_at"
                  show-time
                  format="YYYY-MM-DD HH:mm:ss"
                  value-format="YYYY-MM-DDTHH:mm:ssZ"
                  placeholder="请选择一次性执行时间"
                  :show-confirm-btn="false"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <div class="helper-card">
                <strong>调度说明</strong>
                <span v-if="form.trigger_type === 'CRON'">
                  常用示例：`0 0 * * *` 每天零点执行，`0 */2 * * *` 每两小时执行一次。
                </span>
                <span v-else-if="form.trigger_type === 'INTERVAL'">
                  间隔任务会以秒为单位重复执行，建议不要低于 60 秒。
                </span>
                <span v-else>
                  一次性任务执行完成后会自动进入 `COMPLETED`，不再继续调度。
                </span>
              </div>
            </a-col>
          </a-row>

          <a-divider style="margin: 4px 0 12px">通知设置</a-divider>

          <a-row :gutter="12">
            <a-col :span="8">
              <a-form-item field="notify_on_success" label="成功通知">
                <a-switch v-model="form.notify_on_success" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item field="notify_on_failure" label="失败通知">
                <a-switch v-model="form.notify_on_failure" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item field="notification_type" label="通知类型">
                <a-select
                  v-model="form.notification_type"
                  allow-clear
                  :disabled="!notificationsEnabled"
                  placeholder="请选择通知类型"
                >
                  <a-option value="email">email</a-option>
                  <a-option value="webhook">webhook</a-option>
                  <a-option value="both">both</a-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item field="notify_emails_text" label="通知邮箱">
            <a-input
              v-model="notifyEmailsText"
              :disabled="!needsEmailRecipients"
              placeholder="多个邮箱可用逗号、分号或换行分隔"
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
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/authStore'
import { useProjectStore } from '@/store/projectStore'
import { AppAutomationService } from '../services/appAutomationService'
import type {
  AppDevice,
  AppNotificationLog,
  AppPackage,
  AppScheduledTask,
  AppScheduledTaskRunResult,
  AppTestCase,
  AppTestSuite,
} from '../types'

const authStore = useAuthStore()
const projectStore = useProjectStore()
const route = useRoute()
const router = useRouter()

const loading = ref(false)
const visible = ref(false)
const saving = ref(false)
const detailVisible = ref(false)
const detailLoading = ref(false)
const taskNotificationsLoading = ref(false)
const notifyEmailsText = ref('')
const tasks = ref<AppScheduledTask[]>([])
const suites = ref<AppTestSuite[]>([])
const testCases = ref<AppTestCase[]>([])
const devices = ref<AppDevice[]>([])
const packages = ref<AppPackage[]>([])
const currentTask = ref<AppScheduledTask | null>(null)
const taskNotifications = ref<AppNotificationLog[]>([])

const actionLoading = reactive<Record<string, boolean>>({})

const filters = reactive({
  search: '',
  status: '',
  task_type: '',
  trigger_type: '',
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
})

const form = reactive({
  id: 0,
  name: '',
  description: '',
  task_type: 'TEST_SUITE',
  trigger_type: 'CRON',
  cron_expression: '0 0 * * *',
  interval_seconds: 3600,
  execute_at: '',
  device_id: undefined as number | undefined,
  package_id: undefined as number | undefined,
  test_suite_id: undefined as number | undefined,
  test_case_id: undefined as number | undefined,
  notify_on_success: false,
  notify_on_failure: true,
  notification_type: 'email',
  status: 'ACTIVE',
})

const notificationsEnabled = computed(() => form.notify_on_success || form.notify_on_failure)
const needsEmailRecipients = computed(() => notificationsEnabled.value && ['email', 'both'].includes(form.notification_type))
const recentTaskNotifications = computed(() => taskNotifications.value.slice(0, 6))

const filteredTasks = computed(() => {
  const keyword = filters.search.trim().toLowerCase()

  return tasks.value.filter(task => {
    if (filters.status && task.status !== filters.status) return false
    if (filters.task_type && task.task_type !== filters.task_type) return false
    if (filters.trigger_type && task.trigger_type !== filters.trigger_type) return false
    if (!keyword) return true

    return [
      task.name,
      task.description,
      task.test_suite_name,
      task.test_case_name,
      task.device_name,
      task.notification_type,
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const pagedTasks = computed(() => {
  const start = (pagination.current - 1) * pagination.pageSize
  return filteredTasks.value.slice(start, start + pagination.pageSize)
})

const statistics = computed(() => {
  const totalRuns = filteredTasks.value.reduce((sum, task) => sum + Number(task.total_runs || 0), 0)
  const successfulRuns = filteredTasks.value.reduce((sum, task) => sum + Number(task.successful_runs || 0), 0)
  const active = filteredTasks.value.filter(task => task.status === 'ACTIVE').length
  const paused = filteredTasks.value.filter(task => task.status === 'PAUSED').length
  const successRate = totalRuns ? Math.round((successfulRuns / totalRuns) * 1000) / 10 : 0

  return {
    total: filteredTasks.value.length,
    active,
    paused,
    totalRuns,
    successfulRuns,
    successRate,
  }
})

const getActionKey = (action: string, id: number) => `${action}-${id}`
const isActionLoading = (action: string, id: number) => Boolean(actionLoading[getActionKey(action, id)])
const setActionLoading = (action: string, id: number, value: boolean) => {
  actionLoading[getActionKey(action, id)] = value
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

const formatInterval = (seconds?: number | null) => {
  const totalSeconds = Number(seconds || 0)
  if (!totalSeconds) return '-'
  if (totalSeconds < 3600) return `${Math.round(totalSeconds / 60)} 分钟`
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.round((totalSeconds % 3600) / 60)
  return minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`
}

const getTaskTypeLabel = (value: string) => (value === 'TEST_SUITE' ? '测试套件' : '测试用例')
const getTriggerTypeLabel = (value: string) =>
  value === 'CRON' ? 'Cron' : value === 'INTERVAL' ? '固定间隔' : value === 'ONCE' ? '单次执行' : value || '-'

const getNotificationLabel = (value: string) => {
  if (value === 'email') return '邮件'
  if (value === 'webhook') return 'Webhook'
  if (value === 'both') return '邮件 + Webhook'
  return value || '未开启'
}

const getNotificationColor = (value: string) =>
  value === 'email' ? 'arcoblue' : value === 'webhook' ? 'green' : value === 'both' ? 'orange' : 'gray'

const getStatusColor = (value: string) =>
  value === 'ACTIVE' ? 'green' : value === 'PAUSED' ? 'orange' : value === 'FAILED' ? 'red' : value === 'COMPLETED' ? 'arcoblue' : 'gray'

const getNotificationStatusColor = (value: string) =>
  value === 'success' ? 'green' : value === 'failed' ? 'red' : value === 'pending' ? 'orange' : 'gray'

const getTaskTarget = (task: AppScheduledTask) => task.test_suite_name || task.test_case_name || '-'
const getPackageLabel = (task: AppScheduledTask) => `应用包：${task.app_package_name || '未指定'}`

const getTriggerSummary = (task: AppScheduledTask) => {
  if (task.trigger_type === 'CRON') return task.cron_expression || '-'
  if (task.trigger_type === 'INTERVAL') return `每 ${formatInterval(task.interval_seconds)} 执行一次`
  return formatDateTime(task.execute_at)
}

const getNotificationSummary = (task: AppScheduledTask) => {
  if (!task.notification_type) return '未开启通知'
  if (!task.notify_emails.length) return '未填写接收人'
  return task.notify_emails.join(', ')
}

const getExecutionIds = (task: AppScheduledTask) => {
  const ids = task.last_result.execution_ids || []
  return ids.filter((item): item is number => Number.isFinite(Number(item)))
}

const getPrimaryExecutionId = (task: AppScheduledTask) =>
  task.last_result.execution_id || getExecutionIds(task)[0] || undefined

const hasExecutionResult = (task: AppScheduledTask) => Boolean(getPrimaryExecutionId(task) || (task.task_type === 'TEST_SUITE' && task.test_suite_id))
const hasLatestReport = (task: AppScheduledTask) => Boolean(getPrimaryExecutionId(task))

const getTaskSuccessRate = (task: AppScheduledTask) => {
  const totalRuns = Number(task.total_runs || 0)
  return totalRuns ? Math.round((Number(task.successful_runs || 0) / totalRuns) * 1000) / 10 : 0
}

const getLastResultMeta = (task: AppScheduledTask) => {
  if (task.error_message) return { label: '触发失败', color: 'red' }
  if (task.last_result.status === 'triggered') return { label: '已触发', color: 'arcoblue' }
  if (task.total_runs > 0) return { label: '已执行', color: 'green' }
  return { label: '暂无记录', color: 'gray' }
}

const getLastResultSummary = (task: AppScheduledTask) => {
  if (task.error_message) return task.error_message
  if (task.last_result.execution_id) return `最近已触发执行 #${task.last_result.execution_id}`
  if (getExecutionIds(task).length) return `最近一次触发了 ${getExecutionIds(task).length} 条套件执行记录`
  if (task.total_runs) return `累计触发 ${task.total_runs} 次，成功 ${task.successful_runs} 次`
  return '暂无最近结果'
}

const getNotificationDetail = (item: AppNotificationLog) => {
  if (typeof item.response_info.detail === 'string' && item.response_info.detail) {
    return item.response_info.detail
  }
  if (item.notification_content) {
    return item.notification_content.slice(0, 120)
  }
  return '暂无详细通知内容'
}

const getPrimaryExecutionIdFromLog = (item: AppNotificationLog) =>
  item.response_info.execution_id || item.response_info.execution_ids?.[0] || undefined

const resetForm = () => {
  form.id = 0
  form.name = ''
  form.description = ''
  form.task_type = 'TEST_SUITE'
  form.trigger_type = 'CRON'
  form.cron_expression = '0 0 * * *'
  form.interval_seconds = 3600
  form.execute_at = ''
  form.device_id = devices.value[0]?.id
  form.package_id = undefined
  form.test_suite_id = undefined
  form.test_case_id = undefined
  form.notify_on_success = false
  form.notify_on_failure = true
  form.notification_type = 'email'
  form.status = 'ACTIVE'
  notifyEmailsText.value = ''
}

const resetFilters = () => {
  filters.search = ''
  filters.status = ''
  filters.task_type = ''
  filters.trigger_type = ''
  pagination.current = 1
  void loadData()
}

const handleSearch = () => {
  pagination.current = 1
  void loadData()
}

const parseNotifyEmails = () =>
  notifyEmailsText.value
    .split(/[\n,;]+/)
    .map(item => item.trim())
    .filter(Boolean)

const syncTaskFromList = (taskId: number) => {
  const matched = tasks.value.find(item => item.id === taskId)
  if (matched) {
    currentTask.value = matched
  }
}

const loadData = async () => {
  if (!projectStore.currentProjectId) {
    tasks.value = []
    currentTask.value = null
    taskNotifications.value = []
    return
  }

  loading.value = true
  try {
    const [taskList, suiteList, caseList, deviceList, packageList] = await Promise.all([
      AppAutomationService.getScheduledTasks(projectStore.currentProjectId, {
        search: filters.search || undefined,
        status: filters.status || undefined,
        task_type: filters.task_type || undefined,
        trigger_type: filters.trigger_type || undefined,
      }),
      AppAutomationService.getTestSuites(projectStore.currentProjectId),
      AppAutomationService.getTestCases(projectStore.currentProjectId),
      AppAutomationService.getDevices(),
      AppAutomationService.getPackages(projectStore.currentProjectId),
    ])

    tasks.value = taskList
    suites.value = suiteList
    testCases.value = caseList
    devices.value = deviceList
    packages.value = packageList

    if (currentTask.value?.id) {
      syncTaskFromList(currentTask.value.id)
    }
  } catch (error: any) {
    Message.error(error.message || '加载定时任务失败')
  } finally {
    loading.value = false
  }
}

const updateRouteQuery = (queryPatch: Record<string, string | undefined>) =>
  router.replace({
    path: '/app-automation',
    query: {
      ...route.query,
      ...queryPatch,
    },
  })

const loadTaskDetail = async (taskId: number, options: { syncRoute?: boolean } = {}) => {
  detailLoading.value = true
  taskNotificationsLoading.value = true

  try {
    const [task, notifications] = await Promise.all([
      AppAutomationService.getScheduledTask(taskId),
      AppAutomationService.getNotificationLogs({ task_id: taskId }),
    ])
    currentTask.value = task
    taskNotifications.value = notifications
    detailVisible.value = true

    if (options.syncRoute !== false) {
      await updateRouteQuery({ tab: 'scheduled-tasks', taskId: String(taskId) })
    }
  } catch (error: any) {
    Message.error(error.message || '加载任务详情失败')
  } finally {
    detailLoading.value = false
    taskNotificationsLoading.value = false
  }
}

const refreshCurrentTaskIfNeeded = async (taskId: number) => {
  if (detailVisible.value && currentTask.value?.id === taskId) {
    await loadTaskDetail(taskId, { syncRoute: false })
  }
}

const openCreate = () => {
  resetForm()
  visible.value = true
}

const openDetail = (record: AppScheduledTask) => {
  void loadTaskDetail(record.id)
}

const openEdit = (record: AppScheduledTask) => {
  form.id = record.id
  form.name = record.name
  form.description = record.description
  form.task_type = record.task_type
  form.trigger_type = record.trigger_type
  form.cron_expression = record.cron_expression || '0 0 * * *'
  form.interval_seconds = record.interval_seconds || 3600
  form.execute_at = record.execute_at || ''
  form.device_id = record.device_id ?? undefined
  form.package_id = record.package_id ?? undefined
  form.test_suite_id = record.test_suite_id ?? undefined
  form.test_case_id = record.test_case_id ?? undefined
  form.notify_on_success = record.notify_on_success
  form.notify_on_failure = record.notify_on_failure
  form.notification_type = record.notification_type || (record.notify_on_success || record.notify_on_failure ? 'email' : '')
  form.status = ['ACTIVE', 'PAUSED'].includes(record.status) ? record.status : 'ACTIVE'
  notifyEmailsText.value = record.notify_emails.join(', ')
  visible.value = true
}

const validateForm = () => {
  if (!form.name.trim()) {
    Message.warning('请输入任务名称')
    return false
  }
  if (!form.device_id) {
    Message.warning('请选择执行设备')
    return false
  }
  if (form.task_type === 'TEST_SUITE' && !form.test_suite_id) {
    Message.warning('请选择测试套件')
    return false
  }
  if (form.task_type === 'TEST_CASE' && !form.test_case_id) {
    Message.warning('请选择测试用例')
    return false
  }
  if (form.trigger_type === 'CRON' && !form.cron_expression.trim()) {
    Message.warning('请输入 Cron 表达式')
    return false
  }
  if (form.trigger_type === 'INTERVAL' && !form.interval_seconds) {
    Message.warning('请输入间隔秒数')
    return false
  }
  if (form.trigger_type === 'ONCE' && !form.execute_at) {
    Message.warning('请选择一次性执行时间')
    return false
  }
  if (notificationsEnabled.value && !form.notification_type) {
    Message.warning('请选择通知类型')
    return false
  }
  if (needsEmailRecipients.value && !parseNotifyEmails().length) {
    Message.warning('请至少填写一个通知邮箱')
    return false
  }
  return true
}

const buildPayload = () => ({
  project_id: projectStore.currentProjectId || 0,
  name: form.name.trim(),
  description: form.description.trim(),
  task_type: form.task_type,
  trigger_type: form.trigger_type,
  cron_expression: form.trigger_type === 'CRON' ? form.cron_expression.trim() : '',
  interval_seconds: form.trigger_type === 'INTERVAL' ? form.interval_seconds : null,
  execute_at: form.trigger_type === 'ONCE' ? form.execute_at || null : null,
  device_id: form.device_id ?? null,
  package_id: form.package_id ?? null,
  test_suite_id: form.task_type === 'TEST_SUITE' ? form.test_suite_id ?? null : null,
  test_case_id: form.task_type === 'TEST_CASE' ? form.test_case_id ?? null : null,
  notify_on_success: form.notify_on_success,
  notify_on_failure: form.notify_on_failure,
  notification_type: notificationsEnabled.value ? form.notification_type || '' : '',
  notify_emails: needsEmailRecipients.value ? parseNotifyEmails() : [],
  status: form.status,
  created_by: authStore.currentUser?.username || 'FlyTest',
})

const saveTask = async () => {
  if (!projectStore.currentProjectId || !validateForm()) {
    return false
  }

  saving.value = true
  try {
    const payload = buildPayload()
    if (form.id) {
      await AppAutomationService.updateScheduledTask(form.id, payload)
      Message.success('定时任务已更新')
    } else {
      await AppAutomationService.createScheduledTask(payload)
      Message.success('定时任务已创建')
    }
    await loadData()
    if (form.id) {
      await refreshCurrentTaskIfNeeded(form.id)
    }
    return true
  } catch (error: any) {
    Message.error(error.message || '保存定时任务失败')
    return false
  } finally {
    saving.value = false
  }
}

const handleBeforeOk = (done: (closed: boolean) => void) => {
  void (async () => {
    const success = await saveTask()
    done(success)
  })()
}

const goToExecutionContext = async (executionId?: number, suiteId?: number | null) => {
  await router.replace({
    path: '/app-automation',
    query: {
      ...route.query,
      tab: 'executions',
      taskId: undefined,
      executionId: executionId ? String(executionId) : undefined,
      suiteId: suiteId ? String(suiteId) : undefined,
    },
  })
}

const openLatestExecution = (task: AppScheduledTask) => {
  const executionId = getPrimaryExecutionId(task)
  if (executionId) {
    void goToExecutionContext(executionId, task.last_result.test_suite_id || task.test_suite_id)
    return
  }
  if (task.task_type === 'TEST_SUITE' && task.test_suite_id) {
    void goToExecutionContext(undefined, task.test_suite_id)
    return
  }
  Message.warning('当前任务还没有可查看的执行记录')
}

const openLatestReport = (task: AppScheduledTask) => {
  const executionId = getPrimaryExecutionId(task)
  if (!executionId) {
    Message.warning('当前任务还没有可打开的报告')
    return
  }
  window.open(AppAutomationService.getExecutionReportUrl(executionId), '_blank', 'noopener')
}

const openTaskNotifications = async (task: AppScheduledTask) => {
  await router.replace({
    path: '/app-automation',
    query: {
      ...route.query,
      tab: 'notifications',
      taskId: String(task.id),
      executionId: undefined,
      suiteId: undefined,
    },
  })
}

const openNotificationExecution = (item: AppNotificationLog) => {
  const executionId = getPrimaryExecutionIdFromLog(item)
  if (!executionId) {
    Message.warning('该通知暂时没有关联执行记录')
    return
  }
  void goToExecutionContext(executionId, item.response_info.test_suite_id)
}

const runNow = async (id: number) => {
  setActionLoading('run', id, true)
  try {
    const result = (await AppAutomationService.runScheduledTaskNow(
      id,
      authStore.currentUser?.username || 'FlyTest',
    )) as AppScheduledTaskRunResult

    const createdCount = result.trigger_payload?.execution_ids?.length || (result.trigger_payload?.execution_id ? 1 : 0)
    Message.success(createdCount > 1 ? `任务已触发，已创建 ${createdCount} 条执行记录` : '定时任务已触发执行')
    await loadData()
    await refreshCurrentTaskIfNeeded(id)
  } catch (error: any) {
    Message.error(error.message || '执行定时任务失败')
  } finally {
    setActionLoading('run', id, false)
  }
}

const pause = async (id: number) => {
  setActionLoading('pause', id, true)
  try {
    await AppAutomationService.pauseScheduledTask(id)
    Message.success('任务已暂停')
    await loadData()
    await refreshCurrentTaskIfNeeded(id)
  } catch (error: any) {
    Message.error(error.message || '暂停任务失败')
  } finally {
    setActionLoading('pause', id, false)
  }
}

const resume = async (id: number) => {
  setActionLoading('resume', id, true)
  try {
    await AppAutomationService.resumeScheduledTask(id)
    Message.success('任务已恢复')
    await loadData()
    await refreshCurrentTaskIfNeeded(id)
  } catch (error: any) {
    Message.error(error.message || '恢复任务失败')
  } finally {
    setActionLoading('resume', id, false)
  }
}

const remove = (id: number) => {
  Modal.confirm({
    title: '删除定时任务',
    content: '确认删除该定时任务吗？',
    onOk: async () => {
      setActionLoading('delete', id, true)
      try {
        await AppAutomationService.deleteScheduledTask(id)
        Message.success('定时任务已删除')
        if (currentTask.value?.id === id) {
          detailVisible.value = false
          currentTask.value = null
          taskNotifications.value = []
        }
        await loadData()
      } catch (error: any) {
        Message.error(error.message || '删除定时任务失败')
      } finally {
        setActionLoading('delete', id, false)
      }
    },
  })
}

const syncFromRoute = async () => {
  if (route.query.tab !== 'scheduled-tasks' || !projectStore.currentProjectId) {
    return
  }
  const taskId = Number(route.query.taskId || 0)
  if (!taskId || currentTask.value?.id === taskId) {
    return
  }
  await loadTaskDetail(taskId, { syncRoute: false })
}

watch(
  () => filteredTasks.value.length,
  total => {
    const maxPage = Math.max(1, Math.ceil(total / pagination.pageSize))
    if (pagination.current > maxPage) {
      pagination.current = maxPage
    }
  },
)

watch(
  () => detailVisible.value,
  value => {
    if (!value && route.query.tab === 'scheduled-tasks' && route.query.taskId) {
      void updateRouteQuery({ taskId: undefined })
    }
  },
)

watch(
  () => form.task_type,
  value => {
    if (value === 'TEST_SUITE') {
      form.test_case_id = undefined
    } else {
      form.test_suite_id = undefined
    }
  },
)

watch(
  () => form.trigger_type,
  value => {
    if (value !== 'CRON') {
      form.cron_expression = '0 0 * * *'
    }
    if (value !== 'INTERVAL') {
      form.interval_seconds = 3600
    }
    if (value !== 'ONCE') {
      form.execute_at = ''
    }
  },
)

watch(notificationsEnabled, enabled => {
  if (!enabled) {
    form.notification_type = ''
    notifyEmailsText.value = ''
  } else if (!form.notification_type) {
    form.notification_type = 'email'
  }
})

watch(
  () => [route.query.tab, route.query.taskId, projectStore.currentProjectId],
  () => {
    void syncFromRoute()
  },
  { immediate: true },
)

watch(
  () => projectStore.currentProjectId,
  () => {
    pagination.current = 1
    detailVisible.value = false
    currentTask.value = null
    taskNotifications.value = []
    void loadData()
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

.empty-shell,
.modal-state,
.empty-note {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-card-bg);
  border: 1px solid var(--theme-card-border);
  border-radius: 16px;
  color: var(--theme-text-secondary);
}

.modal-state.small {
  min-height: 120px;
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
  grid-template-columns: 1.5fr repeat(3, minmax(140px, 180px)) auto;
  gap: 12px;
  align-items: center;
}

.filter-actions,
.pagination-row,
.notification-actions {
  display: flex;
  gap: 10px;
}

.filter-actions,
.pagination-row {
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
  color: var(--theme-text);
  font-size: 30px;
  line-height: 1;
}

.stat-desc {
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stack strong,
.stack span,
.detail-card strong,
.plain-text {
  color: var(--theme-text);
}

.stack span,
.stack small {
  color: var(--theme-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.inline-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-shell,
.notification-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.detail-card,
.notification-item {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--theme-card-border);
  background: rgba(var(--theme-accent-rgb), 0.04);
}

.detail-label {
  display: block;
  margin-bottom: 8px;
  color: var(--theme-text-secondary);
  font-size: 13px;
}

.summary-text {
  color: var(--theme-text);
  line-height: 1.7;
  margin-bottom: 14px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 14px;
  color: var(--theme-text-secondary);
  font-size: 13px;
}

.detail-alert {
  margin-bottom: 14px;
}

.notification-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.notification-body {
  color: var(--theme-text);
  line-height: 1.7;
  margin-bottom: 10px;
  word-break: break-word;
}

.helper-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 108px;
  padding: 16px;
  border-radius: 14px;
  background: rgba(var(--theme-accent-rgb), 0.06);
  border: 1px solid rgba(var(--theme-accent-rgb), 0.14);
  color: var(--theme-text-secondary);
}

.helper-card strong {
  color: var(--theme-text);
}

@media (max-width: 1360px) {
  .filter-grid,
  .stats-grid,
  .detail-grid {
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
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .filter-actions,
  .pagination-row {
    justify-content: flex-start;
  }

  .notification-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
