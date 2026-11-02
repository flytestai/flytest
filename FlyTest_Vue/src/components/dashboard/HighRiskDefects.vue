<template>
  <article
    class="insights-block fc-risk-list-panel"
    aria-labelledby="high-risk-heading"
  >
    <header class="insights-heading">
      <div class="insights-heading-copy">
        <h3 id="high-risk-heading">高风险缺陷</h3>
        <p>优先关注未关闭的严重缺陷</p>
      </div>
      <router-link to="/test-bugs" class="fc-dashboard-link"
        >查看全部 →</router-link
      >
    </header>
    <div v-if="loading" class="fc-risk-state"><a-spin /></div>
    <div v-else-if="error" class="fc-risk-state">
      <p>{{ error }}</p>
      <a-button size="small" @click="load">重试</a-button>
    </div>
    <ul v-else-if="risks.length" class="fc-risk-list">
      <li v-for="bug in risks" :key="bug.id">
        <router-link
          :to="{
            path: '/test-bugs',
            query: { suite: String(bug.suite), bug: String(bug.id) },
          }"
          ><a-tag :color="rank(bug.priority) <= 1 ? 'red' : 'orange'"
            >P{{ String(bug.priority).replace(/^P/i, "") }}</a-tag
          >
          <div>
            <strong>{{ bug.title }}</strong
            ><span
              >{{ bug.suite_name || "测试套件" }} ·
              {{ bug.assigned_to_name || "未指派" }}</span
            >
          </div>
          <a-tag color="red">{{
            bug.status_display || "待处理"
          }}</a-tag></router-link
        >
      </li>
    </ul>
    <div v-else class="fc-risk-state">
      <icon-check-circle />
      <p>暂无高风险缺陷</p>
      <span>持续关注回归验证与缺陷闭环</span>
    </div>
  </article>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { IconCheckCircle } from "@arco-design/web-vue/es/icon";
import { useProjectStore } from "@/store/projectStore";
import { getTestBugList, type TestBug } from "@/services/testBugService";
const projectStore = useProjectStore(),
  loading = ref(false),
  error = ref(""),
  bugs = ref<TestBug[]>([]);
let generation = 0;
const rank = (value: string) =>
  Number(String(value).replace(/[^\d]/g, "")) || 1;
const risks = computed(() =>
  bugs.value
    .filter(
      (bug) =>
        bug.status !== "closed" &&
        (rank(bug.severity) <= 2 || rank(bug.priority) <= 1),
    )
    .sort(
      (a, b) =>
        rank(a.priority) - rank(b.priority) ||
        rank(a.severity) - rank(b.severity),
    )
    .slice(0, 3),
);
async function load() {
  const token = ++generation,
    project = projectStore.currentProjectId;
  bugs.value = [];
  error.value = "";
  if (!project) return;
  loading.value = true;
  try {
    const response = await getTestBugList(project, {
      ordering: "priority,severity,-id",
    });
    if (token !== generation) return;
    if (!response.success) throw Error(response.error || "无法读取缺陷");
    bugs.value = response.data || [];
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : "无法读取缺陷";
  } finally {
    if (token === generation) loading.value = false;
  }
}
watch(() => projectStore.currentProjectId, load, { immediate: true });
onBeforeUnmount(() => {
  generation++;
});
</script>
<style scoped>
.fc-risk-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.fc-risk-list li + li {
  border-top: 1px solid var(--theme-border);
}
.fc-risk-list a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 17px 0;
  color: var(--theme-text);
  text-decoration: none;
  min-width: 0;
}
.fc-risk-list a > div {
  flex: 1;
  min-width: 0;
}
.fc-risk-list strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 550;
}
.fc-risk-list a > div > span {
  display: block;
  margin-top: 6px;
  color: var(--theme-text-tertiary);
  font-size: 12px;
}
.fc-risk-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 130px;
  gap: 10px;
  color: var(--theme-text-tertiary);
  font-size: 12px;
  text-align: center;
}
.fc-risk-state p {
  margin: 0;
  overflow-wrap: anywhere;
}
.fc-risk-state > svg {
  width: 26px;
  height: 26px;
  color: var(--theme-accent);
}
.fc-risk-state > span {
  font-size: 12px;
}
</style>
