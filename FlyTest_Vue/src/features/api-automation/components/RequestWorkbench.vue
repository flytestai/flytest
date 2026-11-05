<template>
  <div class="fc-request-workbench">
    <div v-if="loading" class="fc-request-state">
      <a-spin tip="加载接口配置…" />
    </div>
    <a-result
      v-else-if="loadError"
      status="error"
      title="无法读取接口"
      :subtitle="loadError"
      ><template #extra
        ><a-button @click="load">重试</a-button></template
      ></a-result
    >
    <ApiDetailLayout v-else-if="detail" :open="overviewOpen" @close="overviewOpen=false">
      <ApiActionPortal><a-button @click="$router.push('/api-automation?tab=environments')">环境配置</a-button><a-button type="primary" :loading="executing" :disabled="saving || generating" @click="execute">执行测试</a-button></ApiActionPortal>
      <header class="fc-request-tab">
        <span>{{ detail.name }}</span
        ><span v-if="dirty" class="fc-request-unsaved">未保存</span
        ><a-button type="text" size="mini" @click="emit('close')">返回接口列表</a-button><a-button type="text" size="mini" @click="overviewOpen=!overviewOpen">接口概览</a-button><button type="button" aria-label="关闭当前接口" @click="emit('close')">
          ×
        </button>
      </header>
      <div class="fc-request-target">
        <a-select
          v-model="editor.method"
          aria-label="请求方法"
          :style="{ width: '108px' }"
          ><a-option v-for="method in methods" :key="method">{{
            method
          }}</a-option></a-select
        ><a-input
          v-model="editor.url"
          aria-label="请求地址"
          placeholder="{{base_url}}/api/…"
        /><a-button
          :loading="saving"
          :disabled="executing || generating"
          @click="save()"
          >保存</a-button
        ><a-button
          type="primary"
          :loading="executing"
          :disabled="saving || generating"
          @click="execute"
          >执行测试</a-button
        >
      </div>
      <div class="fc-request-context">
        <a-select
          v-model="environmentId"
          allow-clear
          placeholder="选择执行环境"
          aria-label="执行环境"
          :loading="environmentLoading"
          ><a-option
            v-for="env in environments"
            :key="env.id"
            :value="env.id"
            >{{ env.name }}</a-option
          ></a-select
        ><span>超时 {{ editor.timeout_ms }} ms</span
        ><a-button
          class="fc-ai-action"
          size="small"
          :loading="generating"
          :disabled="saving || executing || dirty"
          @click="generateAssertions"
          >AI 生成断言</a-button
        >
      </div>
      <p v-if="dirty" class="fc-request-draft-hint">
        当前有未保存的配置；执行前将先保存。AI 断言基于已保存的接口生成。
      </p>
      <a-alert
        v-if="operationError"
        type="error"
        :closable="true"
        @close="operationError = ''"
        >{{ operationError }}</a-alert
      >
      <StructuredHttpEditor
        v-model="editor"
        :show-request-target="false"
        preferred-tab="body"
        compact
      />
      <section class="fc-request-results" aria-label="接口响应与断言结果">
        <header>
          <h3>响应与断言结果</h3>
          <div v-if="result" class="fc-request-response-meta">
            <a-tag :color="result.passed ? 'green' : 'red'">{{
              result.status_code ?? result.status
            }}</a-tag
            ><span>{{ result.response_time ?? "—" }} ms</span
            ><span>{{ responseSize }}</span
            ><span>{{ result.environment_name || "默认环境" }}</span>
          </div>
        </header>
        <a-empty
          v-if="!result"
          description="执行接口后，在这里查看真实响应与断言结果"
        />
        <template v-else
          ><a-alert v-if="result.error_message" type="error">{{
            result.error_message
          }}</a-alert>
          <div class="fc-request-result-grid">
            <section>
              <h4>响应内容</h4>
              <pre tabindex="0">{{ responseText }}</pre>
            </section>
            <section>
              <h4>
                断言结果
                <span
                  >{{
                    result.assertions_results?.filter((item) => item.passed)
                      .length || 0
                  }}
                  / {{ result.assertions_results?.length || 0 }}</span
                >
              </h4>
              <ul v-if="result.assertions_results?.length">
                <li
                  v-for="(assertion, index) in result.assertions_results"
                  :key="index"
                >
                  <span
                    :class="
                      assertion.passed ? 'quality-success' : 'quality-danger'
                    "
                    >{{ assertion.passed ? "✓" : "×" }}</span
                  >
                  <div>
                    <strong>{{
                      assertion.name ||
                      assertion.type ||
                      assertion.assertion_type ||
                      "断言 " + (index + 1)
                    }}</strong
                    ><small
                      >期望
                      {{
                        stringify(
                          assertion.expected ?? assertion.expected_value,
                        )
                      }}
                      · 实际
                      {{
                        stringify(assertion.actual ?? assertion.actual_value)
                      }}</small
                    >
                  </div>
                  <a-tag :color="assertion.passed ? 'green' : 'red'">{{
                    assertion.passed ? "通过" : "失败"
                  }}</a-tag>
                </li>
              </ul>
              <a-empty v-else description="未配置断言" />
            </section>
          </div>
          <footer>
            <span
              >执行时间
              {{ new Date(result.created_at).toLocaleString("zh-CN") }}</span
            ><router-link to="/api-automation?tab=execution-records"
              >查看执行记录 →</router-link
            ><router-link to="/api-automation?tab=execution-report"
              >测试报告 →</router-link
            >
            <router-link to="/api-automation?tab=test-cases"
              >测试用例与生成 →</router-link
            >
          </footer></template
        >
      </section><template #detail><ApiRequestOverview :record="detail" :body="editor.body_json_text" :saving="saving" @close="overviewOpen=false" @save="save()" /></template>
    </ApiDetailLayout>
    <a-modal
      v-model:visible="suggestionsVisible"
      title="AI 断言草稿"
      :ok-text="'添加到当前接口'"
      :ok-button-props="{ disabled: !suggestions.length }"
      class="fc-dialog"
      @ok="applyAssertions"
    >
      <a-alert type="info"
        >请审核断言的期望值。添加后仍需保存；已有断言会保留。</a-alert
      >
      <ol class="fc-assertion-suggestions">
        <li v-for="(item, index) in suggestions" :key="index">
          <strong>{{ item.assertion_type }}</strong>
          <p>
            {{ item.selector || item.target || "响应" }} ·
            {{
              item.expected_text ||
              item.expected_number ||
              item.expected_json_text ||
              "检查响应内容"
            }}
          </p>
        </li>
      </ol>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import ApiDetailLayout from "./ApiDetailLayout.vue";
