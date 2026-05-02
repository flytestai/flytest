<template>
  <div class="test-report-view">
    <div v-if="!currentProjectId" class="empty-state">
      <a-empty description="请先选择项目" />
    </div>

    <div v-else class="report-layout">
      <section class="report-sidebar">
        <div class="sidebar-header">
          <div>
            <div class="sidebar-title">测试报告</div>
            <div class="sidebar-subtitle">
              勾选一个或多个根套件、子套件，基于测试用例与 BUG 数据生成本轮迭代测试报告。
            </div>
          </div>
          <a-button size="small" @click="fetchSuites">刷新</a-button>
        </div>

        <a-input-search
          v-model="searchKeyword"
          placeholder="搜索套件名称"
          allow-clear
          @search="fetchSuites"
          @clear="fetchSuites"
        />

        <div class="sidebar-toolbar">
          <a-space>
            <a-button size="mini" @click="checkAllSuites">全选</a-button>
            <a-button size="mini" @click="clearCheckedSuites">清空</a-button>
            <a-button size="mini" @click="expandAllSuites">展开</a-button>
          </a-space>
          <span class="checked-summary">已选 {{ checkedSuiteIds.length }} 个</span>
        </div>

        <div class="suite-tree-panel">
          <a-spin :loading="suiteLoading" style="width: 100%">
            <a-tree
              v-if="treeData.length > 0"
              checkable
              block-node
              show-line
              :data="treeData"
              :field-names="{ key: 'id', title: 'name' }"
              v-model:checked-keys="checkedKeys"
              v-model:expanded-keys="expandedKeys"
            >
              <template #title="nodeData">
                <div class="suite-node">
                  <span class="suite-node-name">{{ nodeData.name }}</span>
                  <span class="suite-node-count">{{ nodeData.testcase_count || 0 }}</span>
                </div>
              </template>
            </a-tree>
            <a-empty v-else description="暂无套件数据" />
          </a-spin>
        </div>

        <div class="sidebar-actions">
          <a-button
            type="primary"
            long
            :loading="reportLoading"
            :disabled="checkedSuiteIds.length === 0"
            @click="handleGenerateReport"
          >
            AI生成测试报告
          </a-button>
          <div class="sidebar-note">
            生成时会带入所选套件及其子套件下的测试用例、BUG 列表和执行状态数据。
          </div>
        </div>

        <div class="snapshot-panel">
          <div class="snapshot-header">
            <span class="snapshot-title">报告快照</span>
            <a-space>
              <a-button size="mini" :disabled="!reportData" @click="handleSaveSnapshot">保存</a-button>
              <a-button size="mini" @click="loadReportSnapshots">刷新</a-button>
              <a-button
                size="mini"
                status="danger"
                :disabled="reportSnapshots.length === 0"
                @click="clearReportSnapshots"
              >
                清空
              </a-button>
            </a-space>
          </div>

          <a-input-search
            v-model="snapshotKeyword"
            class="snapshot-search"
            placeholder="搜索快照标题或创建人"
            allow-clear
          />

          <div class="snapshot-summary">
            <span>共 {{ reportSnapshots.length }} 条</span>
            <span v-if="snapshotKeyword.trim()">筛选后 {{ filteredReportSnapshots.length }} 条</span>
          </div>

          <a-empty v-if="filteredReportSnapshots.length === 0" description="暂无报告快照" />
          <div v-else class="snapshot-list">
            <div
              v-for="item in filteredReportSnapshots"
              :key="item.id"
              class="snapshot-item"
              :class="{ active: activeSnapshotId === item.id, pinned: item.isPinned }"
            >
              <div class="snapshot-main" @click="applyReportSnapshot(item)">
                <div class="snapshot-name-row">
                  <template v-if="editingSnapshotId === item.id">
                    <a-input
                      v-model="editingSnapshotTitle"
                      size="small"
                      class="snapshot-title-input"
                      placeholder="请输入快照名称"
                      @click.stop
                      @press-enter="submitRenameSnapshot(item)"
                    />
                  </template>
                  <template v-else>
                    <div class="snapshot-name">{{ item.title }}</div>
                    <a-tag v-if="item.isPinned" size="small" color="gold">置顶</a-tag>
                  </template>
                </div>
                <div class="snapshot-meta">
                  <span>{{ item.generatedAtText }}</span>
                  <span>创建人：{{ item.creatorName }}</span>
                </div>
              </div>

              <div class="snapshot-actions">
                <template v-if="editingSnapshotId === item.id">
                  <a-button size="mini" type="primary" @click.stop="submitRenameSnapshot(item)">保存</a-button>
                  <a-button size="mini" @click.stop="cancelRenameSnapshot">取消</a-button>
                </template>
                <template v-else>
                  <a-button size="mini" @click.stop="startRenameSnapshot(item)">重命名</a-button>
                  <a-button size="mini" @click.stop="handleTogglePinSnapshot(item)">
                    {{ item.isPinned ? '取消置顶' : '置顶' }}
                  </a-button>
                  <a-button size="mini" status="danger" @click.stop="removeReportSnapshot(item.id)">删除</a-button>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="report-content">
        <div v-if="reportData" class="report-body">
          <div class="report-hero">
            <div class="hero-main">
              <div class="hero-kicker">QUALITY REPORT CENTER</div>
              <div class="report-title-row">
                <div class="report-title-block">
                  <div class="report-title">本轮测试报告</div>
                  <div class="report-meta">
                    {{ reportData.report_standard.test_overview.test_object }} / {{ reportData.report_standard.test_overview.target_version }}
                  </div>
                </div>
                <div class="hero-tag-group">
                  <a-tag color="arcoblue">已选套件 {{ checkedSuiteIds.length }}</a-tag>
                  <a-tag :color="reportData.used_ai ? 'arcoblue' : 'gold'">
                    {{ reportData.used_ai ? 'AI生成' : '规则生成' }}
                  </a-tag>
                </div>
              </div>
              <div class="hero-description">
                {{ reportData.report_standard.quality_conclusion.conclusion }}
              </div>
              <div class="hero-meta-grid">
                <div class="hero-meta-item">
                  <span class="hero-meta-label">生成时间</span>
                  <span class="hero-meta-value">{{ formatDateTime(reportData.generated_at) }}</span>
                </div>
                <div class="hero-meta-item">
                  <span class="hero-meta-label">报告编号</span>
                  <span class="hero-meta-value">{{ reportData.report_standard.basic_info.report_no }}</span>
                </div>
                <div class="hero-meta-item">
                  <span class="hero-meta-label">编写人</span>
                  <span class="hero-meta-value">{{ reportData.report_standard.basic_info.author }}</span>
                </div>
                <div class="hero-meta-item">
                  <span class="hero-meta-label">审核人</span>
                  <span class="hero-meta-value">{{ reportData.report_standard.basic_info.reviewer }}</span>
                </div>
                <div class="hero-meta-item" v-if="reportData.model_name">
                  <span class="hero-meta-label">生成模型</span>
                  <span class="hero-meta-value">{{ reportData.model_name }}</span>
                </div>
              </div>
            </div>

            <div class="hero-side">
              <div class="hero-status-card">
                <div class="hero-status-label">发布建议</div>
                <div class="hero-status-value">
                  <a-tag
                    size="large"
                    :color="getReleaseRecommendationColor(reportData.report_standard.quality_conclusion.release_recommendation)"
                  >
                    {{ reportData.report_standard.quality_conclusion.release_recommendation }}
                  </a-tag>
                </div>
                <div class="hero-status-footnote">
                  质量评级：{{ reportData.report_standard.quality_conclusion.rating }}
                </div>
              </div>
              <div class="hero-highlight-grid">
                <div class="hero-highlight-card">
                  <div class="hero-highlight-label">通过率</div>
                  <div class="hero-highlight-value">{{ reportData.report_standard.result_details.case_execution.pass_rate }}%</div>
                </div>
                <div class="hero-highlight-card">
                  <div class="hero-highlight-label">未关闭BUG</div>
                  <div class="hero-highlight-value">{{ reportData.report_standard.appendices.defect_list_summary.open_total }}</div>
                </div>
                <div class="hero-highlight-card">
                  <div class="hero-highlight-label">复测失败</div>
                  <div class="hero-highlight-value">{{ reportData.report_standard.defect_summary.trend_summary.retest_failed_total }}</div>
                </div>
                <div class="hero-highlight-card">
                  <div class="hero-highlight-label">未执行用例</div>
                  <div class="hero-highlight-value">{{ reportData.report_standard.result_details.case_execution.not_executed }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="report-toolbar">
            <a-space>
              <a-button size="small" :disabled="!reportData || !activeSnapshotId" @click="handleOverwriteSnapshot">
                覆盖当前快照
              </a-button>
              <a-button size="small" @click="handleCopyReportSummary">复制摘要</a-button>
              <a-button size="small" @click="handleExportReport">导出报告</a-button>
              <a-button size="small" :loading="reportLoading" @click="handleGenerateReport">重新生成</a-button>
            </a-space>
          </div>

          <div class="report-summary-grid">
            <div v-for="item in overviewCards" :key="item.label" class="summary-card">
              <div class="summary-topline">{{ item.kicker }}</div>
              <div class="summary-label">{{ item.label }}</div>
              <div class="summary-value" :class="{ 'summary-value-small': item.compact }">{{ item.value }}</div>
              <div class="summary-footnote">{{ item.footnote }}</div>
            </div>
          </div>

          <div class="report-summary-grid report-summary-grid-secondary">
            <div class="summary-card summary-card-soft">
              <div class="summary-label">覆盖套件</div>
              <div class="summary-value">{{ reportData.suite_count }}</div>
              <div class="summary-footnote">本次纳入所有关联根套件与子套件统计</div>
            </div>
            <div class="summary-card summary-card-soft">
              <div class="summary-label">测试用例</div>
              <div class="summary-value">{{ reportData.testcase_count }}</div>
              <div class="summary-footnote">
                已执行 {{ reportData.report_standard.activity_summary.workload.executed_cases }} 条
              </div>
            </div>
            <div class="summary-card summary-card-soft">
              <div class="summary-label">BUG数量</div>
              <div class="summary-value">{{ reportData.bug_count }}</div>
              <div class="summary-footnote">
                未关闭 {{ reportData.report_standard.appendices.defect_list_summary.open_total }} 个
              </div>
            </div>
            <div class="summary-card summary-card-soft">
              <div class="summary-label">本次选择</div>
              <div class="summary-value">{{ reportData.selected_suite_count }}</div>
              <div class="summary-footnote">支持多套件联合生成一次迭代报告</div>
            </div>
          </div>

          <div class="report-section">
            <div class="section-title">报告基本信息</div>
            <div class="report-summary-grid">
              <div class="summary-card">
                <div class="summary-label">报告编号</div>
                <div class="summary-value summary-value-small">{{ reportData.report_standard.basic_info.report_no }}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">报告版本</div>
                <div class="summary-value">{{ reportData.report_standard.basic_info.report_version }}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">编写人</div>
                <div class="summary-value">{{ reportData.report_standard.basic_info.author }}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">审核人</div>
                <div class="summary-value">{{ reportData.report_standard.basic_info.reviewer }}</div>
              </div>
            </div>
            <div class="summary-inline">
              报告日期：{{ reportData.report_standard.basic_info.report_date }} / 负责人：{{ reportData.report_standard.basic_info.owner }}
            </div>
          </div>

          <div class="report-two-column">
            <div class="report-section">
              <div class="section-title">测试概述</div>
              <div class="item-list compact-item-list">
                <div class="item-card">
                  <div class="item-title">测试对象</div>
                  <div class="item-detail">
                    {{ reportData.report_standard.test_overview.test_object }} / {{ reportData.report_standard.test_overview.target_version }}
                  </div>
                </div>
                <div class="item-card">
                  <div class="item-title">测试范围</div>
                  <div class="item-detail">{{ reportData.report_standard.test_overview.scope_included }}</div>
                </div>
                <div class="item-card">
                  <div class="item-title">不在范围</div>
                  <div class="item-detail">{{ reportData.report_standard.test_overview.scope_excluded }}</div>
                </div>
                <div class="item-card">
                  <div class="item-title">测试目标</div>
                  <div class="item-detail">
                    <div v-for="(item, index) in reportData.report_standard.test_overview.objectives" :key="index">
                      {{ index + 1 }}. {{ item }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="report-section">
              <div class="section-title">测试环境</div>
              <div class="item-list compact-item-list">
                <div class="item-card">
                  <div class="item-title">硬件/网络</div>
                  <div class="item-detail">{{ reportData.report_standard.environment.hardware_network }}</div>
                </div>
                <div class="item-card">
                  <div class="item-title">软件环境</div>
                  <div class="item-detail">{{ reportData.report_standard.environment.software_environment }}</div>
                </div>
                <div class="item-card">
                  <div class="item-title">第三方依赖</div>
                  <div class="item-detail">{{ reportData.report_standard.environment.third_party_services }}</div>
                </div>
                <div class="item-card">
                  <div class="item-title">测试工具</div>
                  <div class="item-detail">{{ reportData.report_standard.environment.test_tools.join('、') }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="report-two-column">
            <div class="report-section">
              <div class="section-title">测试活动摘要</div>
              <div class="item-list compact-item-list">
                <div class="item-card">
                  <div class="item-title">测试类型</div>
                  <div class="item-detail">{{ reportData.report_standard.activity_summary.test_types.join('、') }}</div>
                </div>
                <div class="item-card">
                  <div class="item-title">测试轮次</div>
                  <div class="item-detail">{{ reportData.report_standard.activity_summary.test_round }}</div>
                </div>
                <div class="item-card">
                  <div class="item-title">时间跨度</div>
                  <div class="item-detail">
                    {{ formatDateTime(reportData.report_standard.activity_summary.time_span.start) }}
                    至
                    {{ formatDateTime(reportData.report_standard.activity_summary.time_span.end) }}
                  </div>
                </div>
                <div class="item-card">
                  <div class="item-title">工作量</div>
                  <div class="item-detail">
                    人日：{{ reportData.report_standard.activity_summary.workload.person_days }} / 总用例：{{ reportData.report_standard.activity_summary.workload.total_cases }}
                    / 已执行：{{ reportData.report_standard.activity_summary.workload.executed_cases }} / 自动化占比：{{ reportData.report_standard.activity_summary.workload.automation_ratio }}
                  </div>
                </div>
              </div>
            </div>
            <div class="report-section">
              <div class="section-title">测试结果详情</div>
              <div class="tag-flow">
                <a-tag color="arcoblue">总用例 {{ reportData.report_standard.result_details.case_execution.total }}</a-tag>
                <a-tag color="green">通过 {{ reportData.report_standard.result_details.case_execution.passed }}</a-tag>
                <a-tag color="red">失败 {{ reportData.report_standard.result_details.case_execution.failed }}</a-tag>
                <a-tag color="orange">阻塞/无需执行 {{ reportData.report_standard.result_details.case_execution.blocked }}</a-tag>
                <a-tag color="gray">未执行 {{ reportData.report_standard.result_details.case_execution.not_executed }}</a-tag>
                <a-tag color="arcoblue">通过率 {{ reportData.report_standard.result_details.case_execution.pass_rate }}%</a-tag>
              </div>
              <div class="item-list compact-item-list">
                <div
                  v-for="item in reportData.report_standard.result_details.execution_breakdown"
                  :key="item.name"
                  class="item-card"
                >
                  <div class="item-header">
                    <span class="item-title">{{ item.name }}</span>
                    <a-tag color="arcoblue">{{ item.count }}</a-tag>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="report-two-column">
            <div class="report-section">
              <div class="section-title">缺陷统计</div>
              <div class="item-list compact-item-list">
                <div class="item-card">
                  <div class="item-title">按严重程度</div>
                  <div class="tag-flow">
                    <a-tag v-for="item in reportData.report_standard.defect_summary.by_severity" :key="item.name" color="arcoblue">
                      {{ item.name }} {{ item.count }}
                    </a-tag>
                  </div>
                </div>
                <div class="item-card">
                  <div class="item-title">按状态</div>
                  <div class="tag-flow">
                    <a-tag v-for="item in reportData.report_standard.defect_summary.by_status" :key="item.name" color="arcoblue">
                      {{ item.name }} {{ item.count }}
                    </a-tag>
                  </div>
                </div>
                <div class="item-card">
                  <div class="item-title">按模块</div>
                  <div class="item-detail">
                    <div v-for="item in reportData.report_standard.defect_summary.by_module" :key="item.name">
                      {{ item.name }}：{{ item.count }}
                    </div>
                  </div>
                </div>
                <div class="item-card">
                  <div class="item-title">缺陷趋势摘要</div>
                  <div class="item-detail">
                    发现 {{ reportData.report_standard.defect_summary.trend_summary.discovered }} 个 /
                    已关闭 {{ reportData.report_standard.defect_summary.trend_summary.closed }} 个 /
                    重新激活 {{ reportData.report_standard.defect_summary.trend_summary.reactivated }} 个 /
                    复测失败 {{ reportData.report_standard.defect_summary.trend_summary.retest_failed_total }} 次
                  </div>
                </div>
              </div>
            </div>
            <div class="report-section">
              <div class="section-title">遗留缺陷</div>
              <a-empty
                v-if="reportData.report_standard.defect_summary.legacy_defects.length === 0"
                description="当前无遗留缺陷"
              />
              <div v-else class="item-list compact-item-list">
                <div
                  v-for="item in reportData.report_standard.defect_summary.legacy_defects"
                  :key="item.id"
                  class="item-card"
                >
                  <div class="item-header">
                    <span class="item-title">BUG#{{ item.id }} {{ item.title }}</span>
                    <a-tag color="red">{{ item.severity }}</a-tag>
                  </div>
                  <div class="item-detail">
                    状态：{{ item.status }} / 模块：{{ item.module }} / 计划修复：{{ item.planned_fix_version }}
                  </div>
                  <div class="item-detail">影响范围：{{ item.impact_scope }}</div>
                  <div class="item-detail">复现步骤：{{ item.repro_steps }}</div>
                  <div class="item-detail">风险接受理由：{{ item.risk_acceptance }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="report-section">
            <div class="section-title">测试结论</div>
            <div class="tag-flow">
              <a-tag :color="getQualityRatingColor(reportData.report_standard.quality_conclusion.rating)">
                质量评级 {{ reportData.report_standard.quality_conclusion.rating }}
              </a-tag>
              <a-tag :color="getReleaseRecommendationColor(reportData.report_standard.quality_conclusion.release_recommendation)">
                {{ reportData.report_standard.quality_conclusion.release_recommendation }}
              </a-tag>
            </div>
            <p class="section-text">{{ reportData.report_standard.quality_conclusion.conclusion }}</p>
            <div class="item-list compact-item-list">
              <div
                v-for="item in reportData.report_standard.quality_conclusion.criteria"
                :key="item.name"
                class="item-card"
              >
                <div class="item-header">
                  <span class="item-title">{{ item.name }}</span>
                  <a-tag :color="item.passed ? 'green' : 'red'">{{ item.passed ? '达成' : '未达成' }}</a-tag>
                </div>
                <div class="item-detail">{{ item.detail }}</div>
              </div>
            </div>
          </div>

          <div class="report-two-column">
            <div class="report-section">
              <div class="section-title">风险与建议</div>
              <div class="item-list compact-item-list">
                <div class="item-card">
                  <div class="item-title">测试过程风险</div>
                  <div class="item-detail">
                    <div v-for="(item, index) in reportData.report_standard.risk_and_suggestions.process_risks" :key="`process-${index}`">
                      {{ index + 1 }}. {{ item }}
                    </div>
                  </div>
                </div>
                <div class="item-card">
                  <div class="item-title">剩余风险</div>
                  <div class="item-detail">
                    <div v-for="(item, index) in reportData.report_standard.risk_and_suggestions.residual_risks" :key="`residual-${index}`">
                      {{ index + 1 }}. {{ item }}
                    </div>
                  </div>
                </div>
                <div class="item-card">
                  <div class="item-title">后续建议</div>
                  <div class="item-detail">
                    <div v-for="(item, index) in reportData.report_standard.risk_and_suggestions.follow_up_actions" :key="`action-${index}`">
                      {{ index + 1 }}. {{ item }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="report-section">
              <div class="section-title">附录与附件</div>
              <div class="item-list compact-item-list">
                <div class="item-card">
                  <div class="item-title">缺陷清单摘要</div>
                  <div class="item-detail">
                    缺陷总数 {{ reportData.report_standard.appendices.defect_list_summary.total }} /
                    未关闭 {{ reportData.report_standard.appendices.defect_list_summary.open_total }}
                  </div>
                </div>
                <div class="item-card">
                  <div class="item-title">需求文档</div>
                  <div class="item-detail">
                    <div
                      v-for="item in reportData.report_standard.appendices.requirement_documents"
                      :key="`${item.title}-${item.version}`"
                    >
                      {{ item.title }} / {{ item.version || '-' }} / {{ item.status || '-' }}
                    </div>
                  </div>
                </div>
                <div class="item-card">
                  <div class="item-title">测试数据说明</div>
                  <div class="item-detail">{{ reportData.report_standard.appendices.test_data_note }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="report-placeholder">
          <a-empty description="请选择套件后生成测试报告" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Message, Modal, type TreeNodeData } from '@arco-design/web-vue';
import { useRoute } from 'vue-router';
import {
  createTestReportSnapshot,
  deleteTestReportSnapshot,
  generateAiIterationTestReport,
  getTestReportSnapshots,
  updateTestReportSnapshot,
  type AiIterationTestReport,
} from '@/services/testExecutionService';
import { getTestSuiteList, type TestSuite } from '@/services/testSuiteService';
import { useProjectStore } from '@/store/projectStore';

type SuiteTreeNode = TreeNodeData & {
  id: number;
  name: string;
  testcase_count: number;
  children?: SuiteTreeNode[];
};

type ReportSnapshot = {
  id: number;
  title: string;
  projectId: number;
  suiteIds: number[];
  creatorName: string;
  isPinned: boolean;
  generatedAt: string;
  generatedAtText: string;
  report: AiIterationTestReport;
};

const projectStore = useProjectStore();
const route = useRoute();
const currentProjectId = computed(() => projectStore.currentProjectId || null);

const suiteLoading = ref(false);
const reportLoading = ref(false);
const searchKeyword = ref('');
const snapshotKeyword = ref('');
const suites = ref<TestSuite[]>([]);
const checkedKeys = ref<(number | string)[]>([]);
const expandedKeys = ref<(number | string)[]>([]);
const reportData = ref<AiIterationTestReport | null>(null);
const reportSnapshots = ref<ReportSnapshot[]>([]);
const activeSnapshotId = ref<number | null>(null);
const editingSnapshotId = ref<number | null>(null);
const editingSnapshotTitle = ref('');

const checkedSuiteIds = computed(() =>
  checkedKeys.value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
);

const filteredReportSnapshots = computed(() => {
  const keyword = snapshotKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return reportSnapshots.value;
  }
  return reportSnapshots.value.filter((item) => {
    return (
      item.title.toLowerCase().includes(keyword) ||
      item.generatedAtText.toLowerCase().includes(keyword) ||
      item.creatorName.toLowerCase().includes(keyword)
    );
  });
});

const normalizeSnapshots = (items: ReportSnapshot[]) =>
  [...items].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }
    return new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime();
  });

const buildFallbackStandardReport = (report: any) => {
  const totalCases = Number(report?.testcase_count || 0);
  const passedCount = Number(report?.execution_status_distribution?.passed || 0);
  const failedCount = Number(report?.execution_status_distribution?.failed || 0);
  const blockedCount = Number(report?.execution_status_distribution?.not_applicable || 0);
  const notExecutedCount = Number(report?.execution_status_distribution?.not_executed || 0);
  const executedCases = Math.max(totalCases - notExecutedCount, 0);
  const passRate = executedCases > 0 ? Math.round((passedCount / executedCases) * 100) : 0;
  const traceableCount = Number(report?.requirement_summary?.traceable_testcase_count || 0);
  const unlinkedCount = Number(report?.requirement_summary?.unlinked_testcase_count || 0);

  const bugStatusDistribution = report?.bug_status_distribution || {};
  const openBugCount = Object.entries(bugStatusDistribution).reduce((sum, [key, value]) => {
    return key === 'closed' ? sum : sum + Number(value || 0);
  }, 0);
  const highRiskBugCount =
    Number(bugStatusDistribution.unassigned || 0) +
    Number(bugStatusDistribution.assigned || 0) +
    Number(bugStatusDistribution.confirmed || 0);
  const retestFailedTotal = Number(report?.bug_workflow_summary?.retest_failed_total_count || 0);

  let rating = '优';
  let releaseRecommendation = '建议发布';

  if (failedCount > 0 || highRiskBugCount > 0) {
    rating = '不合格';
    releaseRecommendation = '不建议发布';
  } else if (openBugCount > 0 || retestFailedTotal > 0) {
    rating = '良';
    releaseRecommendation = '有条件发布';
  } else if (notExecutedCount > 0 || unlinkedCount > 0) {
    rating = '合格';
    releaseRecommendation = '有条件发布';
  }

  const criteria = [
    {
      name: '测试用例已完成执行',
      passed: notExecutedCount === 0,
      detail: `未执行用例 ${notExecutedCount} 条`,
    },
    {
      name: '执行结果无失败',
      passed: failedCount === 0,
      detail: `失败用例 ${failedCount} 条`,
    },
    {
      name: '测试用例已完成需求追踪',
      passed: unlinkedCount === 0,
      detail: `已关联需求 ${traceableCount} 条，未关联需求 ${unlinkedCount} 条`,
    },
    {
      name: '未关闭 BUG 可控',
      passed: highRiskBugCount === 0,
      detail: `高风险未关闭 BUG ${highRiskBugCount} 个，未关闭 BUG 总数 ${openBugCount} 个`,
    },
    {
      name: 'BUG 复测结果稳定',
      passed: retestFailedTotal === 0,
      detail: `复测失败累计 ${retestFailedTotal} 次`,
    },
  ];

  const processRisks = ['当前报告来自历史快照兼容计算，部分环境类字段无法从旧数据中完全还原。'];
  if (unlinkedCount > 0) {
    processRisks.push(`仍有 ${unlinkedCount} 条测试用例未关联需求，历史快照的需求追踪完整性不足。`);
  }
  if (notExecutedCount > 0) {
    processRisks.push(`仍有 ${notExecutedCount} 条测试用例未执行，测试覆盖尚未完整闭环。`);
  }

  const residualRisks: string[] = [];
  if (openBugCount > 0) {
    residualRisks.push(`仍有 ${openBugCount} 个 BUG 未关闭，需要继续跟进修复与验证。`);
  }
  if (retestFailedTotal > 0) {
    residualRisks.push(`BUG 复测失败累计 ${retestFailedTotal} 次，修复稳定性仍需重点关注。`);
  }
  if (failedCount > 0) {
    residualRisks.push(`当前仍有 ${failedCount} 条失败用例，发布风险较高。`);
  }

  const suiteScope = (report?.suite_breakdown || []).map((item: any) => item.path || item.name).join('；') || '未记录';
  const latestDocument =
    (report?.requirement_summary?.documents || []).find((item: any) => item?.is_latest && item?.version) ||
    (report?.requirement_summary?.documents || []).find((item: any) => item?.version);
  const version = latestDocument?.version
    ? `V${String(latestDocument.version).replace(/^V/i, '')}`
    : 'V1.0';

  return {
    basic_info: {
      report_no: report?.generated_at ? `LEGACY-${String(report.generated_at).replace(/\D/g, '').slice(0, 14)}` : 'LEGACY',
      report_version: version,
      report_date: formatDateTime(report?.generated_at),
      author: '-',
      owner: '-',
      reviewer: '-',
    },
    test_overview: {
      test_object: '历史测试报告',
      target_version: version,
      scope_included: suiteScope,
      scope_excluded: '历史快照未记录明确的不在测试范围项。',
      objectives: ['该报告由历史快照兼容计算生成，核心质量结论已按现有执行与 BUG 数据重新推导。'],
    },
    environment: {
      hardware_network: '历史快照未记录',
      software_environment: '历史快照未记录',
      test_tools: ['FlyTest'],
      third_party_services: '历史快照未记录',
    },
    activity_summary: {
      test_types: ['未记录'],
      test_round: '历史快照兼容分析',
      time_span: {
        start: report?.generated_at || null,
        end: report?.generated_at || null,
      },
      workload: {
        person_days: '未统计',
        total_cases: totalCases,
        executed_cases: executedCases,
        automation_ratio: '未统计',
        bug_count: Number(report?.bug_count || 0),
      },
    },
    result_details: {
      case_execution: {
        total: totalCases,
        passed: passedCount,
        failed: failedCount,
        blocked: blockedCount,
        not_executed: notExecutedCount,
        pass_rate: passRate,
      },
      execution_breakdown: Object.entries(report?.execution_status_distribution || {}).map(([name, count]) => ({
        name,
        count: Number(count || 0),
      })),
    },
    defect_summary: {
      by_severity: [],
      by_status: Object.entries(bugStatusDistribution).map(([name, count]) => ({
        name,
        count: Number(count || 0),
      })),
      by_module: [],
      trend_summary: {
        discovered: Number(report?.bug_count || 0),
        closed: Number(report?.bug_workflow_summary?.closed_bug_count || 0),
        reactivated: Number(report?.bug_workflow_summary?.reactivated_bug_count || 0),
        retest_failed_total: retestFailedTotal,
      },
      legacy_defects: [],
    },
    quality_conclusion: {
      rating,
      release_recommendation: releaseRecommendation,
      criteria,
      conclusion:
        report?.summary ||
        `历史快照兼容分析结果：当前执行通过率 ${passRate}%，未关闭 BUG ${openBugCount} 个，失败用例 ${failedCount} 条，未关联需求用例 ${unlinkedCount} 条。`,
    },
    risk_and_suggestions: {
      process_risks: processRisks,
      residual_risks: residualRisks.length > 0 ? residualRisks : ['当前未识别额外剩余风险。'],
      follow_up_actions:
        (report?.recommendations || []).map((item: any) => item.detail).filter(Boolean).slice(0, 5).length > 0
          ? (report?.recommendations || []).map((item: any) => item.detail).filter(Boolean).slice(0, 5)
          : ['建议重新生成一次新版标准测试报告，以补齐环境、范围和附录字段。'],
    },
    appendices: {
      defect_list_summary: {
        total: Number(report?.bug_count || 0),
        open_total: openBugCount,
        items: [],
      },
      key_testcases: [],
      requirement_documents: (report?.requirement_summary?.documents || []).map((item: any) => ({
        title: item.title,
        version: item.version,
        status: item.status,
      })),
      test_data_note: '该报告为历史快照兼容分析结果，未补录额外测试数据。',
    },
  };
};

const normalizeReportPayload = (payload: any): AiIterationTestReport => {
  let current = payload;
  while (
    current &&
    typeof current === 'object' &&
    ((current.status && current.data !== undefined) ||
      (current.success === true && current.data !== undefined))
  ) {
    current = current.data;
  }
  if (current && typeof current === 'object' && !current.report_standard) {
    current = {
      ...current,
      report_standard: buildFallbackStandardReport(current),
    };
  }
  return current as AiIterationTestReport;
};

const toSnapshot = (item: {
  id: number;
  title: string;
  project: number;
  suite_ids?: number[];
  creator_name?: string;
  is_pinned?: boolean;
  report_data: AiIterationTestReport;
  created_at: string;
}) => {
  const report = normalizeReportPayload(item.report_data);
  return {
    id: item.id,
    title: item.title,
    projectId: item.project,
    suiteIds: item.suite_ids || [],
    creatorName: item.creator_name || '-',
    isPinned: Boolean(item.is_pinned),
    generatedAt: report?.generated_at || item.created_at,
    generatedAtText: formatDateTime(report?.generated_at || item.created_at),
    report,
  };
};

const buildTree = (parentId: number | null = null): SuiteTreeNode[] =>
  suites.value
    .filter((suite) => (suite.parent ?? suite.parent_id ?? null) === parentId)
    .map((suite) => ({
      id: suite.id,
      key: suite.id,
      name: suite.name,
      testcase_count: suite.testcase_count || 0,
      children: buildTree(suite.id),
    }));

const treeData = computed(() => buildTree());

const overviewCards = computed(() => {
  if (!reportData.value) {
    return [];
  }
  const standard = reportData.value.report_standard;
  return [
    {
      kicker: 'QUALITY',
      label: '质量评级',
      value: standard.quality_conclusion.rating,
      footnote: `发布建议：${standard.quality_conclusion.release_recommendation}`,
      compact: false,
    },
    {
      kicker: 'PROGRESS',
      label: '执行通过率',
      value: `${standard.result_details.case_execution.pass_rate}%`,
      footnote: `通过 ${standard.result_details.case_execution.passed} / 总计 ${standard.result_details.case_execution.total}`,
      compact: false,
    },
    {
      kicker: 'DEFECT',
      label: '遗留风险',
      value: `${standard.appendices.defect_list_summary.open_total}`,
      footnote: `复测失败 ${standard.defect_summary.trend_summary.retest_failed_total} 次`,
      compact: false,
    },
    {
      kicker: 'SCOPE',
      label: '测试范围',
      value: standard.test_overview.scope_included || '-',
      footnote: `不在范围：${standard.test_overview.scope_excluded}`,
      compact: true,
    },
  ];
});

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
}

