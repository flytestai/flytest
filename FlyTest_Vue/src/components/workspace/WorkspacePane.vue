<template>
  <div v-show="active" class="fc-workspace-pane"><slot /></div>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'
import { workspacePaneKey } from './workspaceContext'

const props = defineProps<{ active: boolean }>()
provide(workspacePaneKey, computed(() => props.active))
</script>
