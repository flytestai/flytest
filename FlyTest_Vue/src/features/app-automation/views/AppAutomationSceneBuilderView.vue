<template>
  <div class="page-shell">
    <div v-if="!projectStore.currentProjectId" class="empty-shell">
      <a-empty description="请先选择项目后再进行 APP 场景编排" />
    </div>
    <template v-else>
      <div class="page-header">
        <div>
          <h3>场景编排</h3>
          <p>支持基础步骤、自定义组件和流程控制分支的可视化编排。</p>
        </div>
        <a-space class="header-actions" wrap>
          <a-button type="outline" :loading="aiGenerating" @click="openAiPlanDialog">AI 生成场景</a-button>
          <a-button :loading="loading" @click="loadData">刷新</a-button>
          <a-button type="outline" @click="openTestCaseWorkspace">测试用例</a-button>
          <a-button type="outline" @click="openExecutionWorkspace()">执行记录</a-button>
          <a-button @click="createDraft">新建草稿</a-button>
          <a-button :disabled="!steps.length" @click="openCreateCustomComponent">另存为自定义组件</a-button>
          <a-button type="primary" :loading="saving" @click="saveDraft">保存用例</a-button>
          <a-button type="primary" status="success" :loading="saving || executing" @click="openExecuteDialog">
            保存并执行
          </a-button>
        </a-space>
      </div>

      <a-card class="form-card ai-status-card">
        <div class="ai-status-header">
          <div class="ai-status-copy">
            <span class="ai-status-kicker">AI 智能模式</span>
            <strong>{{ aiStatusTitle }}</strong>
            <p>{{ aiStatusDescription }}</p>
          </div>
          <a-space wrap class="ai-status-actions">
            <a-tag :color="aiStatusColor">{{ aiStatusLabel }}</a-tag>
            <a-tag v-if="aiStatus.has_config" :color="aiStatus.supports_vision ? 'arcoblue' : 'purple'">
              {{ aiStatus.supports_vision ? '视觉 + 文本' : '文本模式' }}
            </a-tag>
            <a-button size="mini" :loading="aiStatusLoading" @click="refreshAiRuntimeStatus(true)">刷新 AI 状态</a-button>
            <a-button size="mini" type="outline" @click="openLlmConfigManagement">模型配置</a-button>
          </a-space>
        </div>

        <div class="ai-status-grid">
          <div class="ai-status-item">
            <span>当前能力</span>
            <strong>{{ aiCapabilityLabel }}</strong>
            <small>{{ aiStatus.checked_at ? `最近检测：${formatDateTime(aiStatus.checked_at)}` : '尚未检测' }}</small>
          </div>
          <div class="ai-status-item">
            <span>激活配置</span>
            <strong>{{ aiConfigDisplayName }}</strong>
            <small>{{ aiProviderDisplayName }}</small>
          </div>
          <div class="ai-status-item">
            <span>模型名称</span>
            <strong>{{ aiModelDisplayName }}</strong>
            <small>{{ aiEndpointDisplay }}</small>
          </div>
        </div>

        <div v-if="lastAiActivity" class="ai-activity-panel">
          <div class="ai-activity-header">
            <div class="ai-activity-copy">
              <span class="ai-activity-kicker">最近一次 AI 结果</span>
              <strong>{{ getAiActionLabel(lastAiActivity.action) }}</strong>
            </div>
            <a-tag :color="getAiActivityColor(lastAiActivity)">{{ getAiActivityStatusLabel(lastAiActivity) }}</a-tag>
          </div>

          <div class="ai-activity-meta">
            <span>时间：{{ formatDateTime(lastAiActivity.executed_at) }}</span>
            <span v-if="lastAiActivity.target_name">对象：{{ lastAiActivity.target_name }}</span>
            <span v-if="lastAiActivity.model">模型：{{ lastAiActivity.model }}</span>
            <span v-if="lastAiActivity.provider">提供方：{{ formatProviderLabel(lastAiActivity.provider) }}</span>
          </div>

          <div class="ai-activity-summary">{{ lastAiActivity.summary }}</div>
          <div v-if="lastAiActivity.prompt" class="ai-activity-prompt">提示词：{{ lastAiActivity.prompt }}</div>

          <div v-if="lastAiActivity.warnings.length" class="ai-warning-list">
            <div v-for="(warning, index) in lastAiActivity.warnings" :key="`${lastAiActivity.executed_at}-${index}`" class="ai-warning-item">
              {{ warning }}
            </div>
          </div>
        </div>
        <div v-else class="ai-activity-empty">还没有触发 AI 场景生成或步骤补全，执行后会在这里保留结果摘要与回退原因。</div>
      </a-card>

      <a-card class="form-card">
        <a-form :model="draft" layout="vertical">
          <a-row :gutter="12">
            <a-col :span="8">
              <a-form-item field="caseId" label="加载已有用例">
                <a-select
                  v-model="selectedCaseId"
                  allow-clear
                  placeholder="选择已有用例"
                  @change="handleCaseChange"
                >
                  <a-option v-for="item in testCases" :key="item.id" :value="item.id">
                    {{ item.name }}
                  </a-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item field="name" label="用例名称">
                <a-input v-model="draft.name" placeholder="例如：登录并进入首页" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item field="package_id" label="应用包">
                <a-select v-model="draft.package_id" allow-clear placeholder="可选">
                  <a-option v-for="item in packages" :key="item.id" :value="item.id">
                    {{ item.name }}
                  </a-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item field="description" label="描述">
                <a-textarea
                  v-model="draft.description"
                  :auto-size="{ minRows: 3, maxRows: 5 }"
                  placeholder="补充业务说明或前置条件"
                />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item field="timeout" label="超时时间（秒）">
                <a-input-number v-model="draft.timeout" :min="1" :max="7200" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item field="retry_count" label="失败重试">
                <a-input-number v-model="draft.retry_count" :min="0" :max="10" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item label="场景变量">
            <div class="variable-list">
              <div v-if="variableItems.length" class="variable-items">
                <div v-for="(item, index) in variableItems" :key="`variable-${index}`" class="variable-row">
                  <a-input v-model="item.name" placeholder="变量名" />
                  <a-select v-model="item.scope" placeholder="作用域">
                    <a-option value="local">local</a-option>
                    <a-option value="global">global</a-option>
                  </a-select>
                  <a-select v-model="item.type" placeholder="类型">
                    <a-option value="string">string</a-option>
                    <a-option value="number">number</a-option>
                    <a-option value="boolean">boolean</a-option>
                    <a-option value="array">array</a-option>
                    <a-option value="object">object</a-option>
                  </a-select>
                  <a-input v-model="item.valueText" placeholder="默认值" />
                  <a-input v-model="item.description" placeholder="说明" />
                  <a-button status="danger" @click="removeVariable(index)">删除</a-button>
                </div>
              </div>
              <a-empty v-else description="暂未配置场景变量" />
            </div>
            <div class="variable-actions">
              <a-button type="outline" size="small" @click="addVariable">添加变量</a-button>
            </div>
          </a-form-item>
        </a-form>
      </a-card>

      <div class="builder-grid">
        <a-card class="panel-card library-panel">
          <template #title>步骤组件库</template>
          <template #extra>
            <a-space size="small">
              <a-button size="mini" @click="openComponentPackageDialog">导入组件包</a-button>
              <a-button size="mini" type="outline" @click="openComponentPackageExportDialog">导出组件包</a-button>
            </a-space>
          </template>
          <a-input-search
            v-model="componentSearch"
            class="component-search"
            allow-clear
            placeholder="搜索组件名称或类型"
          />
          <a-tabs v-model:active-key="paletteTab" lazy-load>
            <a-tab-pane key="base" title="基础组件">
              <div v-if="filteredComponents.length" class="component-grid">
                <div
                  v-for="item in filteredComponents"
                  :key="item.id"
                  class="component-item"
                  @click="appendBaseComponent(item)"
                >
                  <div class="component-copy">
                    <span class="component-name">{{ item.name }}</span>
                    <span class="component-meta">{{ item.type }}</span>
                  </div>
                  <span class="component-tag">{{ item.category || 'base' }}</span>
                </div>
              </div>
              <a-empty v-else description="没有匹配的基础组件" />
            </a-tab-pane>

            <a-tab-pane key="custom" title="自定义组件">
              <div v-if="filteredCustomComponents.length" class="component-grid">
                <div
                  v-for="item in filteredCustomComponents"
                  :key="item.id"
                  class="component-item component-item-custom"
                  @click="appendCustomComponent(item)"
                >
                  <div class="component-copy">
                    <span class="component-name">{{ item.name }}</span>
                    <span class="component-meta">{{ item.type }} · {{ item.steps?.length || 0 }} 个子步骤</span>
                  </div>
                  <div class="component-actions">
                    <a-button type="text" size="mini" @click.stop="openEditCustomComponent(item)">编辑</a-button>
                    <a-button type="text" size="mini" status="danger" @click.stop="deleteCustomComponent(item)">
                      删除
                    </a-button>
                  </div>
                </div>
              </div>
              <a-empty v-else description="暂无自定义组件" />
            </a-tab-pane>
          </a-tabs>
        </a-card>

        <a-card class="panel-card canvas-panel">
          <template #title>场景步骤</template>
          <template #extra>
            <a-space>
              <span class="step-counter">共 {{ steps.length }} 步</span>
              <a-button size="mini" status="danger" :disabled="!steps.length" @click="clearSteps">清空</a-button>
            </a-space>
          </template>

          <div v-if="steps.length" class="step-list">
            <draggable
              v-model="steps"
              item-key="id"
              handle=".drag-handle"
              class="draggable-root"
              :animation="180"
            >
              <template #item="{ element, index }">
                <div class="step-item-wrapper">
                  <div
                    class="step-item"
                    :class="{ active: selectedStepIndex === index && selectedSubStepIndex === null }"
                    @click="selectStep(index)"
                  >
                    <div class="step-main">
                      <span class="drag-handle">⋮⋮</span>
                      <span class="step-index">{{ index + 1 }}</span>
                      <div class="step-copy">
                        <strong>{{ element.name || resolveStepTitle(element) }}</strong>
                        <span>{{ resolveStepMeta(element) }}</span>
                      </div>
                      <a-tag v-if="isCustomStep(element)" size="small">自定义组件</a-tag>
                      <a-tag v-else-if="isFlowContainerStep(element)" size="small">流程容器</a-tag>
                    </div>
                    <a-space>
                      <a-button
                        v-if="isContainerStep(element)"
                        size="mini"
                        type="text"
                        @click.stop="toggleExpand(index)"
                      >
                        {{ element._expanded ? '收起' : '展开' }}
                      </a-button>
                      <a-button size="mini" type="text" @click.stop="duplicateStep(index)">复制</a-button>
                      <a-button size="mini" type="text" status="danger" @click.stop="removeStep(index)">删除</a-button>
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
                            v-model="subStepSelections[getSubStepSelectionKey(element, group.key)]"
                            allow-search
                            placeholder="选择基础组件后添加为子步骤"
                          >
                            <a-option v-for="item in components" :key="item.id" :value="item.type">
                              {{ item.name }}
                            </a-option>
                          </a-select>
                          <a-button size="mini" type="primary" @click.stop="addSubStep(index, group.key)">
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
                        @update:model-value="updateStepGroupItems(element, group.key, $event)"
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
                            @click.stop="selectSubStep(index, group.key, subIndex)"
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
                                @click.stop="duplicateSubStep(index, group.key, subIndex)"
                              >
                                复制
                              </a-button>
                              <a-button
                                size="mini"
                                type="text"
                                status="danger"
                                @click.stop="removeSubStep(index, group.key, subIndex)"
                              >
                                删除
                              </a-button>
                            </a-space>
                          </div>
                        </template>
                      </draggable>

                      <a-empty
                        v-if="!getStepGroupSteps(element, group.key).length"
                        description="当前分支还没有子步骤"
                      />
                    </div>
                  </div>
                </div>
              </template>
            </draggable>
          </div>
          <a-empty v-else description="从左侧添加步骤，快速搭建 APP 自动化场景" />
        </a-card>

        <a-card class="panel-card config-panel">
          <template #title>步骤配置</template>
          <div v-if="!selectedSceneStep" class="config-empty">请选择一个步骤进行配置</div>

          <div v-else-if="selectedCustomParentSummary" class="config-summary">
            <a-form layout="vertical">
              <a-form-item label="组件名称">
                <a-input v-model="selectedParentStep!.name" />
              </a-form-item>
              <a-form-item label="组件类型">
                <a-input :model-value="selectedParentStep!.component_type || selectedParentStep!.type || 'custom'" disabled />
              </a-form-item>
              <a-form-item label="子步骤数量">
                <a-input :model-value="String(countChildSteps(selectedParentStep))" disabled />
              </a-form-item>
            </a-form>
            <a-alert>
              当前选中的是自定义组件父步骤，请展开后编辑子步骤；这里可以直接修改组件在当前场景中的显示名称。
            </a-alert>
          </div>

          <div v-else class="config-form">
            <a-alert v-if="selectedSceneStep && isFlowContainerStep(selectedSceneStep)" class="config-flow-alert">
              流程容器步骤的 JSON 同时支持维护 `steps`、`else_steps`、`catch_steps`、`finally_steps`。
            </a-alert>

            <a-form layout="vertical">
              <a-form-item label="步骤名称">
                <a-input v-model="selectedSceneStep.name" placeholder="请输入步骤名称" />
              </a-form-item>
              <a-form-item label="步骤类型">
                <a-input :model-value="resolveStepMeta(selectedSceneStep)" disabled />
              </a-form-item>
              <div class="config-toolbar">
                <a-button
                  type="outline"
                  size="small"
                  :disabled="!selectedSceneStep || !!selectedCustomParentSummary"
                  :loading="aiStepSuggesting"
                  @click="openAiStepDialog"
                >
                  AI 补全当前步骤
                </a-button>
              </div>

              <a-alert
                v-if="
                  usesBasicSelectorQuickConfig(selectedStepActionType) ||
                  usesSwipeToQuickConfig(selectedStepActionType) ||
                  usesSwipeQuickConfig(selectedStepActionType) ||
                  usesDragQuickConfig(selectedStepActionType) ||
                  usesVariableMutationQuickConfig(selectedStepActionType) ||
                  usesExtractOutputQuickConfig(selectedStepActionType) ||
                  usesApiRequestQuickConfig(selectedStepActionType) ||
                  usesDeviceActionQuickConfig(selectedStepActionType) ||
                  usesImageBranchQuickConfig(selectedStepActionType) ||
                  usesAssertQuickConfig(selectedStepActionType) ||
                  usesForeachAssertQuickConfig(selectedStepActionType)
                "
                class="config-helper-alert"
              >
                常用图片、OCR 和断言参数可以直接在下方快捷配置；更复杂的字段仍然可以继续在 JSON 中补充。
              </a-alert>

              <div v-if="usesBasicSelectorQuickConfig(selectedStepActionType)" class="quick-config-panel">
                <div class="quick-config-title">基础动作配置</div>
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="选择器类型">
                      <a-select
                        :model-value="selectedPrimarySelectorType"
                        @change="value => updateSelectedStepConfig('selector_type', value || 'element')"
                      >
                        <a-option v-for="item in SELECTOR_TYPE_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="16">
                    <a-form-item label="选择器内容">
                      <a-input
                        :model-value="readSelectedConfigString('selector')"
                        placeholder="元素名称、文本、XPath、图片路径或区域坐标"
                        @input="value => updateSelectedStepConfig('selector', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row v-if="selectedPrimarySelectorType === 'image'" :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="图片阈值">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('threshold', 0.7)"
                        :min="0.1"
                        :max="1"
                        :step="0.05"
                        @change="value => updateSelectedStepConfig('threshold', value ?? 0.7)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="全屏找图">
                      <a-switch
                        :model-value="readSelectedConfigBoolean('search_full_screen', true)"
                        @change="value => updateSelectedStepConfig('search_full_screen', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col v-if="selectedStepActionType === 'text'" :span="24">
                    <a-form-item label="输入内容">
                      <a-input
                        :model-value="readSelectedConfigString('text')"
                        placeholder="输入文本，支持变量表达式"
                        @input="value => updateSelectedStepConfig('text', value)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col v-if="selectedStepActionType === 'wait' || selectedStepActionType === 'assert_exists'" :span="8">
                    <a-form-item label="等待超时（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('timeout', 10)"
                        :min="0"
                        :max="300"
                        :step="0.5"
                        @change="value => updateSelectedStepConfig('timeout', value ?? 10)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col v-if="selectedStepActionType === 'double_click'" :span="8">
                    <a-form-item label="双击间隔（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('interval', 0.12)"
                        :min="0"
                        :max="5"
                        :step="0.05"
                        @change="value => updateSelectedStepConfig('interval', value ?? 0.12)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col v-if="selectedStepActionType === 'long_press'" :span="8">
                    <a-form-item label="长按时长（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('duration', 1)"
                        :min="0.1"
                        :max="20"
                        :step="0.1"
                        @change="value => updateSelectedStepConfig('duration', value ?? 1)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>

              <div v-if="usesSwipeToQuickConfig(selectedStepActionType)" class="quick-config-panel">
                <div class="quick-config-title">滑动查找配置</div>
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="目标选择器类型">
                      <a-select
                        :model-value="selectedTargetSelectorType"
                        @change="value => updateSelectedStepConfig('target_selector_type', value || 'text')"
                      >
                        <a-option v-for="item in SELECTOR_TYPE_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="16">
                    <a-form-item label="目标选择器">
                      <a-input
                        :model-value="readSelectedConfigString('target_selector')"
                        placeholder="目标元素、文本或图片路径"
                        @input="value => updateSelectedStepConfig('target_selector', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="6">
                    <a-form-item label="滑动方向">
                      <a-select
                        :model-value="readSelectedConfigString('direction', 'up')"
                        @change="value => updateSelectedStepConfig('direction', value || 'up')"
                      >
                        <a-option v-for="item in SWIPE_DIRECTION_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="6">
                    <a-form-item label="最大滑动次数">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('max_swipes', 5)"
                        :min="1"
                        :max="100"
                        @change="value => updateSelectedStepConfig('max_swipes', value ?? 5)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="6">
                    <a-form-item label="每次间隔（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('interval', 0.5)"
                        :min="0"
                        :max="10"
                        :step="0.1"
                        @change="value => updateSelectedStepConfig('interval', value ?? 0.5)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="6">
                    <a-form-item label="滑动时长（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('duration', 0.4)"
                        :min="0.1"
                        :max="10"
                        :step="0.1"
                        @change="value => updateSelectedStepConfig('duration', value ?? 0.4)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="起点坐标（可选）">
                      <a-input
                        :model-value="readSelectedConfigString('start')"
                        placeholder="例如：540,1600"
                        @input="value => updateSelectedStepConfig('start', value || undefined)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="终点坐标（可选）">
                      <a-input
                        :model-value="readSelectedConfigString('end')"
                        placeholder="例如：540,600"
                        @input="value => updateSelectedStepConfig('end', value || undefined)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row v-if="selectedTargetSelectorType === 'image'" :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="目标阈值">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('target_threshold', 0.7)"
                        :min="0.1"
                        :max="1"
                        :step="0.05"
                        @change="value => updateSelectedStepConfig('target_threshold', value ?? 0.7)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="目标全屏找图">
                      <a-switch
                        :model-value="readSelectedConfigBoolean('target_search_full_screen', true)"
                        @change="value => updateSelectedStepConfig('target_search_full_screen', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>

              <div v-if="usesSwipeQuickConfig(selectedStepActionType)" class="quick-config-panel">
                <div class="quick-config-title">滑动配置</div>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="起点坐标">
                      <a-input
                        :model-value="readSelectedConfigString('start')"
                        placeholder="例如：540,1600"
                        @input="value => updateSelectedStepConfig('start', value)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="终点坐标">
                      <a-input
                        :model-value="readSelectedConfigString('end')"
                        placeholder="例如：540,600"
                        @input="value => updateSelectedStepConfig('end', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="滑动时长（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('duration', 0.4)"
                        :min="0.1"
                        :max="10"
                        :step="0.1"
                        @change="value => updateSelectedStepConfig('duration', value ?? 0.4)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>

              <div v-if="usesDragQuickConfig(selectedStepActionType)" class="quick-config-panel">
                <div class="quick-config-title">拖拽配置</div>
                <a-alert class="quick-config-subtle-alert">
                  当前快捷配置按坐标拖拽；如果需要按元素、图片或 OCR 区域定位拖拽起终点，可继续在下方 JSON 中补充
                  `start_selector_type`、`start_selector`、`end_selector_type`、`end_selector` 等高级字段。
                </a-alert>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="起点坐标">
                      <a-input
                        :model-value="readSelectedConfigString('start')"
                        placeholder="例如：200,800"
                        @input="value => updateSelectedStepConfig('start', value)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="终点坐标">
                      <a-input
                        :model-value="readSelectedConfigString('end')"
                        placeholder="例如：800,800"
                        @input="value => updateSelectedStepConfig('end', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="拖拽时长（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('duration', 0.6)"
                        :min="0.1"
                        :max="10"
                        :step="0.1"
                        @change="value => updateSelectedStepConfig('duration', value ?? 0.6)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>

              <div v-if="usesVariableMutationQuickConfig(selectedStepActionType)" class="quick-config-panel">
                <div class="quick-config-title">
                  {{ selectedStepActionType === 'set_variable' ? '设置变量配置' : '删除变量配置' }}
                </div>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="变量名">
                      <a-input
                        :model-value="readSelectedConfigString('variable_name')"
                        placeholder="例如：token"
                        @input="value => updateSelectedStepConfig('variable_name', value)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="作用域">
                      <a-select
                        :model-value="selectedVariableScope"
                        @change="value => updateSelectedStepConfig('scope', value || 'local')"
                      >
                        <a-option v-for="item in VARIABLE_SCOPE_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-form-item v-if="selectedStepActionType === 'set_variable'" label="变量值">
                  <a-textarea
                    :model-value="formatQuickConfigValue(readSelectedConfigValue('value'))"
                    :auto-size="{ minRows: 4, maxRows: 8 }"
                    placeholder="支持普通文本、数字、布尔值，或 JSON 对象/数组"
                    @change="value => handleLooseConfigTextChange('value', String(value || ''))"
                  />
                </a-form-item>
              </div>

              <div v-if="usesExtractOutputQuickConfig(selectedStepActionType)" class="quick-config-panel">
                <div class="quick-config-title">提取输出配置</div>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="来源变量">
                      <a-input
                        :model-value="readSelectedConfigString('source')"
                        placeholder="例如：response 或 response.body"
                        @input="value => updateSelectedStepConfig('source', value)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="提取路径">
                      <a-input
                        :model-value="readSelectedConfigString('path')"
                        placeholder="例如：body.data.token"
                        @input="value => updateSelectedStepConfig('path', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="保存变量名">
                      <a-input
                        :model-value="readSelectedConfigString('variable_name')"
                        placeholder="例如：token"
                        @input="value => updateSelectedStepConfig('variable_name', value)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="保存作用域">
                      <a-select
                        :model-value="selectedVariableScope"
                        @change="value => updateSelectedStepConfig('scope', value || 'local')"
                      >
                        <a-option v-for="item in VARIABLE_SCOPE_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>

              <div v-if="usesApiRequestQuickConfig(selectedStepActionType)" class="quick-config-panel">
                <div class="quick-config-title">接口请求配置</div>
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="请求方法">
                      <a-select
                        :model-value="readSelectedConfigString('method', 'GET')"
                        @change="value => updateSelectedStepConfig('method', value || 'GET')"
                      >
                        <a-option v-for="item in HTTP_METHOD_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="16">
                    <a-form-item label="请求地址">
                      <a-input
                        :model-value="readSelectedConfigString('url')"
                        placeholder="例如：https://example.com/api/health"
                        @input="value => updateSelectedStepConfig('url', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="超时（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('timeout', 10)"
                        :min="0.1"
                        :max="300"
                        :step="0.5"
                        @change="value => updateSelectedStepConfig('timeout', value ?? 10)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="响应类型">
                      <a-select
                        :model-value="readSelectedConfigString('response_type', 'auto')"
                        @change="value => updateSelectedStepConfig('response_type', value || 'auto')"
                      >
                        <a-option v-for="item in RESPONSE_TYPE_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="期望状态码">
                      <a-input
                        :model-value="readSelectedConfigString('expected_status')"
                        placeholder="可留空，例如：200"
                        @input="value => handleLooseConfigTextChange('expected_status', String(value || ''))"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="完整响应保存名">
                      <a-input
                        :model-value="readSelectedConfigString('save_as')"
                        placeholder="例如：response"
                        @input="value => updateSelectedStepConfig('save_as', value)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="保存作用域">
                      <a-select
                        :model-value="selectedVariableScope"
                        @change="value => updateSelectedStepConfig('scope', value || 'local')"
                      >
                        <a-option v-for="item in VARIABLE_SCOPE_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-form-item label="请求头 JSON">
                  <a-textarea
                    :model-value="formatQuickConfigValue(readSelectedConfigValue('headers', {}))"
                    :auto-size="{ minRows: 4, maxRows: 8 }"
                    placeholder='例如：{"Authorization":"Bearer {{token}}"}'
                    @change="value => handleJsonConfigTextChange('headers', String(value || ''), {})"
                  />
                </a-form-item>
                <a-form-item label="查询参数 JSON">
                  <a-textarea
                    :model-value="formatQuickConfigValue(readSelectedConfigValue('params', {}))"
                    :auto-size="{ minRows: 4, maxRows: 8 }"
                    placeholder='例如：{"page":1,"size":20}'
                    @change="value => handleJsonConfigTextChange('params', String(value || ''), {})"
                  />
                </a-form-item>
                <a-form-item label="JSON 请求体">
                  <a-textarea
                    :model-value="formatQuickConfigValue(readSelectedConfigValue('json'))"
                    :auto-size="{ minRows: 4, maxRows: 10 }"
                    placeholder='留空则不发送 JSON 请求体，例如：{"username":"admin"}'
                    @change="value => handleJsonConfigTextChange('json', String(value || ''), undefined)"
                  />
                </a-form-item>
                <a-form-item label="表单/原始请求体">
                  <a-textarea
                    :model-value="formatQuickConfigValue(readSelectedConfigValue('data'))"
                    :auto-size="{ minRows: 3, maxRows: 8 }"
                    placeholder="可填写文本、数字，或 JSON 对象"
                    @change="value => handleLooseConfigTextChange('data', String(value || ''))"
                  />
                </a-form-item>
                <a-form-item label="字段提取 JSON 数组">
                  <a-textarea
                    :model-value="formatQuickConfigValue(readSelectedConfigValue('extracts', []))"
                    :auto-size="{ minRows: 4, maxRows: 10 }"
                    placeholder='例如：[{"path":"body.data.token","name":"token","scope":"local"}]'
                    @change="value => handleJsonConfigTextChange('extracts', String(value || ''), [])"
                  />
                </a-form-item>
              </div>

              <div v-if="usesDeviceActionQuickConfig(selectedStepActionType)" class="quick-config-panel">
                <div class="quick-config-title">设备动作配置</div>
                <a-form-item v-if="selectedStepActionType === 'snapshot'" label="截图标签">
                  <a-input
                    :model-value="readSelectedConfigString('label')"
                    placeholder="可选，不填时默认使用步骤名称"
                    @input="value => updateSelectedStepConfig('label', value || undefined)"
                  />
                </a-form-item>

                <template v-if="selectedStepActionType === 'launch_app' || selectedStepActionType === 'stop_app'">
                  <a-row :gutter="12">
                    <a-col :span="selectedStepActionType === 'launch_app' ? 12 : 24">
                      <a-form-item label="应用包名">
                        <a-input
                          :model-value="readSelectedConfigString('package_name')"
                          placeholder="例如：com.example.demo"
                          @input="value => updateSelectedStepConfig('package_name', value)"
                        />
                      </a-form-item>
                    </a-col>
                    <a-col v-if="selectedStepActionType === 'launch_app'" :span="12">
                      <a-form-item label="启动 Activity">
                        <a-input
                          :model-value="readSelectedConfigString('activity_name')"
                          placeholder="可选，例如：.MainActivity"
                          @input="value => updateSelectedStepConfig('activity_name', value || undefined)"
                        />
                      </a-form-item>
                    </a-col>
                  </a-row>
                </template>

                <a-form-item v-if="selectedStepActionType === 'keyevent'" label="Android Keyevent">
                  <a-input
                    :model-value="readSelectedConfigString('keycode', 'KEYCODE_ENTER')"
                    placeholder="例如：KEYCODE_BACK / KEYCODE_HOME / KEYCODE_ENTER"
                    @input="value => updateSelectedStepConfig('keycode', value || 'KEYCODE_ENTER')"
                  />
                </a-form-item>
              </div>

              <div v-if="usesAssertQuickConfig(selectedStepActionType)" class="quick-config-panel">
                <div class="quick-config-title">断言快捷配置</div>
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="断言类型">
                      <a-select :model-value="selectedAssertType" @change="value => handleAssertTypeChange(String(value || 'condition'))">
                        <a-option v-for="item in ASSERT_TYPE_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="超时重试（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('timeout', 0)"
                        :min="0"
                        :max="300"
                        :step="0.5"
                        @change="value => updateSelectedStepConfig('timeout', value ?? 0)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="重试间隔（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('retry_interval', 0.5)"
                        :min="0.1"
                        :max="30"
                        :step="0.1"
                        @change="value => updateSelectedStepConfig('retry_interval', value ?? 0.5)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>

                <template v-if="selectedAssertQuickMode === 'ocr'">
                  <a-row :gutter="12">
                    <a-col :span="8">
                      <a-form-item label="OCR 区域类型">
                        <a-input :model-value="'region'" disabled />
                      </a-form-item>
                    </a-col>
                    <a-col :span="16">
                      <a-form-item label="OCR 区域">
                        <a-input
                          :model-value="readSelectedConfigString('selector')"
                          placeholder="格式：x1,y1,x2,y2"
                          @input="value => updateSelectedStepConfig('selector', value)"
                        />
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <a-row v-if="selectedAssertType === 'text' || selectedAssertType === 'regex'" :gutter="12">
                    <a-col v-if="selectedAssertType === 'text'" :span="8">
                      <a-form-item label="匹配方式">
                        <a-select
                          :model-value="readSelectedConfigString('match_mode', 'contains')"
                          @change="value => updateSelectedStepConfig('match_mode', value || 'contains')"
                        >
                          <a-option v-for="item in MATCH_MODE_OPTIONS" :key="item.value" :value="item.value">
                            {{ item.label }}
                          </a-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                    <a-col :span="selectedAssertType === 'text' ? 16 : 24">
                      <a-form-item :label="selectedAssertType === 'regex' ? '正则表达式' : '期望文本'">
                        <a-input
                          :model-value="readSelectedConfigString('expected')"
                          :placeholder="selectedAssertType === 'regex' ? '请输入 OCR 正则表达式' : '请输入期望文本'"
                          @input="value => updateSelectedStepConfig('expected', value)"
                        />
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <a-row v-else-if="selectedAssertType === 'number'" :gutter="12">
                    <a-col :span="12">
                      <a-form-item label="期望数字">
                        <a-input
                          :model-value="readSelectedConfigString('expected')"
                          placeholder="例如：100 或 3,000"
                          @input="value => updateSelectedStepConfig('expected', value)"
                        />
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <a-row v-else-if="selectedAssertType === 'range'" :gutter="12">
                    <a-col :span="12">
                      <a-form-item label="最小值">
                        <a-input
                          :model-value="readSelectedConfigString('min')"
                          placeholder="可留空"
                          @input="value => updateSelectedStepConfig('min', value)"
                        />
                      </a-form-item>
                    </a-col>
                    <a-col :span="12">
                      <a-form-item label="最大值">
                        <a-input
                          :model-value="readSelectedConfigString('max')"
                          placeholder="可留空"
                          @input="value => updateSelectedStepConfig('max', value)"
                        />
                      </a-form-item>
                    </a-col>
                  </a-row>
                </template>

                <template v-else-if="selectedAssertQuickMode === 'image'">
                  <a-row :gutter="12">
                    <a-col :span="16">
                      <a-form-item label="期望图片路径">
                        <a-input
                          :model-value="readSelectedConfigString('expected')"
                          placeholder="例如：common/login-button.png"
                          @input="value => updateSelectedStepConfig('expected', value)"
                        />
                      </a-form-item>
                    </a-col>
                    <a-col :span="8">
                      <a-form-item label="图片阈值">
                        <a-input-number
                          :model-value="readSelectedConfigNumber('threshold', 0.7)"
                          :min="0.1"
                          :max="1"
                          :step="0.05"
                          @change="value => updateSelectedStepConfig('threshold', value ?? 0.7)"
                        />
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <a-row :gutter="12">
                    <a-col :span="8">
                      <a-form-item label="全屏找图">
                        <a-switch
                          :model-value="readSelectedConfigBoolean('search_full_screen', true)"
                          @change="value => updateSelectedStepConfig('search_full_screen', value)"
                        />
                      </a-form-item>
                    </a-col>
                  </a-row>
                </template>

                <template v-else-if="selectedAssertQuickMode === 'exists'">
                  <a-row :gutter="12">
                    <a-col :span="8">
                      <a-form-item label="选择器类型">
                        <a-select
                          :model-value="selectedPrimarySelectorType"
                          @change="value => updateSelectedStepConfig('selector_type', value || 'element')"
                        >
                          <a-option v-for="item in SELECTOR_TYPE_OPTIONS" :key="item.value" :value="item.value">
                            {{ item.label }}
                          </a-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                    <a-col :span="16">
                      <a-form-item label="选择器内容">
                        <a-input
                          :model-value="readSelectedConfigString('selector')"
                          placeholder="元素名、文本或图片路径"
                          @input="value => updateSelectedStepConfig('selector', value)"
                        />
                      </a-form-item>
                    </a-col>
                  </a-row>
                </template>

                <template v-else>
                  <a-row :gutter="12">
                    <a-col :span="10">
                      <a-form-item label="断言来源">
                        <a-input
                          :model-value="readSelectedConfigString('source')"
                          placeholder="例如：response.body.code"
                          @input="value => updateSelectedStepConfig('source', value)"
                        />
                      </a-form-item>
                    </a-col>
                    <a-col :span="6">
                      <a-form-item label="操作符">
                        <a-select
                          :model-value="readSelectedConfigString('operator', '==')"
                          @change="value => updateSelectedStepConfig('operator', value || '==')"
                        >
                          <a-option v-for="item in ASSERT_OPERATOR_OPTIONS" :key="item.value" :value="item.value">
                            {{ item.label }}
                          </a-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                    <a-col :span="8">
                      <a-form-item label="期望值">
                        <a-input
                          :model-value="readSelectedConfigString('expected')"
                          placeholder="期望值或变量表达式"
                          @input="value => updateSelectedStepConfig('expected', value)"
                        />
                      </a-form-item>
                    </a-col>
                  </a-row>
                </template>
              </div>

              <div v-if="usesImageBranchQuickConfig(selectedStepActionType)" class="quick-config-panel">
                <div class="quick-config-title">图片分支点击配置</div>
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="主选择器类型">
                      <a-select
                        :model-value="selectedPrimarySelectorType"
                        @change="value => updateSelectedStepConfig('selector_type', value || 'image')"
                      >
                        <a-option v-for="item in SELECTOR_TYPE_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="16">
                    <a-form-item label="主选择器">
                      <a-input
                        :model-value="readSelectedConfigString('selector')"
                        placeholder="主定位元素或图片路径"
                        @input="value => updateSelectedStepConfig('selector', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row v-if="selectedPrimarySelectorType === 'image'" :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="主阈值">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('threshold', 0.7)"
                        :min="0.1"
                        :max="1"
                        :step="0.05"
                        @change="value => updateSelectedStepConfig('threshold', value ?? 0.7)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="主全屏找图">
                      <a-switch
                        :model-value="readSelectedConfigBoolean('search_full_screen', true)"
                        @change="value => updateSelectedStepConfig('search_full_screen', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>

                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="备用选择器类型">
                      <a-select
                        :model-value="selectedFallbackSelectorType"
                        @change="value => updateSelectedStepConfig('fallback_selector_type', value || 'element')"
                      >
                        <a-option v-for="item in SELECTOR_TYPE_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="16">
                    <a-form-item label="备用选择器">
                      <a-input
                        :model-value="readSelectedConfigString('fallback_selector')"
                        placeholder="备用元素或图片路径"
                        @input="value => updateSelectedStepConfig('fallback_selector', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col v-if="selectedFallbackSelectorType === 'image'" :span="8">
                    <a-form-item label="备用阈值">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('fallback_threshold', 0.7)"
                        :min="0.1"
                        :max="1"
                        :step="0.05"
                        @change="value => updateSelectedStepConfig('fallback_threshold', value ?? 0.7)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col v-if="selectedFallbackSelectorType === 'image'" :span="8">
                    <a-form-item label="备用全屏找图">
                      <a-switch
                        :model-value="readSelectedConfigBoolean('fallback_search_full_screen', true)"
                        @change="value => updateSelectedStepConfig('fallback_search_full_screen', value)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col v-if="selectedStepActionType === 'image_exists_click_chain'" :span="8">
                    <a-form-item label="主备间隔（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('interval', 0.5)"
                        :min="0"
                        :max="10"
                        :step="0.1"
                        @change="value => updateSelectedStepConfig('interval', value ?? 0.5)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>

              <div v-if="usesForeachAssertQuickConfig(selectedStepActionType)" class="quick-config-panel">
                <div class="quick-config-title">循环点击断言配置</div>
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="点击选择器类型">
                      <a-select
                        :model-value="selectedClickSelectorType"
                        @change="value => updateSelectedStepConfig('click_selector_type', value || 'element')"
                      >
                        <a-option v-for="item in SELECTOR_TYPE_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="16">
                    <a-form-item label="点击选择器">
                      <a-input
                        :model-value="readSelectedConfigString('click_selector')"
                        placeholder="点击按钮元素、文本或图片路径"
                        @input="value => updateSelectedStepConfig('click_selector', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row v-if="selectedClickSelectorType === 'image'" :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="点击阈值">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('click_threshold', 0.7)"
                        :min="0.1"
                        :max="1"
                        :step="0.05"
                        @change="value => updateSelectedStepConfig('click_threshold', value ?? 0.7)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="点击全屏找图">
                      <a-switch
                        :model-value="readSelectedConfigBoolean('click_search_full_screen', true)"
                        @change="value => updateSelectedStepConfig('click_search_full_screen', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="断言类型">
                      <a-select
                        :model-value="readSelectedConfigString('assert_type', 'text')"
                        @change="value => updateSelectedStepConfig('assert_type', value || 'text')"
                      >
                        <a-option value="text">OCR 文本</a-option>
                        <a-option value="number">OCR 数字</a-option>
                        <a-option value="regex">OCR 正则</a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="16">
                    <a-form-item label="OCR 区域">
                      <a-input
                        :model-value="readSelectedConfigString('ocr_selector')"
                        placeholder="格式：x1,y1,x2,y2"
                        @input="value => updateSelectedStepConfig('ocr_selector', value)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="匹配方式">
                      <a-select
                        :model-value="readSelectedConfigString('match_mode', 'contains')"
                        @change="value => updateSelectedStepConfig('match_mode', value || 'contains')"
                      >
                        <a-option v-for="item in MATCH_MODE_OPTIONS" :key="item.value" :value="item.value">
                          {{ item.label }}
                        </a-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="最大循环次数">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('max_loops', 3)"
                        :min="1"
                        :max="100"
                        @change="value => updateSelectedStepConfig('max_loops', value ?? 3)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="最少命中次数">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('min_match', 1)"
                        :min="0"
                        :max="100"
                        @change="value => updateSelectedStepConfig('min_match', value ?? 1)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="点击后等待（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('interval', 0.5)"
                        :min="0"
                        :max="10"
                        :step="0.1"
                        @change="value => updateSelectedStepConfig('interval', value ?? 0.5)"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="单次 OCR 超时（秒）">
                      <a-input-number
                        :model-value="readSelectedConfigNumber('timeout', 1.5)"
                        :min="0"
                        :max="30"
                        :step="0.1"
                        @change="value => updateSelectedStepConfig('timeout', value ?? 1.5)"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-form-item label="期望列表">
                  <a-textarea
                    :model-value="expectedListText"
                    :auto-size="{ minRows: 4, maxRows: 8 }"
                    placeholder="每行一个期望值，也可以直接填写 JSON 数组"
                    @input="value => handleExpectedListTextChange(String(value || ''))"
                  />
                </a-form-item>
              </div>
              <a-form-item label="配置字段">
                <div class="config-keys">
                  <a-tag v-for="item in configKeys" :key="item" size="small">{{ item }}</a-tag>
                  <span v-if="!configKeys.length" class="config-empty-text">当前步骤还没有配置字段</span>
                </div>
              </a-form-item>
              <a-form-item label="配置 JSON">
                <a-textarea
                  v-model="stepConfigText"
                  :auto-size="{ minRows: 10, maxRows: 18 }"
                  placeholder="请输入步骤配置 JSON"
                />
              </a-form-item>
            </a-form>

            <div class="config-actions">
              <a-button @click="resetSelectedStepConfig">恢复默认配置</a-button>
              <a-button type="primary" @click="applyStepConfig">应用到当前步骤</a-button>
            </div>
          </div>
        </a-card>
      </div>

      <a-modal v-model:visible="componentPackageVisible" width="760px">
        <template #title>导入组件包</template>

        <a-form layout="vertical">
          <a-alert class="custom-dialog-alert">
            支持导入 `.json`、`.yaml`、`.yml` 组件包。导入时可以选择覆盖已有组件，也会同步安装组件包里的自定义组件。
          </a-alert>

          <a-form-item label="覆盖已有组件">
            <a-switch v-model="componentPackageOverwrite" />
          </a-form-item>

          <a-form-item label="选择文件">
            <a-upload
              :file-list="componentPackageFileList"
              :auto-upload="false"
              :limit="1"
              accept=".json,.yaml,.yml"
              @change="handleComponentPackageFileChange"
            />
          </a-form-item>

          <a-form-item label="已导入组件包">
            <div class="component-package-list">
              <div
                v-for="item in componentPackageRecords"
                :key="item.id"
                class="component-package-item"
              >
                <div class="component-package-copy">
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.description || '暂无描述' }}</span>
                </div>
                <div class="component-package-meta">
                  <span>{{ item.version || '-' }}</span>
                  <a-button type="text" size="mini" status="danger" @click="deleteComponentPackageRecord(item)">
                    删除
                  </a-button>
                </div>
              </div>
              <a-empty v-if="!componentPackageLoading && !componentPackageRecords.length" description="暂无组件包记录" />
              <a-spin v-if="componentPackageLoading" style="width: 100%" />
            </div>
          </a-form-item>
        </a-form>

        <template #footer>
          <a-space>
            <a-button @click="componentPackageVisible = false">关闭</a-button>
            <a-button type="primary" :loading="componentPackageUploading" @click="submitComponentPackageImport">
              导入组件包
            </a-button>
          </a-space>
        </template>
      </a-modal>

      <a-modal v-model:visible="componentPackageExportVisible" width="560px">
        <template #title>导出组件包</template>

        <a-form :model="componentPackageExportForm" layout="vertical">
          <a-form-item label="组件包名称">
            <a-input v-model="componentPackageExportForm.name" placeholder="例如：app-component-pack" />
          </a-form-item>
          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item label="版本">
                <a-input v-model="componentPackageExportForm.version" placeholder="例如：2026.04.07" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="作者">
                <a-input v-model="componentPackageExportForm.author" placeholder="可选" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="描述">
            <a-textarea
              v-model="componentPackageExportForm.description"
              :auto-size="{ minRows: 3, maxRows: 5 }"
              placeholder="可选"
            />
          </a-form-item>
          <a-form-item label="导出禁用组件">
            <a-switch v-model="componentPackageIncludeDisabled" />
          </a-form-item>
        </a-form>

        <template #footer>
          <a-space>
            <a-button @click="componentPackageExportVisible = false">取消</a-button>
            <a-button type="outline" :loading="componentPackageExporting" @click="downloadComponentPackage('json')">
              导出 JSON
            </a-button>
            <a-button type="primary" :loading="componentPackageExporting" @click="downloadComponentPackage('yaml')">
              导出 YAML
            </a-button>
          </a-space>
        </template>
      </a-modal>

      <a-modal v-model:visible="aiPlanVisible" width="720px">
        <template #title>AI 生成 APP 场景</template>

        <a-form :model="aiPlanForm" layout="vertical">
          <a-alert class="custom-dialog-alert">
            优先使用当前激活的 LLM 配置生成步骤；如果模型不可用或网络失败，会自动回退到规则规划，保证场景草稿仍然可编辑可保存。
          </a-alert>

          <div class="ai-dialog-meta">
            <div class="ai-dialog-item">
              <span>当前引擎</span>
              <strong>{{ aiDialogEngineName }}</strong>
            </div>
            <div class="ai-dialog-item">
              <span>执行模式</span>
              <strong>{{ aiDialogModeText }}</strong>
            </div>
            <div class="ai-dialog-item">
              <span>最近检测</span>
              <strong>{{ formatDateTime(aiStatus.checked_at) }}</strong>
            </div>
          </div>

          <a-form-item field="prompt" label="场景描述">
            <a-textarea
              v-model="aiPlanForm.prompt"
              :auto-size="{ minRows: 6, maxRows: 10 }"
              placeholder="例如：启动企业微信，输入账号密码登录，进入工作台后校验消息入口存在并截图。"
            />
          </a-form-item>

          <a-form-item field="applyMode" label="应用方式">
            <a-radio-group v-model="aiPlanForm.applyMode" type="button">
              <a-radio value="replace">替换当前草稿</a-radio>
              <a-radio value="append">追加到当前步骤</a-radio>
            </a-radio-group>
          </a-form-item>
        </a-form>

        <template #footer>
          <a-space>
            <a-button @click="aiPlanVisible = false">取消</a-button>
            <a-button type="primary" :loading="aiGenerating" @click="generateAiPlan">
              生成并应用
            </a-button>
          </a-space>
        </template>
      </a-modal>

      <a-modal v-model:visible="aiStepVisible" width="640px">
        <template #title>AI 补全当前步骤</template>

        <a-form :model="aiStepForm" layout="vertical">
          <a-alert class="custom-dialog-alert">
            这会基于当前已选步骤、场景上下文和激活的 LLM 配置补全当前步骤；如果模型不可用，会自动回退到规则补全。
          </a-alert>

          <div class="ai-dialog-meta">
            <div class="ai-dialog-item">
              <span>当前引擎</span>
              <strong>{{ aiDialogEngineName }}</strong>
            </div>
            <div class="ai-dialog-item">
              <span>执行模式</span>
              <strong>{{ aiDialogModeText }}</strong>
            </div>
            <div class="ai-dialog-item">
              <span>最近检测</span>
              <strong>{{ formatDateTime(aiStatus.checked_at) }}</strong>
            </div>
          </div>

          <a-form-item field="prompt" label="补全说明">
            <a-textarea
              v-model="aiStepForm.prompt"
              :auto-size="{ minRows: 5, maxRows: 8 }"
              placeholder="例如：补全为输入登录账号，优先复用已有元素，缺少值时自动生成变量。"
            />
          </a-form-item>
        </a-form>

        <template #footer>
          <a-space>
            <a-button @click="aiStepVisible = false">取消</a-button>
            <a-button type="primary" :loading="aiStepSuggesting" @click="generateAiStepSuggestion">
              补全并应用
            </a-button>
          </a-space>
        </template>
      </a-modal>

      <a-modal v-model:visible="executeVisible" width="560px">
        <template #title>保存并执行当前用例</template>

        <a-form :model="executeForm" layout="vertical">
          <a-alert class="custom-dialog-alert">
            会先保存当前场景草稿，再立即创建执行任务，并跳转到执行记录页跟踪执行进度。
          </a-alert>

          <a-form-item label="当前用例">
            <a-input :model-value="executionCaseName" readonly />
          </a-form-item>

          <a-form-item label="执行设备">
            <a-select v-model="executeForm.device_id" placeholder="请选择执行设备">
              <a-option v-for="device in availableDevices" :key="device.id" :value="device.id">
                {{ device.name || device.device_id }}
              </a-option>
            </a-select>
          </a-form-item>

          <div class="execute-device-meta">
            <span>可用设备 {{ availableDevices.length }} 台</span>
            <a-button type="text" size="mini" @click="reloadDevices">刷新设备</a-button>
          </div>
        </a-form>

        <template #footer>
          <a-space>
            <a-button @click="executeVisible = false">取消</a-button>
            <a-button type="primary" :loading="saving || executing" @click="executeCurrentDraft">开始执行</a-button>
          </a-space>
        </template>
      </a-modal>

      <a-modal v-model:visible="customComponentVisible" width="760px">
        <template #title>
          {{ customComponentMode === 'create' ? '保存为自定义组件' : '编辑自定义组件' }}
        </template>

        <a-form :model="customComponentForm" layout="vertical">
          <a-alert class="custom-dialog-alert">
            {{
              customComponentMode === 'create'
                ? '当前会将场景中的基础步骤和流程步骤保存为新的自定义组件，暂不支持嵌套自定义组件。'
                : '这里可以维护组件名称、类型与步骤 JSON，保存后会同步到组件库。'
            }}
          </a-alert>

          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item field="name" label="组件名称">
                <a-input v-model="customComponentForm.name" placeholder="请输入组件名称" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item field="type" label="组件类型">
                <a-input v-model="customComponentForm.type" placeholder="例如：login_flow_component" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item field="description" label="组件描述">
            <a-textarea
              v-model="customComponentForm.description"
              :auto-size="{ minRows: 3, maxRows: 5 }"
              placeholder="说明该组件的用途"
            />
          </a-form-item>

          <a-form-item field="stepsText" label="步骤 JSON">
            <a-textarea
              v-model="customComponentForm.stepsText"
              :auto-size="{ minRows: 12, maxRows: 20 }"
              placeholder="请填写组件步骤 JSON 数组"
            />
          </a-form-item>
        </a-form>

        <template #footer>
          <a-space>
            <a-button @click="customComponentVisible = false">取消</a-button>
            <a-button type="primary" :loading="customComponentSaving" @click="saveCustomComponent">
              保存组件
            </a-button>
          </a-space>
        </template>
      </a-modal>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { Message, Modal } from '@arco-design/web-vue'
