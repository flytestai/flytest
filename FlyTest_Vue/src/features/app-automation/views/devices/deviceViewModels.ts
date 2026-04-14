import type { AppDevice, AppDeviceScreenshot } from '../../types'

export interface DeviceFilters {
  search: string
  status: string
}

export interface DeviceConnectFormModel {
  ip_address: string
  port: number
}

export interface DeviceEditFormModel {
  name: string
  description: string
  location: string
  status: string
}

export interface DeviceStats {
  total: number
  available: number
  locked: number
  offline: number
}

export interface DevicesHeaderBarProps {
  loading: boolean
  autoRefreshEnabled: boolean
  lastUpdatedText: string
}

export interface DevicesFilterCardProps {
  filters: DeviceFilters
}

export interface DevicesStatsGridProps {
  stats: DeviceStats
}

export interface DevicesTableCardProps {
  devices: AppDevice[]
  loading: boolean
  screenshotLoadingId: number | null
  formatDateTime: (value?: string | null) => string
  getStatusLabel: (status: string) => string
  getStatusColor: (status: string) => string
  getConnectionLabel: (connectionType: string) => string
  formatEndpoint: (record: AppDevice) => string
  canReconnect: (record: AppDevice) => boolean
  canDisconnect: (record: AppDevice) => boolean
}

export interface DeviceConnectDialogProps {
  connectForm: DeviceConnectFormModel
}

export interface DeviceEditDialogProps {
  editForm: DeviceEditFormModel
  editSaving: boolean
}

export interface DeviceDetailDialogProps {
  currentDevice: AppDevice | null
  formatDateTime: (value?: string | null) => string
  getStatusLabel: (status: string) => string
  getConnectionLabel: (connectionType: string) => string
  formatEndpoint: (record: AppDevice) => string
}

export interface DeviceScreenshotDialogProps {
  currentScreenshot: AppDeviceScreenshot | null
  formatTimestamp: (timestamp?: number) => string
}
