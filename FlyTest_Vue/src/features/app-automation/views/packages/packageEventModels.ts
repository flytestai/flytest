import type { AppPackage } from '../../types'

export interface PackagesHeaderBarEmits {
  refresh: []
  create: []
}

export interface PackagesFilterCardEmits {
  search: []
  reset: []
}

export interface PackagesTableCardEmits {
  'open-edit': [record: AppPackage]
  remove: [record: AppPackage]
}

export interface PackageEditorDialogEmits {
  submit: []
}