import ApiRequestOverview from "./ApiRequestOverview.vue";
import ApiActionPortal from './ApiActionPortal.vue';
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { Message, Modal } from "@arco-design/web-vue";
import WorkspacePageHeader from "@/components/workspace/WorkspacePageHeader.vue";
import StructuredHttpEditor from "./StructuredHttpEditor.vue";
import { apiRequestApi, caseGenerationJobApi, environmentApi } from "../api";
import {
  createAssertionSpec,
  bodyModeToLegacyBodyType,
  createEmptyHttpEditorModel,
  httpEditorModelToAssertionSpecs,
  httpEditorModelToExtractorSpecs,
  httpEditorModelToRequestSpec,
  requestSpecToLegacyBody,
  requestSpecToLegacyHeaders,
  requestSpecToLegacyParams,
  requestToHttpEditorModel,
} from "../state/httpEditor";
import type {
  ApiAssertionSpec,
  ApiEnvironment,
  ApiExecutionRecord,
  ApiRequest,
  ApiRequestForm,
} from "../types";
const overviewOpen=ref(window.innerWidth >= 1360);
const props = defineProps<{ projectId?: number; requestId: number }>();
const emit = defineEmits<{ close: []; updated: []; executed: [] }>();
const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const loading = ref(false),
  saving = ref(false),
  executing = ref(false),
  generating = ref(false),
  loadError = ref(""),
  operationError = ref("");
const detail = ref<ApiRequest | null>(null),
  editor = ref(createEmptyHttpEditorModel()),
  baseline = ref("");
