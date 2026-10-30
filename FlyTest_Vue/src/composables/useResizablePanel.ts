import { computed, ref, watch } from 'vue'
import { useEventListener, useWindowSize } from '@vueuse/core'

/** Shared by the case, suite and bug workspaces. Dragging uses a delta so
 * the application sidebar never changes the calculated panel width. */
export function useResizablePanel() {
  const panelWidth = ref(240)
  const { width: viewportWidth } = useWindowSize()
  const minWidth = 200
  const maxWidth = computed(() => Math.max(240, Math.min(480, Math.floor(viewportWidth.value * 0.4))))
  const shellStyle = computed(() => ({ width: `${panelWidth.value}px` }))
  let resizing = false
  let initialX = 0
  let initialWidth = 0
  const clamp = (value: number) => Math.min(maxWidth.value, Math.max(minWidth, value))

  const startResize = (event: MouseEvent) => {
    if (viewportWidth.value <= 1023) return
    event.preventDefault()
    initialX = event.clientX
    initialWidth = panelWidth.value
    resizing = true
  }
  const stopResize = () => { resizing = false }
  const resizeWithKeyboard = (event: KeyboardEvent) => {
    const offsets: Record<string, number> = { ArrowLeft: -16, ArrowRight: 16 }
    if (event.key in offsets) panelWidth.value = clamp(panelWidth.value + offsets[event.key])
    else if (event.key === 'Home') panelWidth.value = minWidth
    else if (event.key === 'End') panelWidth.value = maxWidth.value
    else return
    event.preventDefault()
  }

  useEventListener('mousemove', (event: MouseEvent) => {
    if (resizing) panelWidth.value = clamp(initialWidth + event.clientX - initialX)
  })
  useEventListener('mouseup', stopResize)
  useEventListener('blur', stopResize)
  watch(viewportWidth, () => {
    stopResize()
    panelWidth.value = clamp(panelWidth.value)
  })

  return { panelWidth, minWidth, maxWidth, shellStyle, startResize, stopResize, resizeWithKeyboard }
}
