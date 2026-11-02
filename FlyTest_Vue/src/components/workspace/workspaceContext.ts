import type { ComputedRef, InjectionKey, Ref } from 'vue'

export const workspaceHeadingKey: InjectionKey<Ref<HTMLElement | undefined>> = Symbol('workspace-heading')
export const workspacePaneKey: InjectionKey<ComputedRef<boolean>> = Symbol('workspace-pane')
export const workspaceDirectoryKey: InjectionKey<{ selected: () => void }> = Symbol('workspace-directory')
export const workspaceCompactHeadingKey: InjectionKey<ComputedRef<boolean>> = Symbol('workspace-compact-heading')
