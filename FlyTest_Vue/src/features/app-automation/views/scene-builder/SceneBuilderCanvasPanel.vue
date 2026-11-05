<template>
  <section class="canvas-panel scene-flow-canvas" aria-label="场景流程画布">
    <div class="scene-flow-toolbar"><span>{{ steps.length }} 个步骤 · 拖动手柄调整顺序</span><a-button size="mini" status="danger" :disabled="!steps.length" @click="emit('clear-steps')">清空</a-button></div>
    <div class="scene-flow-viewport" ref="viewport">
    <div class="scene-flow-content" :style="{zoom: zoom / 100}">
    <div class="scene-flow-terminal"><span>▶</span> 开始</div>
    <div v-if="steps.length" class="step-list">
      <draggable
        :model-value="steps"
        item-key="id"
        handle=".drag-handle"
        class="draggable-root"
        :animation="180"
        @update:model-value="updateSteps"
      >
        <template #item="{ element, index }">
          <div class="step-item-wrapper" :class="{'flow-container': isContainerStep(element)}">
            <div
              class="step-item"
              :class="{ active: selectedStepIndex === index && selectedSubStepIndex === null }"
              role="button" tabindex="0" :aria-label="'编辑步骤 ' + (element.name || resolveStepTitle(element))" :aria-pressed="selectedStepIndex === index && selectedSubStepIndex === null"
              @keydown.enter.self.prevent="emit('select-step', index)" @keydown.space.self.prevent="emit('select-step', index)"
              @click="emit('select-step', index)"
            >
              <div class="step-main">
                <span class="drag-handle">⋮⋮</span>
                <span class="step-index"><SceneBuilderStepIcon :type="element.component_type || element.type || element.action" /></span>
                <div class="step-copy">
                  <strong>{{ element.name || resolveStepTitle(element) }}</strong>
                  <span>{{ resolveStepMeta(element) }}</span>
                </div>
                <a-tag v-if="isCustomStep(element)" size="small">自定义组件</a-tag>
                <a-tag v-else-if="isFlowContainerStep(element)" size="small">流程容器</a-tag>
              </div>
              <a-space>
                <a-button v-if="isContainerStep(element)" size="mini" type="text" @click.stop="emit('toggle-expand', index)">
                  {{ element._expanded ? '收起' : '展开' }}
                </a-button>
                <a-button size="mini" type="text" @click.stop="emit('duplicate-step', index)">复制</a-button>
                <a-button size="mini" type="text" status="danger" @click.stop="emit('remove-step', index)">
                  删除
                </a-button>
              </a-space>
            </div>

            <div v-if="isContainerStep(element) && element._expanded" class="sub-step-shell">
              <div
                v-for="group in getStepChildGroups(element)"
                :key="`${getNodeKey(element)}-${group.key}`"
                class="sub-step-group"
              >
                <div class="sub-step-group-header">
                  <div class="sub-step-group-copy">
                    <strong>{{ group.label }}</strong>
                    <span>{{ getStepGroupSteps(element, group.key).length }} 个子步骤</span>
                  </div>
                  <div class="sub-step-toolbar">
                    <a-select
                      :model-value="subStepSelections[getSubStepSelectionKey(element, group.key)]"
                      allow-search
                      placeholder="选择基础组件后添加为子步骤"
                      @change="value => handleSubStepSelectionChange(element, group.key, value)"
                    >
                      <a-option v-for="item in components" :key="item.id" :value="item.type">
                        {{ item.name }}
                      </a-option>
                    </a-select>
                    <a-button size="mini" type="primary" @click.stop="emit('add-sub-step', { index, groupKey: group.key })">
                      添加子步骤
                    </a-button>
                  </div>
                </div>

                <draggable
                  :model-value="getStepGroupSteps(element, group.key)"
                  item-key="id"
                  handle=".drag-handle"
                  class="sub-step-list"
                  :animation="160"
                  @update:model-value="items => emit('update-step-group-items', { step: element, groupKey: group.key, items })"
                >
                  <template #item="{ element: subStep, index: subIndex }">
                    <div
                      class="sub-step-item"
                      :class="{
                        active:
                          selectedStepIndex === index &&
                          selectedSubStepGroupKey === group.key &&
                          selectedSubStepIndex === subIndex,
                      }"
                      role="button" tabindex="0" :aria-label="'编辑子步骤 ' + (subStep.name || resolveStepTitle(subStep))"
                      @keydown.enter.self.prevent="emit('select-sub-step', { index, groupKey: group.key, subIndex })"
                      @keydown.space.self.prevent="emit('select-sub-step', { index, groupKey: group.key, subIndex })"
                      @click.stop="emit('select-sub-step', { index, groupKey: group.key, subIndex })"
                    >
                      <div class="step-main">
                        <span class="drag-handle">⋮⋮</span>
                        <span class="step-index sub-index">{{ index + 1 }}.{{ subIndex + 1 }}</span>
                        <div class="step-copy">
                          <strong>{{ subStep.name || resolveStepTitle(subStep) }}</strong>
                          <span>{{ resolveStepMeta(subStep) }}</span>
                        </div>
                        <a-tag v-if="isFlowContainerStep(subStep)" size="small">流程</a-tag>
                      </div>
                      <a-space>
                        <a-button
                          size="mini"
                          type="text"
                          @click.stop="emit('duplicate-sub-step', { index, groupKey: group.key, subIndex })"
                        >
                          复制
                        </a-button>
                        <a-button
                          size="mini"
                          type="text"
                          status="danger"
                          @click.stop="emit('remove-sub-step', { index, groupKey: group.key, subIndex })"
                        >
                          删除
                        </a-button>
                      </a-space>
                    </div>
                  </template>
                </draggable>

                <a-empty v-if="!getStepGroupSteps(element, group.key).length" description="当前分支还没有子步骤" />
              </div>
            </div>
          </div>
        </template>
      </draggable>
    </div>
    <a-empty v-else description="从右侧添加步骤，开始编排你的第一个场景" />
    <div v-if="steps.length" class="scene-flow-terminal end">■ 结束</div>
    </div>
    </div>
    <div class="scene-flow-zoom" aria-label="画布缩放">
      <button aria-label="放大画布" :disabled="zoom >= 150" @click="zoom = Math.min(150, zoom + 10)">+</button>
      <span>{{ zoom }}%</span>
      <button aria-label="缩小画布" :disabled="zoom <= 50" @click="zoom = Math.max(50, zoom - 10)">−</button>
      <button aria-label="重置画布" @click="resetView">⊡</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import SceneBuilderStepIcon from './SceneBuilderStepIcon.vue'
