<template>
  <article
    class="insights-block fc-runtime-status"
    aria-labelledby="automation-heading"
  >
    <header class="insights-heading">
      <div class="insights-heading-copy">
        <h3 id="automation-heading">自动化运行状态</h3>
        <p>环境配置、执行器和设备连接状态</p>
      </div>
      <button
        type="button"
        class="fc-runtime-refresh"
        :disabled="loading"
        @click="load"
      >
        {{ loading ? "读取中…" : "刷新" }}
      </button>
    </header>
    <div class="fc-runtime-rows">
      <router-link v-for="item in items" :key="item.key" :to="item.to"
        ><span class="fc-runtime-icon">{{ item.key }}</span
        ><strong>{{ item.name }}</strong
        ><span class="fc-runtime-state" :data-state="item.state"
          ><i />{{ item.label }}</span
        ><span aria-hidden="true">›</span></router-link
      >
    </div>
    <div
      class="fc-coverage"
      data-metric="coverage"
      :data-quality="coverageTone(coverageRate)"
    >
      <span>自动化覆盖率</span
      ><strong
        class="fc-coverage-value"
        :class="'quality-' + coverageTone(coverageRate)"
        >{{ formatQualityPercent(coverageRate) }}</strong
      ><small v-if="coverageRate == null">暂无覆盖率数据</small>
    </div>
    <footer>
      <router-link to="/llm-configs">AI 模型配置 →</router-link
      ><router-link to="/api-automation?tab=environments"
        >管理执行环境 →</router-link
      >
    </footer>
  </article>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useProjectStore } from "@/store/projectStore";
import { environmentApi } from "@/features/api-automation/api";
import { actuatorApi } from "@/features/ui-automation/api";
import { extractResponseData } from "@/features/ui-automation/types";
import { AppAutomationService } from "@/features/app-automation/services/appAutomationService";
import { coverageTone, formatQualityPercent } from "@/utils/qualityStatus";
defineProps<{ coverageRate?: number | null }>();
const store = useProjectStore(),
  loading = ref(false),
  counts = ref<(number | null)[]>([null, null, null]),
  failed = ref([false, false, false]);
let generation = 0;
const items = computed(() => [
  {
    key: "API",
    name: "API 自动化",
    to: "/api-automation?tab=environments",
    state: failed.value[0] ? "unknown" : counts.value[0] ? "ready" : "pending",
    label: loading.value
      ? "读取中…"
      : failed.value[0]
        ? "状态暂不可用"
        : counts.value[0]
          ? "已配置 " + counts.value[0] + " 个环境"
          : "待配置环境",
  },
  {
    key: "Web",
    name: "Web 自动化",
    to: "/ui-automation?tab=actuators",
    state: failed.value[1] ? "unknown" : counts.value[1] ? "ready" : "pending",
    label: loading.value
      ? "读取中…"
      : failed.value[1]
        ? "状态暂不可用"
        : counts.value[1]
          ? counts.value[1] + " 个执行器在线"
          : "等待执行器连接",
  },
  {
    key: "APP",
    name: "APP 自动化",
    to: "/app-automation?tab=devices",
    state: failed.value[2] ? "unknown" : counts.value[2] ? "ready" : "pending",
    label: loading.value
      ? "读取中…"
      : failed.value[2]
        ? "状态暂不可用"
        : counts.value[2]
          ? counts.value[2] + " 台设备在线"
          : "待连接设备",
  },
]);
async function load() {
  const token = ++generation,
    project = store.currentProjectId;
  if (!project) {
    counts.value = [null, null, null];
    return;
  }
  loading.value = true;
  const responses = await Promise.allSettled([
    environmentApi.list({ project }),
    actuatorApi.list(),
    AppAutomationService.getDevices(),
  ]);
  if (token !== generation) return;
  failed.value = responses.map((response) => response.status === "rejected");
  counts.value = responses.map((response, index) => {
    if (response.status === "rejected") return null;
    if (index === 0) {
      const data = (
        response.value as Awaited<ReturnType<typeof environmentApi.list>>
      ).data.data;
      return Array.isArray(data) ? data.length : 0;
    }
    if (index === 1) {
      const data = extractResponseData<{
        items: Array<{ type: string; is_open: boolean }>;
      }>(response.value as Awaited<ReturnType<typeof actuatorApi.list>>);
      return (
        data?.items?.filter(
          (item) =>
            ["web_ui", "pytest_web"].includes(item.type) && item.is_open,
        ).length || 0
      );
    }
    const devices = response.value as Awaited<
      ReturnType<typeof AppAutomationService.getDevices>
    >;
    return Array.isArray(devices)
      ? devices.filter((device) => device.status === "online").length
      : 0;
  });
  loading.value = false;
}
watch(() => store.currentProjectId, load, { immediate: true });
onBeforeUnmount(() => {
  generation++;
});
</script>
<style scoped>
.fc-runtime-refresh {
  border: 0;
  background: transparent;
  color: var(--theme-text-tertiary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.fc-runtime-rows > a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 17px 0;
  color: var(--theme-text-secondary);
  text-decoration: none;
  border-bottom: 1px solid var(--theme-border);
  font-size: 12px;
}
.fc-runtime-rows > a > strong {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
}
.fc-runtime-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border: 1px solid var(--theme-border);
  border-radius: 6px;
  color: var(--theme-text-tertiary);
  font-size: 9px;
  font-weight: 600;
}
.fc-runtime-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-align: right;
  max-width: 160px;
  font-size: 12px;
  color: var(--theme-warning);
}
.fc-runtime-state i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}
.fc-runtime-state[data-state="ready"] {
  color: var(--theme-accent);
}
.fc-runtime-state[data-state="unknown"] {
  color: var(--theme-text-tertiary);
}
.fc-runtime-status footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 14px;
  font-size: 12px;
}
.fc-runtime-status footer a {
  color: var(--theme-text-tertiary);
  text-decoration: none;
}
.fc-runtime-status footer a:first-child {
  color: var(--theme-ai);
}
.fc-coverage {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 14px;
  font-size: 12px;
  color: var(--theme-text-tertiary);
}
.fc-coverage strong {
  font-size: 14px;
}
.fc-coverage small {
  font-size: 10px;
}
@media (max-width: 420px) {
  .fc-runtime-rows > a {
    gap: 8px;
  }
  .fc-runtime-state {
    max-width: 125px;
    font-size: 10px;
  }
}
</style>
