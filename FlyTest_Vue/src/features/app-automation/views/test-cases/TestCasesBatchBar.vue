<template>
  <div v-if="selectedCount" class="batch-bar">
    <div class="batch-bar-copy">
      <span class="batch-bar-kicker">Batch Actions</span>
      <span>已选择 <strong>{{ selectedCount }}</strong> 个用例</span>
    </div>
    <a-space wrap class="batch-bar-actions">
      <a-button type="primary" size="small" @click="emit('open-batch-execute')">
        {{ selectedCount > 1 ? '转到套件执行' : '执行所选' }}
      </a-button>
      <a-button size="small" @click="emit('clear-selection')">取消选择</a-button>
    </a-space>
  </div>
</template>

<script setup lang="ts">
import type { TestCasesBatchBarEmits } from './testCaseEventModels'
import type { TestCasesBatchBarProps } from './testCaseViewModels'

defineProps<TestCasesBatchBarProps>()

const emit = defineEmits<TestCasesBatchBarEmits>()
</script>

<style scoped>
.batch-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.2);
  background:
    var(--theme-surface);
  box-shadow: var(--theme-card-shadow);
  color: var(--theme-text);
  overflow: hidden;
}

.batch-bar-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.batch-bar-kicker {
  font-size: 12px;
  line-height: 1;
  color: var(--theme-text-secondary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.batch-bar strong {
  color: var(--theme-accent);
}

.batch-bar-actions :deep(.arco-btn) {
  min-width: 92px;
  border-radius: 12px;
}

.batch-bar::after {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: none;
}

@media (max-width: 900px) {
  .batch-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .batch-bar-actions {
    width: 100%;
  }
}
</style>
