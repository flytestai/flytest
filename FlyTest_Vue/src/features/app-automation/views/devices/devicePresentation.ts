import type { AppDevice } from '../../types'

export type DeviceState = 'online' | 'busy' | 'offline' | 'unavailable'
export const deviceStateLabels: Record<DeviceState, string> = { online: '在线', busy: '忙碌', offline: '离线', unavailable: '不可用' }
export function deviceState(device: AppDevice): DeviceState {
  if (['available', 'online'].includes(device.status)) return 'online'
  if (['locked', 'busy', 'stopping'].includes(device.status)) return 'busy'
  if (device.status === 'offline') return 'offline'
  return 'unavailable'
}
export function devicePlatform(device: AppDevice): string {
  const specs = device.device_specs || {}
  const value = String(specs.platform || specs.os || '').toLowerCase()
  if (['ios', 'ipados', 'iphone', 'ipad'].includes(value)) return 'iOS'
  if (value === 'android' || device.android_version) return 'Android'
  return '未知平台'
}
export function deviceVersion(device: AppDevice): string {
  const specs = device.device_specs || {}
  return String(specs.os_version || specs.system_version || (devicePlatform(device) === 'Android' ? device.android_version : '') || '')
}
export function deviceKind(device: AppDevice): string {
  const specs = device.device_specs || {}
  if (specs.is_emulator === true || specs.is_simulator === true || specs.device_type === 'simulator' || specs.device_type === 'emulator' || /^emulator-\d+$/.test(device.device_id)) return '模拟器'
  if (specs.is_emulator === false || specs.is_simulator === false || specs.device_type === 'physical' || ['usb', 'remote'].includes(device.connection_type)) return '真机'
  // Older discovery services label all ADB devices as "emulator"; that alone is not evidence.
  return '未识别'
}
export function deviceModel(device: AppDevice): string {
  return String(device.device_specs?.model || device.device_specs?.model_name || '未上报')
}
export function deviceUsage(device: AppDevice): number | null {
  const value = device.device_specs?.utilization_percent ?? device.device_specs?.usage_percent
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
}
