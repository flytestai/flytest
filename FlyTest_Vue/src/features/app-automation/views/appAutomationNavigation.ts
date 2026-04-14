import type { LocationQueryRaw, RouteLocationNormalizedLoaded, Router } from 'vue-router'

import { AppAutomationService } from '../services/appAutomationService'

export type AppAutomationQueryPatch = Record<string, string | undefined>

const normalizeQueryValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return String(value[0] ?? '')
  }
  return String(value ?? '')
}

export const replaceAppAutomationQuery = async (
  route: RouteLocationNormalizedLoaded,
  router: Router,
  patch: AppAutomationQueryPatch,
) => {
  const nextQuery: LocationQueryRaw = { ...route.query }

  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      delete nextQuery[key]
    } else {
      nextQuery[key] = value
    }
  })

  const keys = new Set([...Object.keys(route.query), ...Object.keys(nextQuery)])
  const changed = [...keys].some(key => normalizeQueryValue(route.query[key]) !== normalizeQueryValue(nextQuery[key]))

  if (!changed) {
    return
  }

  await router.replace({
    path: '/app-automation',
    query: nextQuery,
  })
}

export const openExecutionReportWindow = (executionId: number) => {
  window.open(AppAutomationService.getExecutionReportUrl(executionId), '_blank', 'noopener')
}

export const openExecutionArtifactWindow = (executionId: number, relativePath: string) => {
  if (!relativePath) return

  if (
    relativePath.startsWith('http://') ||
    relativePath.startsWith('https://') ||
    relativePath.startsWith('data:')
  ) {
    window.open(relativePath, '_blank', 'noopener')
    return
  }

  window.open(
    AppAutomationService.getExecutionReportAssetUrl(executionId, relativePath),
    '_blank',
    'noopener',
  )
}