async function loadReportSnapshots() {
  if (!currentProjectId.value) {
    reportSnapshots.value = [];
    activeSnapshotId.value = null;
    return;
  }

  const response = await getTestReportSnapshots(currentProjectId.value);
  if (!response.success) {
    Message.error(response.error || '加载报告快照失败');
    reportSnapshots.value = [];
    return;
  }

  reportSnapshots.value = normalizeSnapshots((response.data || []).map((item) => toSnapshot(item)));

  if (activeSnapshotId.value) {
    const matched = reportSnapshots.value.find((item) => item.id === activeSnapshotId.value);
    if (matched) {
      reportData.value = matched.report;
      return;
    }
    activeSnapshotId.value = null;
  }

  if (!reportData.value && reportSnapshots.value.length > 0) {
    applyReportSnapshot(reportSnapshots.value[0], false);
  }
}

async function createReportSnapshot(
  report: AiIterationTestReport,
  useCurrentTitle = true,
  options: {
    silent?: boolean;
  } = {}
) {
  if (!currentProjectId.value) {
    return null;
  }

  const timestamp = new Date();
  const title = useCurrentTitle
    ? `测试报告 ${timestamp.toLocaleString('zh-CN', { hour12: false })}`
    : `手动保存 ${timestamp.toLocaleString('zh-CN', { hour12: false })}`;

  const response = await createTestReportSnapshot(currentProjectId.value, {
    title,
    suite_ids: [...checkedSuiteIds.value],
    report_data: JSON.parse(JSON.stringify(report)),
  });

  if (!response.success || !response.data) {
    if (!options.silent) {
      Message.error(response.error || '保存报告快照失败');
    }
    return null;
  }

  const snapshot = toSnapshot(response.data);
  reportSnapshots.value = normalizeSnapshots(
    [snapshot, ...reportSnapshots.value.filter((item) => item.id !== snapshot.id)].slice(0, 20)
  );
  activeSnapshotId.value = snapshot.id;
  return snapshot;
}

