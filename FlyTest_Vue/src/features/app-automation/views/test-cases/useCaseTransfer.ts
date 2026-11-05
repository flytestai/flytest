import { ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { AppAutomationService } from '../../services/appAutomationService'
import type { AppTestCase } from '../../types'
import { validateCaseContent } from './testCasePresentation'

export function useCaseTransfer(projectId: () => number, cases: () => AppTestCase[], reload: () => void) {
  const visible = ref(false), busy = ref(false), pending = ref<AppTestCase[]>([]), summary = ref('')
  const readFile = async (event: Event) => {
    const input = event.target as HTMLInputElement, file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('导入文件不能超过 5 MB')
      const data = JSON.parse(await file.text()), records = Array.isArray(data) ? data : data.cases
      if (!Array.isArray(records) || !records.length || records.length > 500) throw new Error('请提供 1–500 条用例的 JSON 数组或 FeiCe 导出文件')
      for (const record of records) {
        if (typeof record?.name !== 'string' || !record.name.trim() || record.name.length > 200) throw new Error('每条用例需要有效名称（最多 200 字）')
        validateCaseContent(record.ui_flow, record.variables || [])
      }
      pending.value = records
      summary.value = '仅创建新用例，同名项自动跳过；应用包按当前项目有效编号匹配。'
      visible.value = true
    } catch (error: any) { Message.error(error.message || '无法读取导入文件') }
  }
  const importCases = async (validPackages: number[]) => {
    if (busy.value || !pending.value.length) return
    const targetProject = projectId(), names = new Set(cases().map(item => item.name.trim()))
    if (!targetProject) return
    busy.value = true
    let imported = 0, skipped = 0
    const failed: AppTestCase[] = []
    try {
      for (const record of pending.value) {
        if (targetProject !== projectId()) break
        if (names.has(record.name.trim())) { skipped++; continue }
        try {
          await AppAutomationService.createTestCase({ project_id: targetProject, name: record.name.trim(), description: typeof record.description === 'string' ? record.description : '', package_id: validPackages.includes(Number(record.package_id)) ? Number(record.package_id) : null, ui_flow: record.ui_flow, variables: record.variables || [], tags: Array.isArray(record.tags) ? record.tags.filter(item => typeof item === 'string') : [], timeout: Math.max(1, Math.min(7200, Number(record.timeout) || 300)), retry_count: Math.max(0, Math.min(10, Number(record.retry_count) || 0)) })
          names.add(record.name.trim()); imported++
        } catch { failed.push(record) }
      }
      pending.value = failed
      summary.value = `已导入 ${imported} 项 · 同名跳过 ${skipped} 项 · 失败 ${failed.length} 项${failed.length ? '，可重试失败项' : ''}`
      reload()
    } finally { busy.value = false }
  }
  const exportCases = (records: AppTestCase[]) => {
    if (!records.length) { Message.warning('没有可导出的用例'); return }
    const content = { format: 'feice-app-test-cases', version: 1, cases: records.map(({ name, description, package_id, ui_flow, variables, tags, timeout, retry_count }) => ({ name, description, package_id, ui_flow, variables, tags, timeout, retry_count })) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'feice-app-test-cases.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return { visible, busy, pending, summary, readFile, importCases, exportCases }
}
