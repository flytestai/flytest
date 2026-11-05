<template>
  <div class="execution-record-list fc-page">
    <WorkspacePageHeader local class="api-local-toolbar">
        <template #title>执行历史</template>
        <template #description>按执行批次聚合查看接口和测试用例的历史结果，适合快速定位失败批次与异常热点。</template>
        <template #meta><div class="page-summary__meta">
          <span>{{ projectName }}</span>
          <span>{{ selectedCollectionName || '当前项目全部接口目录' }}</span>
          <span>{{ groupedRuns.length }} 个执行批次</span>
          <span>{{ filteredRecords.length }} 条执行记录</span>
        </div></template>
        <template #actions><div class="page-toolbar">
        <a-input-search
          v-model="searchKeyword"
          class="toolbar-search"
          placeholder="搜索接口、用例、地址或错误信息"
          allow-clear
          @search="loadRecords"
          @clear="loadRecords"
        />
        <a-select v-model="resultFilter" aria-label="筛选执行结果" placeholder="执行结果" allow-clear style="width:120px"><a-option value="passed">通过</a-option><a-option value="failed">失败</a-option><a-option value="error">异常</a-option></a-select><a-select v-model="environmentFilter" aria-label="筛选执行环境" placeholder="执行环境" allow-clear style="width:140px"><a-option v-for="name in environmentNames" :key="name" :value="name">{{ name }}</a-option></a-select><a-button @click="loadRecords">刷新</a-button>
      </div></template>
      </WorkspacePageHeader>

    <div v-if="!projectId" class="state-card">
      <a-empty description="请先选择项目" />
    </div>

    <div v-else-if="loading" class="state-card">
      <a-spin size="large" />
    </div>

    <div v-else-if="!groupedRuns.length" class="state-card">
      <a-empty description="当前筛选条件下还没有执行记录" />
    </div>

    <ApiDetailLayout v-else :open="!!currentRecord" @close="currentRecord=null"><div class="api-table-panel"><a-table class="fc-table" :data="filteredRecords" :pagination="{pageSize:20,showTotal:true}" row-key="id" size="small" :scroll="{x:900}" :row-class="record => currentRecord?.id === record.id ? 'api-selected-row' : ''" @row-click="viewRecord">
      <template #columns>
        <a-table-column title="执行批次" :width="180"><template #cell="{record}"><button class="api-row-name" @click="viewRecord(record)">{{ record.run_name || record.run_id || 'RUN-'+record.id }}<span class="api-row-code">#{{ record.id }}</span></button></template></a-table-column>
        <a-table-column title="接口 / 用例" :width="210"><template #cell="{record}">{{ record.test_case_name || record.interface_name || record.request_name }}</template></a-table-column>
        <a-table-column title="执行环境" :width="110"><template #cell="{record}">{{ record.environment_name || '默认环境' }}</template></a-table-column>
        <a-table-column title="结果" :width="90"><template #cell="{record}"><a-tag :color="record.passed ? 'green' : 'red'">{{ record.passed ? '通过' : record.status === 'error' ? '异常' : '失败' }}</a-tag></template></a-table-column>
        <a-table-column title="耗时" :width="90"><template #cell="{record}">{{ record.response_time == null ? '—' : record.response_time+' ms' }}</template></a-table-column>
        <a-table-column title="执行时间" :width="170"><template #cell="{record}">{{ formatDate(record.created_at) }}</template></a-table-column>
        <a-table-column title="执行人" :width="95"><template #cell="{record}">{{ record.executor_name || '未记录' }}</template></a-table-column>
        <a-table-column title="操作" :width="100"><template #cell="{record}"><a-button type="text" @click.stop="viewFullRecord(record)">日志</a-button><a-popconfirm content="确认删除这条执行记录？" @ok="deleteRecord(record.id)"><a-button type="text" status="danger" @click.stop>删除</a-button></a-popconfirm></template></a-table-column>
      </template></a-table></div><template #detail><ApiRecordPreview v-if="currentRecord" :record="currentRecord" @close="currentRecord=null" @logs="viewFullRecord" /></template></ApiDetailLayout>

    <a-modal
      v-model:visible="detailVisible"
      class="detail-modal detail-modal--wide fc-dialog"
      title="执行记录详情"
      width="1120px"
      :footer="false"
      :mask-closable="true"
      :body-style="{ maxHeight: '78vh', overflowY: 'auto' }"
    >
      <ExecutionRecordDetailPanel :record="currentRecord" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import ApiDetailLayout from '../components/ApiDetailLayout.vue'
