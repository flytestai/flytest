import type { AppElement } from '../../types'
import { extractAppAutomationImageCategory } from '../../utils/assetPath'
import type { ElementsEditorFormModel } from './elementViewModels'

type ElementMutationPayload = Omit<AppElement, 'id' | 'updated_at'>
type ElementRecordOverrides = Partial<AppElement> & { name?: string; is_active?: boolean }

const cloneElementValue = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const parseObjectText = (text: string) => {
  const raw = String(text || '').trim()
  if (!raw) {
    return {}
  }

  const parsed = JSON.parse(raw)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('扩展配置 JSON 必须是对象')
  }

  return parsed as Record<string, unknown>
}

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseTagsText = (value: string) =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

export const createDefaultElementFormModel = (): ElementsEditorFormModel => ({
  id: 0,
  name: '',
  element_type: 'image',
  selector_type: 'image',
  selector_value: '',
  description: '',
  tagsText: '',
  configText: '{\n  "threshold": 0.7\n}',
  image_path: '',
  imageCategory: 'common',
  fileHash: '',
  is_active: true,
  threshold: 0.7,
  rgb: false,
  posX: 0,
  posY: 0,
  regionX1: 0,
  regionY1: 0,
  regionX2: 0,
  regionY2: 0,
})

export const resolveElementImageCategory = (
  record: Pick<AppElement, 'config' | 'image_path'>,
  fallback = '',
) => {
  const config = record.config as Record<string, unknown> | undefined
  if (config?.image_category) {
    return String(config.image_category)
  }

  return extractAppAutomationImageCategory(record.image_path) || fallback
}

export const buildElementFormPatchFromRecord = (record: AppElement): ElementsEditorFormModel => {
  const config = cloneElementValue(record.config || {})

  return {
    ...createDefaultElementFormModel(),
    id: record.id,
    name: record.name,
    element_type: record.element_type,
    selector_type: record.selector_type,
    selector_value: record.selector_value,
    description: record.description,
    tagsText: record.tags.join(', '),
    configText: JSON.stringify(config, null, 2),
    image_path: record.image_path,
    imageCategory: resolveElementImageCategory(record, 'common'),
    fileHash: String((config as Record<string, unknown>).file_hash || ''),
    is_active: record.is_active,
    threshold: toFiniteNumber((config as Record<string, unknown>).threshold, 0.7) || 0.7,
    rgb: Boolean((config as Record<string, unknown>).rgb),
    posX: toFiniteNumber((config as Record<string, unknown>).x),
    posY: toFiniteNumber((config as Record<string, unknown>).y),
    regionX1: toFiniteNumber((config as Record<string, unknown>).x1),
    regionY1: toFiniteNumber((config as Record<string, unknown>).y1),
    regionX2: toFiniteNumber((config as Record<string, unknown>).x2),
    regionY2: toFiniteNumber((config as Record<string, unknown>).y2),
  }
}

export const buildElementPayloadFromForm = (
  form: ElementsEditorFormModel,
  projectId: number,
): ElementMutationPayload => {
  const selectorValue = form.selector_value.trim()
    || (form.element_type === 'image'
      ? form.image_path.trim()
      : form.element_type === 'pos'
        ? `${form.posX},${form.posY}`
        : `${form.regionX1},${form.regionY1},${form.regionX2},${form.regionY2}`)

  const selectorType = form.selector_type.trim()
    || (form.element_type === 'image' ? 'image' : form.element_type)

  const config = parseObjectText(form.configText)
  if (form.element_type === 'image') {
    config.image_category = form.imageCategory || 'common'
    config.image_path = form.image_path
    config.threshold = form.threshold
    config.rgb = form.rgb
    if (form.fileHash) {
      config.file_hash = form.fileHash
    } else {
      delete config.file_hash
    }
  } else if (form.element_type === 'pos') {
    config.x = form.posX
    config.y = form.posY
  } else {
    config.x1 = form.regionX1
    config.y1 = form.regionY1
    config.x2 = form.regionX2
    config.y2 = form.regionY2
    config.width = Math.max(form.regionX2 - form.regionX1, 0)
    config.height = Math.max(form.regionY2 - form.regionY1, 0)
  }

  return {
    project_id: projectId,
    name: form.name.trim(),
    element_type: form.element_type,
    selector_type: selectorType,
    selector_value: selectorValue,
    description: form.description.trim(),
    tags: parseTagsText(form.tagsText),
    config,
    image_path: form.image_path,
    is_active: form.is_active,
  }
}

export const buildElementPayloadFromRecord = (
  record: AppElement,
  overrides?: ElementRecordOverrides,
): ElementMutationPayload => ({
  project_id: record.project_id,
  name: String(overrides?.name ?? record.name).trim(),
  element_type: String(overrides?.element_type ?? record.element_type),
  selector_type: String(overrides?.selector_type ?? record.selector_type),
  selector_value: String(overrides?.selector_value ?? record.selector_value),
  description: String(overrides?.description ?? record.description),
  tags: [...record.tags],
  config: cloneElementValue(record.config || {}),
  image_path: String(overrides?.image_path ?? record.image_path),
  is_active: typeof overrides?.is_active === 'boolean' ? overrides.is_active : record.is_active,
})