function persistReportSnapshotInBackground(report: AiIterationTestReport) {
  void createReportSnapshot(report, true, { silent: true }).catch((error) => {
    console.error('自动保存报告快照失败:', error);
    Message.warning('\u6d4b\u8bd5\u62a5\u544a\u5df2\u751f\u6210\uff0c\u4f46\u81ea\u52a8\u4fdd\u5b58\u5feb\u7167\u5931\u8d25\uff0c\u53ef\u624b\u52a8\u70b9\u51fb\u4fdd\u5b58');
  });
}
function applyReportSnapshot(snapshot: ReportSnapshot, showMessage = true) {
  cancelRenameSnapshot();
  reportData.value = snapshot.report;
  checkedKeys.value = [...snapshot.suiteIds];
  expandedKeys.value = Array.from(new Set([...expandedKeys.value, ...snapshot.suiteIds]));
  activeSnapshotId.value = snapshot.id;
  if (showMessage) {
    Message.success('报告快照已加载');
  }
}

async function patchSnapshot(
  snapshotId: number,
  payload: {
    title?: string;
    is_pinned?: boolean;
    suite_ids?: number[];
    report_data?: AiIterationTestReport;
  }
) {
  if (!currentProjectId.value) {
    return null;
  }

  const response = await updateTestReportSnapshot(currentProjectId.value, snapshotId, payload);
  if (!response.success || !response.data) {
    Message.error(response.error || '更新报告快照失败');
    return null;
  }

  const nextItem = toSnapshot(response.data);
  reportSnapshots.value = normalizeSnapshots(
    reportSnapshots.value.map((item) => (item.id === snapshotId ? nextItem : item))
  );

  if (activeSnapshotId.value === snapshotId) {
    reportData.value = nextItem.report;
  }

  return nextItem;
}

