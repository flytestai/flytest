<template>
  <a-dropdown v-model:popup-visible="open" trigger="click" position="br" @select="value => select(String(value))">
    <button ref="trigger" type="button" class="fc-node-menu" :aria-label="`${label}的更多操作`" title="更多操作" aria-haspopup="menu" :aria-expanded="open" :aria-controls="menuId"
      @mousedown.stop @pointerdown.stop @click.stop @keydown.enter.stop @keydown.space.stop @keydown.down.prevent.stop="focusMenu" @keydown.up.prevent.stop="focusMenu">⋯</button>
    <template #content>
      <div :id="menuId" role="menu" :aria-label="`${label}操作`" :data-directory-menu-open="open" @keydown="navigate">
        <a-doption v-for="item in items" :key="item.value" :value="item.value" role="menuitem" tabindex="0" :class="{ 'fc-directory-danger': item.value === 'delete' }"
          @keydown.enter.prevent="select(item.value)" @keydown.space.prevent="select(item.value)">{{ item.label }}</a-doption>
      </div>
    </template>
  </a-dropdown>
</template>

<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'
defineProps<{ label: string; items: { value: string; label: string }[] }>()
const emit = defineEmits<{ action: [value: string] }>()
const open = ref(false)
const trigger = ref<HTMLButtonElement>()
const menuId = `directory-menu-${useId()}`
function select(value: string) { open.value = false; trigger.value?.focus(); emit('action', value) }
async function focusMenu() { open.value = true; await nextTick(); document.getElementById(menuId)?.querySelector<HTMLElement>('[role="menuitem"]')?.focus() }
function navigate(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); open.value = false; trigger.value?.focus(); return }
  const items = [...document.getElementById(menuId)?.querySelectorAll<HTMLElement>('[role="menuitem"]') || []]
  const current = items.indexOf(document.activeElement as HTMLElement)
  let next: number
  if (event.key === 'ArrowDown') next = (current + 1) % items.length
  else if (event.key === 'ArrowUp') next = (current + items.length - 1) % items.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = items.length - 1
  else { if (event.key === 'Tab') open.value = false; return }
  event.preventDefault(); event.stopPropagation(); items[next]?.focus()
}
</script>
