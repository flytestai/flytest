<template>
  <a-modal
    :visible="visible"
    title="模块拆分配置"
    :width="600"
    @ok="handleConfirm"
    @cancel="handleCancel"
  >
    <div class="split-options">
      <!-- 拆分级别选择 -->
      <div class="option-group">
        <h4>拆分级别</h4>
        <template v-if="supportsHeadingSplit">
          <a-radio-group v-model="splitConfig.split_level" class="level-radio-group">
            <a-radio value="h1">H1</a-radio>
            <a-radio value="h2">H2</a-radio>
            <a-radio value="h3">H3</a-radio>
            <a-radio value="h4">H4</a-radio>
            <a-radio value="h5">H5</a-radio>
            <a-radio value="h6">H6</a-radio>
            <a-radio value="auto">字数拆分</a-radio>
          </a-radio-group>
          <div class="level-desc">{{ levelDescription }}</div>
        </template>
        <template v-else>
          <a-radio-group v-model="splitConfig.split_level">
            <a-radio value="auto">字数拆分</a-radio>
          </a-radio-group>
          <div class="level-desc">按字数拆分 - 适合没有明确标题结构的文档</div>
          <div class="doc-type-hint">
            <a-alert type="info" :show-icon="false">
              {{ documentType?.toUpperCase() }} 格式文档建议使用字数拆分
            </a-alert>
          </div>
        </template>
      </div>

      <!-- 其他配置选项 -->
      <div v-if="supportsHeadingSplit" class="option-group">
        <h4>拆分配置</h4>
        <a-checkbox v-model="splitConfig.include_context">
          包含上下文（包含上级标题作为上下文）
        </a-checkbox>
      </div>

      <!-- 字数拆分的分块大小 -->
      <div v-if="splitConfig.split_level === 'auto'" class="option-group">
        <h4>分块大小</h4>
        <a-input-number
          v-model="splitConfig.chunk_size"
          :min="500"
          :max="5000"
          :step="100"
          style="width: 200px"
        />
        <div class="input-desc">字符数，建议1500-3000之间</div>
      </div>

      <!-- 文档结构分析结果 -->
      <div v-if="structureAnalysis && supportsHeadingSplit" class="option-group">
        <h4>文档结构分析</h4>
        <div class="structure-info">
          <div class="structure-item">
            <span class="structure-label">H1标题：</span>
            <span class="structure-count">{{ structureAnalysis.structure_analysis.h1_titles.length }}个</span>
          </div>
          <div class="structure-item">
            <span class="structure-label">H2标题：</span>
            <span class="structure-count">{{ structureAnalysis.structure_analysis.h2_titles.length }}个</span>
          </div>
          <div class="structure-item">
            <span class="structure-label">H3标题：</span>
            <span class="structure-count">{{ structureAnalysis.structure_analysis.h3_titles.length }}个</span>
          </div>
          <div class="structure-item">
            <span class="structure-label">H4标题：</span>
            <span class="structure-count">{{ structureAnalysis.structure_analysis.h4_titles?.length || 0 }}个</span>
          </div>
          <div class="structure-item">
            <span class="structure-label">H5标题：</span>
            <span class="structure-count">{{ structureAnalysis.structure_analysis.h5_titles?.length || 0 }}个</span>
          </div>
          <div class="structure-item">
            <span class="structure-label">H6标题：</span>
            <span class="structure-count">{{ structureAnalysis.structure_analysis.h6_titles?.length || 0 }}个</span>
          </div>
        </div>

        <!-- 拆分建议 -->
        <div v-if="structureAnalysis.split_recommendations?.length" class="recommendations">
          <h5>💡 拆分建议：</h5>
          <div
            v-for="rec in structureAnalysis.split_recommendations"
            :key="rec.level"
            class="recommendation-item"
            :class="{ recommended: rec.recommended }"
          >
            <div class="rec-header">
              <strong>{{ rec.level.toUpperCase() }}级别</strong>
              <span v-if="rec.recommended" class="rec-badge">推荐</span>
              <span class="rec-count">{{ rec.modules_count }}个模块</span>
            </div>
            <div class="rec-desc">{{ rec.description }} - {{ rec.suitable_for }}</div>
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { reactive, watch, computed } from 'vue';
import type { SplitModulesRequest, DocumentStructureResponse, DocumentType } from '../types';

