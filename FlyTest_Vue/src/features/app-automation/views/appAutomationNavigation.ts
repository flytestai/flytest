import type { LocationQueryRaw, RouteLocationNormalizedLoaded, Router } from 'vue-router'

import { Message } from '@arco-design/web-vue'
import { AppAutomationService } from '../services/appAutomationService'
import type { AppAutomationTab } from '../types'

export type AppAutomationQueryPatch = Record<string, string | undefined>

const appAutomationContextKeys = [
  'caseId',
  'executionId',
  'suiteId',
  'taskId',
  'reportMode',
] as const

const EXTERNAL_WINDOW_URL_PATTERN = /^(?:https?:|data:|blob:|mailto:|tel:|javascript:)/i
const OBJECT_URL_REVOKE_DELAY_MS = 30 * 60 * 1000

const normalizeQueryValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return String(value[0] ?? '')
  }
  return String(value ?? '')
}

const scheduleObjectUrlCleanup = (objectUrls: string[]) => {
  const uniqueUrls = [...new Set(objectUrls.filter(Boolean))]
  if (!uniqueUrls.length) {
    return
  }
  window.setTimeout(() => {
    uniqueUrls.forEach(objectUrl => {
      URL.revokeObjectURL(objectUrl)
    })
  }, OBJECT_URL_REVOKE_DELAY_MS)
}

const openLoadingWindow = () => {
  const popup = window.open('', '_blank')
  if (!popup) {
    Message.warning('Unable to open a new window. Please allow pop-ups and try again.')
    return null
  }

  try {
    popup.opener = null
  } catch {
    // Ignore opener assignment failures in restricted browser contexts.
  }

  popup.document.write(
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8" /><title>FlyTest</title></head><body style="margin:0;padding:24px;font:14px/1.6 Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;color:#1f2937;background:#f8fafc;">Loading...</body></html>',
  )
  popup.document.close()
  return popup
}

const closeWindow = (popup: Window | null) => {
  if (!popup) {
    return
  }
  try {
    popup.close()
  } catch {
    // Ignore close failures when the browser already disposed the window.
  }
}

const navigateWindow = (popup: Window | null, targetUrl: string) => {
  if (popup) {
    popup.location.replace(targetUrl)
    return
  }
  window.open(targetUrl, '_blank', 'noopener')
}

const isExternalWindowUrl = (value: string) => EXTERNAL_WINDOW_URL_PATTERN.test(value.trim())

const normalizeReportAssetPath = (value: string) => {
  try {
    return new URL(value, 'https://app-automation.local/report/index.html').pathname.replace(/^\/+/, '')
  } catch {
    return value.replace(/^\.\/+/, '').replace(/^\/+/, '')
  }
}

const rewriteExecutionReportHtml = async (executionId: number, html: string) => {
  const parser = new DOMParser()
  const documentNode = parser.parseFromString(html, 'text/html')
  const objectUrlCache = new Map<string, string>()
  const resourceNodes = Array.from(documentNode.querySelectorAll('[src], [href]'))

  for (const node of resourceNodes) {
    for (const attributeName of ['src', 'href'] as const) {
      const currentValue = node.getAttribute(attributeName)
      if (!currentValue) {
        continue
      }

      const trimmedValue = currentValue.trim()
      if (!trimmedValue || trimmedValue.startsWith('#') || isExternalWindowUrl(trimmedValue)) {
        continue
      }

      const resolvedPath = normalizeReportAssetPath(trimmedValue)
      if (!resolvedPath) {
        continue
      }

      let objectUrl = objectUrlCache.get(resolvedPath)
      if (!objectUrl) {
        objectUrl = await AppAutomationService.fetchExecutionReportAssetBlobUrl(executionId, resolvedPath)
        objectUrlCache.set(resolvedPath, objectUrl)
      }
      node.setAttribute(attributeName, objectUrl)
    }
  }

  return {
    html: `<!DOCTYPE html>\n${documentNode.documentElement.outerHTML}`,
    objectUrls: [...objectUrlCache.values()],
  }
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

export const buildAppAutomationTabChangePatch = (
  tab: AppAutomationTab,
): AppAutomationQueryPatch => {
  const patch: AppAutomationQueryPatch = { tab }

  appAutomationContextKeys.forEach(key => {
    patch[key] = undefined
  })

  return patch
}

export const pushAppAutomationTab = async (
  router: Router,
  tab: AppAutomationTab,
  patch: AppAutomationQueryPatch = {},
) => {
  await router.push({
    path: '/app-automation',
    query: {
      ...buildAppAutomationTabChangePatch(tab),
      ...patch,
    },
  })
}

export const pushAppAutomationExecutions = async (
  router: Router,
  options: { executionId?: number; suiteId?: number | null } = {},
) => {
  await pushAppAutomationTab(router, 'executions', {
    executionId: options.executionId ? String(options.executionId) : undefined,
    suiteId: options.suiteId ? String(options.suiteId) : undefined,
  })
}

export const pushAppAutomationSceneBuilder = async (
  router: Router,
  options: { caseId?: number } = {},
) => {
  await pushAppAutomationTab(router, 'scene-builder', {
    caseId: options.caseId ? String(options.caseId) : undefined,
  })
}

export const pushAppAutomationScheduledTasks = async (
  router: Router,
  options: { taskId?: number } = {},
) => {
  await pushAppAutomationTab(router, 'scheduled-tasks', {
    taskId: options.taskId ? String(options.taskId) : undefined,
  })
}

export const openExecutionReportWindow = async (executionId: number) => {
  const popup = openLoadingWindow()
  if (!popup) {
    return
  }

  try {
    const html = await AppAutomationService.fetchExecutionReportText(executionId)
    const { html: nextHtml, objectUrls } = await rewriteExecutionReportHtml(executionId, html)
    const reportObjectUrl = URL.createObjectURL(new Blob([nextHtml], { type: 'text/html' }))
    scheduleObjectUrlCleanup([reportObjectUrl, ...objectUrls])
    navigateWindow(popup, reportObjectUrl)
  } catch (error: any) {
    closeWindow(popup)
    Message.error(error.message || 'Failed to open the execution report')
  }
}

export const openExecutionArtifactWindow = async (executionId: number, relativePath: string) => {
  if (!relativePath) {
    return
  }

  if (isExternalWindowUrl(relativePath)) {
    window.open(relativePath, '_blank', 'noopener')
    return
  }

  const popup = openLoadingWindow()
  if (!popup) {
    return
  }

  try {
    const objectUrl = await AppAutomationService.fetchExecutionReportAssetBlobUrl(
      executionId,
      normalizeReportAssetPath(relativePath),
    )
    scheduleObjectUrlCleanup([objectUrl])
    navigateWindow(popup, objectUrl)
  } catch (error: any) {
    closeWindow(popup)
    Message.error(error.message || 'Failed to open the execution artifact')
  }
}
