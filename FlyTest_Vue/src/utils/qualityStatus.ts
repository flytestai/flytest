/** Color is a business result, independent of display rounding and asset category. */
export type QualityTone = 'success' | 'danger' | 'neutral'
export const QUALITY_TARGETS = { passRate: 100, coverage: 80 } as const

const validPercentage = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100

export function passRateTone(value: number | null | undefined): QualityTone {
  return !validPercentage(value) ? 'neutral' : value === QUALITY_TARGETS.passRate ? 'success' : 'danger'
}

export function coverageTone(value: number | null | undefined): QualityTone {
  return !validPercentage(value) ? 'neutral' : value >= QUALITY_TARGETS.coverage ? 'success' : 'danger'
}

export function qualityColor(tone: QualityTone): string {
  return tone === 'neutral' ? 'var(--theme-text-tertiary)' : `var(--theme-${tone})`
}

export const passRateColor = (value: number | null | undefined) => qualityColor(passRateTone(value))

/** Arco progress takes a 0–1 fraction; API percentages use 0–100. */
export function progressFraction(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) / 100 : 0
}

export function calculatePassRate(passed: number, total: number): number | null {
  return Number.isFinite(passed) && Number.isFinite(total) && total > 0 && passed >= 0 && passed <= total
    ? passed / total * 100 : null
}

/** Avoid showing "100%" for a partial result such as 99.999%. */
export function formatQualityPercent(value: number | null | undefined): string {
  if (!validPercentage(value)) return '—'
  return `${Number((Math.floor(value * 10) / 10).toFixed(1))}%`
}
