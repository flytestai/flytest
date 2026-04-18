import type { AppElement } from '../types'

type CapturedElementPayload = Omit<AppElement, 'id' | 'updated_at'>

export type CaptureElementMode = 'image' | 'pos' | 'region'

export interface CaptureElementFormState {
  name: string
  element_type: CaptureElementMode
  image_category: string
  threshold: number
  rgb: boolean
  tagsText: string
  description: string
}

export interface CapturePoint {
  x: number
  y: number
}

export interface CaptureRegion extends CapturePoint {
  width: number
  height: number
}

export interface CaptureMetaSnapshot {
  device_id: string
  timestamp: number
}

export interface UploadedImageAsset {
  image_path: string
  image_category: string
  file_hash: string
}

const parseCaptureTags = (value: string) =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

export const createDefaultCaptureElementFormState = (): CaptureElementFormState => ({
  name: '',
  element_type: 'image',
  image_category: 'common',
  threshold: 0.7,
  rgb: false,
  tagsText: '',
  description: '',
})

export const normalizeCapturedElementFileName = (name: string) => {
  const safeBase = name.trim().replace(/[^\u4e00-\u9fa5\w-]+/g, '_').replace(/^_+|_+$/g, '')
  return `${safeBase || 'captured_element'}.png`
}

export const buildCapturedImageElementPayload = ({
  projectId,
  form,
  uploadResult,
  captureMeta,
  cropRegion,
}: {
  projectId: number
  form: CaptureElementFormState
  uploadResult: UploadedImageAsset
  captureMeta: CaptureMetaSnapshot
  cropRegion: CaptureRegion | null
}): CapturedElementPayload => ({
  project_id: projectId,
  name: form.name.trim(),
  element_type: 'image',
  selector_type: 'image',
  selector_value: uploadResult.image_path,
  description: form.description.trim(),
  tags: parseCaptureTags(form.tagsText),
  config: {
    threshold: form.threshold,
    rgb: form.rgb,
    image_path: uploadResult.image_path,
    image_category: uploadResult.image_category,
    file_hash: uploadResult.file_hash,
    capture_device_id: captureMeta.device_id,
    capture_timestamp: captureMeta.timestamp,
    crop_region: cropRegion,
  },
  image_path: uploadResult.image_path,
  is_active: true,
})

export const buildCapturedPosElementPayload = ({
  projectId,
  form,
  point,
  captureMeta,
}: {
  projectId: number
  form: CaptureElementFormState
  point: CapturePoint
  captureMeta: CaptureMetaSnapshot
}): CapturedElementPayload => ({
  project_id: projectId,
  name: form.name.trim(),
  element_type: 'pos',
  selector_type: 'pos',
  selector_value: `${point.x},${point.y}`,
  description: form.description.trim(),
  tags: parseCaptureTags(form.tagsText),
  config: {
    x: point.x,
    y: point.y,
    capture_device_id: captureMeta.device_id,
    capture_timestamp: captureMeta.timestamp,
  },
  image_path: '',
  is_active: true,
})

export const buildCapturedRegionElementPayload = ({
  projectId,
  form,
  region,
  captureMeta,
}: {
  projectId: number
  form: CaptureElementFormState
  region: CaptureRegion
  captureMeta: CaptureMetaSnapshot
}): CapturedElementPayload => ({
  project_id: projectId,
  name: form.name.trim(),
  element_type: 'region',
  selector_type: 'region',
  selector_value: `${region.x},${region.y},${region.x + region.width},${region.y + region.height}`,
  description: form.description.trim(),
  tags: parseCaptureTags(form.tagsText),
  config: {
    x1: region.x,
    y1: region.y,
    x2: region.x + region.width,
    y2: region.y + region.height,
    width: region.width,
    height: region.height,
    capture_device_id: captureMeta.device_id,
    capture_timestamp: captureMeta.timestamp,
  },
  image_path: '',
  is_active: true,
})