const environments = ref<ApiEnvironment[]>([]),
  environmentId = ref<number>(),
  environmentLoading = ref(false),
  result = ref<ApiExecutionRecord | null>(null);
const suggestions = ref<ApiAssertionSpec[]>([]),
  suggestionsVisible = ref(false);
let generation = 0,
  executionGeneration = 0,
  jobId: number | undefined,
  pollTimer: ReturnType<typeof setTimeout> | undefined,
  pollWake: (() => void) | undefined;
const dirty = computed(
  () => !!detail.value && baseline.value !== JSON.stringify(editor.value),
);
const stringify = (value: unknown) =>
  value === undefined || value === null
    ? "—"
    : typeof value === "string"
      ? value
      : JSON.stringify(value, null, 2);
const responseText = computed(() =>
  stringify(
    result.value?.response_snapshot?.body ??
      result.value?.response_snapshot?.json ??
      result.value?.response_snapshot,
  ),
);
const responseSize = computed(() => {
  const bytes = new TextEncoder().encode(responseText.value).length;
  return bytes >= 1024 ? (bytes / 1024).toFixed(2) + " KB" : bytes + " B";
});
function releasePoll() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = undefined;
  pollWake?.();
  pollWake = undefined;
}
function normalizeDraftAssertion(item: Record<string, unknown>) {
  if (item.assertion_type)
    return createAssertionSpec(item as Partial<ApiAssertionSpec>);
  const expected = item.expected;
  return createAssertionSpec({
    ...item,
    assertion_type: String(item.type || "status_code"),
    selector: String(item.selector || item.path || ""),
    expected_value_kind:
      typeof expected === "number"
        ? "number"
        : typeof expected === "object"
          ? "json"
          : "text",
    expected_number: typeof expected === "number" ? expected : null,
    expected_text: typeof expected === "string" ? expected : "",
    expected_json:
      typeof expected === "object" && expected !== null ? expected : {},
  } as Partial<ApiAssertionSpec>);
}
function pause() {
  return new Promise<void>((resolve) => {
    pollWake = resolve;
    pollTimer = setTimeout(() => {
      pollTimer = undefined;
      pollWake = undefined;
      resolve();
    }, 1500);
  });
}
async function load() {
  const token = ++generation;
  executionGeneration++;
  releasePoll();
  if (jobId) void caseGenerationJobApi.cancel(jobId).catch(() => {});
  jobId = undefined;
  saving.value = false;
  executing.value = false;
  generating.value = false;
  detail.value = null;
  result.value = null;
  suggestionsVisible.value = false;
  suggestions.value = [];
  loadError.value = "";
  operationError.value = "";
  loading.value = true;
  try {
    const response = await apiRequestApi.get(props.requestId);
    if (token !== generation) return;
    detail.value = response.data.data;
    editor.value = requestToHttpEditorModel(detail.value);
    if (!(detail.value.assertion_specs || detail.value.assertions)?.length)
      editor.value.assertions = [];
    baseline.value = JSON.stringify(editor.value);
  } catch (cause) {
    if (token === generation) loadError.value = errorText(cause);
  } finally {
    if (token === generation) loading.value = false;
  }
}
function errorText(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : (cause as { error?: string; message?: string })?.error ||
        (cause as { message?: string })?.message ||
        "操作失败，请稍后重试";
}
async function loadEnvironments() {
  const project = props.projectId;
  if (!project) {
    environments.value = [];
    return;
  }
  environmentLoading.value = true;
  try {
    const response = await environmentApi.list({ project });
    if (project !== props.projectId) return;
    environments.value = response.data.data || [];
    if(!environments.value.some(env=>env.id===environmentId.value)) environmentId.value = environments.value.find((env) => env.is_default)?.id;
  } catch {
    if (project === props.projectId) environments.value = [];
  } finally {
    if (project === props.projectId) environmentLoading.value = false;
  }
}
async function save(notify = true) {
  if (!detail.value || saving.value) return false;
  const token = generation,
    id = detail.value.id,
    snapshot = JSON.parse(JSON.stringify(editor.value));
  if (!editor.value.url.trim()) {
    Message.warning("请填写请求地址");
    return false;
  }
  try {
    saving.value = true;
    operationError.value = "";
    const spec = httpEditorModelToRequestSpec(snapshot);
    const payload: ApiRequestForm = {
      collection: detail.value.collection,
      name: detail.value.name,
      description: detail.value.description,
      method: spec.method,
      url: spec.url,
      headers: requestSpecToLegacyHeaders(spec),
      params: requestSpecToLegacyParams(spec),
      body_type: bodyModeToLegacyBodyType(spec.body_mode),
      body: requestSpecToLegacyBody(spec),
      assertions: [],
      request_spec: spec,
      assertion_specs: httpEditorModelToAssertionSpecs(snapshot),
      extractor_specs: httpEditorModelToExtractorSpecs(snapshot),
      timeout_ms: spec.timeout_ms,
    };
    await apiRequestApi.update(id, payload);
    if (token !== generation) return false;
    baseline.value = JSON.stringify(snapshot);
    if (notify) Message.success("接口配置已保存");
    emit("updated");
    return true;
  } catch (cause) {
    if (token === generation) operationError.value = errorText(cause);
    return false;
  } finally {
    if (token === generation) saving.value = false;
  }
}
async function execute() {
  if (executing.value || !detail.value) return;
  const token = generation,
    operation = ++executionGeneration,
    id = detail.value.id,
    env = environmentId.value;
  executing.value = true;
  operationError.value = "";
  result.value = null;
  try {
    if (dirty.value && !(await save(false))) return;
    if (token !== generation || operation !== executionGeneration) return;
    if (dirty.value) {
      Message.warning("配置已变更，请再次执行");
      return;
    }
    const response = await apiRequestApi.execute(id, env);
    if (token !== generation || operation !== executionGeneration) return;
    result.value = response.data.data;
    emit("executed");
  } catch (cause) {
    if (token === generation && operation === executionGeneration)
      operationError.value = errorText(cause);
  } finally {
    if (token === generation) executing.value = false;
  }
}
async function generateAssertions() {
  if (!detail.value || dirty.value || generating.value) return;
  const token = generation,
    id = detail.value.id;
  generating.value = true;
  operationError.value = "";
  try {
    let job = (
      await caseGenerationJobApi.create({
        scope: "selected",
        ids: [id],
        mode: "append",
        count_per_request: 1,
      })
    ).data.data;
    if (token !== generation) {
      void caseGenerationJobApi.cancel(job.id).catch(() => {});
      return;
    }
    jobId = job.id;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (token !== generation) return;
      if (job.status === "preview_ready") break;
      if (["failed", "canceled", "success"].includes(job.status))
        throw Error(job.error_message || "未取得可审核的断言草稿");
      await pause();
      if (token !== generation) return;
      job = (await caseGenerationJobApi.get(job.id)).data.data;
    }
    if (token !== generation) return;
    if (job.status !== "preview_ready") throw Error("生成时间较长，请稍后重试");
    const drafts =
      job.draft_payload?.items?.find(
        (item: { request_id?: number; id?: number }) =>
          item.request_id === id || item.id === id,
      )?.drafts || job.draft_payload?.items?.[0]?.drafts;
    const assertions = drafts?.[0]?.assertions;
    if (!Array.isArray(assertions) || !assertions.length)
      throw Error("本次未生成可用断言，请检查模型配置后重试");
    suggestions.value = requestToHttpEditorModel({
      ...detail.value,
      assertion_specs: assertions.map(normalizeDraftAssertion),
      assertions: [],
    }).assertions;
    suggestionsVisible.value = true;
  } catch (cause) {
    if (token === generation) operationError.value = errorText(cause);
  } finally {
    if (token === generation) {
      generating.value = false;
      jobId = undefined;
    }
  }
}
function applyAssertions() {
  editor.value.assertions = [
    ...editor.value.assertions,
    ...suggestions.value.map((item) => ({ ...item, id: undefined })),
  ];
  suggestionsVisible.value = false;
  Message.success("断言已添加，请检查后保存");
}
function confirmLeave() {
  if (!dirty.value && !generating.value && !saving.value && !executing.value)
    return Promise.resolve(true);
  return new Promise<boolean>((resolve) =>
    Modal.confirm({
      title: "离开当前接口？",
      content: "当前有未保存的配置或仍在进行的操作，离开后将不再展示其结果。",
      okText: "离开",
      cancelText: "继续编辑",
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    }),
  );
}
watch(
  () => [props.projectId, props.requestId],
  () => {
    void load();
  },
  { immediate: true },
);
watch(
  () => props.projectId,
  () => {
    environmentId.value = undefined;
    void loadEnvironments();
  },
  { immediate: true },
);
watch(environmentId, () => {
  executionGeneration++;
  result.value = null;
});
onBeforeRouteLeave(() => confirmLeave());
onBeforeUnmount(() => {
  generation++;
  executionGeneration++;
  releasePoll();
  if (jobId) void caseGenerationJobApi.cancel(jobId).catch(() => {});
});
defineExpose({ confirmLeave, refreshEnvironments:loadEnvironments });
</script>
<style scoped>
.fc-request-workbench {
  min-width: 0;
}
.fc-request-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  width: fit-content;
  max-width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--theme-border);
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
  color: var(--theme-accent);
  font-size: 12px;
}
.fc-request-tab > button {
  border: 0;
  background: transparent;
  color: var(--theme-text-tertiary);
  cursor: pointer;
  font-size: 16px;
}
.fc-request-unsaved {
  font-size: 10px;
  color: var(--theme-warning);
}
.fc-request-target {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--theme-border);
}
.fc-request-target > .arco-input-wrapper {
  flex: 1;
  min-width: 0;
  font-family: monospace;
}
.fc-request-context {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
  font-size: 11px;
  color: var(--theme-text-tertiary);
}
.fc-request-context > .arco-select-view {
  width: 180px;
}
.fc-request-context > .arco-btn {
  margin-left: auto;
}
.fc-request-draft-hint {
  margin: 0 0 12px;
  color: var(--theme-warning);
  font-size: 11px;
  line-height: 1.7;
}
.fc-request-state {
  display: grid;
  place-items: center;
  min-height: 300px;
}
.fc-request-results {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--theme-border);
  min-width: 0;
}
.fc-request-results > header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.fc-request-results h3 {
  margin: 0;
  font-size: 14px;
}
.fc-request-response-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--theme-text-secondary);
}
.fc-request-result-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  min-width: 0;
}
.fc-request-result-grid > section {
  min-width: 0;
  border: 1px solid var(--theme-border);
  border-radius: 6px;
  overflow: hidden;
}
.fc-request-result-grid h4 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 10px 12px;
  border-bottom: 1px solid var(--theme-border);
  font-size: 12px;
  font-weight: 500;
}
.fc-request-result-grid h4 span {
  color: var(--theme-accent);
}
.fc-request-result-grid pre {
  min-height: 160px;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  margin: 0;
  background: var(--theme-surface-soft);
  font:
    12px/1.8 ui-monospace,
    Consolas,
    monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.fc-request-result-grid ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.fc-request-result-grid li {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px;
  border-bottom: 1px solid var(--theme-border);
  font-size: 12px;
}
.fc-request-result-grid li > div {
  flex: 1;
  min-width: 0;
}
.fc-request-result-grid strong {
  font-size: 12px;
  font-weight: 500;
}
.fc-request-result-grid small {
  display: block;
  margin-top: 5px;
  font-size: 10px;
  color: var(--theme-text-tertiary);
  overflow-wrap: anywhere;
}
.fc-request-results > footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 12px;
  font-size: 11px;
  color: var(--theme-text-tertiary);
}
.fc-request-results > footer > span {
  margin-right: auto;
}
.fc-request-results a {
  color: var(--theme-accent);
  text-decoration: none;
}
.fc-assertion-suggestions {
  padding-left: 22px;
  font-size: 12px;
  line-height: 1.8;
}
.fc-assertion-suggestions p {
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .fc-request-target {
    display: grid;
    grid-template-columns: 104px minmax(0, 1fr);
  }
  .fc-request-target > :first-child {
    width: 100% !important;
  }
  .fc-request-result-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .fc-request-context > .arco-select-view {
    flex: 1;
    min-width: 120px;
  }
  .fc-request-context > span {
    display: none;
  }
}
</style>