import type { FileItem } from '@arco-design/web-vue/es/upload/interfaces'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/authStore'
import { useProjectStore } from '@/store/projectStore'
import { getActiveLlmConfig, getLlmConfigDetails } from '@/features/langgraph/services/llmConfigService'
import { AppAutomationService } from '../services/appAutomationService'
import type {
  AppComponent,
  AppComponentPackage,
  AppCustomComponent,
  AppDevice,
  AppExecution,
  AppLlmConfigSnapshot,
  AppPackage,
  AppScenePlanResponse,
  AppSceneStep,
  AppStepSuggestionResponse,
  AppTestCase,
} from '../types'

type PaletteTab = 'base' | 'custom'
type CustomComponentDialogMode = 'create' | 'edit'
type AiApplyMode = 'replace' | 'append'
type StepChildGroupKey = 'steps' | 'else_steps' | 'catch_steps' | 'finally_steps'

interface SceneVariableDraft {
  name: string
  scope: string
  type: string
  valueText: string
  description: string
}

interface StepChildGroup {
  key: StepChildGroupKey
  label: string
}

interface QuickOption {
  label: string
  value: string
}

interface AiRuntimeStatus {
  has_config: boolean
  ready: boolean
  config_name: string
  provider: string
  model: string
  api_url: string
  supports_vision: boolean
  checked_at: string
  error: string
}

