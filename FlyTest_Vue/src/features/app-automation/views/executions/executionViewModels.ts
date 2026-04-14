import type { AppExecution, AppTestSuite } from '../../types'

export interface ExecutionFilters {
  search: string
  status: string
  suite: string
}

export interface ExecutionPaginationState {
  current: number
  pageSize: number
}

export interface ExecutionStatusMeta {
  label: string
  color: string
  hex: string
}

export interface ExecutionArtifact {
  key: string
  relativePath: string
  message: string
  level: string
}

export interface ExecutionStatistics {
  total: number
  running: number
  passed: number
  averagePassRate: number
}

export interface ExecutionsHeaderBarProps {
  loading: boolean
  lastUpdatedText: string
}

export interface ExecutionsFilterCardProps {
  filters: ExecutionFilters
  suites: AppTestSuite[]
}

export interface ExecutionsStatsGridProps {
  statistics: ExecutionStatistics
}

export interface ExecutionsTableCardProps {
  loading: boolean
  executions: AppExecution[]
  total: number
  stoppingIds: Record<number, boolean>
  formatDateTime: (value?: string | null) => string
  formatDuration: (value?: number | null) => string
  formatRate: (value?: number | null) => number
  formatProgress: (value?: number | null) => number
  getExecutionSource: (record: AppExecution) => string
  getExecutionStatusMeta: (record: AppExecution) => ExecutionStatusMeta
  canOpenReport: (record: AppExecution) => boolean
  isExecutionRunning: (record: AppExecution) => boolean
}

export interface ExecutionsDetailDialogProps {
  detailLoading: boolean
  currentExecution: AppExecution | null
  executionArtifacts: ExecutionArtifact[]
  stoppingIds: Record<number, boolean>
  formatDateTime: (value?: string | null) => string
  formatDuration: (value?: number | null) => string
  formatRate: (value?: number | null) => number
  formatProgress: (value?: number | null) => number
  getExecutionSource: (record: AppExecution) => string
  getExecutionStatusMeta: (record: AppExecution) => ExecutionStatusMeta
  getLogLevelColor: (value?: string) => string
  canOpenReport: (record: AppExecution) => boolean
  isExecutionRunning: (record: AppExecution) => boolean
}
