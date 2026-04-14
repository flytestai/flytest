import type { AppExecution } from '../../types'

export interface ExecutionsHeaderBarEmits {
  refresh: []
}

export interface ExecutionsFilterCardEmits {
  search: []
  reset: []
}

export interface ExecutionsTableCardEmits {
  'view-detail': [id: number]
  'open-report': [record: AppExecution]
  'stop-execution': [record: AppExecution]
}

export interface ExecutionsDetailDialogEmits {
  'open-report': [record: AppExecution]
  'stop-execution': [record: AppExecution]
  'open-artifact': [record: AppExecution, relativePath: string]
}
