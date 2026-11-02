<template>
  <article class="insights-block fc-my-work" aria-labelledby="my-work-heading">
    <header class="insights-heading">
      <div class="insights-heading-copy">
        <h3 id="my-work-heading">我的待办</h3>
        <p>当前账号最近分配的用例与待验证缺陷</p>
      </div>
      <button type="button" :disabled="loading" @click="load">
        {{ loading ? "读取中…" : "刷新" }}
      </button>
    </header>
    <p v-if="error" class="fc-my-work__error">{{ error }}</p>
    <div v-if="loading" class="fc-my-work__empty"><a-spin /></div>
    <ul v-else-if="items.length">
      <li v-for="item in items" :key="item.key">
        <router-link :to="item.to"
          ><span class="fc-my-work__indicator" aria-hidden="true">↗</span>
          <div>
            <strong>{{ item.name }}</strong
            ><small>{{ item.code }} · {{ item.module }}</small>
          </div>
          <a-tag :color="item.color">{{ item.label }}</a-tag
          ><span aria-hidden="true">›</span></router-link
        >
      </li>
    </ul>
    <div v-else-if="!error" class="fc-my-work__empty">
      <icon-check-circle />
      <p>当前没有待处理事项</p>
      <small>新的分配与回归验证任务会出现在这里</small>
    </div>
    <footer><router-link to="/testsuites">查看测试任务 →</router-link></footer>
  </article>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { IconCheckCircle } from "@arco-design/web-vue/es/icon";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { getTestCaseList } from "@/services/testcaseService";
import { getTestBugList } from "@/services/testBugService";
type QueueItem = {
  key: string;
  name: string;
  code: string;
  module: string;
  label: string;
  color: string;
  to: { path: string; query: Record<string, string> };
};
const project = useProjectStore(),
  auth = useAuthStore(),
  loading = ref(false),
  error = ref(""),
  items = ref<QueueItem[]>([]);
let generation = 0;
async function load() {
  const token = ++generation,
    projectId = project.currentProjectId,
    userId = auth.currentUser?.id;
  items.value = [];
  error.value = "";
  if (!projectId || !userId) return;
  loading.value = true;
  const results = await Promise.allSettled([
    getTestCaseList(projectId, { page: 1, pageSize: 50, assignee_id: userId }),
    getTestBugList(projectId, {
      assigned_to: userId,
      status: "pending_retest",
      ordering: "-id",
    }),
  ]);
  if (token !== generation) return;
  const queue: QueueItem[] = [];
  const cases = results[0];
  if (cases.status === "fulfilled" && cases.value.success) {
    for (const item of cases.value.data || []) {
      if (
        item.review_status === "pending_review" ||
        (item.review_status === "approved" &&
          (!item.execution_status || item.execution_status === "not_executed"))
      )
        queue.push({
          key: "case-" + item.id,
          name: item.name,
          code: "TC-" + item.id,
          module: item.module_detail || "未分类",
          label: item.review_status === "pending_review" ? "待审核" : "待执行",
          color:
            item.review_status === "pending_review" ? "orange" : "arcoblue",
          to: { path: "/testcases", query: { testcase_id: String(item.id) } },
        });
    }
  } else error.value = "部分待办暂时无法读取，请稍后刷新。";
  const bugs = results[1];
  if (bugs.status === "fulfilled" && bugs.value.success) {
    for (const item of bugs.value.data || []) {
      if (item.status === "pending_retest")
        queue.push({
          key: "bug-" + item.id,
          name: item.title,
          code: "BUG-" + item.id,
          module: item.suite_name || "测试套件",
          label: "待验证",
          color: "cyan",
          to: {
            path: "/test-bugs",
            query: { suite: String(item.suite), bug: String(item.id) },
          },
        });
    }
  } else error.value = "部分待办暂时无法读取，请稍后刷新。";
  items.value = queue.slice(0, 3);
  loading.value = false;
}
watch(() => [project.currentProjectId, auth.currentUser?.id], load, {
  immediate: true,
});
onBeforeUnmount(() => {
  generation++;
});
</script>
<style scoped>
.fc-my-work > header > button {
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 11px;
  color: var(--theme-text-tertiary);
  cursor: pointer;
}
.fc-my-work ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.fc-my-work li + li {
  border-top: 1px solid var(--theme-border);
}
.fc-my-work li a {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 15px 0;
  text-decoration: none;
  color: var(--theme-text-secondary);
  font-size: 12px;
}
.fc-my-work li a > div {
  flex: 1;
  min-width: 0;
}
.fc-my-work strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--theme-text);
  font-size: 13px;
  font-weight: 500;
}
.fc-my-work small {
  display: block;
  margin-top: 7px;
  font-size: 11px;
  color: var(--theme-text-tertiary);
}
.fc-my-work__indicator {
  display: grid;
  place-items: center;
  flex: none;
  width: 22px;
  height: 22px;
  border: 1px solid var(--theme-border);
  border-radius: 5px;
  color: var(--theme-text-tertiary);
}
.fc-my-work__empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  min-height: 160px;
  color: var(--theme-text-tertiary);
  font-size: 12px;
  text-align: center;
}
.fc-my-work__empty p {
  margin: 4px 0;
}
.fc-my-work__empty svg {
  width: 24px;
  height: 24px;
  color: var(--theme-accent);
}
.fc-my-work__error {
  font-size: 12px;
  color: var(--theme-warning);
}
.fc-my-work footer {
  margin-top: auto;
  padding-top: 10px;
  font-size: 11px;
}
.fc-my-work footer a {
  color: var(--theme-accent);
  text-decoration: none;
}
</style>