import ApiRecordPreview from '../components/ApiRecordPreview.vue'
import { useApiWorkspaceMetrics } from '../state/workspacePresentation'
import { calculatePassRate,formatQualityPercent,passRateTone } from '@/utils/qualityStatus'
import WorkspacePageHeader from '@/components/workspace/WorkspacePageHeader.vue'
import { computed, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useProjectStore } from '@/store/projectStore'
import { executionRecordApi } from '../api'
import ExecutionRecordDetailPanel from '../components/ExecutionRecordDetailPanel.vue'
import type { ApiExecutionRecord } from '../types'

interface RecordCaseGroup {
  key: string
  caseName: string
  isDirectRequest: boolean
  totalCount: number
  passedCount: number
  failedCount: number
  errorCount: number
  latestExecutedAt?: string
  latestRecord: ApiExecutionRecord
  failedRecord?: ApiExecutionRecord
  records: ApiExecutionRecord[]
}

interface RecordInterfaceGroup {
  key: string
  interfaceName: string
  method: string
  url: string
  collectionName?: string | null
  totalCount: number
  passedCount: number
  failedCount: number
  errorCount: number
  latestExecutedAt?: string
  failedCaseCount: number
  cases: RecordCaseGroup[]
}

interface RecordRunGroup {
  key: string
  runId: string
  runName: string
  runType: 'request' | 'test_case' | 'mixed'
  runTypeLabel: string
  totalCount: number
  passedCount: number
  failedCount: number
  errorCount: number
  latestExecutedAt?: string
  environmentNames: string[]
  failedInterfaceCount: number
  failedTestCaseCount: number
  interfaces: RecordInterfaceGroup[]
}

const props = defineProps<{
  selectedCollectionId?: number
  selectedCollectionName?: string
}>()

const projectStore = useProjectStore()
const projectId = computed(() => projectStore.currentProject?.id)
const projectName = computed(() => projectStore.currentProject?.name || '未选择项目')

const loading = ref(false)
const searchKeyword = ref('')
const records = ref<ApiExecutionRecord[]>([])
const detailVisible = ref(false)
const currentRecord = ref<ApiExecutionRecord | null>(null)

const methodColorMap: Record<string, string> = {
  GET: 'green',
  POST: 'arcoblue',
  PUT: 'orange',
  PATCH: 'purple',
  DELETE: 'red',
  HEAD: 'gray',
  OPTIONS: 'cyan',
}

const runTypeLabelMap: Record<RecordRunGroup['runType'], string> = {
  request: '接口执行批次',
  test_case: '测试用例执行批次',
  mixed: '混合执行批次',
}

const resultFilter=ref<string>(),environmentFilter=ref<string>()
const environmentNames=computed(()=>[...new Set(records.value.map(item=>item.environment_name || '默认环境'))])
useApiWorkspaceMetrics('execution-records',computed(()=>{const rate=calculatePassRate(records.value.filter(item=>item.passed).length,records.value.length),durations=records.value.map(item=>item.response_time).filter((item):item is number=>item!=null);return [{label:'范围执行记录',value:loading.value ? null : records.value.length},{label:'通过率',value:formatQualityPercent(rate),tone:passRateTone(rate)},{label:'平均耗时',value:durations.length ? Math.round(durations.reduce((a,b)=>a+b,0)/durations.length)+' ms' : '—',tone:'purple'},{label:'失败与异常',value:loading.value ? null : records.value.filter(item=>!item.passed).length,tone:'danger'}]}))
const viewFullRecord=(record:ApiExecutionRecord)=>{currentRecord.value=record;detailVisible.value=true}
const filteredRecords = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const scoped=records.value.filter(item=>(!resultFilter.value || (resultFilter.value==='passed' ? item.passed : resultFilter.value==='error' ? item.status==='error' : !item.passed && item.status!=='error')) && (!environmentFilter.value || (item.environment_name || '默认环境')===environmentFilter.value))
  if (!keyword) return scoped
  return scoped.filter(item => {
    return (
      (item.interface_name || item.request_name || '').toLowerCase().includes(keyword) ||
      (item.test_case_name || '').toLowerCase().includes(keyword) ||
      item.url.toLowerCase().includes(keyword) ||
      (item.error_message || '').toLowerCase().includes(keyword)
    )
  })
})

