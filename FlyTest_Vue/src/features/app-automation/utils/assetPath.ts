const PROJECT_SEGMENT_PATTERN = /^project-\d+$/i

export const normalizeAppAutomationAssetPath = (assetPath?: string) =>
  String(assetPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .join('/')

export const encodeAppAutomationAssetPath = (assetPath?: string) =>
  normalizeAppAutomationAssetPath(assetPath)
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/')

export const extractAppAutomationImageCategory = (assetPath?: string) => {
  const normalized = normalizeAppAutomationAssetPath(assetPath)
  if (!normalized) {
    return ''
  }

  const parts = normalized.split('/')
  const categoryIndex = parts[0] === 'elements' ? 1 : 0
  const category = parts[categoryIndex] || ''

  if (!category || PROJECT_SEGMENT_PATTERN.test(category)) {
    return ''
  }

  return category
}