import type { AppComponent, AppSceneStep } from '../../types'
import {
  getNodeKey,
  getStepChildGroups,
  getStepGroupSteps,
  getSubStepSelectionKey,
  isCustomStep,
  isFlowContainerStep,
  type StepChildGroupKey,
} from './sceneBuilderDraft'

interface Props {
  steps: AppSceneStep[]
  selectedStepIndex: number | null
  selectedSubStepIndex: number | null
  selectedSubStepGroupKey: StepChildGroupKey | null
  subStepSelections: Record<string, string | undefined>
  components: AppComponent[]
  resolveStepTitle: (step?: Partial<AppSceneStep>) => string
  resolveStepMeta: (step?: Partial<AppSceneStep>) => string
}

interface IndexedSubStepPayload {
  index: number
  groupKey: StepChildGroupKey
  subIndex: number
}

interface UpdateStepGroupItemsPayload {
  step: AppSceneStep
  groupKey: StepChildGroupKey
  items: AppSceneStep[]
}

interface UpdateSubStepSelectionPayload {
  key: string
  value?: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:steps': [items: AppSceneStep[]]
  'select-step': [index: number]
  'toggle-expand': [index: number]
  'duplicate-step': [index: number]
  'remove-step': [index: number]
  'clear-steps': []
  'select-sub-step': [payload: IndexedSubStepPayload]
  'update-sub-step-selection': [payload: UpdateSubStepSelectionPayload]
  'add-sub-step': [payload: { index: number; groupKey: StepChildGroupKey }]
  'duplicate-sub-step': [payload: IndexedSubStepPayload]
  'remove-sub-step': [payload: IndexedSubStepPayload]
  'update-step-group-items': [payload: UpdateStepGroupItemsPayload]
}>()

const zoom = ref(100)
const viewport = ref<HTMLElement>()
const resetView = () => { zoom.value = 100; viewport.value?.scrollTo({top: 0, left: 0, behavior: 'auto'}) }

const draggable = defineAsyncComponent(() => import('vuedraggable'))

const isContainerStep = (step?: Partial<AppSceneStep> | null) => Boolean(step && (isCustomStep(step) || isFlowContainerStep(step)))

const updateSteps = (items: unknown) => {
  emit('update:steps', Array.isArray(items) ? (items as AppSceneStep[]) : [])
}

const handleSubStepSelectionChange = (step: AppSceneStep, groupKey: StepChildGroupKey, value: unknown) => {
  emit('update-sub-step-selection', {
    key: getSubStepSelectionKey(step, groupKey),
    value: value ? String(value) : undefined,
  })
}
</script>

