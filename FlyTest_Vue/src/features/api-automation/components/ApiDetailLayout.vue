<template>
  <div class="api-detail-layout" :class="{ 'api-detail-layout--open': open && wide }"><div class="api-detail-layout__main"><slot /></div><aside v-if="open && wide" ref="asideElement" class="api-detail-layout__aside" :style="{maxHeight:asideHeight+'px'}"><slot name="detail" /></aside></div>
  <a-drawer v-if="!wide" :visible="open" :width="Math.min(width - 24, 480)" :footer="false" :header="false" class="api-detail-drawer" unmount-on-close @cancel="$emit('close')"><slot name="detail" /></a-drawer>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementBounding, useMediaQuery, useWindowSize } from '@vueuse/core'
defineProps<{ open: boolean }>()
defineEmits<{close: []}>()
const wide = useMediaQuery('(min-width: 1360px)'), { width, height } = useWindowSize()
const asideElement=ref<HTMLElement>()
const {top}=useElementBounding(asideElement)
const asideHeight=computed(()=>Math.max(180,height.value-top.value-28))
</script>
