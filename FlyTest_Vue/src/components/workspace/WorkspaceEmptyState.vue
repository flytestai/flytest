<template>
  <div class="fc-start-state" :class="{ 'fc-start-state--compact': compact }" role="status">
    <span class="fc-start-state__icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="11" y="8" width="26" height="32" rx="5"/><path d="M18 17h12M18 24h12M18 31h7"/><path d="m32 7 4-3 4 3M7 35l-3 3 3 3" opacity=".4"/></svg></span>
    <h3>{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <div v-if="actionLabel || $slots.actions" class="fc-start-state__actions"><slot name="actions"><a-button type="primary" @click="$emit('action')">{{ actionLabel }}</a-button></slot></div>
  </div>
</template>
<script setup lang="ts">
defineProps<{title:string;description?:string;actionLabel?:string;compact?:boolean}>()
defineEmits<{action:[]}>()
</script>
<style scoped>
.fc-start-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; min-height:240px; padding:32px 20px; text-align:center; color:var(--theme-text); box-sizing:border-box; }
.fc-start-state__icon { display:grid; place-items:center; width:64px; height:64px; border-radius:18px; color:var(--theme-accent); background:var(--theme-accent-soft); margin-bottom:4px; }
.fc-start-state__icon svg { width:38px; height:38px; }
.fc-start-state h3 { margin:0; font-size:16px; line-height:1.5; font-weight:600; }
.fc-start-state p { margin:0; max-width:380px; font-size:13px; line-height:1.8; color:var(--theme-text-secondary); }
.fc-start-state__actions { margin-top:6px; }
.fc-start-state--compact { min-height:160px; padding:24px 16px; }
.fc-start-state--compact .fc-start-state__icon { width:48px; height:48px; border-radius:12px; }
.fc-start-state--compact .fc-start-state__icon svg { width:28px; height:28px; }
@media(max-width:767px) { .fc-start-state { min-height:220px; padding:24px 16px; } }
</style>
