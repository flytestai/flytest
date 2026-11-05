import type { AppExecution, AppScheduledTask, AppTestCase, AppPackage } from '../../types'

export const executionState = (record: AppExecution) => {
  if (['pending','running'].includes(record.status)) return record.status
  if (['error','exception'].includes(record.result) || ['error','exception'].includes(record.status)) return 'error'
  if (record.result === 'stopped' || record.status === 'stopped') return 'stopped'
  if (record.result === 'failed' || record.status === 'failed') return 'failed'
  if (record.result === 'passed') return 'passed'
  return record.status === 'completed' ? 'completed' : 'unknown'
}
export const executionTime = (record: AppExecution) => record.started_at || record.created_at
export const executionCode = (record: AppExecution) => `EX-${String(record.id).padStart(5, '0')}`
export function executionInDates(record: AppExecution, dates?: string[] | null) {
  if (dates?.length !== 2) return true
  const start = new Date(dates[0] + 'T00:00:00').getTime(), end = new Date(dates[1] + 'T00:00:00')
  end.setDate(end.getDate() + 1)
  const time = Date.parse(executionTime(record))
  return Number.isFinite(time) && time >= start && time < end.getTime()
}
export const executionTask = (record: AppExecution, tasks: AppScheduledTask[]) => tasks.find(task => record.task_id ? task.id === record.task_id : task.last_result?.execution_id === record.id || task.last_result?.execution_ids?.includes(record.id))
export function executionApp(record: AppExecution, cases: AppTestCase[], packages: AppPackage[]) {
  const snapshot = record.package_snapshot
  const packageId = record.package_id ?? cases.find(item => item.id === record.test_case_id)?.package_id
  const current = packages.find(item => item.id === packageId)
  return { id: packageId, name: snapshot?.name || record.app_name || current?.name || '未记录应用', platform: snapshot?.platform || current?.platform || '', version: snapshot?.version || record.app_version || '', snapshot: Boolean(snapshot?.name || record.app_name) }
}
export const clockDuration = (seconds?: number | null) => {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—'
  const value = Math.floor(seconds)
  return [Math.floor(value / 3600), Math.floor(value % 3600 / 60), value % 60].map(v => String(v).padStart(2, '0')).join(':')
}
export function executionTrend(records: AppExecution[], now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Array.from({length:7},(_,index) => {
    const day = new Date(today - (6-index)*86400000).toISOString().slice(0,10)
    const completed = records.filter(item => {
      const time = Date.parse(executionTime(item))
      return Number.isFinite(time) && new Date(time).toISOString().startsWith(day) && ['passed','failed','error'].includes(executionState(item))
    })
    const passed = completed.filter(item=>executionState(item)==='passed').length
    return {day, total:completed.length, passed, rate:completed.length ? passed/completed.length*100 : null}
  })
}
