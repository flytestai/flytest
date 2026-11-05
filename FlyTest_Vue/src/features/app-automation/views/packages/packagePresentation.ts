import type { AppPackage } from '../../types'

export function packageFormat(record: AppPackage) { return (record.file_type || record.file_name?.split('.').pop() || '').toLowerCase() }
export function packageSize(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '未上报'
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
export function packageInstallation(record: AppPackage) {
  const entries = record.installations || [], installed = entries.filter(item => item.status === 'installed').length
  if (entries.some(item => item.status === 'installing')) return { key: 'installing', label: '安装中', installed, total: entries.length }
  if (installed && installed === entries.length) return { key: 'installed', label: `已安装 (${installed}/${entries.length})`, installed, total: entries.length }
  if (installed) return { key: 'partial', label: `部分安装 (${installed}/${entries.length})`, installed, total: entries.length }
  if (entries.some(item => item.status === 'failed')) return { key: 'failed', label: '安装失败', installed, total: entries.length }
  return { key: 'unknown', label: '无安装记录', installed, total: 0 }
}
export function latestPackageIds(records: AppPackage[]) {
  const latest = new Map<string, AppPackage>()
  for (const record of records) {
    if (!record.version_name && !record.version_code) continue
    const key = `${record.platform}:${record.package_name}`, previous = latest.get(key)
    if (!previous || Date.parse(record.uploaded_at || record.updated_at) > Date.parse(previous.uploaded_at || previous.updated_at)) latest.set(key, record)
  }
  return new Set([...latest.values()].map(item => item.id))
}
export function savePackageBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = filename.replace(/[\\/\r\n]/g, '_'); document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