const groupedRuns = computed<RecordRunGroup[]>(() => {
  const runMap = new Map<string, RecordRunGroup & { interfaceMap: Map<string, RecordInterfaceGroup & { caseMap: Map<string, RecordCaseGroup> }> }>()
  const items = [...filteredRecords.value].sort((left, right) => {
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })

  items.forEach(record => {
    const runKey = record.run_id || `legacy-${record.id}`
    const runType = record.test_case ? 'test_case' : 'request'
    let runEntry = runMap.get(runKey)

    if (!runEntry) {
      runEntry = {
        key: runKey,
        runId: record.run_id || runKey,
        runName: record.run_name || (record.test_case ? '测试用例执行' : '接口执行'),
        runType,
        runTypeLabel: runTypeLabelMap[runType],
        totalCount: 0,
        passedCount: 0,
        failedCount: 0,
        errorCount: 0,
        latestExecutedAt: record.created_at,
        environmentNames: [],
        failedInterfaceCount: 0,
        failedTestCaseCount: 0,
        interfaces: [],
        interfaceMap: new Map(),
      }
      runMap.set(runKey, runEntry)
    } else if (runEntry.runType !== runType) {
      runEntry.runType = 'mixed'
      runEntry.runTypeLabel = runTypeLabelMap.mixed
    }

    runEntry.totalCount += 1
    if (record.passed) runEntry.passedCount += 1
    if (record.status === 'failed') runEntry.failedCount += 1
    if (record.status === 'error') runEntry.errorCount += 1
    if (record.environment_name && !runEntry.environmentNames.includes(record.environment_name)) {
      runEntry.environmentNames.push(record.environment_name)
    }

    const interfaceName = record.interface_name || record.request_name || '未命名接口'
    const interfaceKey = `${record.request || interfaceName}-${record.collection_id || 'unknown'}`
    let interfaceEntry = runEntry.interfaceMap.get(interfaceKey)
    if (!interfaceEntry) {
      interfaceEntry = {
        key: interfaceKey,
        interfaceName,
        method: record.method,
        url: record.url,
        collectionName: record.collection_name || record.request_collection_name || null,
        totalCount: 0,
        passedCount: 0,
        failedCount: 0,
        errorCount: 0,
        latestExecutedAt: record.created_at,
        failedCaseCount: 0,
        cases: [],
        caseMap: new Map(),
      }
      runEntry.interfaceMap.set(interfaceKey, interfaceEntry)
    }

    interfaceEntry.totalCount += 1
    if (record.passed) interfaceEntry.passedCount += 1
    if (record.status === 'failed') interfaceEntry.failedCount += 1
    if (record.status === 'error') interfaceEntry.errorCount += 1

    const caseName =
      record.test_case_name ||
      (record.request_name && record.request_name !== interfaceName ? record.request_name : '接口直接执行')
    const caseKey = record.test_case ? `case-${record.test_case}` : `direct-${record.request || interfaceName}`
    let caseEntry = interfaceEntry.caseMap.get(caseKey)
    if (!caseEntry) {
      caseEntry = {
        key: caseKey,
        caseName,
        isDirectRequest: !Boolean(record.test_case),
        totalCount: 0,
        passedCount: 0,
        failedCount: 0,
        errorCount: 0,
        latestExecutedAt: record.created_at,
        latestRecord: record,
        failedRecord: !record.passed ? record : undefined,
        records: [],
      }
      interfaceEntry.caseMap.set(caseKey, caseEntry)
    }

    caseEntry.totalCount += 1
    if (record.passed) caseEntry.passedCount += 1
    if (record.status === 'failed') caseEntry.failedCount += 1
    if (record.status === 'error') caseEntry.errorCount += 1
    caseEntry.records.push(record)
    if (!caseEntry.failedRecord && !record.passed) {
      caseEntry.failedRecord = record
    }
  })

  return Array.from(runMap.values()).map(runEntry => {
    const interfaces = Array.from(runEntry.interfaceMap.values()).map(interfaceEntry => {
      const cases = Array.from(interfaceEntry.caseMap.values()).sort((left, right) => {
        return new Date(right.latestExecutedAt || 0).getTime() - new Date(left.latestExecutedAt || 0).getTime()
      })
      interfaceEntry.cases = cases
      interfaceEntry.failedCaseCount = cases.filter(item => item.failedCount || item.errorCount).length
      return {
        key: interfaceEntry.key,
        interfaceName: interfaceEntry.interfaceName,
        method: interfaceEntry.method,
        url: interfaceEntry.url,
        collectionName: interfaceEntry.collectionName,
        totalCount: interfaceEntry.totalCount,
        passedCount: interfaceEntry.passedCount,
        failedCount: interfaceEntry.failedCount,
        errorCount: interfaceEntry.errorCount,
        latestExecutedAt: interfaceEntry.latestExecutedAt,
        failedCaseCount: interfaceEntry.failedCaseCount,
        cases,
      }
    }).sort((left, right) => new Date(right.latestExecutedAt || 0).getTime() - new Date(left.latestExecutedAt || 0).getTime())

    return {
      key: runEntry.key,
      runId: runEntry.runId,
      runName: runEntry.runName,
      runType: runEntry.runType,
      runTypeLabel: runTypeLabelMap[runEntry.runType],
      totalCount: runEntry.totalCount,
      passedCount: runEntry.passedCount,
      failedCount: runEntry.failedCount,
      errorCount: runEntry.errorCount,
      latestExecutedAt: runEntry.latestExecutedAt,
      environmentNames: runEntry.environmentNames,
      failedInterfaceCount: interfaces.filter(item => item.failedCount || item.errorCount).length,
      failedTestCaseCount: interfaces.reduce((count, item) => count + item.failedCaseCount, 0),
      interfaces,
    }
  }).sort((left, right) => new Date(right.latestExecutedAt || 0).getTime() - new Date(left.latestExecutedAt || 0).getTime())
})

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN')
}