function startRenameSnapshot(snapshot: ReportSnapshot) {
  editingSnapshotId.value = snapshot.id;
  editingSnapshotTitle.value = snapshot.title;
}

function cancelRenameSnapshot() {
  editingSnapshotId.value = null;
  editingSnapshotTitle.value = '';
}

async function submitRenameSnapshot(snapshot: ReportSnapshot) {
  const nextTitle = editingSnapshotTitle.value.trim();
  if (!nextTitle) {
    Message.warning('快照标题不能为空');
    return;
  }

  const updated = await patchSnapshot(snapshot.id, { title: nextTitle });
  if (!updated) {
    return;
  }

  cancelRenameSnapshot();
  Message.success('快照名称已更新');
}

async function handleTogglePinSnapshot(snapshot: ReportSnapshot) {
  const updated = await patchSnapshot(snapshot.id, { is_pinned: !snapshot.isPinned });
  if (updated) {
    Message.success(updated.isPinned ? '快照已置顶' : '快照已取消置顶');
  }
}

async function removeReportSnapshot(snapshotId: number) {
  if (!currentProjectId.value) {
    return;
  }

  Modal.confirm({
    title: '确认删除',
    content: '删除后不可恢复，确定删除这条报告快照吗？',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      const response = await deleteTestReportSnapshot(currentProjectId.value!, snapshotId);
      if (!response.success) {
        Message.error(response.error || '删除报告快照失败');
        return;
      }

      reportSnapshots.value = reportSnapshots.value.filter((item) => item.id !== snapshotId);
      if (activeSnapshotId.value === snapshotId) {
        activeSnapshotId.value = null;
        reportData.value = null;
        if (reportSnapshots.value.length > 0) {
          applyReportSnapshot(reportSnapshots.value[0], false);
        }
      }
      Message.success('报告快照已删除');
    },
  });
}

