import type { AppElement } from '../../types'
import { buildElementPayloadFromRecord } from './elementFormUtils'

export const controlTypes: Record<string, string> = { generic: '元素', input: '输入框', button: '按钮', checkbox: '复选框', text: '文本', image: '图片', link: '链接', list: '列表' }
export const selectorLabels: Record<string, string> = { id: 'ResourceId', 'resource-id': 'ResourceId', xpath: 'XPath', text: 'Text', desc: 'Accessibility', 'content-desc': 'Accessibility', accessibility_id: 'Accessibility', class: 'Class', image: 'Image', pos: 'Position', point: 'Position', coordinate: 'Position', region: 'Region' }
export const elementPage = (record: AppElement) => String(record.config?.page_name || '').trim()
export const elementControl = (record: AppElement) => String(record.config?.ui_type || (record.element_type === 'image' ? 'image' : 'generic'))
export const elementControlLabel = (record: AppElement) => controlTypes[elementControl(record)] || record.element_type || '元素'
export const elementReusable = (record: AppElement) => typeof record.config?.reusable === 'boolean' ? record.config.reusable : null
export const elementMaintenance = (record: AppElement) => ['normal', 'needs_maintenance'].includes(String(record.config?.maintenance_status)) ? String(record.config.maintenance_status) : null
export const elementSelector = (record: AppElement) => selectorLabels[record.selector_type.toLowerCase()] || record.selector_type || '未设置'
export function elementExpression(record: AppElement) {
  if (record.selector_value) return record.selector_value
  if (record.element_type === 'image') return record.image_path || '未设置图片'
  if (record.element_type === 'pos') return `${record.config.x ?? '—'}, ${record.config.y ?? '—'}`
  if (record.element_type === 'region') return `${record.config.x1 ?? '—'}, ${record.config.y1 ?? '—'} → ${record.config.x2 ?? '—'}, ${record.config.y2 ?? '—'}`
  return '未设置'
}

export function downloadElements(records: AppElement[], filename = 'FeiCe-元素资产.json') {
  const content = { kind: 'feice-app-elements', schema_version: 1, exported_at: new Date().toISOString(), elements: records.map(record => buildElementPayloadFromRecord(record)) }
  const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export type ImportedElement = ReturnType<typeof buildElementPayloadFromRecord>
export function parseElementImport(text: string, projectId: number): ImportedElement[] {
  if (text.length > 5 * 1024 * 1024) throw new Error('导入文件不能超过 5 MB')
  const data = JSON.parse(text), records = Array.isArray(data) ? data : data?.elements
  if (!Array.isArray(records) || !records.length || records.length > 2000) throw new Error('请提供包含 1–2000 个元素的 JSON 数组或元素导出文件')
  return records.map((raw: unknown, index: number) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`第 ${index + 1} 项不是有效元素`)
    const item = raw as Record<string, unknown>, name = String(item.name || '').trim(), type = String(item.element_type || 'locator')
    const selectorType = String(item.selector_type || '').toLowerCase(), selectorValue = String(item.selector_value || '')
    if (!name || name.length > 120) throw new Error(`第 ${index + 1} 项名称为空或超过 120 字符`)
    const allowedSelectors = ['resource-id','id','xpath','text','desc','content-desc','accessibility_id','class','image','pos','point','coordinate','region']
    if (!allowedSelectors.includes(selectorType)) throw new Error(`元素“${name}”使用了不支持的定位方式`)
    const config = item.config && typeof item.config === 'object' && !Array.isArray(item.config) ? item.config as Record<string, unknown> : {}
    if (type === 'image' && !item.image_path) throw new Error(`图片元素“${name}”缺少资源路径`)
    if (type === 'pos' && ![config.x, config.y].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) throw new Error(`元素“${name}”坐标无效`)
    if (type === 'region' && ![config.x1, config.y1, config.x2, config.y2].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) throw new Error(`元素“${name}”区域无效`)
    if (!['image','pos','region'].includes(type) && !selectorValue.trim()) throw new Error(`元素“${name}”缺少定位表达式`)
    return { project_id: projectId, name, element_type: type, selector_type: selectorType, selector_value: selectorValue, description: String(item.description || ''), tags: Array.isArray(item.tags) ? item.tags.map(String) : [], config: JSON.parse(JSON.stringify(config)), image_path: String(item.image_path || ''), is_active: item.is_active === true }
  })
}