const getRecordStatusTag = (record: ApiExecutionRecord) => {
  if (record.passed) return { color: 'green', label: '通过' }
  if (record.status === 'error') return { color: 'red', label: '异常' }
  return { color: 'orange', label: '失败' }
}

const pickCaseRecord = (caseGroup: RecordCaseGroup) => caseGroup.failedRecord || caseGroup.latestRecord

const getWorkflowSummaryText = (record?: ApiExecutionRecord | null) => {
  if (!record) return ''
  const workflowSummary = record.workflow_summary
  const stepCount = workflowSummary?.executed_step_count || workflowSummary?.configured_step_count || record.workflow_steps?.length || 0
  if (!workflowSummary?.enabled && !stepCount) return ''
  if (record.main_request_blocked) return `工作流 ${stepCount} 步，主请求被阻断`
  if (workflowSummary?.has_failure) return `工作流 ${stepCount} 步，存在失败步骤`
  return `工作流 ${stepCount} 步`
}

const loadRecords = async () => {
  if (!projectId.value) {
    records.value = []
    return
  }
  loading.value = true
  try {
    const res = await executionRecordApi.list({
      project: projectId.value,
      collection: props.selectedCollectionId,
    })
    const data = res.data?.data || []
    records.value = Array.isArray(data) ? data : []
    if(currentRecord.value) currentRecord.value=records.value.find(item=>item.id===currentRecord.value?.id) || null
  } catch (error) {
    console.error('[ExecutionRecordList] 获取执行记录失败:', error)
    Message.error('获取执行记录失败')
    records.value = []
  } finally {
    loading.value = false
  }
}

