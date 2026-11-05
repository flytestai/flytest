<template><Teleport :to="target || 'body'" :disabled="!target"><div class="api-primary-actions"><slot /></div></Teleport></template>
<script setup lang="ts">
import { computed, inject } from 'vue'
import { apiWorkspaceKey } from '../state/workspacePresentation'
import { workspacePaneKey } from '@/components/workspace/workspaceContext'
const workspace = inject(apiWorkspaceKey, undefined)
const active = inject(workspacePaneKey, undefined)
const target = computed(() => active?.value === false ? undefined : workspace?.actions.value)
</script>
