<template>
  <div class="fc-module-header">
    <header v-if="!navigationOnly" class="fc-module-heading">
      <div>
        <h2>{{ pageTitle || title }}</h2>
        <p v-if="description">{{ description }}</p>
      </div>
      <slot name="actions" />
    </header>
    <div class="fc-module-navigation" :class="{ 'has-overflow': canScrollRight }">
    <nav
      ref="navigation"
      class="fc-module-tabs"
      :aria-label="title + '模块导航'"
      @scroll="updateOverflow"
    >
      <router-link
        v-for="tab in tabs"
        :key="tab.key"
        :to="tab.to"
        :aria-current="activeKey === tab.key ? 'page' : undefined"
        >{{ tab.label }}</router-link
      >
    </nav>
    <a-dropdown v-model:popup-visible="menuOpen" trigger="click">
      <button ref="allTrigger" type="button" class="fc-module-all" :aria-label="title + '全部页面'" aria-haspopup="menu" :aria-expanded="menuOpen" :aria-controls="menuId">全部 <span aria-hidden="true">⌄</span></button>
      <template #content>
        <div :id="menuId" ref="menu" class="fc-module-menu" role="menu" :aria-label="title + '页面列表'" @keydown="handleMenuKeys">
          <button v-for="tab in tabs" :key="tab.key" type="button" role="menuitem" :aria-current="tab.key === activeKey ? 'page' : undefined" :class="{ 'fc-module-option--active': tab.key === activeKey }" @click="selectTab(tab.key)">{{ tab.label }}<span v-if="tab.key === activeKey" aria-hidden="true">✓</span></button>
        </div>
      </template>
    </a-dropdown>
    </div>
  </div>
</template>
<script setup lang="ts">
import { nextTick, ref, watch, useId } from "vue";
import { useRouter } from "vue-router";
import { useResizeObserver } from '@vueuse/core';
import type { RouteLocationRaw } from "vue-router";
const props = defineProps<{
  title: string;
  pageTitle?: string;
  navigationOnly?: boolean;
  description?: string;
  activeKey: string;
  tabs: Array<{ key: string; label: string; to: RouteLocationRaw }>;
}>();
const navigation = ref<HTMLElement>();
const router = useRouter();
const menuOpen = ref(false), menu = ref<HTMLElement>(), allTrigger = ref<HTMLButtonElement>();
const menuId = 'module-menu-' + useId();
watch(menuOpen, async open => { if(open) { await nextTick(); const item = menu.value?.querySelector<HTMLElement>('[aria-current="page"]') || menu.value?.querySelector<HTMLElement>('[role="menuitem"]'); item?.focus({preventScroll:true}); item?.scrollIntoView({block:'nearest'}); } });
function handleMenuKeys(event: KeyboardEvent) {
  if(event.key === 'Escape') { event.preventDefault(); menuOpen.value = false; allTrigger.value?.focus(); return; }
  const items = [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [])];
  if(!items.length || !['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
  event.preventDefault(); const current = items.indexOf(document.activeElement as HTMLElement);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[index]?.focus();
}
const canScrollRight = ref(false);
function updateOverflow() {
  const nav = navigation.value;
  canScrollRight.value = Boolean(nav && nav.scrollWidth - nav.clientWidth - nav.scrollLeft > 2);
}
function selectTab(key: unknown) {
  menuOpen.value = false;
  const tab = props.tabs.find(item => item.key === key);
  if(tab) void router.push(tab.to);
}
useResizeObserver(navigation, updateOverflow);
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
    updateOverflow();
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
.fc-module-navigation { display: flex; align-items: stretch; gap: 12px; min-width: 0; border-bottom: 1px solid var(--theme-border); }
.fc-module-all { display: none; }
.fc-module-option--active { color: var(--theme-accent); font-weight: 600; background: var(--theme-accent-soft); }
.fc-module-menu { display:flex; flex-direction:column; min-width:180px; max-height:min(480px,60dvh); overflow:auto; padding:6px; }
.fc-module-menu button { display:flex; align-items:center; justify-content:space-between; gap:16px; flex:none; min-height:40px; padding:8px 12px; border:0; border-radius:6px; font:inherit; font-size:14px; text-align:left; background:transparent; color:var(--theme-text); cursor:pointer; }
.fc-module-menu button:hover,.fc-module-menu button:focus-visible { outline:none; background:var(--theme-surface-soft); }
.fc-module-menu button.fc-module-option--active { color:var(--theme-accent); background:var(--theme-accent-soft); }
.fc-module-tabs {
  position: relative;
  display: flex;
  align-items: center;
  gap: 24px;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  flex: 1;
  scrollbar-width: thin;
}
.fc-module-tabs a {
  position: relative;
  flex: none;
  padding: 10px 0 12px;
  color: var(--theme-text-secondary);
  font-size: 14px;
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
  .fc-module-all { display: inline-flex; align-items: center; gap: 6px; flex: none; padding: 0 8px; border: 0; background: transparent; color: var(--theme-text-secondary); font: inherit; font-size: 13px; cursor: pointer; }
  .has-overflow .fc-module-tabs { mask-image: linear-gradient(to right, black calc(100% - 18px), transparent); }
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
