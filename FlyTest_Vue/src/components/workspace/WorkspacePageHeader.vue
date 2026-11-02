<template>
  <Teleport :to="headingTarget || 'body'" :disabled="!headingTarget || local">
  <header v-show="active" class="fc-page-heading">
    <div class="fc-page-heading__copy">
      <h2 class="fc-page-heading__title"><slot name="title">{{ title }}</slot></h2>
      <p v-if="description || $slots.description" class="fc-page-heading__description" :title="description">
        <slot name="description">{{ description }}</slot>
      </p>
      <div v-if="$slots.meta || showBack" class="fc-page-heading__meta">
        <button v-if="showBack" type="button" class="fc-page-heading__back" @click="$emit('back')">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m10 5-7 7 7 7M3 12h18" /></svg>
          返回
        </button>
        <slot name="meta" />
      </div>
    </div>
    <div v-if="$slots.actions" class="fc-page-heading__actions"><slot name="actions" /></div>
  </header>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { workspaceHeadingKey, workspacePaneKey } from './workspaceContext'

const headingTarget = inject(workspaceHeadingKey, undefined)
const paneActive = inject(workspacePaneKey, undefined)
const active = computed(() => paneActive?.value ?? true)

defineProps<{ title?: string; description?: string; showBack?: boolean; local?: boolean }>()
defineEmits<{ back: [] }>()
</script>
