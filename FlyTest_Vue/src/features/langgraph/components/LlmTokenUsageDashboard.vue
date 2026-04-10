<template>
  <div class="llm-usage-dashboard">
    <div class="dashboard-header">
      <div class="dashboard-filters">
        <a-radio-group :model-value="preset" type="button" @change="value => emit('update:preset', String(value))">
          <a-radio value="today">今天</a-radio>
          <a-radio value="7d">近7天</a-radio>
          <a-radio value="30d">近30天</a-radio>
          <a-radio value="custom">自定义</a-radio>
        </a-radio-group>
        <a-select
          :model-value="source"
          :options="sourceOptions"
          allow-clear
          placeholder="全部来源"
          style="width: 180px"
          @change="value => emit('update:source', value ? String(value) : '')"
        />
        <div class="dashboard-date-range">
          <input :value="startDate" class="dashboard-date-input" type="date" @input="emitDateRange(($event.target as HTMLInputElement).value, endDate)" />
          <span class="dashboard-date-separator">-</span>
          <input :value="endDate" class="dashboard-date-input" type="date" @input="emitDateRange(startDate, ($event.target as HTMLInputElement).value)" />
        </div>
        <a-button :loading="loading" @click="emit('refresh')">刷新</a-button>
      </div>
    </div>

    <a-spin :loading="loading" class="dashboard-spin" tip="正在汇总 Token 消耗...">
      <template v-if="stats">
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-card__label">总消耗 Token</div>
            <div class="summary-card__value">{{ formatNumber(stats.total.total_tokens) }}</div>
            <div class="summary-card__meta">{{ periodLabel }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-card__label">输入 Token</div>
            <div class="summary-card__value">{{ formatNumber(stats.total.input_tokens) }}</div>
            <div class="summary-card__meta">输出 {{ formatNumber(stats.total.output_tokens) }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-card__label">调用请求数</div>
            <div class="summary-card__value">{{ formatNumber(stats.total.request_count) }}</div>
            <div class="summary-card__meta">覆盖 {{ formatNumber(stats.total.model_count) }} 个模型</div>
          </div>
          <div class="summary-card">
            <div class="summary-card__label">涉及用户数</div>
            <div class="summary-card__value">{{ formatNumber(stats.total.user_count) }}</div>
            <div class="summary-card__meta">{{ stats.permissions?.can_view_all_users ? '管理员视角' : '个人视角' }}</div>
          </div>
        </div>

        <div class="panel-grid">
          <div class="dashboard-panel">
            <div class="dashboard-panel__title">按时间趋势</div>
            <div v-if="stats.by_time?.length" class="trend-list">
              <div v-for="item in stats.by_time || []" :key="item.period || 'unknown'" class="trend-item">
                <div class="trend-item__head">
                  <span>{{ item.period || '-' }}</span>
                  <strong>{{ formatNumber(item.total_tokens) }}</strong>
                </div>
                <a-progress
                  :percent="computePercent(item.total_tokens, maxTimeTokens)"
                  :show-text="false"
                  size="mini"
                  color="#165dff"
                />
              </div>
            </div>
            <a-empty v-else description="当前日期范围内暂无 Token 记录" />
          </div>

          <div class="dashboard-panel">
            <div class="dashboard-panel__title">大模型消耗排名</div>
            <div v-if="stats.by_model?.length" class="ranking-list">
              <div v-for="item in topModels" :key="`${item.provider}-${item.model_name}-${item.rank}`" class="ranking-item">
                <div class="ranking-item__head">
                  <div>
                    <div class="ranking-item__title">#{{ item.rank }} {{ item.model_name }}</div>
                    <div class="ranking-item__meta">{{ item.provider || '未知供应商' }} · {{ item.config_name || '未命名配置' }}</div>
                  </div>
                  <strong>{{ formatNumber(item.total_tokens) }}</strong>
                </div>
                <a-progress
                  :percent="computePercent(item.total_tokens, maxModelTokens)"
                  :show-text="false"
                  size="mini"
                  color="#0f766e"
                />
              </div>
            </div>
            <a-empty v-else description="暂无模型 Token 消耗记录" />
          </div>
        </div>

        <div class="panel-grid">
          <div class="dashboard-panel">
            <div class="dashboard-panel__title">按用户名展示</div>
            <a-table
              :data="stats.by_user || []"
              :pagination="false"
              row-key="rank"
              size="small"
              :scroll="{ x: 640 }"
            >
              <template #columns>
                <a-table-column title="排名" data-index="rank" :width="70" />
                <a-table-column title="用户名" data-index="username" :width="160" />
                <a-table-column title="总 Token" :width="140">
                  <template #cell="{ record }">{{ formatNumber(record.total_tokens) }}</template>
                </a-table-column>
                <a-table-column title="输入 Token" :width="120">
                  <template #cell="{ record }">{{ formatNumber(record.input_tokens) }}</template>
                </a-table-column>
                <a-table-column title="输出 Token" :width="120">
                  <template #cell="{ record }">{{ formatNumber(record.output_tokens) }}</template>
                </a-table-column>
                <a-table-column title="请求数" :width="100">
                  <template #cell="{ record }">{{ formatNumber(record.request_count) }}</template>
                </a-table-column>
                <a-table-column title="模型数" :width="100">
                  <template #cell="{ record }">{{ formatNumber(record.model_count) }}</template>
                </a-table-column>
              </template>
            </a-table>
          </div>
        </div>
      </template>
      <a-empty v-else description="暂无 Token 统计数据" />
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Button as AButton,
  Empty as AEmpty,
  Progress as AProgress,
  RadioGroup as ARadioGroup,
  Radio as ARadio,
  Select as ASelect,
  Spin as ASpin,
  Table as ATable,
  TableColumn as ATableColumn,
} from '@arco-design/web-vue';
import type { TokenUsageStats } from '@/features/langgraph/types/llmConfig';

interface Props {
  stats: TokenUsageStats | null;
  loading: boolean;
  preset: string;
  source: string;
  startDate: string;
  endDate: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:preset', value: string): void;
  (e: 'update:source', value: string): void;
  (e: 'update:date-range', payload: { startDate: string; endDate: string }): void;
  (e: 'refresh'): void;
}>();

const sourceOptions = [
  { label: '全部来源', value: '' },
  { label: 'AI 对话', value: 'langgraph_chat' },
  { label: 'AI 接口自动化', value: 'api_automation' },
  { label: '需求评审', value: 'requirements_review' },
  { label: 'UI 自动化', value: 'ui_automation' },
  { label: '其他', value: 'other' },
];

const emitDateRange = (startDate: string, endDate: string) => {
  emit('update:date-range', { startDate, endDate });
};

const formatNumber = (value: number | null | undefined) => new Intl.NumberFormat('zh-CN').format(Number(value || 0));

const periodLabel = computed(() => {
  if (!props.stats) return '';
  return `${props.stats.period.start_date} 至 ${props.stats.period.end_date}`;
});

const maxTimeTokens = computed(() => Math.max(...(props.stats?.by_time.map(item => item.total_tokens) || [0]), 1));
const maxModelTokens = computed(() => Math.max(...(props.stats?.by_model.map(item => item.total_tokens) || [0]), 1));
const topModels = computed(() => (props.stats?.by_model || []).slice(0, 10));

const computePercent = (value: number, maxValue: number) => {
  if (!maxValue) return 0;
  return Math.max(2, Math.min(100, Number(((value / maxValue) * 100).toFixed(2))));
};
</script>

<style scoped>
.llm-usage-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.dashboard-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.dashboard-date-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dashboard-date-input {
  min-width: 148px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--color-neutral-3);
  border-radius: 6px;
}

.dashboard-date-separator {
  color: #64748b;
  font-size: 12px;
}

.dashboard-spin {
  width: 100%;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.summary-card,
.dashboard-panel {
  padding: 18px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.summary-card__label {
  font-size: 12px;
  color: #64748b;
}

.summary-card__value {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
}

.summary-card__meta {
  margin-top: 8px;
  font-size: 12px;
  color: #94a3b8;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.dashboard-panel__title {
  margin-bottom: 14px;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.trend-list,
.ranking-list {
  display: grid;
  gap: 12px;
}

.trend-item__head,
.ranking-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.ranking-item__title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.ranking-item__meta {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

@media (max-width: 1200px) {
  .summary-grid,
  .panel-grid {
    grid-template-columns: 1fr;
  }
}
</style>