interface AiActivityRecord {
  action: 'scene' | 'step'
  status: 'success' | 'error'
  mode: 'llm' | 'fallback'
  summary: string
  prompt: string
  target_name: string
  warnings: string[]
  provider: string
  model: string
  executed_at: string
}

const FLOW_CONTAINER_TYPES = new Set(['sequence', 'if', 'loop', 'try'])

const STEP_META_KEYS = new Set([
  'id',
  'name',
  'kind',
  'type',
  'action',
  'component_type',
  'component_name',
  'steps',
  'then_steps',
  'try_steps',
  'else_steps',
  'catch_steps',
  'finally_steps',
  '_expanded',
])

const FLOW_CHILD_GROUPS: Record<string, StepChildGroup[]> = {
  sequence: [{ key: 'steps', label: '子步骤' }],
  if: [
    { key: 'steps', label: 'Then 分支' },
    { key: 'else_steps', label: 'Else 分支' },
  ],
  loop: [{ key: 'steps', label: '循环体' }],
  try: [
    { key: 'steps', label: 'Try 分支' },
    { key: 'catch_steps', label: 'Catch 分支' },
    { key: 'finally_steps', label: 'Finally 分支' },
  ],
}

const SELECTOR_TYPE_OPTIONS: QuickOption[] = [
  { label: '元素库', value: 'element' },
  { label: '文本', value: 'text' },
  { label: '资源 ID', value: 'id' },
  { label: '描述', value: 'desc' },
  { label: 'XPath', value: 'xpath' },
  { label: '图片', value: 'image' },
  { label: '区域', value: 'region' },
  { label: '坐标', value: 'pos' },
]

