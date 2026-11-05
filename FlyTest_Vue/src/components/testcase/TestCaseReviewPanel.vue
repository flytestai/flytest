<template>
  <section
    class="fc-case-review"
    aria-label="用例详情审核"
    @keydown.esc="emit('close')"
  >
    <header class="fc-case-review__header">
      <h3>用例详情</h3>
      <button type="button" aria-label="关闭用例详情" @click="emit('close')">
        ×
      </button>
    </header>
    <div v-if="loading" class="fc-case-review__state">
      <a-spin tip="加载用例详情…" />
    </div>
    <a-result
      v-else-if="error"
      status="error"
      title="无法加载用例"
      :subtitle="error"
      ><template #extra
        ><a-button @click="load">重新加载</a-button></template
      ></a-result
    >
    <template v-else-if="detail">
      <div class="fc-case-review__body">
        <span class="fc-case-code">TC-{{ detail.id }}</span>
        <h4>{{ detail.name }}</h4>
        <a-tag :color="getReviewStatusColor(detail.review_status)">{{
          getReviewStatusLabel(detail.review_status)
        }}</a-tag>
        <dl class="fc-case-review__meta">
          <div>
            <dt>优先级</dt>
            <dd>
              <a-tag :color="getLevelColor(detail.level)">{{
                detail.level
              }}</a-tag>
            </dd>
          </div>
          <div>
            <dt>负责人</dt>
            <dd>{{ getUserDisplayName(detail.assignee_detail, '未分配') }}</dd>
          </div>
          <div class="fc-case-review__full">
            <dt>所属模块</dt>
            <dd>{{ moduleName || detail.module_detail || "未分类" }}</dd>
          </div>
        </dl>
        <section>
          <h5>前置条件</h5>
          <p>{{ detail.precondition || "未填写前置条件" }}</p>
        </section>
        <section>
          <h5>测试步骤与预期结果</h5>
          <ol v-if="detail.steps?.length" class="fc-case-review__steps">
            <li v-for="(step, index) in detail.steps" :key="step.id || index">
              <span>{{ index + 1 }}</span>
              <div>
                <p>{{ step.description }}</p>
                <small>预期结果</small>
                <p>{{ step.expected_result || "未填写" }}</p>
              </div>
            </li>
          </ol>
          <p v-else>暂无测试步骤</p>
        </section>
        <section v-if="detail.notes">
          <h5>备注</h5>
          <p>{{ detail.notes }}</p>
        </section>
      </div>
      <footer class="fc-case-review__footer">
        <p v-if="detail.review_status !== 'approved'" class="fc-review-notice">
          审核通过后，再将用例用于正式测试执行。
        </p>
        <div>
          <a-button @click="emit('edit', detail.id)">编辑用例</a-button
          ><a-button
            type="primary"
            :disabled="detail.review_status === 'approved'"
            :loading="reviewing"
            @click="approve"
            >{{
              detail.review_status === "approved" ? "已审核通过" : "审核通过"
            }}</a-button
          >
        </div>
        <button
          type="button"
          class="fc-case-review__full-link"
          @click="emit('full', detail.id)"
        >
          查看完整详情与附件 →
        </button>
      </footer>
    </template>
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { Message } from "@arco-design/web-vue";
import { getUserDisplayName } from '@/utils/userDisplay';
import {
  getTestCaseDetail,
  updateTestCaseReviewStatus,
  type TestCase,
} from "@/services/testcaseService";
import {
  getLevelColor,
  getReviewStatusColor,
  getReviewStatusLabel,
  getExecutionStatusColor,
  getExecutionStatusLabel,
} from "@/utils/formatters";
const props = defineProps<{
  projectId: number | null;
  caseId: number;
  moduleName?: string;
}>();
const emit = defineEmits<{
  close: [];
  edit: [id: number];
  full: [id: number];
  reviewed: [id: number];
}>();
const loading = ref(false),
  reviewing = ref(false),
  error = ref(""),
  detail = ref<TestCase | null>(null);
let generation = 0;
async function load() {
  const token = ++generation,
    project = props.projectId,
    id = props.caseId;
  detail.value = null;
  error.value = "";
  loading.value = true;
  if (!project) {
    loading.value = false;
    return;
  }
  try {
    const result = await getTestCaseDetail(project, id);
    if (token !== generation) return;
    if (!result.success || !result.data)
      throw Error(result.error || "请稍后重试");
    detail.value = result.data;
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : "加载失败";
  } finally {
    if (token === generation) loading.value = false;
  }
}
async function approve() {
  if (!props.projectId || !detail.value || reviewing.value) return;
  const project = props.projectId,
    id = detail.value.id,
    token = generation;
  reviewing.value = true;
  try {
    const result = await updateTestCaseReviewStatus(project, id, "approved");
    if (!result.success) throw Error(result.error || "审核失败");
    if (token !== generation) return;
    detail.value!.review_status = "approved";
    Message.success("用例审核通过");
    emit("reviewed", id);
  } catch (cause) {
    if (token === generation)
      Message.error(cause instanceof Error ? cause.message : "审核失败");
  } finally {
    reviewing.value = false;
  }
}
watch(() => [props.projectId, props.caseId], load, { immediate: true });
onBeforeUnmount(() => {
  generation++;
});
</script>
<style scoped>
.fc-case-review {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  color: var(--theme-text);
  background: var(--theme-surface);
}
.fc-case-review__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: none;
  padding: 14px 16px;
  border-bottom: 1px solid var(--theme-border);
}
.fc-case-review__header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.fc-case-review__header button {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--theme-text-secondary);
  font-size: 24px;
  cursor: pointer;
}
.fc-case-review__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}
.fc-case-review__body h4 {
  font-size: 18px;
  line-height: 1.6;
  margin: 7px 0 10px;
  overflow-wrap: anywhere;
}
.fc-case-review__body section {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--theme-border);
}
.fc-case-review__body h5 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
}
.fc-case-review__body p {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.8;
}
.fc-case-review__meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 16px 0;
  padding: 12px;
  border: 1px solid var(--theme-border);
  border-radius: 9px;
  background: var(--theme-surface-soft);
}
.fc-case-review__meta dt {
  font-size: 11px;
  color: var(--theme-text-tertiary);
  margin-bottom: 6px;
}
.fc-case-review__meta dd {
  font-size: 12px;
  margin: 0;
}
.fc-case-review__full {
  min-width: 0;
  overflow-wrap: anywhere;
}
.fc-case-review__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
}
.fc-case-review__steps li {
  display: flex;
  gap: 9px;
}
.fc-case-review__steps li > span {
  display: grid;
  place-items: center;
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--theme-surface-soft);
  font-size: 11px;
}
.fc-case-review__steps small {
  display: block;
  margin-top: 7px;
  color: var(--theme-text-tertiary);
  font-size: 10px;
}
.fc-case-review__footer {
  flex: none;
  padding: 12px 16px;
  border-top: 1px solid var(--theme-border);
}
.fc-case-review__footer > div {
  display: flex;
  gap: 8px;
}
.fc-case-review__footer > div > * {
  flex: 1;
}
.fc-review-notice {
  margin: 0 0 10px;
  padding: 8px;
  border-radius: 5px;
  background: var(--theme-ai-soft);
  color: var(--theme-ai);
  font-size: 11px;
  line-height: 1.6;
}
.fc-case-review__full-link {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 3px;
  border: 0;
  background: transparent;
  color: var(--theme-accent);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.fc-case-review__state {
  display: grid;
  place-items: center;
  min-height: 250px;
}
</style>
