<template>
  <div class="structured-environment-editor">
    <a-tabs type="rounded" size="large">
      <a-tab-pane key="headers" title="Headers">
        <div class="editor-toolbar">
          <div>
            <div class="editor-title">公共请求头</div>
            <div class="editor-description">环境级 Header 会自动应用到当前环境下的请求。</div>
          </div>
          <a-button size="small" @click="addHeader">新增 Header</a-button>
        </div>
        <div v-if="!localModel.headers.length" class="editor-empty">暂无公共 Header</div>
        <div v-for="(item, index) in localModel.headers" :key="`header-${index}`" class="item-card">
          <div class="item-row item-row--main">
            <a-input v-model="item.name" class="item-name" placeholder="Header 名，例如 Authorization" />
            <a-input v-model="item.value" class="item-value" placeholder="Header 值，支持 {{token}} 变量" />
          </div>
          <div class="item-row item-row--meta">
            <a-switch v-model="item.enabled" size="small" />
            <span class="meta-label">启用</span>
            <a-button status="danger" size="mini" @click="removeAt(localModel.headers, index)">删除</a-button>
          </div>
        </div>
      </a-tab-pane>

      <a-tab-pane key="variables" title="Variables">
        <div class="editor-toolbar">
          <div>
            <div class="editor-title">环境变量</div>
            <div class="editor-description">支持 token、tenant、账号密码等变量，也可标记为敏感字段。</div>
          </div>
          <a-button size="small" @click="addVariable">新增变量</a-button>
        </div>
        <div v-if="!localModel.variables.length" class="editor-empty">暂无环境变量</div>
        <div v-for="(item, index) in localModel.variables" :key="`variable-${index}`" class="item-card">
          <div class="item-row item-row--main">
            <a-input v-model="item.name" class="item-name" placeholder="变量名，例如 token" />
            <a-input v-model="item.value" class="item-value" placeholder="变量值" />
          </div>
          <div class="item-row item-row--meta">
            <a-switch v-model="item.enabled" size="small" />
            <span class="meta-label">启用</span>
            <a-switch v-model="item.is_secret" size="small" />
            <span class="meta-label">敏感</span>
            <a-button status="danger" size="mini" @click="removeAt(localModel.variables, index)">删除</a-button>
          </div>
        </div>
      </a-tab-pane>

      <a-tab-pane key="cookies" title="Cookies">
        <div class="editor-toolbar">
          <div>
            <div class="editor-title">环境 Cookie</div>
            <div class="editor-description">适合登录态、会话链路和跨接口复用的 Cookie 初始化。</div>
          </div>
          <a-button size="small" @click="addCookie">新增 Cookie</a-button>
        </div>
        <div v-if="!localModel.cookies.length" class="editor-empty">暂无环境 Cookie</div>
        <div v-for="(item, index) in localModel.cookies" :key="`cookie-${index}`" class="item-card">
          <div class="item-row item-row--main">
            <a-input v-model="item.name" class="item-name" placeholder="Cookie 名，例如 sessionid" />
            <a-input v-model="item.value" class="item-value" placeholder="Cookie 值" />
          </div>
          <div class="item-row">
            <a-input v-model="item.domain" class="item-half" placeholder="Domain，可留空" />
            <a-input v-model="item.path" class="item-half" placeholder="Path，默认 /" />
          </div>
          <div class="item-row item-row--meta">
            <a-switch v-model="item.enabled" size="small" />
            <span class="meta-label">启用</span>
            <a-button status="danger" size="mini" @click="removeAt(localModel.cookies, index)">删除</a-button>
          </div>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ApiEnvironmentEditorModel } from '../types'
import {
  createEmptyEnvironmentEditorModel,
  createEnvironmentCookieSpec,
  createEnvironmentHeaderSpec,
  createEnvironmentVariableSpec,
} from '../state/environmentEditor'

const props = defineProps<{
  modelValue: ApiEnvironmentEditorModel
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: ApiEnvironmentEditorModel): void
}>()

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const localModel = ref<ApiEnvironmentEditorModel>(createEmptyEnvironmentEditorModel())

watch(
  () => props.modelValue,
  value => {
    localModel.value = createEmptyEnvironmentEditorModel(cloneJson(value || {}))
  },
  { deep: true, immediate: true }
)

watch(
  localModel,
  value => {
    emit('update:modelValue', createEmptyEnvironmentEditorModel(cloneJson(value)))
  },
  { deep: true }
)

const removeAt = <T>(items: T[], index: number) => {
  items.splice(index, 1)
}

const addHeader = () => {
  localModel.value.headers.push(createEnvironmentHeaderSpec({ order: localModel.value.headers.length }))
}

const addVariable = () => {
  localModel.value.variables.push(createEnvironmentVariableSpec({ order: localModel.value.variables.length }))
}

const addCookie = () => {
  localModel.value.cookies.push(createEnvironmentCookieSpec({ order: localModel.value.cookies.length }))
}
</script>

<style scoped>
.structured-environment-editor {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 20px;
  padding: 18px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(255, 255, 255, 0.98));
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.editor-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.editor-description {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.editor-empty {
  padding: 20px;
  border: 1px dashed rgba(148, 163, 184, 0.32);
  border-radius: 16px;
  color: #94a3b8;
  text-align: center;
  background: rgba(255, 255, 255, 0.8);
}

.item-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.92);
}

.item-card + .item-card {
  margin-top: 12px;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-row--main {
  align-items: stretch;
}

.item-row--meta {
  justify-content: flex-end;
  color: #475569;
}

.item-name {
  width: 240px;
  max-width: 100%;
}

.item-value,
.item-half {
  flex: 1;
}

.meta-label {
  font-size: 12px;
}

@media (max-width: 768px) {
  .editor-toolbar,
  .item-row,
  .item-row--main {
    flex-direction: column;
    align-items: stretch;
  }

  .item-name,
  .item-value,
  .item-half {
    width: 100%;
  }

  .item-row--meta {
    align-items: flex-start;
  }
}
</style>
