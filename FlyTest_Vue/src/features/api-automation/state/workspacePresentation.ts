import { inject, watch, type InjectionKey, type Ref, type ComputedRef } from 'vue'

export interface ApiWorkspaceMetric { label: string; value: number | string | null; tone?: string }
export const apiWorkspaceKey: InjectionKey<{
  actions: Ref<HTMLElement | undefined>
  publish: (tab: string, metrics: ApiWorkspaceMetric[]) => void
}> = Symbol('api-workspace-presentation')

export function useApiWorkspaceMetrics(tab: string, metrics: ComputedRef<ApiWorkspaceMetric[]>) {
  const workspace = inject(apiWorkspaceKey, undefined)
  watch(metrics, value => workspace?.publish(tab, value), { immediate: true })
}
