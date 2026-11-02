<template>
  <div class="fc-module-header">
    <header class="fc-module-heading">
      <div>
        <h2>{{ title }}</h2>
        <p v-if="description">{{ description }}</p>
      </div>
      <slot name="actions" />
    </header>
    <nav
      ref="navigation"
      class="fc-module-tabs"
      :aria-label="title + '模块导航'"
    >
      <router-link
        v-for="tab in tabs"
        :key="tab.key"
        :to="tab.to"
        :aria-current="activeKey === tab.key ? 'page' : undefined"
        >{{ tab.label }}</router-link
      >
    </nav>
  </div>
</template>
<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { RouteLocationRaw } from "vue-router";
const props = defineProps<{
  title: string;
  description?: string;
  activeKey: string;
  tabs: Array<{ key: string; label: string; to: RouteLocationRaw }>;
}>();
const navigation = ref<HTMLElement>();
watch(
  () => [props.activeKey, props.tabs],
  async () => {
    await nextTick();
    const nav = navigation.value,
      selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !selected) return;
    const left =
      selected.getBoundingClientRect().left -
      nav.getBoundingClientRect().left +
      nav.scrollLeft;
    if (left < nav.scrollLeft) nav.scrollLeft = left;
    else if (left + selected.offsetWidth > nav.scrollLeft + nav.clientWidth)
      nav.scrollLeft = left + selected.offsetWidth - nav.clientWidth;
  },
  { immediate: true },
);
</script>
<style scoped>
.fc-module-header {
  flex: none;
  min-width: 0;
  margin-bottom: 16px;
}
.fc-module-heading {
  margin-bottom: 12px;
}
.fc-module-tabs {
  position: relative;
  display: flex;
  align-items: center;
  gap: 24px;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  border-bottom: 1px solid var(--theme-border);
  scrollbar-width: thin;
}
.fc-module-tabs a {
  position: relative;
  flex: none;
  padding: 10px 0 12px;
  color: var(--theme-text-secondary);
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
}
.fc-module-tabs a:hover {
  color: var(--theme-accent);
}
.fc-module-tabs a[aria-current="page"] {
  color: var(--theme-accent);
  font-weight: 600;
}
.fc-module-tabs a[aria-current="page"]::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  border-radius: 3px;
  background: var(--theme-accent);
}
@media (max-width: 767px) {
  .fc-module-header {
    margin-bottom: 12px;
  }
  .fc-module-tabs {
    gap: 20px;
  }
  .fc-module-tabs a {
    padding-top: 12px;
    padding-bottom: 14px;
  }
}
</style>
