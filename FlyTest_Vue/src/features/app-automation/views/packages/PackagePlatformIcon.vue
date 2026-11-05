<template>
  <svg v-if="platform === 'android'" class="package-platform-icon android" viewBox="0 0 24 24" role="img" aria-label="Android"><g fill="currentColor"><path d="M5 10h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zm0-1a7 7 0 0 1 14 0z"/><rect x="1.5" y="10" width="2.5" height="8" rx="1.2"/><rect x="20" y="10" width="2.5" height="8" rx="1.2"/><rect x="7" y="18" width="3" height="6" rx="1.5"/><rect x="14" y="18" width="3" height="6" rx="1.5"/></g><path d="m7 4-2-3m12 3 2-3" stroke="currentColor" stroke-linecap="round"/><circle cx="9" cy="6.5" r=".7" fill="white"/><circle cx="15" cy="6.5" r=".7" fill="white"/></svg>
  <svg v-else-if="platform === 'ios'" class="package-platform-icon ios" viewBox="0 0 24 24" role="img" aria-label="iOS"><path fill="currentColor" d="M16.9 1c.2 2-1.1 4.2-3.4 4.5-.4-2.1 1.3-4.2 3.4-4.5ZM20.6 8c-3 1.7-2.7 5.8.5 7.1-.5 1.5-1.3 3.1-2.4 4.5-1.1 1.5-2.3 2.9-3.9 2.8-1.5-.1-2-1-3.8-1-1.8 0-2.4 1-3.8 1C4.3 22.4 1.5 16.7 1.5 12.5c0-4.3 2.5-6.8 5.3-6.8 1.6 0 2.8 1 4 1 1.1 0 3.1-1.2 4.9-1.1 2 .1 3.7 1 4.9 2.4Z"/></svg>
  <span v-else class="package-platform-unknown">?</span>
</template>
<script setup lang="ts">
defineProps<{ platform: string }>()
</script>
<style scoped>.package-platform-icon{width:20px;height:23px;display:inline-block;flex:none;vertical-align:middle}.android{color:#13b54a}.ios{color:#7e8ca1}.package-platform-unknown{color:var(--theme-text-tertiary)}</style>
