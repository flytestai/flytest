<template>
  <section class="api-preview" aria-label="接口用例详情">
    <header><h3>用例详情</h3><a-button type="text" size="small" aria-label="关闭用例详情" @click="$emit('close')">×</a-button></header>
    <span class="api-row-code">TC-{{ record.id }}</span><h4>{{ record.name }}</h4><a-tag :color="record.status === 'ready' ? 'green' : record.status === 'disabled' ? 'red' : 'orange'">{{ labels[record.status] }}</a-tag>
    <dl class="api-preview__meta"><div><dt>创建人</dt><dd>{{ record.creator_name || '未记录' }}</dd></div><div><dt>所属接口</dt><dd>{{ record.request_name || '未记录' }}</dd></div><div><dt>请求方法</dt><dd>{{ record.request_method || '—' }}</dd></div></dl>
    <h5>用例说明</h5><p>{{ record.description || '未填写用例说明' }}</p>
    <h5>工作流步骤</h5><ol v-if="steps.length"><li v-for="(step,index) in steps" :key="index">{{ step.name || step.request_name || '步骤 ' + (index + 1) }}<small v-if="step.description"> · {{ step.description }}</small></li></ol><p v-else>执行当前接口请求，使用本用例的覆盖配置与断言进行验证。</p>
    <h5>预期结果与断言</h5><ol v-if="assertions.length"><li v-for="(item,index) in assertions" :key="index">{{ item.assertion_type || item.type || '断言' }}<template v-if="item.selector || item.target"> · {{ item.selector || item.target }}</template><br />{{ item.expected_text ?? item.expected_number ?? (item.expected_json != null ? JSON.stringify(item.expected_json) : item.expected ?? item.expected_value ?? '按配置规则验证') }}</li></ol><p v-else>尚未配置断言，请编辑并补充验证规则。</p>
    <div v-if="record.status === 'draft'" class="api-draft-notice">草稿用例请先检查请求配置和断言，再设为就绪。</div>
    <footer class="api-preview__footer"><a-button @click="$emit('edit',record)">编辑用例</a-button><a-button type="primary" :disabled="record.status === 'ready'" :loading="saving" @click="$emit('ready',record)">{{ record.status === 'ready' ? '已就绪' : '设为就绪' }}</a-button><a-button type="text" @click="$emit('full',record)">查看完整配置 →</a-button></footer>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { ApiTestCase } from '../types'
const props=defineProps<{record:ApiTestCase;saving?:boolean}>()
defineEmits<{close:[];edit:[record:ApiTestCase];ready:[record:ApiTestCase];full:[record:ApiTestCase]}>()
const labels={draft:'草稿',ready:'就绪',disabled:'停用'}
const steps=computed(() => props.record.workflow_steps || props.record.script?.workflow_steps || [])
const assertions=computed<Array<Record<string,any>>>(() => props.record.assertion_specs?.length ? props.record.assertion_specs : props.record.assertions || [])
</script>
