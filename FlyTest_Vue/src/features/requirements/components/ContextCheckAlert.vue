<template>
  <div v-if="contextResult" class="context-check-alert">
    <!-- 可以直接分析 -->
    <a-alert
      v-if="contextResult.context_analysis.suggestion === 'OK'"
      type="success"
      :title="'✅ 文档大小适合'"
      :description="`当前文档(${contextResult.document_info.word_count}字)适合${contextResult.context_analysis.model_name}模型直接分析，使用率${contextResult.context_analysis.usage_percentage.toFixed(1)}%`"
      show-icon
      class="context-alert"
    >
      <template #action>
        <a-button type="primary" @click="$emit('directReview')">
          开始需求评审
        </a-button>
      </template>
    </a-alert>

    <!-- 建议拆分 -->
    <a-alert
      v-else-if="contextResult.context_analysis.suggestion === 'SPLIT_RECOMMENDED'"
      type="warning"
      :title="'⚠️ 建议拆分'"
      :description="`文档较大，使用率${contextResult.context_analysis.usage_percentage.toFixed(1)}%，拆分后可获得更好的分析效果`"
      show-icon
      class="context-alert"
    >
      <template #action>
        <a-space>
          <a-button @click="$emit('directReview')">
            直接分析
          </a-button>
          <a-button class="fc-ai-action" type="primary" @click="$emit('showSplitOptions')">
            智能拆分
          </a-button>
        </a-space>
      </template>
    </a-alert>

    <!-- 建议列表 -->
    <div v-if="contextResult.recommendations?.length" class="recommendations">
      <h4>💡 建议：</h4>
      <ul>
        <li v-for="(rec, index) in contextResult.recommendations" :key="index">
          {{ rec }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ContextCheckResponse } from '../types';

interface Props {
  contextResult: ContextCheckResponse | null;
}

interface Emits {
  (e: 'directReview'): void;
  (e: 'showSplitOptions', splitLevel?: string): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>

<style scoped>
.context-check-alert {
  margin-bottom: 16px;
}

.context-alert {
  margin-bottom: 12px;
}

.recommendations {
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 12px;
  margin-top: 12px;
}

.recommendations h4 {
  margin: 0 0 8px 0;
  color: var(--theme-text-secondary);
  font-size: 14px;
}

.recommendations ul {
  margin: 0;
  padding-left: 20px;
}

.recommendations li {
  margin-bottom: 4px;
  color: var(--theme-text-secondary);
  font-size: 13px;
}
</style>