const MATCH_MODE_OPTIONS: QuickOption[] = [
  { label: '包含', value: 'contains' },
  { label: '精确匹配', value: 'exact' },
  { label: '正则匹配', value: 'regex' },
]

const ASSERT_TYPE_OPTIONS: QuickOption[] = [
  { label: '条件断言', value: 'condition' },
  { label: '存在断言', value: 'exists' },
  { label: '不存在断言', value: 'not_exists' },
  { label: '图片断言', value: 'image' },
  { label: 'OCR 文本', value: 'text' },
  { label: 'OCR 数字', value: 'number' },
  { label: 'OCR 正则', value: 'regex' },
  { label: 'OCR 范围', value: 'range' },
]

const ASSERT_OPERATOR_OPTIONS: QuickOption[] = [
  { label: '等于', value: '==' },
  { label: '不等于', value: '!=' },
  { label: '大于', value: '>' },
  { label: '大于等于', value: '>=' },
  { label: '小于', value: '<' },
  { label: '小于等于', value: '<=' },
  { label: '包含', value: 'contains' },
  { label: '正则', value: 'regex' },
  { label: '真值', value: 'truthy' },
  { label: '假值', value: 'falsy' },
]

const SWIPE_DIRECTION_OPTIONS: QuickOption[] = [
  { label: '向上', value: 'up' },
  { label: '向下', value: 'down' },
  { label: '向左', value: 'left' },
  { label: '向右', value: 'right' },
]

const VARIABLE_SCOPE_OPTIONS: QuickOption[] = [
  { label: '局部', value: 'local' },
  { label: '全局', value: 'global' },
]

const HTTP_METHOD_OPTIONS: QuickOption[] = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'DELETE', value: 'DELETE' },
]

const RESPONSE_TYPE_OPTIONS: QuickOption[] = [
  { label: '自动判断', value: 'auto' },
  { label: 'JSON', value: 'json' },
  { label: '文本', value: 'text' },
  { label: '二进制', value: 'binary' },
]

const authStore = useAuthStore()
const projectStore = useProjectStore()
const route = useRoute()
const router = useRouter()

const loading = ref(false)
const saving = ref(false)
const executing = ref(false)
const aiGenerating = ref(false)
const aiStepSuggesting = ref(false)
const aiStatusLoading = ref(false)
const componentPackageLoading = ref(false)
const componentPackageUploading = ref(false)
const componentPackageExporting = ref(false)
const customComponentSaving = ref(false)
const selectedCaseId = ref<number | undefined>()
const selectedStepIndex = ref<number | null>(null)
const selectedSubStepIndex = ref<number | null>(null)
const selectedSubStepGroupKey = ref<StepChildGroupKey | null>(null)
const componentSearch = ref('')
const stepConfigText = ref('{}')
const paletteTab = ref<PaletteTab>('base')
const componentPackageVisible = ref(false)
const componentPackageExportVisible = ref(false)
const aiPlanVisible = ref(false)
const aiStepVisible = ref(false)
const executeVisible = ref(false)
const customComponentVisible = ref(false)
const customComponentMode = ref<CustomComponentDialogMode>('create')
const editingCustomComponentId = ref<number | null>(null)

const components = ref<AppComponent[]>([])
const customComponents = ref<AppCustomComponent[]>([])
const componentPackageRecords = ref<AppComponentPackage[]>([])
const devices = ref<AppDevice[]>([])
const packages = ref<AppPackage[]>([])
const testCases = ref<AppTestCase[]>([])
const steps = ref<AppSceneStep[]>([])
const variableItems = ref<SceneVariableDraft[]>([])
const activeLlmSnapshot = ref<AppLlmConfigSnapshot | null>(null)
const lastAiActivity = ref<AiActivityRecord | null>(null)
const componentPackageFileList = ref<FileItem[]>([])
const componentPackageFile = ref<File | null>(null)
const componentPackageOverwrite = ref(true)
const componentPackageIncludeDisabled = ref(false)

const subStepSelections = reactive<Record<string, string | undefined>>({})

const draft = reactive({
  name: '',
  description: '',
  package_id: undefined as number | undefined,
  timeout: 300,
  retry_count: 0,
})

const customComponentForm = reactive({
  name: '',
  type: '',
  description: '',
  stepsText: '[]',
})

const aiPlanForm = reactive({
  prompt: '',
  applyMode: 'replace' as AiApplyMode,
})

const aiStepForm = reactive({
  prompt: '',
})

const executeForm = reactive({
  device_id: undefined as number | undefined,
})

const createAiStatusState = (): AiRuntimeStatus => ({
  has_config: false,
  ready: false,
  config_name: '',
  provider: '',
  model: '',
  api_url: '',
  supports_vision: false,
  checked_at: '',
  error: '',
})

const aiStatus = reactive<AiRuntimeStatus>(createAiStatusState())

const componentPackageExportForm = reactive({
  name: 'app-component-pack',
  version: '',
  author: '',
  description: 'FlyTest APP 自动化组件包',
})

let stepSeed = 0

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)))

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

const formatProviderLabel = (value?: string | null) => {
  const normalized = String(value || '').trim()
  if (!normalized) return '-'

  const providerMap: Record<string, string> = {
    openai: 'OpenAI',
    openai_compatible: 'OpenAI Compatible',
    anthropic: 'Anthropic',
    google: 'Google',
    gemini: 'Google Gemini',
    deepseek: 'DeepSeek',
    siliconflow: '硅基流动',
    qwen: '通义千问',
    alibaba: '阿里云百炼',
  }

  return (
    providerMap[normalized.toLowerCase()] ||
    normalized
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, segment => segment.toUpperCase())
  )
}

