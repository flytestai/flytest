import type { AppPackage } from '../../types'

export interface PackageFormModel {
  id: number
  project_id: number
  name: string
  package_name: string
  activity_name: string
  platform: string
  description: string
}

export interface PackageStats {
  total: number
  android: number
  ios: number
  configuredActivity: number
}

export interface PackagePaginationState {
  current: number
  pageSize: number
}

export interface PackagesHeaderBarProps {
  loading: boolean
}

export interface PackagesStatsGridProps {
  stats: PackageStats
}

export interface PackagesTableCardProps {
  packages: AppPackage[]
  loading: boolean
  total: number
  formatDateTime: (value?: string | null) => string
  getPlatformLabel: (platform: string) => string
  getPlatformColor: (platform: string) => string
}

export interface PackageEditorDialogProps {
  form: PackageFormModel
  submitting: boolean
}