async function clearReportSnapshots() {
  if (!currentProjectId.value || reportSnapshots.value.length === 0) {
    return;
  }

  Modal.confirm({
    title: '确认清空',
    content: '将清空当前项目下最近保存的报告快照，确定继续吗？',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      const snapshotIds = reportSnapshots.value.map((item) => item.id);
      for (const snapshotId of snapshotIds) {
        const response = await deleteTestReportSnapshot(currentProjectId.value!, snapshotId);
        if (!response.success) {
          Message.error(response.error || '清空报告快照失败');
          return;
        }
      }

      reportSnapshots.value = [];
      reportData.value = null;
      activeSnapshotId.value = null;
      cancelRenameSnapshot();
      Message.success('报告快照已清空');
    },
  });
}

async function handleSaveSnapshot() {
  if (!reportData.value) {
    Message.warning('当前没有可保存的测试报告');
    return;
  }

  const snapshot = await createReportSnapshot(reportData.value, false);
  if (snapshot) {
    Message.success('报告快照已保存');
  }
}

async function handleOverwriteSnapshot() {
  if (!reportData.value || !activeSnapshotId.value) {
    Message.warning('请先加载一个可覆盖的报告快照');
    return;
  }

  Modal.confirm({
    title: '确认覆盖',
    content: '将用当前报告内容覆盖这条快照，原内容会被更新，确定继续吗？',
    onOk: async () => {
      const updated = await patchSnapshot(activeSnapshotId.value!, {
        suite_ids: [...checkedSuiteIds.value],
        report_data: JSON.parse(JSON.stringify(reportData.value)),
      });
      if (!updated) {
        return;
      }
      activeSnapshotId.value = updated.id;
      reportData.value = updated.report;
      Message.success('当前快照已覆盖保存');
    },
  });
}

