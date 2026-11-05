<template>
  <details class="fc-status-disclosure">
    <summary>
      <span>AI 辅助配置</span>
      <a-tag :color="aiStatusCard.aiStatusColor" size="small">{{ aiStatusCard.aiStatusLabel }}</a-tag>
      <span class="fc-status-disclosure__hint">查看模型、运行能力与最近活动</span>
    </summary>
    <SceneBuilderAiStatusCard
    :ai-status-title="aiStatusCard.aiStatusTitle"
    :ai-status-description="aiStatusCard.aiStatusDescription"
    :ai-status-color="aiStatusCard.aiStatusColor"
    :ai-status-label="aiStatusCard.aiStatusLabel"
    :ai-status-has-config="aiStatusCard.aiStatusHasConfig"
    :ai-status-supports-vision="aiStatusCard.aiStatusSupportsVision"
    :ai-status-loading="aiStatusCard.aiStatusLoading"
    :ai-capability-label="aiStatusCard.aiCapabilityLabel"
    :ai-status-checked-at="aiStatusCard.aiStatusCheckedAt"
    :ai-config-display-name="aiStatusCard.aiConfigDisplayName"
    :ai-provider-display-name="aiStatusCard.aiProviderDisplayName"
    :ai-model-display-name="aiStatusCard.aiModelDisplayName"
    :ai-endpoint-display="aiStatusCard.aiEndpointDisplay"
    :last-ai-activity="aiStatusCard.lastAiActivity"
    :format-date-time="aiStatusCard.formatDateTime"
    :format-provider-label="aiStatusCard.formatProviderLabel"
    :get-ai-action-label="aiStatusCard.getAiActionLabel"
    :get-ai-activity-color="aiStatusCard.getAiActivityColor"
    :get-ai-activity-status-label="aiStatusCard.getAiActivityStatusLabel"
    @refresh-ai-status="emit('refresh-ai-status')"
    @open-llm-config="emit('open-llm-config')"
    />
  </details>

  <SceneBuilderDraftFormCard
    :selected-case-id="selectedCaseId"
    :draft="draftForm.draft"
    :packages="draftForm.packages"
    :test-cases="draftForm.testCases"
    :variable-items="draftForm.variableItems"
    @update:selected-case-id="emit('update:selected-case-id', $event)"
    @case-change="emit('case-change', $event)"
    @add-variable="emit('add-variable')"
    @remove-variable="emit('remove-variable', $event)"
  />
</template>

<script setup lang="ts">
import SceneBuilderAiStatusCard from './SceneBuilderAiStatusCard.vue'
import SceneBuilderDraftFormCard from './SceneBuilderDraftFormCard.vue'
import type { SceneBuilderTopSectionEmits } from './sceneBuilderEventModels'
import type {
  SceneBuilderAiStatusSectionProps,
  SceneBuilderDraftSectionProps,
  SceneBuilderHeaderSectionProps,
} from './sceneBuilderViewModels'

interface Props {
  header: SceneBuilderHeaderSectionProps
  aiStatusCard: SceneBuilderAiStatusSectionProps
  draftForm: SceneBuilderDraftSectionProps
  selectedCaseId?: number
}

defineProps<Props>()

const emit = defineEmits<SceneBuilderTopSectionEmits>()
</script>
