<template>
  <section class="fc-workspace" :class="{ 'fc-workspace--directory': inlineOpen, 'fc-workspace--overlay': isOverlay }">
    <div class="fc-workspace-topbar">
    <div ref="headingTarget" class="fc-workspace-heading"><slot name="heading" /></div>
    <div v-if="directory || $slots.filters || selection" class="fc-workspace-context">
      <button v-if="directory" ref="trigger" class="fc-directory-toggle" type="button"
        :aria-expanded="isOverlay ? dialogOpen : inlineOpen" :aria-controls="directoryId" @click="toggleDirectory">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>
        {{ directoryLabel }}
        <span aria-hidden="true">{{ inlineOpen ? '‹' : '›' }}</span>
      </button>
      <span v-if="selection" class="fc-workspace-selection"><span class="fc-workspace-selection__label">{{ selectionLabel }}</span>{{ selection }}</span>
      <button v-if="clearable && selection" type="button" class="fc-workspace-clear" @click="emit('clear')">清除筛选</button>
      <slot name="filters" />
    </div>
    </div>
    <div class="fc-workspace-body" :style="inlineOpen ? { '--fc-directory-width': `${panelWidth}px` } : undefined">
      <Teleport to="body" :disabled="!isOverlay">
      <div v-if="dialogOpen" class="fc-directory-backdrop" aria-hidden="true" @click="closeDirectory" />
      <aside v-if="$slots.directory && directoryVisited" v-show="directory && (inlineOpen || dialogOpen)" :id="directoryId" ref="directoryDialog" class="fc-workspace-directory"
        :class="{ 'fc-workspace-directory--inline': inlineOpen, 'fc-workspace-directory--drawer': dialogOpen }"
        :role="dialogOpen ? 'dialog' : 'complementary'" :aria-modal="dialogOpen || undefined" :aria-label="directoryLabel">
        <div class="fc-workspace-directory__bar">
          <span>{{ directoryLabel }}</span>
          <button type="button" class="fc-directory-dismiss" :aria-label="`收起${directoryLabel}`" @click="dismissDirectory">×</button>
        </div>
        <div class="fc-workspace-directory__content"><slot name="directory" /></div>
      </aside>
      </Teleport>
      <div v-if="inlineOpen" class="fc-workspace-resizer" role="separator" tabindex="0"
        aria-label="调整目录宽度" aria-orientation="vertical" :aria-valuemin="minWidth" :aria-valuemax="maxWidth"
        :aria-valuenow="panelWidth" @mousedown="startResize" @keydown="resizeWithKeyboard" />
      <div class="fc-workspace-content"><slot /></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, provide, ref, useId, watch } from 'vue'
import { useEventListener, useLocalStorage, useWindowSize } from '@vueuse/core'
import { useResizablePanel } from '@/composables/useResizablePanel'
import { workspaceDirectoryKey, workspaceHeadingKey, workspaceCompactHeadingKey } from './workspaceContext'

const props = withDefaults(defineProps<{
  storageKey: string
  directory?: boolean
  directoryLabel?: string
  selection?: string
  selectionLabel?: string
  clearable?: boolean
  prioritizeContent?: boolean
  drawerOnly?: boolean
  compactHeader?: boolean
}>(), { directory: true, directoryLabel: '模块目录', selection: '', selectionLabel: '当前范围', clearable: false, prioritizeContent: false, drawerOnly: false })
const emit = defineEmits<{ clear: [] }>()
const headingTarget = ref<HTMLElement>()
const directoryDialog = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const directoryId = `workspace-directory-${useId()}`
const directoryVisited = ref(props.directory)
watch(() => props.directory, value => { if (value) directoryVisited.value = true })
const { width } = useWindowSize()
const preference = useLocalStorage<boolean | null>(`feice-directory-${props.storageKey}`, null, {
  serializer: { read: value => value === 'true' ? true : value === 'false' ? false : null, write: value => String(value) },
})
const isOverlay = computed(() => width.value < 1024 || props.drawerOnly || props.prioritizeContent)
const expanded = computed(() => preference.value ?? width.value >= 1440)
const inlineOpen = computed(() => props.directory && !isOverlay.value && expanded.value)
const dialogOpen = ref(false)
const { panelWidth, minWidth, maxWidth, startResize, stopResize, resizeWithKeyboard } = useResizablePanel()

provide(workspaceHeadingKey, headingTarget)
provide(workspaceCompactHeadingKey, computed(() => Boolean(props.compactHeader)))
provide(workspaceDirectoryKey, { selected: () => { if (isOverlay.value) closeDirectory() } })

async function closeDirectory() {
  if (dialogOpen.value) {
    dialogOpen.value = false
    await nextTick()
    trigger.value?.focus({ preventScroll: true })
  }
}
function dismissDirectory() { if (inlineOpen.value) preference.value = false; else void closeDirectory() }
async function toggleDirectory() {
  if (!isOverlay.value) { preference.value = !expanded.value; return }
  if (dialogOpen.value) { await closeDirectory(); return }
  await nextTick()
  dialogOpen.value = true
  await nextTick()
  directoryDialog.value?.querySelector<HTMLButtonElement>('button')?.focus()
}
function hasOtherPopup() {
  return [...document.querySelectorAll<HTMLElement>('.arco-modal-wrapper,.arco-drawer-container,.arco-trigger-popup')]
    .some(node => !directoryDialog.value?.contains(node) && !node.querySelector('[data-directory-menu-open="false"]') && node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== 'hidden')
}
useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (!dialogOpen.value || hasOtherPopup()) return
  if (event.key === 'Escape') { event.preventDefault(); void closeDirectory(); return }
  if (event.key !== 'Tab') return
  const items = [...(directoryDialog.value?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]') ?? [])]
    .filter(node => node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== 'hidden')
  const first = items[0], last = items[items.length - 1]
  if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
    event.preventDefault(); (event.shiftKey ? last : first)?.focus()
  }
})
let restoreBackground: (() => void) | undefined
watch(dialogOpen, (open) => {
  if (open) {
    const app = document.getElementById('app')
    const inert = app?.inert ?? false
    const overflow = document.body.style.overflow
    if (app) app.inert = true
    document.body.style.overflow = 'hidden'
    restoreBackground = () => { if (app) app.inert = inert; document.body.style.overflow = overflow }
  } else { restoreBackground?.(); restoreBackground = undefined }
}, { flush: 'sync' })
watch([isOverlay, () => props.directory], async () => { stopResize(); if (dialogOpen.value) await closeDirectory() })
onBeforeUnmount(() => { stopResize(); restoreBackground?.() })
defineExpose({ closeDirectory })
</script>