function applySuiteSelectionFromRoute() {
  const suiteId = Number(route.query.suiteId);
  if (!suiteId || !Number.isFinite(suiteId)) {
    return;
  }
  if (!suites.value.some((suite) => suite.id === suiteId)) {
    return;
  }
  checkedKeys.value = Array.from(new Set([suiteId, ...checkedSuiteIds.value]));
  expandedKeys.value = Array.from(new Set([suiteId, ...expandedKeys.value.map((item) => Number(item))]));
}

async function fetchSuites() {
  if (!currentProjectId.value) {
    suites.value = [];
    checkedKeys.value = [];
    expandedKeys.value = [];
    return;
  }

  suiteLoading.value = true;
  try {
    const response = await getTestSuiteList(currentProjectId.value, {
      search: searchKeyword.value.trim() || undefined,
    });
    if (response.success && response.data) {
      suites.value = response.data;
      expandedKeys.value = response.data.map((item) => item.id);
      checkedKeys.value = checkedKeys.value.filter((item) => response.data?.some((suite) => suite.id === Number(item)));
      applySuiteSelectionFromRoute();
      return;
    }
    Message.error(response.error || '获取套件列表失败');
    suites.value = [];
  } catch (error) {
    console.error('获取套件列表失败:', error);
    Message.error('获取套件列表失败');
    suites.value = [];
  } finally {
    suiteLoading.value = false;
  }
}

function checkAllSuites() {
  checkedKeys.value = suites.value.map((item) => item.id);
}

function clearCheckedSuites() {
  checkedKeys.value = [];
}

function expandAllSuites() {
  expandedKeys.value = suites.value.map((item) => item.id);
}

async function handleGenerateReport() {
  if (!currentProjectId.value) {
    Message.warning('请先选择项目');
    return;
  }

  if (checkedSuiteIds.value.length === 0) {
    Message.warning('请至少选择一个测试套件');
    return;
  }

  reportLoading.value = true;
  try {
    const response = await generateAiIterationTestReport(currentProjectId.value, checkedSuiteIds.value);
    if (response.success && response.data) {
      reportData.value = response.data;
      persistReportSnapshotInBackground(response.data);
      Message.success(response.data.used_ai ? '测试报告生成完成' : '测试报告已生成（统计版）');
      return;
    }
    Message.error(response.error || '生成测试报告失败');
  } catch (error) {
    console.error('生成测试报告失败:', error);
    Message.error('生成测试报告失败');
  } finally {
    reportLoading.value = false;
  }
}

function getQualityRatingColor(value: string) {
  if (value === '优') return 'green';
  if (value === '良') return 'arcoblue';
  if (value === '合格') return 'orange';
  return 'red';
}

function getReleaseRecommendationColor(value: string) {
  if (value === '建议发布') return 'green';
  if (value === '有条件发布') return 'orange';
  return 'red';
}

function getSeverityLabel(value: string) {
  if (value === 'high') return '高';
  if (value === 'low') return '低';
  return '中';
}

function getPriorityLabel(value: string) {
  if (value === 'high') return '高优先级';
  if (value === 'low') return '低优先级';
  return '中优先级';
}