const formatEndpointDisplay = (value?: string | null) => {
  const text = String(value || '').trim()
  if (!text) return '未配置接口地址'

  try {
    const parsed = new URL(text)
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '') || '/'}`
  } catch {
    return text
  }
}

const normalizeErrorMessage = (error: any, fallback: string) => error?.message || error?.error || fallback

const resetAiStatus = () => {
  Object.assign(aiStatus, createAiStatusState())
}

const readRouteCaseId = () => {
  const rawValue = Array.isArray(route.query.caseId) ? route.query.caseId[0] : route.query.caseId
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return undefined
  }

  const parsed = Number(rawValue)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const syncRouteCaseId = (caseId?: number) => {
  const currentCaseId = readRouteCaseId()
  if (currentCaseId === caseId) {
    return
  }

  const nextQuery: Record<string, string> = {}
  Object.entries(route.query).forEach(([key, value]) => {
    if (key === 'caseId') {
      return
    }

    if (Array.isArray(value)) {
      if (value[0] !== undefined) {
        nextQuery[key] = String(value[0])
      }
      return
    }

    if (value !== undefined) {
      nextQuery[key] = String(value)
    }
  })

  if (caseId) {
    nextQuery.caseId = String(caseId)
  }

  void router.replace({
    path: route.path,
    query: nextQuery,
  })
}

const clearRecord = (record: Record<string, unknown>) => {
  Object.keys(record).forEach(key => {
    delete record[key]
  })
}

const isObjectValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const generateStepId = () => `scene-step-${Date.now()}-${stepSeed++}`

const toComponentType = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || `component_${Date.now()}`
}

const inferVariableType = (value: unknown) => {
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (isObjectValue(value)) return 'object'
  return 'string'
}

const formatVariableValue = (value: unknown, type: string) => {
  if (type === 'object' || type === 'array') {
    return JSON.stringify(value ?? (type === 'array' ? [] : {}), null, 2)
  }
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
}

const getNodeKey = (step: AppSceneStep) => String(step.id ?? '')

const getStepType = (step?: Partial<AppSceneStep> | null) =>
  String(step?.component_type || step?.type || step?.action || '')
    .trim()
    .toLowerCase()

const componentMap = computed(() => new Map(components.value.map(item => [item.type, item])))
const componentNameMap = computed(() => {
  const entries = [
    ...components.value.map(item => [item.type, item.name] as const),
    ...customComponents.value.map(item => [item.type, item.name] as const),
  ]
  return new Map(entries)
})

const aiStatusColor = computed(() => {
  if (aiStatus.ready) return 'green'
  if (aiStatus.has_config) return 'orange'
  return 'gray'
})

const aiStatusLabel = computed(() => {
  if (aiStatus.ready) return 'AI 已就绪'
  if (aiStatus.has_config) return '规则回退待排查'
  return '未配置模型'
})

const aiCapabilityLabel = computed(() => {
  if (!aiStatus.has_config) return '规则规划兜底'
  return aiStatus.supports_vision ? '视觉 + 文本智能规划' : '文本智能规划'
})

const aiConfigDisplayName = computed(() => aiStatus.config_name || '未激活 LLM 配置')
const aiProviderDisplayName = computed(() => formatProviderLabel(aiStatus.provider))
const aiModelDisplayName = computed(() => aiStatus.model || '未配置模型名称')
const aiEndpointDisplay = computed(() => formatEndpointDisplay(aiStatus.api_url))

const aiStatusTitle = computed(() => {
  if (aiStatus.ready) {
    return `${aiConfigDisplayName.value} 已接入 APP 智能编排`
  }
  if (aiStatus.has_config) {
    return '已检测到模型配置，但当前会优先回退到规则规划'
  }
  return '当前未启用 LLM，系统会自动使用规则规划'
})

const aiStatusDescription = computed(() => {
  if (aiStatus.ready) {
    return 'AI 场景生成和步骤补全会优先走激活模型，失败时再自动回退到规则规划，保证编排不中断。'
  }
  if (aiStatus.error) {
    return aiStatus.error
  }
  if (aiStatus.has_config) {
    return '已存在激活配置，但模型名称或接口地址不完整，当前生成链路仍可继续使用规则规划。'
  }
  return '建议先配置并激活一个 LLM 模型，这样场景规划、步骤补全和变量生成会更稳定高效。'
})

const aiDialogEngineName = computed(() => {
  if (!aiStatus.has_config) return '未配置 LLM，将回退到规则规划'
  return `${aiModelDisplayName.value} · ${aiProviderDisplayName.value}`
})

const aiDialogModeText = computed(() => {
  if (!aiStatus.has_config) return '规则规划兜底'
  return aiStatus.supports_vision ? '视觉 + 文本联合规划' : '文本规划'
})

const availableDevices = computed(() =>
  devices.value.filter(device => device.status === 'available' || device.status === 'online'),
)

const executionCaseName = computed(() => draft.name.trim() || '未命名测试用例')

const isFlowContainerType = (value?: string | null) => FLOW_CONTAINER_TYPES.has(String(value || '').trim().toLowerCase())

const isCustomStep = (step?: Partial<AppSceneStep> | null) => Boolean(step && step.kind === 'custom')

const isFlowContainerStep = (step?: Partial<AppSceneStep> | null) => Boolean(step && isFlowContainerType(getStepType(step)))

const isContainerStep = (step?: Partial<AppSceneStep> | null) => Boolean(step && (isCustomStep(step) || isFlowContainerStep(step)))

const findStepList = (source: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (Array.isArray(value)) {
      return {
        found: true,
        steps: value as AppSceneStep[],
      }
    }
  }

  return {
    found: false,
    steps: [] as AppSceneStep[],
  }
}

const pickStepList = (primary: Record<string, unknown>, fallback: Record<string, unknown>, keys: readonly string[]) => {
  const direct = findStepList(primary, keys)
  if (direct.found) {
    return direct.steps
  }
  return findStepList(fallback, keys).steps
}

const stripNestedStepKeys = (record: Record<string, unknown>) => {
  const next = clone(record)
  ;['steps', 'then_steps', 'try_steps', 'else_steps', 'catch_steps', 'finally_steps'].forEach(key => {
    delete next[key]
  })
  return next
}

const getStepChildGroups = (step?: Partial<AppSceneStep> | null): StepChildGroup[] => {
  if (!step) {
    return []
  }
  if (isCustomStep(step)) {
    return [{ key: 'steps', label: '子步骤' }]
  }
  return FLOW_CHILD_GROUPS[getStepType(step)] || []
}

const getStepGroupSteps = (step: AppSceneStep, groupKey: StepChildGroupKey) => {
  const value = step[groupKey]
  return Array.isArray(value) ? (value as AppSceneStep[]) : []
}

const getSubStepSelectionKey = (step: AppSceneStep, groupKey: StepChildGroupKey) => `${getNodeKey(step)}::${groupKey}`

const countChildSteps = (step?: Partial<AppSceneStep> | null) => {
  if (!step || !isContainerStep(step)) {
    return 0
  }

  return getStepChildGroups(step).reduce((total, group) => {
    const value = step[group.key]
    return total + (Array.isArray(value) ? value.length : 0)
  }, 0)
}

const resolveStepTitle = (step?: Partial<AppSceneStep>) => {
  const componentType = getStepType(step)
  return step?.name || componentNameMap.value.get(componentType) || componentType || '未命名步骤'
}

const resolveStepMeta = (step?: Partial<AppSceneStep>) => {
  const componentType = getStepType(step)
  if (isContainerStep(step)) {
    const branchCount = getStepChildGroups(step).length
    const branchLabel = branchCount > 1 ? ` · ${branchCount} 个分支` : ''
    return `${componentType || (isCustomStep(step) ? 'custom' : 'flow')} · ${countChildSteps(step)} 个子步骤${branchLabel}`
  }
  return componentType || 'base'
}

const normalizeStep = (input: Partial<AppSceneStep>, forcedKind?: 'base' | 'custom'): AppSceneStep => {
  const raw = clone(input || {})
  const rawRecord = raw as Record<string, unknown>
  const type = getStepType(raw)
  const rawConfig = isObjectValue(raw.config) ? clone(raw.config) : {}
  const primaryKeys = type === 'if' ? ['then_steps', 'steps'] : type === 'try' ? ['try_steps', 'steps'] : ['steps']
  const derivedConfig =
    isObjectValue(raw.config)
      ? stripNestedStepKeys(rawConfig)
      : stripNestedStepKeys(
          Object.entries(raw).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
            if (!STEP_META_KEYS.has(key)) {
              accumulator[key] = value
            }
            return accumulator
          }, {}),
        )

  const kind = forcedKind ?? (raw.kind === 'custom' ? 'custom' : 'base')
  const step: AppSceneStep = {
    ...raw,
    id: raw.id ?? generateStepId(),
    name: String(raw.name || resolveStepTitle(raw)),
    kind,
    type: type || undefined,
    action: type || undefined,
    component_type: type || undefined,
    config: clone(derivedConfig),
    _expanded: Boolean(raw._expanded),
  }

  if (kind === 'custom' || isFlowContainerType(type)) {
    step.steps = normalizeSteps(pickStepList(rawRecord, rawConfig, primaryKeys))
  }

  if (type === 'if') {
    step.else_steps = normalizeSteps(pickStepList(rawRecord, rawConfig, ['else_steps']))
  }

  if (type === 'try') {
    step.catch_steps = normalizeSteps(pickStepList(rawRecord, rawConfig, ['catch_steps']))
    step.finally_steps = normalizeSteps(pickStepList(rawRecord, rawConfig, ['finally_steps']))
  }

  return step
}

const normalizeSteps = (items: unknown, forcedKind?: 'base' | 'custom') => {
  if (!Array.isArray(items)) {
    return []
  }
  return items.map(item => normalizeStep(item as AppSceneStep, forcedKind))
}

const sanitizeStep = (step: AppSceneStep): AppSceneStep => {
  const componentType = getStepType(step)
  const payload: AppSceneStep = {
    name: step.name?.trim() || resolveStepTitle(step),
    kind: isCustomStep(step) ? 'custom' : 'base',
    type: componentType || undefined,
    action: componentType || undefined,
    component_type: componentType || undefined,
    config: clone(step.config || {}),
  }

  if (isCustomStep(step) || isFlowContainerStep(step)) {
    payload.steps = getStepGroupSteps(step, 'steps').map(item => sanitizeStep(item))
  }

  if (getStepType(step) === 'if') {
    payload.else_steps = getStepGroupSteps(step, 'else_steps').map(item => sanitizeStep(item))
  }

  if (getStepType(step) === 'try') {
    payload.catch_steps = getStepGroupSteps(step, 'catch_steps').map(item => sanitizeStep(item))
    payload.finally_steps = getStepGroupSteps(step, 'finally_steps').map(item => sanitizeStep(item))
  }

  return payload
}

const containsCustomStep = (step: AppSceneStep): boolean => {
  if (isCustomStep(step)) {
    return true
  }

  return getStepChildGroups(step).some(group => getStepGroupSteps(step, group.key).some(item => containsCustomStep(item)))
}

const buildStepEditorPayload = (step?: AppSceneStep | null) => {
  if (!step) {
    return {}
  }

  const payload = clone(step.config || {})
  if (isFlowContainerStep(step)) {
    getStepChildGroups(step).forEach(group => {
      payload[group.key] = getStepGroupSteps(step, group.key).map(item => sanitizeStep(item))
    })
  }
  return payload
}

const setNormalizedGroupSteps = (step: AppSceneStep, groupKey: StepChildGroupKey, items: unknown) => {
  step[groupKey] = normalizeSteps(items)
}

const applyStepEditorPayload = (step: AppSceneStep, payload: Record<string, unknown>) => {
  const next = clone(payload)

  if (isFlowContainerStep(step)) {
    getStepChildGroups(step).forEach(group => {
      if (Object.prototype.hasOwnProperty.call(next, group.key)) {
        setNormalizedGroupSteps(step, group.key, Array.isArray(next[group.key]) ? next[group.key] : [])
      }
      delete next[group.key]
    })
  }

  step.config = stripNestedStepKeys(next)
}

const normalizeVariables = (items: unknown): SceneVariableDraft[] => {
  if (!Array.isArray(items)) {
    return []
  }

  return items.map(item => {
    const record = isObjectValue(item) ? item : {}
    const value = record.value
    const type = String(record.type || inferVariableType(value))

    return {
      name: String(record.name || ''),
      scope: String(record.scope || 'local'),
      type,
      valueText: formatVariableValue(value, type),
      description: String(record.description || ''),
    }
  })
}

const buildVariablePayload = () => {
  return variableItems.value
    .map(item => ({
      name: item.name.trim(),
      scope: item.scope,
      type: item.type,
      valueText: item.valueText,
      description: item.description.trim(),
    }))
    .filter(item => item.name || item.valueText || item.description)
    .map(item => {
      let parsedValue: unknown = item.valueText

      if (item.type === 'number') {
        parsedValue = item.valueText === '' ? 0 : Number(item.valueText)
        if (Number.isNaN(parsedValue)) {
          throw new Error(`变量 ${item.name || '(未命名)'} 的值不是有效数字`)
        }
      } else if (item.type === 'boolean') {
        const normalized = item.valueText.trim().toLowerCase()
        parsedValue = ['true', '1', 'yes'].includes(normalized)
      } else if (item.type === 'array') {
        parsedValue = JSON.parse(item.valueText || '[]')
        if (!Array.isArray(parsedValue)) {
          throw new Error(`变量 ${item.name || '(未命名)'} 必须是数组 JSON`)
        }
      } else if (item.type === 'object') {
        parsedValue = JSON.parse(item.valueText || '{}')
        if (!isObjectValue(parsedValue)) {
          throw new Error(`变量 ${item.name || '(未命名)'} 必须是对象 JSON`)
        }
      }

      return {
        name: item.name,
        scope: item.scope,
        type: item.type,
        value: parsedValue,
        description: item.description,
      }
    })
}

const mergeVariableDrafts = (currentItems: SceneVariableDraft[], incomingItems: SceneVariableDraft[]) => {
  const merged = new Map<string, SceneVariableDraft>()

  currentItems.forEach(item => {
    const key = item.name.trim().toLowerCase() || `current-${merged.size}`
    merged.set(key, item)
  })

  incomingItems.forEach(item => {
    const key = item.name.trim().toLowerCase() || `incoming-${merged.size}`
    merged.set(key, item)
  })

  return Array.from(merged.values())
}

const applyGeneratedScenePlan = (plan: AppScenePlanResponse, applyMode: AiApplyMode) => {
  const normalizedPlanSteps = normalizeSteps(plan.steps)
  const normalizedPlanVariables = normalizeVariables(plan.variables)

  if (applyMode === 'replace') {
    steps.value = normalizedPlanSteps
    variableItems.value = normalizedPlanVariables
    draft.name = plan.name || draft.name
    draft.description = plan.description || draft.description
    draft.package_id = plan.package_id ?? undefined
    selectedStepIndex.value = steps.value.length ? 0 : null
  } else {
    const startIndex = steps.value.length
    steps.value = [...steps.value, ...normalizedPlanSteps]
    variableItems.value = mergeVariableDrafts(variableItems.value, normalizedPlanVariables)

    if (!draft.name.trim() && plan.name) {
      draft.name = plan.name
    }
    if (!draft.description.trim() && plan.description) {
      draft.description = plan.description
    }
    if (draft.package_id === undefined && plan.package_id !== null) {
      draft.package_id = plan.package_id
    }

    selectedStepIndex.value = steps.value.length ? startIndex : null
  }

  selectedSubStepIndex.value = null
  selectedSubStepGroupKey.value = null
  syncStepEditor()
}

const replaceSelectedSceneStep = (nextStep: AppSceneStep) => {
  const currentStep = selectedSceneStep.value
  if (!currentStep) {
    return
  }

  const preservedId = currentStep.id ?? generateStepId()
  const preservedExpanded = Boolean(currentStep._expanded)
  const normalized = normalizeStep({
    ...nextStep,
    id: preservedId,
    _expanded: preservedExpanded || Boolean(nextStep._expanded),
  })

  const currentRecord = currentStep as Record<string, unknown>
  Object.keys(currentRecord).forEach(key => {
    delete currentRecord[key]
  })
  Object.assign(currentRecord, normalized)
}

const applyStepSuggestion = (suggestion: AppStepSuggestionResponse) => {
  const normalizedStep = normalizeStep(suggestion.step)
  replaceSelectedSceneStep(normalizedStep)
  variableItems.value = mergeVariableDrafts(variableItems.value, normalizeVariables(suggestion.variables))
  syncStepEditor()
}

const rememberAiActivity = (payload: Omit<AiActivityRecord, 'executed_at'>) => {
  lastAiActivity.value = {
    ...payload,
    warnings: [...payload.warnings],
    executed_at: new Date().toISOString(),
  }
}

const getAiActionLabel = (action: AiActivityRecord['action']) => (action === 'scene' ? '场景规划' : '步骤补全')

const getAiActivityColor = (record: AiActivityRecord) => {
  if (record.status === 'error') return 'red'
  if (record.mode === 'fallback') return 'orange'
  return 'green'
}

const getAiActivityStatusLabel = (record: AiActivityRecord) => {
  if (record.status === 'error') return '执行失败'
  if (record.mode === 'fallback') return '规则回退'
  return 'LLM 已生效'
}

const refreshAiRuntimeStatus = async (showMessage = false): Promise<AppLlmConfigSnapshot | null> => {
  aiStatusLoading.value = true
  try {
    const activeResponse = await getActiveLlmConfig()
    const activeConfig = activeResponse.data
    if (!activeConfig?.id) {
      activeLlmSnapshot.value = null
      resetAiStatus()
      aiStatus.checked_at = new Date().toISOString()
      if (showMessage) {
        Message.info('当前没有激活的 LLM 配置，APP AI 会回退到规则规划')
      }
      return null
    }

    const detailResponse = await getLlmConfigDetails(activeConfig.id)
    const detail = detailResponse.data || activeConfig
    const snapshot: AppLlmConfigSnapshot | null =
      detail?.name && detail?.api_url
        ? {
            config_name: detail.config_name,
            provider: detail.provider,
            name: detail.name,
            api_url: detail.api_url,
            api_key: detail.api_key,
            system_prompt: detail.system_prompt,
            supports_vision: detail.supports_vision,
          }
        : null

    Object.assign(aiStatus, {
      has_config: true,
      ready: Boolean(snapshot),
      config_name: detail?.config_name || '',
      provider: detail?.provider || '',
      model: detail?.name || '',
      api_url: detail?.api_url || '',
      supports_vision: Boolean(detail?.supports_vision),
      checked_at: new Date().toISOString(),
      error: snapshot ? '' : '激活的 LLM 配置缺少模型名称或接口地址，当前会回退到规则规划。',
    })

    activeLlmSnapshot.value = snapshot

    if (!snapshot) {
      if (showMessage) {
        Message.warning(aiStatus.error || 'AI 状态已刷新')
      }
      return null
    }

    if (showMessage) {
      Message.success('AI 模型状态已刷新')
    }

    return snapshot
  } catch (error: any) {
    activeLlmSnapshot.value = null
    resetAiStatus()
    aiStatus.checked_at = new Date().toISOString()
    aiStatus.error = normalizeErrorMessage(error, '加载激活 LLM 配置失败，当前会回退到规则规划。')
    if (showMessage) {
      Message.error(aiStatus.error)
    }
    return null
  } finally {
    aiStatusLoading.value = false
  }
}

const buildLlmConfigSnapshot = async (): Promise<AppLlmConfigSnapshot | null> => {
  if (activeLlmSnapshot.value?.name && activeLlmSnapshot.value?.api_url) {
    return activeLlmSnapshot.value
  }
  return refreshAiRuntimeStatus()
}

const openLlmConfigManagement = async () => {
  await router.push({ name: 'LlmConfigManagement' })
}

const loadComponentPackageRecords = async () => {
  componentPackageLoading.value = true
  try {
    componentPackageRecords.value = await AppAutomationService.getComponentPackages()
  } catch (error: any) {
    Message.error(error.message || '加载组件包记录失败')
    componentPackageRecords.value = []
  } finally {
    componentPackageLoading.value = false
  }
}

const handleComponentPackageFileChange = (fileListParam: FileItem[], fileItem: FileItem) => {
  componentPackageFileList.value = fileListParam.slice(-1)
  if (fileItem?.file) {
    componentPackageFile.value = fileItem.file as File
    return
  }

  if (!componentPackageFileList.value.length) {
    componentPackageFile.value = null
  }
}

const openComponentPackageDialog = async () => {
  componentPackageVisible.value = true
  await loadComponentPackageRecords()
}

const openComponentPackageExportDialog = () => {
  componentPackageExportVisible.value = true
}

const submitComponentPackageImport = async () => {
  if (!componentPackageFile.value) {
    Message.warning('请选择组件包文件')
    return
  }

  componentPackageUploading.value = true
  try {
    const result = await AppAutomationService.importComponentPackage(componentPackageFile.value, componentPackageOverwrite.value)
    componentPackageFile.value = null
    componentPackageFileList.value = []
    await Promise.all([loadData(), loadComponentPackageRecords()])

    const counts = result.counts
    Message.success(
      `组件包已导入：基础组件新增 ${counts.base_created} 个，更新 ${counts.base_updated} 个；自定义组件新增 ${counts.custom_created} 个，更新 ${counts.custom_updated} 个。`,
    )
  } catch (error: any) {
    Message.error(error.message || '导入组件包失败')
  } finally {
    componentPackageUploading.value = false
  }
}

const deleteComponentPackageRecord = (item: AppComponentPackage) => {
  Modal.confirm({
    title: '删除组件包记录',
    content: `确认删除组件包记录“${item.name}”吗？此操作不会删除已经安装的组件，仅删除导入记录。`,
    onOk: async () => {
      await AppAutomationService.deleteComponentPackage(item.id)
      Message.success('组件包记录已删除')
      await loadComponentPackageRecords()
    },
  })
}

const downloadTextFile = (content: string, filename: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType || 'application/octet-stream' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const downloadComponentPackage = async (format: 'json' | 'yaml') => {
  componentPackageExporting.value = true
  try {
    const payload = await AppAutomationService.exportComponentPackage({
      export_format: format,
      include_disabled: componentPackageIncludeDisabled.value,
      name: componentPackageExportForm.name.trim() || 'app-component-pack',
      version: componentPackageExportForm.version.trim(),
      author: componentPackageExportForm.author.trim(),
      description: componentPackageExportForm.description.trim(),
    })
    downloadTextFile(payload.content, payload.filename, payload.content_type)
    Message.success(
      `组件包已导出：基础组件 ${payload.component_count} 个，自定义组件 ${payload.custom_component_count} 个。`,
    )
    componentPackageExportVisible.value = false
  } catch (error: any) {
    Message.error(error.message || '导出组件包失败')
  } finally {
    componentPackageExporting.value = false
  }
}

const filteredComponents = computed(() => {
  const keyword = componentSearch.value.trim().toLowerCase()
  if (!keyword) {
    return components.value
  }
  return components.value.filter(item =>
    [item.name, item.type, item.description, item.category]
      .join(' ')
      .toLowerCase()
      .includes(keyword),
  )
})

const filteredCustomComponents = computed(() => {
  const keyword = componentSearch.value.trim().toLowerCase()
  if (!keyword) {
    return customComponents.value
  }
  return customComponents.value.filter(item =>
    [item.name, item.type, item.description]
      .join(' ')
      .toLowerCase()
      .includes(keyword),
  )
})

const selectedParentStep = computed(() => {
  if (selectedStepIndex.value === null) {
    return null
  }
  return steps.value[selectedStepIndex.value] || null
})

const selectedSceneStep = computed(() => {
  const parentStep = selectedParentStep.value
  if (!parentStep) {
    return null
  }
  if (selectedSubStepIndex.value === null) {
    return parentStep
  }
  if (!selectedSubStepGroupKey.value) {
    return null
  }
  return getStepGroupSteps(parentStep, selectedSubStepGroupKey.value)[selectedSubStepIndex.value] || null
})

const selectedStepActionType = computed(() => getStepType(selectedSceneStep.value))

const usesBasicSelectorQuickConfig = (action?: string | null) =>
  ['touch', 'double_click', 'long_press', 'text', 'wait', 'assert_exists'].includes(String(action || ''))

const usesSwipeToQuickConfig = (action?: string | null) => String(action || '') === 'swipe_to'

const usesSwipeQuickConfig = (action?: string | null) => String(action || '') === 'swipe'

const usesDragQuickConfig = (action?: string | null) => String(action || '') === 'drag'

const usesImageBranchQuickConfig = (action?: string | null) =>
  ['image_exists_click', 'image_exists_click_chain'].includes(String(action || ''))

const usesAssertQuickConfig = (action?: string | null) => String(action || '') === 'assert'

const usesForeachAssertQuickConfig = (action?: string | null) => String(action || '') === 'foreach_assert'

const usesVariableMutationQuickConfig = (action?: string | null) =>
  ['set_variable', 'unset_variable'].includes(String(action || ''))

const usesExtractOutputQuickConfig = (action?: string | null) => String(action || '') === 'extract_output'

const usesApiRequestQuickConfig = (action?: string | null) => String(action || '') === 'api_request'

const usesDeviceActionQuickConfig = (action?: string | null) =>
  ['snapshot', 'launch_app', 'stop_app', 'keyevent'].includes(String(action || ''))

const readSelectedConfigValue = (key: string, fallback: unknown = '') => {
  const step = selectedSceneStep.value
  if (!step || !isObjectValue(step.config)) {
    return fallback
  }
  return step.config[key] ?? fallback
}

const readSelectedConfigString = (key: string, fallback = '') => String(readSelectedConfigValue(key, fallback) ?? fallback)

const readSelectedConfigNumber = (key: string, fallback = 0) => {
  const raw = readSelectedConfigValue(key, fallback)
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

const readSelectedConfigBoolean = (key: string, fallback = false) => {
  const raw = readSelectedConfigValue(key, fallback)
  return typeof raw === 'boolean' ? raw : Boolean(raw)
}

const updateSelectedStepConfig = (key: string, value: unknown) => {
  const step = selectedSceneStep.value
  if (!step || selectedCustomParentSummary.value) {
    return
  }
  const nextConfig = isObjectValue(step.config) ? clone(step.config) : {}
  if (value === undefined) {
    delete nextConfig[key]
  } else {
    nextConfig[key] = value
  }
  step.config = nextConfig
  syncStepEditor()
}

const formatQuickConfigValue = (value: unknown) => {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const parseLooseEditorValue = (value: string) => {
  const text = String(value || '')
  const trimmed = text.trim()
  if (!trimmed) {
    return ''
  }

  const shouldParseJson =
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    trimmed.startsWith('"') ||
    trimmed === 'true' ||
    trimmed === 'false' ||
    trimmed === 'null' ||
    /^-?\d+(\.\d+)?$/.test(trimmed)

  if (shouldParseJson) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return text
    }
  }

  return text
}

const handleLooseConfigTextChange = (key: string, value: string) => {
  const text = String(value || '')
  if (!text.trim()) {
    updateSelectedStepConfig(key, undefined)
    return
  }
  updateSelectedStepConfig(key, parseLooseEditorValue(text))
}

const handleJsonConfigTextChange = (key: string, value: string, emptyValue?: unknown) => {
  const text = String(value || '')
  if (!text.trim()) {
    updateSelectedStepConfig(key, emptyValue)
    return
  }

  try {
    updateSelectedStepConfig(key, JSON.parse(text))
  } catch {
    Message.warning(`${key} 需要填写合法 JSON`)
  }
}

const selectedAssertType = computed(() => readSelectedConfigString('assert_type', 'condition'))

const selectedAssertQuickMode = computed(() => {
  const assertType = selectedAssertType.value
  if (['text', 'number', 'regex', 'range'].includes(assertType)) {
    return 'ocr'
  }
  if (assertType === 'image') {
    return 'image'
  }
  if (['exists', 'not_exists'].includes(assertType)) {
    return 'exists'
  }
  return 'condition'
})

const selectedPrimarySelectorType = computed(() => readSelectedConfigString('selector_type', 'element'))
const selectedFallbackSelectorType = computed(() => readSelectedConfigString('fallback_selector_type', 'element'))
const selectedClickSelectorType = computed(() => readSelectedConfigString('click_selector_type', 'element'))
const selectedTargetSelectorType = computed(() => readSelectedConfigString('target_selector_type', 'text'))
const selectedVariableScope = computed(() => readSelectedConfigString('scope', 'local'))

const expectedListText = computed(() => {
  const raw = readSelectedConfigValue('expected_list', [])
  if (Array.isArray(raw)) {
    return raw.map(item => String(item ?? '')).join('\n')
  }
  return String(raw || '')
})

const handleExpectedListTextChange = (value: string) => {
  const text = String(value || '')
  const trimmed = text.trim()
  if (!trimmed) {
    updateSelectedStepConfig('expected_list', [])
    return
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        updateSelectedStepConfig('expected_list', parsed)
        return
      }
    } catch {
      // Fall back to newline parsing below.
    }
  }

  updateSelectedStepConfig(
    'expected_list',
    text
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean),
  )
}

const handleAssertTypeChange = (value: string) => {
  const nextType = String(value || 'condition')
  updateSelectedStepConfig('assert_type', nextType)

  if (['text', 'number', 'regex', 'range'].includes(nextType)) {
    updateSelectedStepConfig('selector_type', 'region')
    return
  }

  if (nextType === 'image') {
    updateSelectedStepConfig('selector_type', 'image')
    return
  }

  if (['exists', 'not_exists'].includes(nextType) && !readSelectedConfigString('selector_type', '')) {
    updateSelectedStepConfig('selector_type', 'element')
  }
}

const selectedCustomParentSummary = computed(
  () => Boolean(selectedParentStep.value && selectedSubStepIndex.value === null && isCustomStep(selectedParentStep.value)),
)

const configKeys = computed(() => Object.keys(buildStepEditorPayload(selectedSceneStep.value)))

const syncStepEditor = () => {
  const step = selectedSceneStep.value
  if (!step || selectedCustomParentSummary.value) {
    stepConfigText.value = '{}'
    return
  }
  stepConfigText.value = JSON.stringify(buildStepEditorPayload(step), null, 2)
}

const buildBaseStep = (component: AppComponent) =>
  normalizeStep(
    {
      name: component.name,
      kind: 'base',
      type: component.type,
      action: component.type,
      component_type: component.type,
      config: clone(component.default_config || {}),
      _expanded: isFlowContainerType(component.type),
    },
    'base',
  )

const buildCustomStep = (component: AppCustomComponent) =>
  normalizeStep(
    {
      name: component.name,
      kind: 'custom',
      type: component.type,
      action: component.type,
      component_type: component.type,
      config: clone(component.default_config || {}),
      steps: normalizeSteps(component.steps || []),
      _expanded: true,
    },
    'custom',
  )

const cloneSceneStep = (step: AppSceneStep) => {
  const duplicated = normalizeStep(clone(step), isCustomStep(step) ? 'custom' : 'base')
  duplicated.name = `${step.name || resolveStepTitle(step)} 副本`
  return duplicated
}

const addVariable = () => {
  variableItems.value.push({
    name: '',
    scope: 'local',
    type: 'string',
    valueText: '',
    description: '',
  })
}

const removeVariable = (index: number) => {
  variableItems.value.splice(index, 1)
}

const resetDraft = () => {
  selectedCaseId.value = undefined
  selectedStepIndex.value = null
  selectedSubStepIndex.value = null
  selectedSubStepGroupKey.value = null
  executeVisible.value = false
  executeForm.device_id = undefined
  steps.value = []
  variableItems.value = []
  draft.name = ''
  draft.description = ''
  draft.package_id = undefined
  draft.timeout = 300
  draft.retry_count = 0
  clearRecord(subStepSelections)
  syncStepEditor()
}

const createDraft = () => {
  resetDraft()
  syncRouteCaseId()
}

const applyCase = (record?: AppTestCase) => {
  if (!record) {
    resetDraft()
    return
  }

  selectedCaseId.value = record.id
  draft.name = record.name
  draft.description = record.description
  draft.package_id = record.package_id ?? undefined
  draft.timeout = record.timeout
  draft.retry_count = record.retry_count
  variableItems.value = normalizeVariables(record.variables)
  steps.value = normalizeSteps(record.ui_flow?.steps)
  selectedStepIndex.value = steps.value.length ? 0 : null
  selectedSubStepIndex.value = null
  selectedSubStepGroupKey.value = null
  clearRecord(subStepSelections)
  syncStepEditor()
}

const reloadDevices = async () => {
  try {
    devices.value = await AppAutomationService.getDevices()
    return true
  } catch (error: any) {
    Message.error(error.message || '加载设备列表失败')
    return false
  }
}

const loadData = async () => {
  if (!projectStore.currentProjectId) {
    components.value = []
    customComponents.value = []
    devices.value = []
    packages.value = []
    testCases.value = []
    resetDraft()
    return
  }

  loading.value = true
  try {
    const [baseComponents, userComponents, deviceList, packageList, caseList] = await Promise.all([
      AppAutomationService.getComponents(),
      AppAutomationService.getCustomComponents(),
      AppAutomationService.getDevices(),
      AppAutomationService.getPackages(projectStore.currentProjectId),
      AppAutomationService.getTestCases(projectStore.currentProjectId),
      refreshAiRuntimeStatus(),
    ])

    components.value = baseComponents
    customComponents.value = userComponents
    devices.value = deviceList
    packages.value = packageList
    testCases.value = caseList

    const activeCaseId = readRouteCaseId() ?? selectedCaseId.value
    if (activeCaseId) {
      const current = caseList.find(item => item.id === activeCaseId)
      if (current) {
        applyCase(current)
      } else if (readRouteCaseId()) {
        resetDraft()
        syncRouteCaseId()
      }
    }
  } catch (error: any) {
    Message.error(error.message || '加载场景编排数据失败')
  } finally {
    loading.value = false
  }
}

const validateDraftBeforeSave = () => {
  if (!projectStore.currentProjectId) {
    Message.warning('请先选择项目')
    return false
  }

  if (!draft.name.trim()) {
    Message.warning('请输入用例名称')
    return false
  }

  if (!steps.value.length) {
    Message.warning('请至少添加一个步骤')
    return false
  }

  return true
}

const buildTestCasePayload = () => ({
  project_id: projectStore.currentProjectId as number,
  name: draft.name.trim(),
  description: draft.description.trim(),
  package_id: draft.package_id ?? null,
  ui_flow: {
    steps: steps.value.map(item => sanitizeStep(item)),
  },
  variables: buildVariablePayload(),
  tags: [],
  timeout: draft.timeout,
  retry_count: draft.retry_count,
})

const persistDraft = async (options: { showMessage?: boolean } = {}) => {
  if (!validateDraftBeforeSave()) {
    return undefined
  }

  const { showMessage = true } = options
  saving.value = true
  try {
    const payload = buildTestCasePayload()

    if (selectedCaseId.value) {
      const updated = await AppAutomationService.updateTestCase(selectedCaseId.value, payload)
      selectedCaseId.value = updated.id
      syncRouteCaseId(updated.id)
      if (showMessage) {
        Message.success('测试用例已更新')
      }
    } else {
      const created = await AppAutomationService.createTestCase(payload)
      selectedCaseId.value = created.id
      syncRouteCaseId(created.id)
      if (showMessage) {
        Message.success('测试用例已创建')
      }
    }

    await loadData()
    return selectedCaseId.value
  } catch (error: any) {
    Message.error(error.message || '保存测试用例失败')
    return undefined
  } finally {
    saving.value = false
  }
}

const handleCaseChange = (value?: number) => {
  const record = testCases.value.find(item => item.id === value)
  applyCase(record)
  syncRouteCaseId(record?.id)
}

const openTestCaseWorkspace = async () => {
  await router.push({
    path: '/app-automation',
    query: {
      tab: 'test-cases',
    },
  })
}

const openExecutionWorkspace = async (executionId?: number) => {
  const query: Record<string, string> = {
    tab: 'executions',
  }

  if (executionId) {
    query.executionId = String(executionId)
  }

  await router.push({
    path: '/app-automation',
    query,
  })
}

const openExecuteDialog = async () => {
  if (!validateDraftBeforeSave()) {
    return
  }

  if (!availableDevices.value.length) {
    const loaded = await reloadDevices()
    if (!loaded) {
      return
    }
  }

  if (!availableDevices.value.length) {
    Message.warning('暂无可用设备，请先在设备管理中连接并解锁设备')
    return
  }

  if (!executeForm.device_id || !availableDevices.value.some(device => device.id === executeForm.device_id)) {
    executeForm.device_id = availableDevices.value[0]?.id
  }

  executeVisible.value = true
}

const executeCurrentDraft = async (): Promise<AppExecution | undefined> => {
  if (!executeForm.device_id) {
    Message.warning('请选择执行设备')
    return undefined
  }

  const caseId = await persistDraft({ showMessage: false })
  if (!caseId) {
    return undefined
  }

  executing.value = true
  try {
    const execution = await AppAutomationService.executeTestCase(caseId, {
      device_id: executeForm.device_id,
      trigger_mode: 'manual',
      triggered_by: authStore.currentUser?.username || 'FlyTest',
    })
    executeVisible.value = false
    Message.success('执行任务已启动，正在跳转到执行记录')
    await openExecutionWorkspace(execution.id)
    return execution
  } catch (error: any) {
    Message.error(error.message || '启动执行任务失败')
    return undefined
  } finally {
    executing.value = false
  }
}

const appendBaseComponent = (component: AppComponent) => {
  steps.value.push(buildBaseStep(component))
  selectedStepIndex.value = steps.value.length - 1
  selectedSubStepIndex.value = null
  selectedSubStepGroupKey.value = null
}

const appendCustomComponent = (component: AppCustomComponent) => {
  steps.value.push(buildCustomStep(component))
  selectedStepIndex.value = steps.value.length - 1
  selectedSubStepIndex.value = null
  selectedSubStepGroupKey.value = null
  paletteTab.value = 'custom'
}

const selectStep = (index: number) => {
  selectedStepIndex.value = index
  selectedSubStepIndex.value = null
  selectedSubStepGroupKey.value = null
}

const selectSubStep = (parentIndex: number, groupKey: StepChildGroupKey, subIndex: number) => {
  selectedStepIndex.value = parentIndex
  selectedSubStepGroupKey.value = groupKey
  selectedSubStepIndex.value = subIndex
}

const toggleExpand = (index: number) => {
  const step = steps.value[index]
  if (!isContainerStep(step)) {
    return
  }

  step._expanded = !step._expanded
  if (!step._expanded && selectedStepIndex.value === index && selectedSubStepIndex.value !== null) {
    selectedSubStepIndex.value = null
    selectedSubStepGroupKey.value = null
  }
}

const duplicateStep = (index: number) => {
  const source = steps.value[index]
  if (!source) {
    return
  }

  steps.value.splice(index + 1, 0, cloneSceneStep(source))
  selectedStepIndex.value = index + 1
  selectedSubStepIndex.value = null
  selectedSubStepGroupKey.value = null
}

const removeStep = (index: number) => {
  steps.value.splice(index, 1)

  if (!steps.value.length) {
    selectedStepIndex.value = null
    selectedSubStepIndex.value = null
    selectedSubStepGroupKey.value = null
    return
  }

  if (selectedStepIndex.value === index) {
    selectedStepIndex.value = Math.min(index, steps.value.length - 1)
    selectedSubStepIndex.value = null
    selectedSubStepGroupKey.value = null
  } else if (selectedStepIndex.value !== null && selectedStepIndex.value > index) {
    selectedStepIndex.value -= 1
  }
}

const clearSteps = () => {
  steps.value = []
  selectedStepIndex.value = null
  selectedSubStepIndex.value = null
  selectedSubStepGroupKey.value = null
  clearRecord(subStepSelections)
  syncStepEditor()
}

const updateStepGroupItems = (step: AppSceneStep, groupKey: StepChildGroupKey, items: AppSceneStep[]) => {
  step[groupKey] = items
}

const addSubStep = (parentIndex: number, groupKey: StepChildGroupKey) => {
  const parentStep = steps.value[parentIndex]
  if (!isContainerStep(parentStep)) {
    return
  }

  const selectedType = subStepSelections[getSubStepSelectionKey(parentStep, groupKey)]
  if (!selectedType) {
    Message.warning('请先选择一个基础组件')
    return
  }

  const component = componentMap.value.get(selectedType)
  if (!component) {
    Message.warning('未找到对应的基础组件')
    return
  }

  const nextSteps = [...getStepGroupSteps(parentStep, groupKey), buildBaseStep(component)]
  setNormalizedGroupSteps(parentStep, groupKey, nextSteps)
  parentStep._expanded = true
  selectSubStep(parentIndex, groupKey, nextSteps.length - 1)
}

const duplicateSubStep = (parentIndex: number, groupKey: StepChildGroupKey, subIndex: number) => {
  const parentStep = steps.value[parentIndex]
  if (!parentStep) {
    return
  }

  const currentSteps = [...getStepGroupSteps(parentStep, groupKey)]
  const source = currentSteps[subIndex]
  if (!source) {
    return
  }

  currentSteps.splice(subIndex + 1, 0, cloneSceneStep(source))
  setNormalizedGroupSteps(parentStep, groupKey, currentSteps)
  selectSubStep(parentIndex, groupKey, subIndex + 1)
}

const removeSubStep = (parentIndex: number, groupKey: StepChildGroupKey, subIndex: number) => {
  const parentStep = steps.value[parentIndex]
  if (!parentStep) {
    return
  }

  const nextSteps = [...getStepGroupSteps(parentStep, groupKey)]
  nextSteps.splice(subIndex, 1)
  setNormalizedGroupSteps(parentStep, groupKey, nextSteps)

  if (selectedStepIndex.value === parentIndex && selectedSubStepGroupKey.value === groupKey && selectedSubStepIndex.value !== null) {
    if (!nextSteps.length) {
      selectedSubStepIndex.value = null
      selectedSubStepGroupKey.value = null
    } else if (selectedSubStepIndex.value === subIndex) {
      selectedSubStepIndex.value = Math.min(subIndex, nextSteps.length - 1)
    } else if (selectedSubStepIndex.value > subIndex) {
      selectedSubStepIndex.value -= 1
    }
  }
}

const applyStepConfig = () => {
  const step = selectedSceneStep.value
  if (!step || selectedCustomParentSummary.value) {
    return
  }

  try {
    const parsed = JSON.parse(stepConfigText.value || '{}')
    if (!isObjectValue(parsed)) {
      throw new Error('配置 JSON 必须是对象')
    }
    applyStepEditorPayload(step, parsed)
    syncStepEditor()
    Message.success('当前步骤配置已更新')
  } catch (error: any) {
    Message.error(error.message || '步骤配置 JSON 格式不正确')
  }
}

const resetSelectedStepConfig = () => {
  const step = selectedSceneStep.value
  if (!step || selectedCustomParentSummary.value) {
    return
  }

  const template = componentMap.value.get(getStepType(step))
  const nextConfig = stripNestedStepKeys(clone(template?.default_config || {}))
  if (isFlowContainerStep(step)) {
    getStepChildGroups(step).forEach(group => {
      nextConfig[group.key] = getStepGroupSteps(step, group.key).map(item => sanitizeStep(item))
    })
  }
  applyStepEditorPayload(step, nextConfig)
  syncStepEditor()
  Message.success('已恢复默认配置')
}

const openAiStepDialog = () => {
  const step = selectedSceneStep.value
  if (!step || selectedCustomParentSummary.value) {
    Message.warning('请先选择一个可编辑的步骤')
    return
  }

  const promptParts = [step.name?.trim(), resolveStepMeta(step), draft.description.trim()].filter(Boolean)
  aiStepForm.prompt = aiStepForm.prompt.trim() || promptParts.join('，')
  aiStepVisible.value = true
}

const generateAiStepSuggestion = async () => {
  if (!projectStore.currentProjectId) {
    Message.warning('请先选择项目')
    return
  }

  const step = selectedSceneStep.value
  if (!step || selectedCustomParentSummary.value) {
    Message.warning('请先选择一个可编辑的步骤')
    return
  }

  if (!aiStepForm.prompt.trim()) {
    Message.warning('请输入步骤补全说明')
    return
  }

  aiStepSuggesting.value = true
  try {
    const promptText = aiStepForm.prompt.trim()
    let currentVariables: Array<Record<string, unknown>> = []
    try {
      currentVariables = buildVariablePayload()
    } catch {
      currentVariables = []
    }

    const llmConfig = await buildLlmConfigSnapshot()
    const suggestion = await AppAutomationService.suggestStep({
      project_id: projectStore.currentProjectId,
      prompt: promptText,
      package_id: draft.package_id ?? null,
      current_case_name: draft.name.trim(),
      current_description: draft.description.trim(),
      current_step: sanitizeStep(step),
      current_steps: steps.value.map(item => sanitizeStep(item)),
      current_variables: currentVariables,
      llm_config: llmConfig,
    })

    applyStepSuggestion(suggestion)
    aiStepVisible.value = false
    rememberAiActivity({
      action: 'step',
      status: 'success',
      mode: suggestion.mode,
      summary: suggestion.summary || '当前步骤已补全',
      prompt: promptText,
      target_name: step.name || resolveStepTitle(step),
      warnings: suggestion.warnings || [],
      provider: suggestion.provider || llmConfig?.provider || '',
      model: suggestion.model || llmConfig?.name || '',
    })

    if (suggestion.mode === 'fallback') {
      Message.warning(suggestion.warnings?.[0] || 'AI 模型不可用，已回退到规则补全。')
    } else {
      Message.success(suggestion.summary || '当前步骤已补全')
      if (suggestion.warnings?.length) {
        Message.warning(suggestion.warnings[0])
      }
    }
  } catch (error: any) {
    rememberAiActivity({
      action: 'step',
      status: 'error',
      mode: 'fallback',
      summary: normalizeErrorMessage(error, 'AI 步骤补全失败'),
      prompt: aiStepForm.prompt.trim(),
      target_name: step.name || resolveStepTitle(step),
      warnings: [],
      provider: activeLlmSnapshot.value?.provider || '',
      model: activeLlmSnapshot.value?.name || '',
    })
    Message.error(error.message || 'AI 步骤补全失败')
  } finally {
    aiStepSuggesting.value = false
  }
}

const openAiPlanDialog = () => {
  const promptParts = [draft.name.trim(), draft.description.trim()].filter(Boolean)
  aiPlanForm.prompt = aiPlanForm.prompt.trim() || promptParts.join('，')
  aiPlanForm.applyMode = steps.value.length ? 'append' : 'replace'
  aiPlanVisible.value = true
}

const generateAiPlan = async () => {
  if (!projectStore.currentProjectId) {
    Message.warning('请先选择项目')
    return
  }

  if (!aiPlanForm.prompt.trim()) {
    Message.warning('请输入场景描述')
    return
  }

  aiGenerating.value = true
  try {
    const promptText = aiPlanForm.prompt.trim()
    let currentVariables: Array<Record<string, unknown>> = []
    try {
      currentVariables = buildVariablePayload()
    } catch {
      currentVariables = []
    }

    const llmConfig = await buildLlmConfigSnapshot()
    const plan = await AppAutomationService.generateScenePlan({
      project_id: projectStore.currentProjectId,
      prompt: promptText,
      package_id: draft.package_id ?? null,
      current_case_name: draft.name.trim(),
      current_description: draft.description.trim(),
      current_steps: steps.value.map(item => sanitizeStep(item)),
      current_variables: currentVariables,
      llm_config: llmConfig,
    })

    applyGeneratedScenePlan(plan, aiPlanForm.applyMode)
    aiPlanVisible.value = false
    rememberAiActivity({
      action: 'scene',
      status: 'success',
      mode: plan.mode,
      summary: plan.summary || 'AI 场景已生成',
      prompt: promptText,
      target_name: draft.name.trim() || plan.name || '当前场景草稿',
      warnings: plan.warnings || [],
      provider: plan.provider || llmConfig?.provider || '',
      model: plan.model || llmConfig?.name || '',
    })

    if (plan.mode === 'fallback') {
      Message.warning(plan.warnings?.[0] || 'AI 模型不可用，已回退到规则规划。')
    } else {
      Message.success(plan.summary || 'AI 场景已生成')
      if (plan.warnings?.length) {
        Message.warning(plan.warnings[0])
      }
    }
  } catch (error: any) {
    rememberAiActivity({
      action: 'scene',
      status: 'error',
      mode: 'fallback',
      summary: normalizeErrorMessage(error, 'AI 场景生成失败'),
      prompt: aiPlanForm.prompt.trim(),
      target_name: draft.name.trim() || '当前场景草稿',
      warnings: [],
      provider: activeLlmSnapshot.value?.provider || '',
      model: activeLlmSnapshot.value?.name || '',
    })
    Message.error(error.message || 'AI 场景生成失败')
  } finally {
    aiGenerating.value = false
  }
}

const openCreateCustomComponent = () => {
  if (!steps.value.length) {
    Message.warning('请先添加场景步骤')
    return
  }

  if (steps.value.some(item => containsCustomStep(item))) {
    Message.warning('自定义组件中暂不支持嵌套自定义组件')
    return
  }

  customComponentMode.value = 'create'
  editingCustomComponentId.value = null
  customComponentForm.name = ''
  customComponentForm.type = `scene_component_${customComponents.value.length + 1}`
  customComponentForm.description = ''
  customComponentForm.stepsText = JSON.stringify(steps.value.map(item => sanitizeStep(item)), null, 2)
  customComponentVisible.value = true
}

const openEditCustomComponent = (component: AppCustomComponent) => {
  customComponentMode.value = 'edit'
  editingCustomComponentId.value = component.id
  customComponentForm.name = component.name
  customComponentForm.type = component.type
  customComponentForm.description = component.description
  customComponentForm.stepsText = JSON.stringify(normalizeSteps(component.steps || []).map(item => sanitizeStep(item)), null, 2)
  customComponentVisible.value = true
}

const buildCustomComponentSteps = () => {
  let parsed: unknown

  try {
    parsed = JSON.parse(customComponentForm.stepsText || '[]')
  } catch {
    throw new Error('组件步骤 JSON 格式不正确')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('组件步骤 JSON 必须是数组')
  }

  const normalized = normalizeSteps(parsed)
  if (normalized.some(item => containsCustomStep(item))) {
    throw new Error('自定义组件中不支持嵌套自定义组件')
  }

  return normalized.map(item => sanitizeStep(item))
}

const saveCustomComponent = async () => {
  const name = customComponentForm.name.trim()
  const type = toComponentType(customComponentForm.type || customComponentForm.name)

  if (!name) {
    Message.warning('请输入组件名称')
    return
  }

  customComponentSaving.value = true
  try {
    const payload = {
      name,
      type,
      description: customComponentForm.description.trim(),
      schema: {},
      default_config: {},
      steps: buildCustomComponentSteps(),
      enabled: true,
      sort_order: customComponents.value.length + 1,
    }

    if (!payload.steps.length) {
      Message.warning('请至少保留一个组件步骤')
      return
    }

    if (customComponentMode.value === 'edit' && editingCustomComponentId.value) {
      const current = customComponents.value.find(item => item.id === editingCustomComponentId.value)
      await AppAutomationService.updateCustomComponent(editingCustomComponentId.value, {
        ...payload,
        enabled: current?.enabled ?? true,
        sort_order: current?.sort_order ?? payload.sort_order,
      })
      Message.success('自定义组件已更新')
    } else {
      await AppAutomationService.createCustomComponent(payload)
      Message.success('自定义组件已创建')
    }

    customComponentVisible.value = false
    await loadData()
    paletteTab.value = 'custom'
  } catch (error: any) {
    Message.error(error.message || '保存自定义组件失败')
  } finally {
    customComponentSaving.value = false
  }
}

const deleteCustomComponent = (component: AppCustomComponent) => {
  Modal.confirm({
    title: '删除自定义组件',
    content: `确认删除自定义组件“${component.name}”吗？`,
    onOk: async () => {
      await AppAutomationService.deleteCustomComponent(component.id)
      Message.success('自定义组件已删除')
      await loadData()
    },
  })
}

const saveDraft = async () => {
  await persistDraft()
}

watch(
  () => projectStore.currentProjectId,
  () => {
    resetDraft()
    void loadData()
  },
  { immediate: true },
)

watch(
  () => route.query.caseId,
  () => {
    if (!projectStore.currentProjectId) {
      return
    }

    const routeCaseId = readRouteCaseId()
    if (!routeCaseId) {
      if (selectedCaseId.value !== undefined) {
        resetDraft()
      }
      return
    }

    if (selectedCaseId.value === routeCaseId) {
      return
    }

    const record = testCases.value.find(item => item.id === routeCaseId)
    if (record) {
      applyCase(record)
      return
    }

    if (!loading.value) {
      void loadData()
    }
  },
)

watch([selectedStepIndex, selectedSubStepIndex, selectedSubStepGroupKey], () => {
  syncStepEditor()
})
</script>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-shell {
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-card-bg);
  border: 1px solid var(--theme-card-border);
  border-radius: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-actions {
  justify-content: flex-end;
}

.page-header h3 {
  margin: 0;
  color: var(--theme-text);
}

.page-header p {
  margin: 6px 0 0;
  color: var(--theme-text-secondary);
}

.ai-status-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-status-header,
.ai-activity-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ai-status-copy,
.ai-activity-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-status-kicker,
.ai-activity-kicker {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--theme-text-secondary);
}

.ai-status-copy strong,
.ai-activity-copy strong {
  color: var(--theme-text);
  font-size: 18px;
}

.ai-status-copy p {
  margin: 0;
  color: var(--theme-text-secondary);
  line-height: 1.7;
}

.ai-status-grid,
.ai-dialog-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.ai-status-item,
.ai-dialog-item,
.ai-activity-panel {
  border-radius: 14px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.16);
  background: rgba(var(--theme-accent-rgb), 0.05);
}

.ai-status-item,
.ai-dialog-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
}

.ai-status-item span,
.ai-dialog-item span {
  font-size: 12px;
  color: var(--theme-text-secondary);
}

.ai-status-item strong,
.ai-dialog-item strong {
  color: var(--theme-text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.ai-status-item small {
  color: var(--theme-text-secondary);
  line-height: 1.6;
}

.ai-activity-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-activity-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.ai-activity-summary {
  color: var(--theme-text);
  line-height: 1.7;
  font-weight: 500;
}

.ai-activity-prompt {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(var(--theme-surface-rgb), 0.72);
  color: var(--theme-text-secondary);
  line-height: 1.7;
  word-break: break-word;
}

.ai-warning-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-warning-item,
.ai-activity-empty {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(var(--warning-6), 0.24);
  background: rgba(var(--warning-6), 0.08);
  color: rgb(var(--warning-6));
  line-height: 1.7;
}

.ai-activity-empty {
  border-color: rgba(var(--theme-accent-rgb), 0.16);
  background: rgba(var(--theme-accent-rgb), 0.05);
  color: var(--theme-text-secondary);
}

.form-card,
.panel-card {
  border-radius: 16px;
  border: 1px solid var(--theme-card-border);
  background: var(--theme-card-bg);
  box-shadow: var(--theme-card-shadow);
}

.variable-list {
  border: 1px dashed rgba(var(--theme-accent-rgb), 0.24);
  border-radius: 14px;
  padding: 14px;
  background: rgba(var(--theme-accent-rgb), 0.04);
}

.variable-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.variable-row {
  display: grid;
  grid-template-columns: 1.1fr 120px 120px 1.2fr 1.1fr auto;
  gap: 10px;
  align-items: center;
}

.variable-actions {
  margin-top: 10px;
}

.builder-grid {
  display: grid;
  grid-template-columns: 1.05fr 1.2fr 0.95fr;
  gap: 16px;
  min-height: 560px;
}

.library-panel,
.canvas-panel,
.config-panel {
  min-height: 560px;
}

.component-search {
  margin-bottom: 14px;
}

.component-package-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.component-package-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.14);
  background: rgba(var(--theme-accent-rgb), 0.05);
}

.component-package-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.component-package-copy strong {
  color: var(--theme-text);
}

.component-package-copy span,
.component-package-meta {
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.component-package-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.component-grid {
  display: grid;
  gap: 10px;
}

.component-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.16);
  background: rgba(var(--theme-accent-rgb), 0.06);
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.component-item:hover {
  transform: translateY(-1px);
  border-color: rgba(var(--theme-accent-rgb), 0.34);
  background: rgba(var(--theme-accent-rgb), 0.09);
}

.component-item-custom {
  background: rgba(var(--theme-accent-rgb), 0.1);
}

.component-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.component-name {
  font-weight: 700;
  color: var(--theme-text);
}

.component-meta,
.component-tag {
  font-size: 12px;
  color: var(--theme-text-secondary);
}

.component-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.step-list,
.draggable-root,
.sub-step-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step-item-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-item,
.sub-step-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--theme-card-border);
  background: rgba(var(--theme-accent-rgb), 0.04);
  cursor: pointer;
}

.step-item.active,
.sub-step-item.active {
  border-color: rgba(var(--theme-accent-rgb), 0.42);
  box-shadow: 0 12px 28px rgba(var(--theme-accent-rgb), 0.12);
}

.step-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.drag-handle {
  color: var(--theme-text-secondary);
  cursor: move;
  user-select: none;
}

.step-index {
  min-width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(var(--theme-accent-rgb), 0.14);
  color: var(--theme-accent);
  font-weight: 700;
}

.sub-index {
  background: rgba(var(--theme-accent-rgb), 0.22);
}

.step-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.step-copy strong {
  color: var(--theme-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-copy span,
.step-counter {
  font-size: 12px;
  color: var(--theme-text-secondary);
}

.sub-step-shell {
  border: 1px solid rgba(var(--theme-accent-rgb), 0.18);
  border-radius: 14px;
  background: rgba(var(--theme-accent-rgb), 0.05);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sub-step-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.14);
  background: rgba(var(--theme-accent-rgb), 0.04);
}

.sub-step-group-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sub-step-group-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sub-step-group-copy strong {
  color: var(--theme-text);
}

.sub-step-group-copy span {
  font-size: 12px;
  color: var(--theme-text-secondary);
}

.sub-step-toolbar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.config-empty,
.config-empty-text {
  color: var(--theme-text-secondary);
}

.config-summary,
.config-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.config-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-top: -6px;
}

.config-flow-alert {
  margin-bottom: 4px;
}

.config-helper-alert {
  margin-bottom: 4px;
}

.quick-config-panel {
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.18);
  background: rgba(var(--theme-accent-rgb), 0.05);
}

.quick-config-title {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-text);
}

.quick-config-subtle-alert {
  margin-bottom: 12px;
  background: rgba(var(--theme-surface-rgb), 0.72);
}

.config-keys {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.custom-dialog-alert {
  margin-bottom: 14px;
}

.ai-dialog-meta {
  margin-bottom: 14px;
}

.execute-device-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--theme-text-secondary);
  font-size: 12px;
}

@media (max-width: 1480px) {
  .builder-grid {
    grid-template-columns: 1fr;
  }

  .ai-status-grid,
  .ai-dialog-meta {
    grid-template-columns: 1fr;
  }

  .variable-row {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 960px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .ai-status-header,
  .ai-activity-header {
    flex-direction: column;
  }

  .variable-row {
    grid-template-columns: 1fr;
  }

  .sub-step-toolbar {
    grid-template-columns: 1fr;
  }

  .sub-step-group-copy {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