<style scoped>
.scene-flow-canvas {position:relative;min-height:580px;background:radial-gradient(circle,var(--theme-border) .7px,transparent .8px) 0 0/14px 14px;border:0;border-radius:0;box-shadow:none;overflow:hidden}
.scene-flow-toolbar {display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:var(--theme-surface);border-bottom:1px solid var(--theme-border);font-size:11px;color:var(--theme-text-secondary)}
.scene-flow-viewport {height:620px;overflow:auto;padding:18px 24px 50px;scrollbar-gutter:stable}.scene-flow-content {min-width:280px;display:flex;flex-direction:column;align-items:center;padding-bottom:16px}.scene-flow-terminal {position:relative;display:flex;gap:8px;align-items:center;justify-content:center;width:146px;min-height:30px;border:1px solid #b3e5c1;border-radius:24px;background:#e8faed;color:#15803d;font-size:12px;font-weight:600;margin:0 auto 24px}.scene-flow-terminal.end {margin:24px auto 0;background:var(--theme-surface);color:var(--theme-text-secondary);border-color:var(--theme-border)}
.scene-flow-terminal:not(.end):after,.step-item-wrapper:after {content:'↓';position:absolute;bottom:-24px;left:50%;height:24px;line-height:24px;color:#587080;font-size:17px;transform:translateX(-50%)}.step-item-wrapper:last-child:after {bottom:-24px}
.step-list {width:100%}.draggable-root {display:flex;flex-direction:column;gap:24px;align-items:center}.step-item-wrapper {position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:14px}.step-item {position:relative;display:flex;flex-direction:column;width:min(100%,290px);border:1px solid var(--theme-border);border-radius:11px;background:var(--theme-surface);box-shadow:0 2px 4px #233b5510;padding:9px 12px;cursor:pointer;outline-offset:3px}.step-item.active,.sub-step-item.active {border-color:#00a392;box-shadow:0 0 0 2px #00a39216}.step-main {display:flex;align-items:center;gap:9px;min-width:0;width:100%}.drag-handle {cursor:grab;color:#a5b4c4;font-size:15px;user-select:none}.step-index {width:24px;height:26px;display:grid;place-items:center;border-radius:7px;color:#7c5ce2;background:#f2edff;font-size:12px;flex-shrink:0}.step-copy {min-width:0;display:flex;flex-direction:column;gap:3px}.step-copy strong {font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.step-copy>span {font-size:10px;color:var(--theme-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.step-item>.arco-space {margin-top:6px;justify-content:flex-end;width:100%}.step-item .arco-btn {height:20px;font-size:10px;padding:0 5px}.step-item .arco-tag {font-size:10px;margin-left:auto;flex-shrink:0}.flow-container>.step-item {border-color:#d9cef5;background:var(--theme-surface)}
.sub-step-shell {display:flex;align-items:stretch;justify-content:center;gap:12px;width:100%;padding:12px 0 0;border-top:1px solid #c8bbeb}.sub-step-group {min-width:180px;flex:1;border:1px solid var(--theme-border);border-radius:10px;background:var(--theme-surface);padding:10px;max-width:340px}.sub-step-group-header {display:flex;flex-direction:column;gap:8px;margin-bottom:10px}.sub-step-group-copy {display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#7c5ce2}.sub-step-group-copy span {font-size:10px;color:var(--theme-text-secondary)}.sub-step-toolbar {display:flex;flex-wrap:wrap;gap:6px}.sub-step-toolbar .arco-select {width:100%;font-size:11px}.sub-step-list {display:flex;flex-direction:column;gap:14px}.sub-step-item {position:relative;display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--theme-border);background:var(--theme-surface);border-radius:7px;cursor:pointer}.sub-step-item:not(:last-child):after {content:'↓';position:absolute;left:50%;bottom:-15px;color:#9baaba;font-size:12px}.sub-step-item .arco-space {justify-content:flex-end}.sub-step-item .arco-btn {height:20px;padding:0 4px;font-size:10px}.sub-step-item .step-index {width:28px;font-size:10px}.sub-step-group .arco-empty {padding:12px 0;font-size:11px}
.scene-flow-zoom {position:absolute;bottom:14px;left:14px;display:flex;align-items:center;background:var(--theme-surface);border:1px solid var(--theme-border);border-radius:8px;box-shadow:0 2px 6px #142b4710;padding:2px}.scene-flow-zoom button {width:30px;height:30px;background:none;border:0;cursor:pointer;color:var(--theme-text);font-size:20px;border-radius:5px}.scene-flow-zoom button:hover {background:#e5f5f1}.scene-flow-zoom button:disabled {opacity:.35;cursor:default}.scene-flow-zoom span {font-size:10px;color:var(--theme-text-secondary);min-width:32px;text-align:center}
@media(max-width:650px) {.scene-flow-viewport {height:490px;padding:18px 12px 50px}.scene-flow-canvas {min-height:0}.sub-step-shell {justify-content:flex-start}.scene-flow-toolbar {font-size:10px}.step-item {width:260px;max-width:100%}}

@media(hover:hover) and (pointer:fine) {.step-item>.arco-space {position:absolute;bottom:-21px;right:0;z-index:2;margin:0;width:auto;background:var(--theme-surface);border:1px solid var(--theme-border);border-radius:5px;opacity:0;pointer-events:none}.step-item:hover>.arco-space,.step-item:focus-within>.arco-space {opacity:1;pointer-events:auto}.step-item {min-height:49px;justify-content:center}}
.sub-step-shell {position:relative;border-bottom:1px solid #c8bbeb;padding-bottom:12px}.sub-step-shell:before {content:'';position:absolute;left:50%;height:14px;width:1px;top:-14px;background:#c8bbeb}
</style>
