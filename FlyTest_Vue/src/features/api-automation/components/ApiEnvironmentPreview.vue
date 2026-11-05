<template>
  <section class="api-preview" aria-label="环境详情"><header><h3>环境详情</h3><a-button type="text" size="small" aria-label="关闭环境详情" @click="$emit('close')">×</a-button></header><h4>{{ record.name }}</h4><a-tag v-if="record.is_default" color="green">默认环境</a-tag><dl class="api-preview__meta"><div><dt>超时</dt><dd>{{ record.timeout_ms / 1000 }} 秒</dd></div><div><dt>变量</dt><dd>{{ variables.length }}</dd></div><div><dt>公共请求头</dt><dd>{{ headers.length }}</dd></div></dl><h5>基础地址</h5><p>{{ record.base_url || '未配置基础地址' }}</p><h5>环境变量（{{ variables.length }}）</h5><div v-for="item in variables" :key="item.name" class="api-environment-variable"><strong>{{ item.name }}</strong><code :title="isSecret(item) && !revealed[item.name] ? '敏感变量已隐藏' : String(item.value)">{{ isSecret(item) && !revealed[item.name] ? '••••••••' : item.value }}</code><a-button v-if="isSecret(item)" type="text" size="mini" :aria-label="(revealed[item.name] ? '隐藏变量 ' : '显示变量 ') + item.name" @click="revealed[item.name] = !revealed[item.name]">{{ revealed[item.name] ? '隐藏' : '显示' }}</a-button></div><p v-if="!variables.length">暂无环境变量</p><h5>公共请求头</h5><div v-for="item in headers" :key="item.name" class="api-environment-variable"><strong>{{ item.name }}</strong><code>{{ /authorization|token|cookie|key/i.test(item.name) ? '••••••••' : item.value }}</code></div><p v-if="!headers.length">暂无公共请求头，可在编辑环境时配置。</p><p class="api-preview-hint">连接状态需要实际请求验证；这里只展示已保存的配置。</p><footer class="api-preview__footer"><a-button type="primary" @click="$emit('edit',record)">编辑环境</a-button></footer></section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ApiEnvironment } from '../types'
const props=defineProps<{record:ApiEnvironment}>()
defineEmits<{close:[];edit:[record:ApiEnvironment]}>()
const revealed=ref<Record<string,boolean>>({})
watch(() => props.record.id,() => revealed.value={})
const variables=computed(() => props.record.environment_specs?.variables?.length ? props.record.environment_specs.variables.filter(item => item.enabled !== false) : Object.entries(props.record.variables || {}).map(([name,value])=>({name,value,is_secret:false})))
const headers=computed(() => props.record.environment_specs?.headers?.length ? props.record.environment_specs.headers.filter(item => item.enabled !== false) : Object.entries(props.record.common_headers || {}).map(([name,value])=>({name,value})))
const isSecret=(item:{name:string;is_secret?:boolean}) => item.is_secret || /token|password|secret|authorization|api.?key|cookie/i.test(item.name)
</script>
