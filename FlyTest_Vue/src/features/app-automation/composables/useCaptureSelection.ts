import { computed, onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'
import type { CaptureElementMode } from '../utils/captureElementPayload'

interface DisplayPoint {
  x: number
  y: number
}

interface DisplaySelection {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface SelectionSummary {
  start: string
  end: string
  size: string
}

interface UseCaptureSelectionOptions {
  elementType: Ref<CaptureElementMode>
  screenshotContent: Ref<string>
}

export const useCaptureSelection = ({
  elementType,
  screenshotContent,
}: UseCaptureSelectionOptions) => {
  const stageRef = ref<HTMLDivElement | null>(null)
  const imageRef = ref<HTMLImageElement | null>(null)
  const selection = ref<DisplaySelection | null>(null)
  const point = ref<DisplayPoint | null>(null)
  const dragging = ref(false)
  const dragStart = ref<DisplayPoint | null>(null)

  const imageSize = reactive({
    naturalWidth: 0,
    naturalHeight: 0,
    clientWidth: 0,
    clientHeight: 0,
    offsetLeft: 0,
    offsetTop: 0,
  })

  const syncImageMetrics = () => {
    const imageElement = imageRef.value
    if (!imageElement) {
      return null
    }

    imageSize.naturalWidth = imageElement.naturalWidth || 0
    imageSize.naturalHeight = imageElement.naturalHeight || 0
    imageSize.clientWidth = imageElement.clientWidth || 0
    imageSize.clientHeight = imageElement.clientHeight || 0
    imageSize.offsetLeft = imageElement.offsetLeft || 0
    imageSize.offsetTop = imageElement.offsetTop || 0
    return imageElement
  }

  const bindResizeObserver = () => {
    if (typeof ResizeObserver === 'undefined') {
      return
    }

    resizeObserver.value?.disconnect()
    resizeObserver.value = new ResizeObserver(() => {
      syncImageMetrics()
    })

    if (stageRef.value) {
      resizeObserver.value.observe(stageRef.value)
    }
    if (imageRef.value) {
      resizeObserver.value.observe(imageRef.value)
    }
  }

  const normalizePointer = (event: MouseEvent, allowOutside = false) => {
    const imageElement = imageRef.value
    if (!imageElement) {
      return null
    }

    const rect = imageElement.getBoundingClientRect()
    const outside =
      event.clientX < rect.left
      || event.clientX > rect.right
      || event.clientY < rect.top
      || event.clientY > rect.bottom

    if (outside && !allowOutside) {
      return null
    }

    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height))
    return { x, y }
  }

  const resizeObserver = ref<ResizeObserver | null>(null)

  const selectionStyle = computed(() => {
    if (!selection.value) {
      return {}
    }

    const x = Math.min(selection.value.x1, selection.value.x2)
    const y = Math.min(selection.value.y1, selection.value.y2)
    const width = Math.abs(selection.value.x2 - selection.value.x1)
    const height = Math.abs(selection.value.y2 - selection.value.y1)
    return {
      left: `${imageSize.offsetLeft + x}px`,
      top: `${imageSize.offsetTop + y}px`,
      width: `${width}px`,
      height: `${height}px`,
    }
  })

  const pointStyle = computed(() => {
    if (!point.value) {
      return {}
    }

    return {
      left: `${imageSize.offsetLeft + point.value.x}px`,
      top: `${imageSize.offsetTop + point.value.y}px`,
    }
  })

  const pointNatural = computed(() => {
    if (
      !point.value
      || !imageSize.clientWidth
      || !imageSize.clientHeight
      || !imageSize.naturalWidth
      || !imageSize.naturalHeight
    ) {
      return null
    }

    const scaleX = imageSize.naturalWidth / imageSize.clientWidth
    const scaleY = imageSize.naturalHeight / imageSize.clientHeight
    return {
      x: Math.min(Math.round(point.value.x * scaleX), Math.max(imageSize.naturalWidth - 1, 0)),
      y: Math.min(Math.round(point.value.y * scaleY), Math.max(imageSize.naturalHeight - 1, 0)),
    }
  })

  const selectionNatural = computed(() => {
    if (
      !selection.value
      || !imageSize.clientWidth
      || !imageSize.clientHeight
      || !imageSize.naturalWidth
      || !imageSize.naturalHeight
    ) {
      return null
    }

    const scaleX = imageSize.naturalWidth / imageSize.clientWidth
    const scaleY = imageSize.naturalHeight / imageSize.clientHeight
    const x = Math.min(selection.value.x1, selection.value.x2)
    const y = Math.min(selection.value.y1, selection.value.y2)
    const width = Math.abs(selection.value.x2 - selection.value.x1)
    const height = Math.abs(selection.value.y2 - selection.value.y1)
    return {
      x: Math.round(x * scaleX),
      y: Math.round(y * scaleY),
      width: Math.round(width * scaleX),
      height: Math.round(height * scaleY),
    }
  })

  const selectionLabel = computed(() => {
    if (!selectionNatural.value) {
      return ''
    }

    return `${selectionNatural.value.width} × ${selectionNatural.value.height}`
  })

  const pointLabel = computed(() => {
    if (!pointNatural.value) {
      return ''
    }

    return `${pointNatural.value.x}, ${pointNatural.value.y}`
  })

  const regionSummary = computed<SelectionSummary>(() => {
    if (!selectionNatural.value) {
      return {
        start: '-',
        end: '-',
        size: '-',
      }
    }

    const { x, y, width, height } = selectionNatural.value
    return {
      start: `${x}, ${y}`,
      end: `${x + width}, ${y + height}`,
      size: `${width} × ${height}`,
    }
  })

  const clearInteractiveState = () => {
    selection.value = null
    point.value = null
    dragging.value = false
    dragStart.value = null
  }

  const resetSelectionState = () => {
    imageSize.naturalWidth = 0
    imageSize.naturalHeight = 0
    imageSize.clientWidth = 0
    imageSize.clientHeight = 0
    imageSize.offsetLeft = 0
    imageSize.offsetTop = 0
    clearInteractiveState()
  }

  const handleImageLoad = () => {
    syncImageMetrics()
    bindResizeObserver()
  }

  const handlePointerDown = (event: MouseEvent) => {
    if (!screenshotContent.value) {
      return
    }

    syncImageMetrics()
    const pointerPosition = normalizePointer(event)
    if (!pointerPosition) {
      return
    }

    if (elementType.value === 'pos') {
      point.value = pointerPosition
      selection.value = null
      return
    }

    dragging.value = true
    dragStart.value = pointerPosition
    selection.value = {
      x1: pointerPosition.x,
      y1: pointerPosition.y,
      x2: pointerPosition.x,
      y2: pointerPosition.y,
    }
    point.value = null
  }

  const handlePointerMove = (event: MouseEvent) => {
    if (!dragging.value || !dragStart.value || elementType.value === 'pos') {
      return
    }

    const pointerPosition = normalizePointer(event, true)
    if (!pointerPosition) {
      return
    }

    selection.value = {
      x1: dragStart.value.x,
      y1: dragStart.value.y,
      x2: pointerPosition.x,
      y2: pointerPosition.y,
    }
  }

  const handlePointerUp = () => {
    if (!dragging.value) {
      return
    }

    dragging.value = false
    dragStart.value = null
    if (!selection.value) {
      return
    }

    const width = Math.abs(selection.value.x2 - selection.value.x1)
    const height = Math.abs(selection.value.y2 - selection.value.y1)
    if (width < 4 || height < 4) {
      selection.value = null
    }
  }

  watch(elementType, value => {
    if (value === 'pos') {
      selection.value = null
      return
    }

    point.value = null
  })

  watch([stageRef, imageRef], () => {
    bindResizeObserver()
    syncImageMetrics()
  })

  onBeforeUnmount(() => {
    resizeObserver.value?.disconnect()
  })

  return {
    stageRef,
    imageRef,
    imageSize,
    selection,
    point,
    pointNatural,
    selectionNatural,
    selectionStyle,
    pointStyle,
    selectionLabel,
    pointLabel,
    regionSummary,
    clearInteractiveState,
    resetSelectionState,
    handleImageLoad,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}