function buildReportMarkdown(report: AiIterationTestReport) {
  const lines: string[] = [
    '# 测试报告',
    '',
    '## 报告基本信息',
    `- 报告编号：${report.report_standard.basic_info.report_no}`,
    `- 报告版本：${report.report_standard.basic_info.report_version}`,
    `- 报告日期：${report.report_standard.basic_info.report_date}`,
    `- 编写人：${report.report_standard.basic_info.author}`,
    `- 负责人：${report.report_standard.basic_info.owner}`,
    `- 审核人：${report.report_standard.basic_info.reviewer}`,
    '',
    '## 测试概述',
    `- 测试对象：${report.report_standard.test_overview.test_object}`,
    `- 目标版本：${report.report_standard.test_overview.target_version}`,
    `- 测试范围：${report.report_standard.test_overview.scope_included}`,
    `- 不在范围：${report.report_standard.test_overview.scope_excluded}`,
    ...report.report_standard.test_overview.objectives.map((item) => `- 测试目标：${item}`),
    '',
    '## 测试环境',
    `- 硬件/网络：${report.report_standard.environment.hardware_network}`,
    `- 软件环境：${report.report_standard.environment.software_environment}`,
    `- 第三方依赖：${report.report_standard.environment.third_party_services}`,
    `- 测试工具：${report.report_standard.environment.test_tools.join('、')}`,
    '',
    '## 测试活动摘要',
    `- 测试类型：${report.report_standard.activity_summary.test_types.join('、')}`,
    `- 测试轮次：${report.report_standard.activity_summary.test_round}`,
    `- 时间跨度：${formatDateTime(report.report_standard.activity_summary.time_span.start)} 至 ${formatDateTime(report.report_standard.activity_summary.time_span.end)}`,
    `- 工作量（人日）：${report.report_standard.activity_summary.workload.person_days}`,
    `- 执行用例总数：${report.report_standard.activity_summary.workload.total_cases}`,
    `- 已执行用例数：${report.report_standard.activity_summary.workload.executed_cases}`,
    `- 自动化占比：${report.report_standard.activity_summary.workload.automation_ratio}`,
    '',
    '## 测试结果详情',
    `- 总用例数：${report.report_standard.result_details.case_execution.total}`,
    `- 通过数：${report.report_standard.result_details.case_execution.passed}`,
    `- 失败数：${report.report_standard.result_details.case_execution.failed}`,
    `- 阻塞/无需执行数：${report.report_standard.result_details.case_execution.blocked}`,
    `- 未执行数：${report.report_standard.result_details.case_execution.not_executed}`,
    `- 通过率：${report.report_standard.result_details.case_execution.pass_rate}%`,
    ...report.report_standard.result_details.execution_breakdown.map((item) => `- 执行状态 ${item.name}：${item.count}`),
    '',
    '## 缺陷统计',
    ...report.report_standard.defect_summary.by_severity.map((item) => `- 按严重程度 ${item.name}：${item.count}`),
    ...report.report_standard.defect_summary.by_status.map((item) => `- 按状态 ${item.name}：${item.count}`),
    ...report.report_standard.defect_summary.by_module.map((item) => `- 按模块 ${item.name}：${item.count}`),
    `- 缺陷趋势摘要：发现 ${report.report_standard.defect_summary.trend_summary.discovered} / 已关闭 ${report.report_standard.defect_summary.trend_summary.closed} / 重新激活 ${report.report_standard.defect_summary.trend_summary.reactivated} / 复测失败 ${report.report_standard.defect_summary.trend_summary.retest_failed_total}`,
    '',
    '## 报告生成摘要',
    `- 生成时间：${formatDateTime(report.generated_at)}`,
    `- 生成方式：${report.used_ai ? 'AI 生成' : '规则生成'}`,
    `- 套件总数：${report.suite_count}`,
    `- 测试用例总数：${report.testcase_count}`,
    `- BUG 总数：${report.bug_count}`,
    `- 本次选择套件数：${report.selected_suite_count}`,
    '',
    '## 执行摘要',
    report.summary,
    '',
    '## 质量概览',
    report.quality_overview,
    '',
    '## 风险概览',
    report.risk_overview,
    '',
    '## 关键发现',
  ];

  if (report.findings.length === 0) {
    lines.push('- 无');
  } else {
    report.findings.forEach((item) => {
      lines.push(`- [${getSeverityLabel(item.severity)}] ${item.title}：${item.detail}`);
    });
  }

  lines.push('', '## 遗留缺陷');
  if (report.report_standard.defect_summary.legacy_defects.length === 0) {
    lines.push('- 当前无遗留缺陷');
  } else {
    report.report_standard.defect_summary.legacy_defects.forEach((item) => {
      lines.push(
        `- BUG#${item.id} ${item.title}：${item.severity} / ${item.status} / 模块 ${item.module} / 计划修复 ${item.planned_fix_version} / 风险接受理由 ${item.risk_acceptance}`
      );
      lines.push(`  - 影响范围：${item.impact_scope}`);
      lines.push(`  - 复现步骤：${item.repro_steps}`);
    });
  }

  lines.push('', '## 改进建议');
  if (report.recommendations.length === 0) {
    lines.push('- 无');
  } else {
    report.recommendations.forEach((item) => {
      lines.push(`- [${getPriorityLabel(item.priority)}] ${item.title}：${item.detail}`);
    });
  }

  lines.push('', '## 需求覆盖情况');
  lines.push(
    `- 关联需求文档数：${report.requirement_summary.linked_document_count}`,
    `- 关联需求模块数：${report.requirement_summary.linked_module_count}`,
    `- 可追踪测试用例数：${report.requirement_summary.traceable_testcase_count}`,
    `- 未关联测试用例数：${report.requirement_summary.unlinked_testcase_count}`
  );
  if (report.requirement_summary.documents.length > 0) {
    report.requirement_summary.documents.forEach((item) => {
      lines.push(
        `- 文档 ${item.title}：版本 ${item.version || '-'} / 状态 ${item.status || '-'} / 关联用例 ${item.linked_testcase_count} / 模块 ${item.module_count}`
      );
    });
  }
  if (report.requirement_summary.modules.length > 0) {
    lines.push('', '### 需求模块');
    report.requirement_summary.modules.forEach((item) => {
      lines.push(
        `- ${item.document_title} / ${item.title}：关联用例 ${item.matched_testcase_count}${
          item.content_excerpt ? ` / 摘要 ${item.content_excerpt}` : ''
        }`
      );
    });
  }

  lines.push('', '## BUG 流程摘要');
  lines.push(
    `- 已修复 BUG 数：${report.bug_workflow_summary.fixed_bug_count}`,
    `- 待复测 BUG 数：${report.bug_workflow_summary.submitted_retest_bug_count}`,
    `- 已关闭 BUG 数：${report.bug_workflow_summary.closed_bug_count}`,
    `- 已确认 BUG 数：${report.bug_workflow_summary.confirmed_bug_count}`,
    `- 已激活 BUG 数：${report.bug_workflow_summary.reactivated_bug_count}`,
    `- 复测失败总次数：${report.bug_workflow_summary.retest_failed_total_count}`
  );
  if (report.bug_workflow_summary.top_retest_failed_bugs.length > 0) {
    lines.push('', '### 复测失败 TOP BUG');
    report.bug_workflow_summary.top_retest_failed_bugs.forEach((item) => {
      lines.push(
        `- ${item.title}：复测失败 ${item.failed_retest_count} 次 / 当前状态 ${item.status} / 套件 ${item.suite || '-'} / 修复次数 ${item.fix_count} / 解决次数 ${item.resolve_count}`
      );
    });
  }

  lines.push('', '## 测试结论');
  lines.push(`- 质量评级：${report.report_standard.quality_conclusion.rating}`);
  lines.push(`- 发布建议：${report.report_standard.quality_conclusion.release_recommendation}`);
  lines.push(`- 结论陈述：${report.report_standard.quality_conclusion.conclusion}`);
  report.report_standard.quality_conclusion.criteria.forEach((item) => {
    lines.push(`- 完成标准 ${item.name}：${item.passed ? '达成' : '未达成'}；${item.detail}`);
  });

  lines.push('', '## 风险与建议');
  report.report_standard.risk_and_suggestions.process_risks.forEach((item) => {
    lines.push(`- 测试过程风险：${item}`);
  });
  report.report_standard.risk_and_suggestions.residual_risks.forEach((item) => {
    lines.push(`- 剩余风险：${item}`);
  });
  report.report_standard.risk_and_suggestions.follow_up_actions.forEach((item) => {
    lines.push(`- 后续行动建议：${item}`);
  });

  lines.push('', '## 套件覆盖详情');
  report.suite_breakdown.forEach((item) => {
    lines.push(
      `- ${item.path}：测试用例 ${item.testcase_count} / 已审核 ${item.approved_testcase_count} / 失败 ${item.failed_testcase_count} / 未执行 ${item.not_executed_testcase_count} / BUG ${item.bug_count} / 待复测 ${item.pending_retest_bug_count}`
    );
  });

  lines.push('', '## 附录与附件');
  lines.push(
    `- 缺陷清单摘要：总数 ${report.report_standard.appendices.defect_list_summary.total} / 未关闭 ${report.report_standard.appendices.defect_list_summary.open_total}`
  );
  report.report_standard.appendices.key_testcases.forEach((item) => {
    lines.push(`- 关键测试用例 ${item.name}：${item.module || '-'} / ${item.test_type} / ${item.execution_status}`);
  });
  report.report_standard.appendices.requirement_documents.forEach((item) => {
    lines.push(`- 需求文档 ${item.title}：${item.version || '-'} / ${item.status || '-'}`);
  });
  lines.push(`- 测试数据说明：${report.report_standard.appendices.test_data_note}`);

  lines.push('', '## 证据与附件');
  if (report.evidence.length === 0) {
    lines.push('- 无');
  } else {
    report.evidence.forEach((item) => {
      lines.push(`- ${item.label}：${item.detail}`);
    });
  }

  return lines.join('\n');
}

async function handleCopyReportSummary() {
  if (!reportData.value) {
    Message.warning('当前没有可复制的测试报告');
    return;
  }

  const summaryText = buildReportMarkdown(reportData.value);
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(summaryText);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = summaryText;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    Message.success('测试报告摘要已复制');
  } catch (error) {
    console.error('复制测试报告失败:', error);
    Message.error('复制测试报告失败');
  }
}