interface Props {
  visible: boolean;
  structureAnalysis?: DocumentStructureResponse | null;
  defaultLevel?: string;
  documentType?: DocumentType;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', config: SplitModulesRequest): void;
  (e: 'cancel'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const splitConfig = reactive<SplitModulesRequest>({
  split_level: 'h2',
  include_context: true,
  chunk_size: 2000
});

// 支持标题拆分的文档类型
const supportsHeadingSplit = computed(() => {
  const headingTypes: DocumentType[] = ['md', 'doc', 'docx'];
  return !props.documentType || headingTypes.includes(props.documentType);
});

// 推荐的拆分级别
const recommendedLevel = computed(() => {
  if (!props.documentType) return 'h2';

  switch (props.documentType) {
    case 'md':
    case 'docx':
      return 'h2';
    case 'doc':
      return 'h2'; // 有LibreOffice支持
    case 'txt':
    case 'pdf':
      return 'auto';
    default:
      return 'h2';
  }
});

// 当前选中级别的描述
const levelDescription = computed(() => {
  const level = splitConfig.split_level;
  const descriptions: Record<string, string> = {
    h1: '按一级标题拆分 - 生成较大的模块',
    h2: '按二级标题拆分 - 适合大多数文档',
    h3: '按三级标题拆分 - 生成较细的模块',
    h4: '按四级标题拆分 - 适合层级较深的文档',
    h5: '按五级标题拆分 - 生成更细粒度的模块',
    h6: '按六级标题拆分 - 最细粒度的拆分',
    auto: '按字数拆分 - 适合没有明确标题结构的文档'
  };
  return descriptions[level] || '';
});

// 监听文档类型变化，自动设置推荐级别
watch(() => props.documentType, (newType) => {
  if (newType) {
    splitConfig.split_level = recommendedLevel.value as any;
  }
}, { immediate: true });

// 监听默认级别变化
watch(() => props.defaultLevel, (newLevel) => {
  if (newLevel) {
    splitConfig.split_level = newLevel as any;
  }
}, { immediate: true });

const handleConfirm = () => {
  emit('confirm', { ...splitConfig });
  emit('update:visible', false);
};

const handleCancel = () => {
  emit('cancel');
  emit('update:visible', false);
};
</script>

<style scoped>
.split-options {
  padding: 8px 0;
}

.option-group {
  margin-bottom: 24px;
}

.option-group h4 {
  margin: 0 0 12px 0;
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
}

.option-group h5 {
  margin: 12px 0 8px 0;
  color: #4e5969;
  font-size: 13px;
  font-weight: 500;
}

.radio-content {
  margin-left: 8px;
}

.radio-desc {
  color: #86909c;
  font-size: 12px;
  margin-top: 2px;
}

.recommend-tag {
  background: var(--theme-success);
  color: white;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  margin-left: 8px;
}

.doc-type-hint {
  margin-top: 12px;
}

.input-desc {
  color: #86909c;
  font-size: 12px;
  margin-top: 4px;
}

.structure-info {
  background: #f7f8fa;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 12px;
}

.structure-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.structure-label {
  color: #4e5969;
  font-size: 13px;
}

.structure-count {
  color: #1d2129;
  font-weight: 500;
  font-size: 13px;
}

.recommendations {
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  padding: 12px;
}

.recommendation-item {
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  border: 1px solid #e5e6eb;
}

.recommendation-item.recommended {
  border-color: var(--theme-accent);
  background: #f2f7ff;
}

.rec-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.rec-badge {
  background: var(--theme-accent);
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
}

.rec-count {
  color: #86909c;
  font-size: 12px;
}

.rec-desc {
  color: #4e5969;
  font-size: 12px;
}

.level-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.level-desc {
  color: #86909c;
  font-size: 12px;
  margin-top: 8px;
}
</style>
