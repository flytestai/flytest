<template><component :is="icon" aria-hidden="true" /></template>
<script setup lang="ts">
import { computed } from 'vue'
import { IconMobile, IconEdit, IconDragArrow, IconClockCircle, IconCheckCircle, IconBranch, IconLoop, IconCode, IconCamera, IconApps, IconSelectAll } from '@arco-design/web-vue/es/icon'
const props = defineProps<{ type?: string }>()
const icons: Record<string, typeof IconApps> = {
  start_app: IconMobile, launch_app: IconMobile, click: IconSelectAll, tap: IconSelectAll,
  input: IconEdit, input_text: IconEdit, swipe: IconDragArrow, drag: IconDragArrow,
  wait: IconClockCircle, sleep: IconClockCircle, assert: IconCheckCircle,
  if: IconBranch, loop: IconLoop, try: IconCode, screenshot: IconCamera,
}
const icon = computed(() => icons[props.type || ''] || IconApps)
</script>
