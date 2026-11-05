import type { AppTestCase } from '../../types'
export const caseMetadata = (record: AppTestCase) => {
  const value = record.ui_flow?.feice_meta
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
export const caseGroup = (record: AppTestCase) => typeof caseMetadata(record).group === 'string' ? String(caseMetadata(record).group).trim() : ''
export const casePriority = (record: AppTestCase) => ['P0','P1','P2','P3'].includes(String(caseMetadata(record).priority)) ? String(caseMetadata(record).priority) : ''
export const caseCode = (record: AppTestCase) => `AP-${String(record.id).padStart(4, '0')}`
export const caseHasSteps = (record: AppTestCase) => Array.isArray(record.ui_flow?.steps) && record.ui_flow.steps.length > 0
export function validateCaseContent(flow: unknown, variables: unknown) {
  if (!flow || typeof flow !== 'object' || Array.isArray(flow) || !Array.isArray((flow as Record<string,unknown>).steps)) throw new Error('流程 JSON 必须是包含 steps 数组的对象')
  if (!Array.isArray(variables) || variables.some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error('变量 JSON 必须是对象数组')
}