function handleExportReport() {
  if (!reportData.value) {
    Message.warning('当前没有可导出的测试报告');
    return;
  }

  const blob = new Blob([buildReportMarkdown(reportData.value)], {
    type: 'text/markdown;charset=utf-8',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date();
  const fileName = `测试报告_${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate()
  ).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}.md`;
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  Message.success('测试报告已导出');
}

onMounted(() => {
  fetchSuites();
  void loadReportSnapshots();
});

watch(
  () => currentProjectId.value,
  (projectId) => {
    if (!projectId) {
      suites.value = [];
      checkedKeys.value = [];
      expandedKeys.value = [];
      reportData.value = null;
      reportSnapshots.value = [];
      activeSnapshotId.value = null;
      cancelRenameSnapshot();
      return;
    }
    fetchSuites();
    void loadReportSnapshots();
  }
);

watch(
  () => route.query.suiteId,
  () => {
    applySuiteSelectionFromRoute();
  }
);
</script>

<style scoped>
.test-report-view {
  height: 100%;
  background:
    linear-gradient(180deg, #f5f7ff 0%, #f7f8fa 240px, #f2f3f5 100%);
}

.empty-state,
.report-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 420px;
  background: #fff;
  border-radius: 8px;
}

.report-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 20px;
  min-height: calc(100vh - 180px);
}

.report-sidebar,
.report-content {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(229, 230, 235, 0.9);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 14px 40px rgba(17, 24, 39, 0.06);
  backdrop-filter: blur(12px);
}

.report-sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sidebar-header,
.report-header-card,
.item-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.report-toolbar {
  display: flex;
  justify-content: flex-end;
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 10px 12px;
  border: 1px solid rgba(229, 230, 235, 0.9);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
}

.sidebar-title,
.report-title {
  font-size: 22px;
  font-weight: 600;
  color: #1d2129;
  letter-spacing: 0;
}

.sidebar-subtitle,
.report-meta,
.sidebar-note,
.section-note,
.summary-inline,
.checked-summary {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.7;
}

.sidebar-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.suite-tree-panel {
  flex: 1;
  min-height: 260px;
  overflow: auto;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  padding: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
}

.suite-node {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.suite-node-name,
.item-title {
  color: #1d2129;
  font-weight: 500;
}

.suite-node-count {
  min-width: 28px;
  text-align: center;
  padding: 0 8px;
  border-radius: 999px;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 12px;
  line-height: 22px;
}

.sidebar-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.snapshot-panel {
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  padding: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #fafbff 100%);
}

.snapshot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.snapshot-title {
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
}

.snapshot-search {
  margin-bottom: 8px;
}

.snapshot-summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: #86909c;
  font-size: 12px;
}

.snapshot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}

.snapshot-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #eef0f4;
  background: rgba(247, 248, 250, 0.9);
  transition: all 0.2s ease;
}

.snapshot-item.active {
  border-color: #165dff;
  background: #eff4ff;
  box-shadow: 0 10px 24px rgba(22, 93, 255, 0.12);
}

.snapshot-item.pinned {
  border-color: #f7c244;
}

.snapshot-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.snapshot-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.snapshot-name {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
}

.snapshot-title-input {
  width: 220px;
}

.snapshot-meta {
  margin-top: 4px;
  color: #86909c;
  font-size: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.snapshot-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.report-content {
  overflow: auto;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%);
}

.report-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.report-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(320px, 1fr);
  gap: 18px;
  padding: 22px;
  border-radius: 20px;
  border: 1px solid rgba(199, 210, 254, 0.7);
  background:
    linear-gradient(135deg, rgba(236, 242, 255, 0.96) 0%, rgba(255, 255, 255, 0.96) 42%, rgba(238, 244, 255, 0.96) 100%);
  box-shadow: 0 18px 40px rgba(59, 130, 246, 0.08);
}

.hero-main,
.hero-side {
  display: flex;
  flex-direction: column;
}

.hero-main {
  gap: 14px;
}

.hero-kicker,
.summary-topline {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 1.2px;
  color: #165dff;
}

.report-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.report-title-block {
  min-width: 0;
}

.hero-tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-description {
  color: #334155;
  font-size: 14px;
  line-height: 1.9;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(219, 234, 254, 0.9);
}

.hero-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.hero-meta-item,
.hero-status-card,
.hero-highlight-card {
  border-radius: 14px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: rgba(255, 255, 255, 0.8);
}

.hero-meta-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
}

.hero-meta-label,
.hero-highlight-label,
.hero-status-label {
  font-size: 12px;
  color: #64748b;
}

.hero-meta-value,
.hero-status-footnote {
  color: #0f172a;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.hero-side {
  gap: 14px;
}

.hero-status-card {
  padding: 16px;
}

.hero-status-value {
  margin-top: 10px;
}

.hero-status-footnote {
  margin-top: 10px;
}

.hero-highlight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.hero-highlight-card {
  padding: 14px;
}

.hero-highlight-value {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 600;
  line-height: 1;
  color: #111827;
}

.report-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.report-summary-grid-secondary {
  margin-top: -2px;
}

.summary-card,
.report-section,
.item-card,
.report-header-card {
  border: 1px solid rgba(229, 230, 235, 0.95);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.summary-card {
  padding: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
}

.summary-card-soft {
  background: linear-gradient(180deg, #fbfcff 0%, #ffffff 100%);
}

.summary-label {
  margin-top: 8px;
  font-size: 13px;
  color: #64748b;
}

.summary-value {
  margin-top: 8px;
  font-size: 30px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1;
}

.summary-value-small {
  font-size: 17px;
  line-height: 1.5;
  word-break: break-word;
}

.summary-footnote {
  margin-top: 10px;
  min-height: 38px;
  font-size: 12px;
  line-height: 1.6;
  color: #6b7280;
}

.report-header-card,
.report-section,
.item-card {
  padding: 18px;
}

.report-two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.section-title {
  position: relative;
  margin-bottom: 14px;
  padding-left: 14px;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.section-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 3px;
  width: 4px;
  height: 18px;
  border-radius: 999px;
  background: linear-gradient(180deg, #165dff 0%, #36a9ff 100%);
}

.section-text,
.item-detail {
  margin: 0;
  color: #4b5563;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}

.tag-flow,
.item-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.compact-item-list .item-card {
  padding: 12px 14px;
}

.tag-flow {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
}

.item-card {
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
}

.item-header + .item-detail,
.item-detail + .item-detail {
  margin-top: 6px;
}

:deep(.arco-tag) {
  border-radius: 999px;
  font-weight: 500;
}

:deep(.arco-table) {
  border-radius: 14px;
  overflow: hidden;
}

:deep(.arco-table-th) {
  background: #f8fafc;
  color: #475569;
}

:deep(.arco-tree-node-title) {
  padding-right: 0;
}

:deep(.arco-btn-size-small) {
  border-radius: 10px;
}

:deep(.arco-input-wrapper),
:deep(.arco-textarea-wrapper) {
  border-radius: 12px;
}

@media (max-width: 1200px) {
  .report-layout {
    grid-template-columns: 1fr;
  }

  .report-hero,
  .report-summary-grid,
  .report-two-column {
    grid-template-columns: 1fr;
  }

  .hero-meta-grid,
  .hero-highlight-grid {
    grid-template-columns: 1fr 1fr;
  }

  .snapshot-item {
    align-items: flex-start;
    flex-direction: column;
  }

  .snapshot-actions {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .snapshot-title-input {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .report-sidebar,
  .report-content {
    padding: 14px;
    border-radius: 14px;
  }

  .report-hero {
    padding: 16px;
  }

  .report-title-row,
  .snapshot-header,
  .sidebar-header,
  .sidebar-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-meta-grid,
  .hero-highlight-grid {
    grid-template-columns: 1fr;
  }

  .report-toolbar {
    position: static;
    padding: 0;
    border: 0;
    background: transparent;
    backdrop-filter: none;
  }
}
</style>
