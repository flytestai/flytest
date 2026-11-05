import { computed, reactive, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '@/store/projectStore'
import { AppAutomationService } from '../../services/appAutomationService'
import { replaceAppAutomationQuery } from '../appAutomationNavigation'
import type { AppNotificationLog, AppScheduledTask } from '../../types'
import {notificationChannel,notificationEvent,notificationTitle,notificationText,notificationInDates,notificationOverview,notificationTime,channelLabels,simulatedDelivery} from './notificationPresentation'
import type {
  NotificationFilters,
  NotificationPaginationState,
  NotificationParsedContentItem,
} from './notificationViewModels'

export function useAppAutomationNotifications() {
  const route = useRoute()
  const router = useRouter()
  const projectStore = useProjectStore()

  const loading = ref(false)
  const loadError = ref(false)
  let loadVersion=0
  let contextVersion=0
  const retrying = ref(false)
  const detailVisible = ref(false)
  const currentLog = ref<AppNotificationLog | null>(null)
  const logs = ref<AppNotificationLog[]>([])
  const taskContext = ref<AppScheduledTask | null>(null)

  const filters = reactive<NotificationFilters>({
    event_type: '',
    search: '',
    status: '',
    notification_type: '',
    start_date: '',
    end_date: '',
  })

  const pagination = reactive<NotificationPaginationState>({
    current: 1,
    pageSize: 10,
  })

  const currentTaskId = computed(() => {
    const value = Number(route.query.taskId || 0)
    return Number.isSafeInteger(value) && value > 0 ? value : null
  })

  const recipientSummary = (record: AppNotificationLog) =>
    record.recipient_info
      .map(item => item.email || item.name || '')
      .filter(Boolean)
      .join(', ') || '-'

  const filteredLogs = computed(() => {
    const keyword=filters.search.trim().toLowerCase()
    return logs.value.filter(log=>{
      if(currentTaskId.value && log.task_id!==currentTaskId.value)return false
      if(filters.status==='simulated' && !simulatedDelivery(log))return false
      if(filters.status && filters.status!=='simulated' && (simulatedDelivery(log)||log.status!==filters.status))return false
      const channel=notificationChannel(log)
      if(filters.notification_type && channel!==filters.notification_type)return false
      if(filters.event_type && notificationEvent(log)!==filters.event_type)return false
      if(!notificationInDates(log,filters.start_date,filters.end_date))return false
      return !keyword || [log.id,log.task_id,log.task_name,notificationTitle(log),notificationText(log),channelLabels[channel],recipientSummary(log),log.error_message].join(' ').toLowerCase().includes(keyword)
    }).sort((a,b)=>(notificationTime(b.created_at)||0)-(notificationTime(a.created_at)||0)||b.id-a.id)
  })

  const pagedLogs = computed(() => {
    const start = (pagination.current - 1) * pagination.pageSize
    return filteredLogs.value.slice(start, start + pagination.pageSize)
  })

  const statistics = computed(() => notificationOverview(logs.value))

  const parsedContent = computed<NotificationParsedContentItem[]>(() => {
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
        .filter(Boolean) as NotificationParsedContentItem[]
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
        .filter(Boolean) as NotificationParsedContentItem[]
    }
  })

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-'
    const time=notificationTime(value)
    return Number.isFinite(time)?new Date(time).toLocaleString('zh-CN', { hour12: false }):'-'
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
    if (record.response_info.retry_status) {
      return `重试状态：${String(record.response_info.retry_status)}`
    }
    if (record.response_info.detail) return String(record.response_info.detail)
    return `重试 ${record.retry_count || 0} 次`
  }

  const loadTaskContext = async () => {
    const version=++contextVersion,project=projectStore.currentProjectId,id=currentTaskId.value
    taskContext.value=null
    if(!project||!id)return
    try{
      const task=await AppAutomationService.getScheduledTask(id)
      if(version===contextVersion && project===projectStore.currentProjectId && id===currentTaskId.value && task.project_id===project)taskContext.value=task
    }catch{/* The task id remains visible even if a task was removed. */}
  }

  const loadData = async () => {
    const version=++loadVersion,project=projectStore.currentProjectId
    if(!project){logs.value=[];currentLog.value=null;detailVisible.value=false;loading.value=false;return}
    loading.value=true;loadError.value=false
    try{
      const value=await AppAutomationService.getNotificationLogs({project_id:project})
      if(version!==loadVersion || project!==projectStore.currentProjectId)return
      logs.value=value
      if(currentLog.value)currentLog.value=value.find(item=>item.id===currentLog.value?.id)||null
    }catch(error:any){
      if(version!==loadVersion || project!==projectStore.currentProjectId)return
      loadError.value=true;Message.error(error.message||'加载通知日志失败')
    }finally{if(version===loadVersion)loading.value=false}
  }

  const handleSearch = () => {
    pagination.current = 1
    void loadData()
  }

  const resetFilters = () => {
    filters.event_type = ''
    filters.search = ''
    filters.status = ''
    filters.notification_type = ''
    filters.start_date = ''
    filters.end_date = ''
    pagination.current = 1
  }

  const openTaskDetail = async (taskId: number) => {
    await replaceAppAutomationQuery(route, router, {
      tab: 'scheduled-tasks',
      taskId: String(taskId),
      executionId: undefined,
      suiteId: undefined,
    })
  }

  const clearTaskContext = async () => {
    await replaceAppAutomationQuery(route, router, {
      taskId: undefined,
    })
  }

  const openExecution = (record: AppNotificationLog) => {
    const executionId = getPrimaryExecutionId(record)
    if (!executionId) {
      Message.warning('该通知没有关联执行记录')
      return
    }

    void replaceAppAutomationQuery(route, router, {
      tab: 'executions',
      taskId: undefined,
      executionId: String(executionId),
      suiteId: record.response_info.test_suite_id
        ? String(record.response_info.test_suite_id)
        : undefined,
    })
  }

  const viewDetail = (record: AppNotificationLog) => {
    currentLog.value = record
    detailVisible.value = true
  }

  const syncLogRecord = (updated: AppNotificationLog) => {
    logs.value = logs.value.map(item => (item.id === updated.id ? updated : item))
    if (currentLog.value?.id === updated.id) {
      currentLog.value = updated
    }
  }

  const retryNotification = async (record: AppNotificationLog) => {
    if(retrying.value)return
    const project=projectStore.currentProjectId
    retrying.value = true
    try {
      const updated = await AppAutomationService.retryNotificationLog(record.id)
      if(project!==projectStore.currentProjectId)return
      syncLogRecord(updated)
      if(updated.response_info?.retry_status==='not_supported')Message.warning('当前服务不支持真实重发，已记录重试请求，投递状态未变')
      else Message.success('已提交重试，请以最新投递状态为准')
    } catch (error: any) {
      Message.error(error.message || '重试通知失败')
    } finally {
      retrying.value = false
    }
  }

  watch(
    () => route.query.tab,
    tab => {
      if (tab === 'notifications') {
        return
      }
      if (route.query.taskId && tab !== 'scheduled-tasks') {
        void clearTaskContext()
      }
      detailVisible.value = false
    },
  )

  watch(
    () => detailVisible.value,
    value => {
      if (!value) {
        currentLog.value = null
      }
    },
  )

  watch(()=>[filters.search,filters.status,filters.notification_type,filters.event_type,filters.start_date,filters.end_date,pagination.pageSize],()=>{pagination.current=1})

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
    () => [route.query.tab, route.query.taskId],
    ([tab]) => {
      if (tab !== 'notifications') {
        return
      }
      if (!currentTaskId.value) {
        taskContext.value = null
      }
      pagination.current = 1
      void Promise.all([loadTaskContext(), loadData()])
    },
    { immediate: true },
  )

  watch(
    () => projectStore.currentProjectId,
    () => {
      if (route.query.tab !== 'notifications') {
        return
      }
      detailVisible.value = false
      taskContext.value = null
      logs.value=[]
      ++loadVersion
      pagination.current = 1
      if (currentTaskId.value) {
        void clearTaskContext()
        return
      }
      void Promise.all([loadTaskContext(), loadData()])
    },
  )

  return {
    projectStore,
    logs,
    currentTaskId,
    loadError,
    loading,
    retrying,
    detailVisible,
    currentLog,
    taskContext,
    filters,
    pagination,
    filteredLogs,
    pagedLogs,
    statistics,
    parsedContent,
    formatDateTime,
    getTaskTypeLabel,
    getNotificationTypeLabel,
    getNotificationTypeColor,
    getStatusColor,
    getPrimaryExecutionId,
    getDeliverySummary,
    recipientSummary,
    loadData,
    handleSearch,
    resetFilters,
    openTaskDetail,
    clearTaskContext,
    openExecution,
    viewDetail,
    retryNotification,
  }
}