const viewRecord = (record: ApiExecutionRecord) => { currentRecord.value = record }

const deleteRecord = async (id: number) => {
  try {
    await executionRecordApi.delete(id)
    Message.success('执行记录删除成功')
    if (currentRecord.value?.id === id) {
      detailVisible.value = false
      currentRecord.value = null
    }
    await loadRecords()
  } catch (error: any) {
    Message.error(error?.error || '删除执行记录失败')
  }
}

watch(
  () => [projectId.value, props.selectedCollectionId],
  () => {
    loadRecords()
  },
  { immediate: true }
)

defineExpose({
  refresh: loadRecords,
})
</script>

<style scoped>
.execution-record-list {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.page-hero {
  display: grid;
  grid-template-columns: minmax(260px, 1.1fr) minmax(320px, 1fr);
  align-items: end;
  gap: 22px;
  padding: 26px 28px;
  border-radius: 12px;
  background:
    var(--theme-surface);
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: var(--theme-card-shadow);
}

.page-summary,
.page-toolbar {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.page-summary {
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.page-summary__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--theme-accent);
}

.page-summary__title {
  font-size: 30px;
  font-weight: 800;
  line-height: 1.06;
  color: var(--theme-text);
}

.page-summary__desc {
  max-width: 700px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--theme-text-secondary);
}

.page-summary__meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 13px;
  line-height: 1.8;
  color: var(--theme-text-secondary);
}

.page-summary__meta span {
  position: relative;
  padding-right: 12px;
}

.page-summary__meta span:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.9);
  transform: translateY(-50%);
}

.page-toolbar {
  justify-content: flex-end;
  align-items: center;
}

.toolbar-search {
  width: 320px;
  max-width: 100%;
}

.page-toolbar :deep(.arco-input-wrapper),
.page-toolbar :deep(.arco-btn) {
  min-height: 42px;
}

.page-toolbar :deep(.arco-btn) {
  padding-inline: 18px;
  border-radius: 12px;
}

.state-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  padding: 32px;
  border-radius: 12px;
  background: var(--theme-surface);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: var(--theme-card-shadow);
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.run-card {
  padding: 22px;
  border-radius: 12px;
  background: var(--theme-surface);
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: var(--theme-card-shadow);
}

.run-card__header,
.interface-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}

.run-card__copy,
.interface-card__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.run-card__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--theme-success);
}

.run-card__title {
  font-size: 20px;
  font-weight: 700;
  color: var(--theme-text);
  word-break: break-word;
}

.run-card__meta,
.interface-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--theme-text-secondary);
}

.run-card__stats,
.interface-card__summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.interface-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 18px;
}

.interface-card {
  padding: 18px;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.interface-card__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--theme-text);
}

.interface-card__title span {
  min-width: 0;
  word-break: break-word;
}

.interface-card :deep(.arco-table-container) {
  margin-top: 14px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.case-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.case-cell__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--theme-text);
  word-break: break-word;
}

.case-cell__desc,
.failure-text {
  font-size: 12px;
  line-height: 1.7;
  color: var(--theme-text-secondary);
  word-break: break-word;
}

.detail-modal :deep(.arco-modal) {
  max-width: min(1120px, calc(100vw - 32px));
}

.detail-modal :deep(.arco-modal-body) {
  padding: 20px 24px 24px;
}

@media (max-width: 1200px) {
  .page-hero {
    grid-template-columns: 1fr;
  }

  .page-toolbar {
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .page-hero {
    align-items: stretch;
    padding: 22px 20px;
  }

  .page-summary,
  .page-toolbar,
  .toolbar-search {
    width: 100%;
  }

  .page-summary__title {
    font-size: 26px;
  }

  .run-card,
  .interface-card {
    padding: 18px;
  }
}
</style>
