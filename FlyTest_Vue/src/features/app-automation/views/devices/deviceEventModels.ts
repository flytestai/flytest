import type { AppDevice } from '../../types'

export interface DevicesHeaderBarEmits {
  'toggle-auto-refresh': [value: string | number | boolean]
  'open-connect': []
  discover: []
}

export interface DevicesFilterCardEmits {
  search: []
  reset: []
}

export interface DevicesTableCardEmits {
  'open-detail': [record: AppDevice]
  'open-edit': [record: AppDevice]
  'preview-screenshot': [id: number]
  lock: [id: number]
  unlock: [id: number]
  reconnect: [record: AppDevice]
  disconnect: [id: number]
  remove: [id: number]
}

export interface DeviceConnectDialogEmits {
  connect: []
}

export interface DeviceEditDialogEmits {
  submit: []
}
