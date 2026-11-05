<template>
  <div class="requirement-management fc-page">
    <header class="requirement-hero">
      <svg class="requirement-hero__waves" viewBox="0 0 1400 180" preserveAspectRatio="none" aria-hidden="true"><path d="M400 180C750 180 840 -90 1130 50S1400 70 1400 70V180Z" fill="currentColor" opacity=".09"/><path d="M550 180C900 180 1000 10 1220 35S1400 -30 1400 -30V180Z" fill="currentColor" opacity=".05"/></svg>
      <div class="requirement-hero__copy"><span class="requirement-hero__icon" aria-hidden="true"><icon-file /></span><div><h2>需求管理</h2><p>上传、评审与分析需求文档，为测试设计与 AI 协作提供依据</p></div></div>
      <div class="requirement-hero__actions"><a-button type="primary" :disabled="!currentProjectId" @click="showUploadModal"><template #icon><icon-upload /></template>上传需求文档</a-button><a-button :disabled="!currentProjectId" @click="openReviewPicker"><template #icon><icon-plus /></template>新建评审</a-button></div>
    </header>

    <section class="requirement-overview" aria-label="项目需求概览" :aria-busy="overviewLoading">
      <article v-for="metric in overviewMetrics" :key="metric.key" class="requirement-metric" :class="'requirement-metric--' + metric.tone" :title="metric.description">
        <span class="requirement-metric__icon" aria-hidden="true"><component :is="metric.icon" /></span><div><h3>{{ metric.label }}</h3><strong>{{ overview[metric.key] === null ? '—' : overview[metric.key]?.toLocaleString() }}</strong></div>
      </article>
      <button class="requirement-ai" type="button" @click="router.push('/langgraph-chat')"><span><span class="requirement-ai__title"><icon-robot /> AI 助手</span><span class="requirement-ai__description">前往 AI 对话，辅助梳理需求与测试思路</span></span><span class="requirement-ai__arrow" aria-hidden="true"><icon-right /></span></button>
    </section>
    <a-alert v-if="overviewError" type="warning" class="requirement-overview-error">{{ overviewError }}<template #action><a-button type="text" size="small" @click="loadOverview">重新加载</a-button></template></a-alert>

    <div class="requirement-tabs" role="tablist" aria-label="需求管理视图" @keydown="handleTabKeys">
      <button v-for="tab in tabs" :id="'requirement-tab-' + tab.key" :key="tab.key" type="button" role="tab" :aria-selected="activeTab === tab.key" aria-controls="requirement-panel" :tabindex="activeTab === tab.key ? 0 : -1" @click="selectTab(tab.key)"><component :is="tab.icon" aria-hidden="true" />{{ tab.label }}</button>
    </div>

    <section id="requirement-panel" role="tabpanel" :aria-labelledby="'requirement-tab-' + activeTab" class="requirement-body">

    <div class="requirement-filters">
      <div class="filter-row fc-filter-row">
        <a-input-search
          v-model="searchKeyword"
          class="filter-search"
          placeholder="搜索文档标题或描述"
          :input-attrs="{ 'aria-label': '搜索需求文档' }"
          @search="handleSearch"
          @clear="handleSearch"
          allow-clear
        />
        <a-select
          v-model="statusFilter"
          class="filter-select"
          placeholder="文档状态"
          aria-label="文档状态"
          :disabled="activeTab === 'reports'"
          @change="handleSearch"
          allow-clear
        >
          <a-option value="">全部状态</a-option>
          <a-option value="uploaded">已上传</a-option>
          <a-option value="processing">处理中</a-option>
          <a-option value="module_split">模块拆分中</a-option>
          <a-option value="user_reviewing">用户调整中</a-option>
          <a-option value="ready_for_review">待评审</a-option>
          <a-option value="reviewing">评审中</a-option>
          <a-option value="review_completed">评审完成</a-option>
          <a-option value="failed">处理失败</a-option>
        </a-select>
        <a-select
          v-model="typeFilter"
          class="filter-select"
          placeholder="文档类型"
          aria-label="文档类型"
          @change="handleSearch"
          allow-clear
        >
          <a-option value="">全部类型</a-option>
          <a-option value="pdf">PDF</a-option>
          <a-option value="docx">Word</a-option>
          <a-option value="doc">Word (.doc)</a-option>
          <a-option value="md">Markdown</a-option>
          <a-option value="txt">文本</a-option>
        </a-select>
        <a-select v-model="uploaderFilter" class="filter-select" placeholder="上传者" aria-label="上传者" allow-clear @change="handleSearch"><a-option v-for="member in uploaderOptions" :key="member.value" :value="member.value">{{ member.label }}</a-option></a-select>
        <a-button class="filter-reset" @click="resetFilters"><template #icon><icon-refresh /></template>重置</a-button>
      </div>
    </div>

    <div class="requirement-list">
      <div v-if="listError" class="requirement-list-error" role="alert"><icon-file /><h3>暂时无法加载需求文档</h3><p>{{ listError }}</p><a-button @click="loadDocuments()">重新加载</a-button></div>
      <div v-else-if="!currentProjectId && !projectStore.loading" class="requirement-empty"><icon-file class="requirement-empty__simple-icon" /><h3>先选择一个项目</h3><p>在顶部项目选择器中选择项目，开始管理需求文档与评审。</p></div>
      <template v-else>
      <a-table class="fc-table"
        :columns="columns"
        :data="documentList"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1000 }"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        row-key="id"
      >
        <template #empty><div class="requirement-empty">
          <svg class="requirement-empty__illustration" viewBox="0 0 240 132" aria-hidden="true"><ellipse cx="120" cy="119" rx="100" ry="9" fill="currentColor" opacity=".05"/><path d="M22 111C9 91 33 74 50 84 52 55 91 46 108 73 126 52 155 64 157 86 180 61 215 76 218 111Z" fill="currentColor" opacity=".07"/><path d="M63 39Q63 31 71 31H112L123 44H172Q180 44 179 53L172 108H60Z" fill="currentColor" opacity=".3"/><rect x="79" y="43" width="87" height="61" rx="6" fill="var(--theme-surface)"/><path d="M91 56h62M91 66h54M91 76h35" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".25"/><path d="M52 66Q50 59 59 59H101L113 70H181Q188 70 185 78L174 116H63Z" fill="currentColor" opacity=".55"/><circle cx="153" cy="93" r="16" fill="var(--theme-accent)"/><path d="M153 101V85m-6 6 6-6 6 6" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M190 27v-9m13 17 6-7m-5 21 8-3" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".8"/></svg>
          <h3>{{ emptyState.title }}</h3><p>{{ emptyState.description }}</p><a-button :type="hasFilters ? 'outline' : 'primary'" :disabled="!currentProjectId" @click="handleEmptyAction"><template #icon><icon-refresh v-if="hasFilters" /><icon-upload v-else-if="activeTab === 'documents'" /><icon-plus v-else /></template>{{ emptyState.action }}</a-button>
        </div></template>
        <template #title="{ record }"><button class="requirement-document-title" type="button" @click="viewDocument(record)"><span class="requirement-document-icon" aria-hidden="true"><icon-file /></span><span><strong>{{ record.title }}</strong><small>{{ record.modules_count || 0 }} 个模块 · {{ (record.word_count || 0).toLocaleString() }} 字</small></span></button></template>
        <template #status="{ record }">
          <a-tag :color="getStatusColor(record.status)">
            {{ getStatusText(record.status) }}
          </a-tag>
        </template>

        <template #document_type="{ record }">
          <a-tag color="blue">{{ getTypeText(record.document_type) }}</a-tag>
        </template>

        <template #stats="{ record }">
          <span class="requirement-review-state" :class="'requirement-review-state--' + record.status"><span aria-hidden="true"></span>{{ getReviewStage(record.status) }}</span>
        </template>

        <template #actions="{ record }">
          <div class="actions-wrapper">
            <a-button type="text" size="small" @click="viewDocument(record)">
              详情
            </a-button>
            <a-button
              v-if="record.status === 'uploaded'"
              type="text"
              size="small"
              @click="viewDocument(record)"
            >
              拆分
            </a-button>
            <a-button
              v-if="record.status === 'ready_for_review'"
              type="text"
              size="small"
              @click="startReview(record)"
            >
              评审
            </a-button>
            <a-button
              v-if="record.status === 'reviewing'"
              type="text"
              size="small"
              status="warning"
              @click="viewDocument(record)"
            >
              查看进度
            </a-button>
            <a-button
              v-if="record.status === 'review_completed'"
              type="text"
              size="small"
              @click="viewReports(record)"
            >
              报告
            </a-button>
            <a-button
              v-if="record.status === 'review_completed'"
              type="text"
              size="small"
              @click="restartReview(record)"
            >
              重审
            </a-button>
            <a-button
              v-if="record.status === 'failed'"
              type="text"
              size="small"
              @click="retryReview(record)"
            >
              重试
            </a-button>
            <a-popconfirm
              content="确定要删除这个文档吗？"
              @ok="deleteDocument(record)"
            >
              <a-button type="text" size="small" status="danger">
                删除
              </a-button>
            </a-popconfirm>
          </div>
        </template>
      </a-table>
      </template>
    </div>
    </section>

    <a-modal v-model:visible="reviewPickerVisible" class="fc-dialog" title="新建评审" :width="520" :ok-button-props="{ disabled: !selectedReviewId || pickerLoading }" @ok="confirmReviewSelection">
      <a-spin :loading="pickerLoading" style="width:100%"><a-alert v-if="pickerError" type="error">{{ pickerError }}<template #action><a-button type="text" @click="openReviewPicker">重试</a-button></template></a-alert><template v-else-if="reviewCandidates.length"><p class="requirement-picker-hint">选择已完成模块调整的文档，继续配置评审参数。</p><a-select v-model="selectedReviewId" aria-label="选择待评审文档" placeholder="请选择待评审文档" allow-search><a-option v-for="document in reviewCandidates" :key="document.id" :value="document.id">{{ document.title }}</a-option></a-select></template><div v-else class="requirement-picker-empty"><icon-file /><h3>暂无待评审文档</h3><p>上传文档后，先在详情中完成模块拆分和确认，再发起评审。</p><a-button type="primary" @click="reviewPickerVisible = false; showUploadModal()">上传需求文档</a-button></div></a-spin>
    </a-modal>

    <a-modal class="fc-dialog"
      v-model:visible="uploadModalVisible"
      title="上传需求文档"
      width="600px"
      @before-ok="handleUpload"
      @cancel="resetUploadForm"
      :confirm-loading="uploadLoading"
    >
      <a-form class="fc-form"
        ref="uploadFormRef"
        :model="uploadForm"
        :rules="uploadRules"
        layout="vertical"
      >
        <a-form-item label="文档标题" field="title">
          <a-input v-model="uploadForm.title" placeholder="请输入文档标题" />
        </a-form-item>
        <a-form-item label="文档描述" field="description">
          <a-textarea
            v-model="uploadForm.description"
            placeholder="请输入文档描述（可选）"
            :rows="3"
          />
        </a-form-item>
        <a-form-item label="上传方式" field="uploadType">
          <a-radio-group v-model="uploadForm.uploadType" @change="handleUploadTypeChange">
            <a-radio value="file">上传文件</a-radio>
            <a-radio value="content">直接输入</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item
          v-if="uploadForm.uploadType === 'file'"
          label="选择文件"
          field="file"
        >
          <a-upload
            ref="uploadRef"
            :file-list="fileList"
            :auto-upload="false"
            :show-file-list="true"
            :limit="1"
            accept=".pdf,.doc,.docx,.txt,.md"
            @change="handleFileChange"
          >
            <template #upload-button>
              <div class="upload-area">
                <icon-upload />
                <div>点击上传文件</div>
                <div class="upload-tip">支持 PDF、Word(.doc/.docx)、TXT、Markdown</div>
              </div>
            </template>
            <template #upload-item="{ fileItem, index }">
              <div class="upload-file-item">
                <div class="file-info">
                  <icon-file />
                  <span class="file-name">{{ fileItem.name }}</span>
                  <span class="file-size">({{ formatFileSize(fileItem.file?.size || fileItem.size) }})</span>
                </div>
                <a-button
                  type="text"
                  size="mini"
                  status="danger"
                  @click="removeFile(index)"
                >
                  <template #icon><icon-delete /></template>
                </a-button>
              </div>
            </template>
          </a-upload>
        </a-form-item>
        <a-form-item
          v-if="uploadForm.uploadType === 'content'"
          label="文档内容"
          field="content"
        >
          <a-textarea
            v-model="uploadForm.content"
            placeholder="请输入或粘贴文档内容"
            :rows="8"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal class="fc-dialog"
      v-model:visible="reviewConfigVisible"
      :title="reviewAction === 'restart' ? '重新评审配置' : '评审配置'"
      @ok="confirmReview"
      @cancel="reviewConfigVisible = false"
    >
      <a-alert v-if="reviewAction === 'restart'" type="warning" style="margin-bottom: 16px">
        重新评审将创建新的评审报告，原有报告会保留。
      </a-alert>
      
      <a-form class="fc-form" :model="reviewConfig" layout="vertical">
        <a-form-item label="并发分析数量" field="max_workers">
          <a-select v-model="reviewConfig.max_workers" placeholder="请选择并发数量">
            <a-option :value="1">1（串行分析，最慢但最稳定）</a-option>
            <a-option :value="2">2（低并发，适合低配环境）</a-option>
            <a-option :value="3">3（推荐，平衡速度与稳定性）</a-option>
            <a-option :value="5">5（高并发，速度最快）</a-option>
          </a-select>
          <template #help>
            并发数量决定了同时进行的专项分析任务数。如果遇到 API 限流错误，请尝试降低并发数。
          </template>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import { IconPlus, IconUpload, IconFile, IconDelete, IconRefresh, IconRobot, IconRight, IconCheckCircle, IconSchedule, IconBarChart } from '@arco-design/web-vue/es/icon';
import { getProjectMembers, type ProjectMember } from '@/services/projectService';
import { useProjectStore } from '@/store/projectStore';
import { RequirementDocumentService } from '../services/requirementService';
import type {
  RequirementDocument,
  DocumentDetail,
  DocumentStatus,
  DocumentType,
  CreateDocumentRequest,
  DocumentListParams
} from '../types';
import {
  DocumentStatusDisplay,
  DocumentTypeDisplay
} from '../types';

const projectStore = useProjectStore();
const router = useRouter();

const loading = ref(false);
const documentList = ref<RequirementDocument[]>([]);
const searchKeyword = ref('');
const statusFilter = ref<DocumentStatus | ''>('');
const typeFilter = ref<DocumentType | ''>('');
const uploaderFilter = ref('');
const projectMembers = ref<ProjectMember[]>([]);
const listError = ref('');
let listRequestId = 0;
type RequirementTab = 'documents' | 'reviews' | 'reports';
const activeTab = ref<RequirementTab>('documents');
const tabs = [
  { key: 'documents' as const, label: '需求文档', icon: IconFile },
  { key: 'reviews' as const, label: '评审记录', icon: IconSchedule },
  { key: 'reports' as const, label: '分析报告', icon: IconBarChart },
];
const overviewMetrics = [
  { key: 'documents' as const, label: '需求文档', icon: IconFile, tone: 'teal', description: '当前项目的需求文档总量' },
  { key: 'reviews' as const, label: '评审任务', icon: IconSchedule, tone: 'cyan', description: '当前项目已发起过评审的文档数量' },
  { key: 'pending' as const, label: '待分析', icon: IconBarChart, tone: 'amber', description: '已上传，尚未开始模块拆分的文档' },
  { key: 'completed' as const, label: '已完成评审', icon: IconCheckCircle, tone: 'green', description: '当前项目评审完成、可查看报告的文档' },
];
const overview = reactive<Record<'documents' | 'reviews' | 'pending' | 'completed', number | null>>({ documents: null, reviews: null, pending: null, completed: null });
const overviewLoading = ref(false), overviewError = ref('');
let overviewRequestId = 0;
const hasFilters = computed(() => Boolean(searchKeyword.value || statusFilter.value || typeFilter.value || uploaderFilter.value));
const uploaderOptions = computed(() => {
  const options = new Map<string, string>();
  projectMembers.value.forEach(member => options.set(String(member.user), member.user_detail?.username || String(member.user)));
  documentList.value.forEach(document => options.set(String(document.uploader), document.uploader_name));
  return [...options].map(([value, label]) => ({ value, label }));
});
const emptyState = computed(() => {
  if (hasFilters.value) return { title: '没有找到匹配的文档', description: '尝试调整搜索条件，或重置筛选查看全部内容。', action: '重置筛选' };
  if (activeTab.value === 'reviews') return { title: '暂无评审记录', description: '选择已完成模块拆分的需求文档，发起第一次评审。', action: '新建评审' };
  if (activeTab.value === 'reports') return { title: '暂无分析报告', description: '需求评审完成后，可在这里查看分析结果与改进建议。', action: '新建评审' };
  return { title: '暂无需求文档', description: '上传 PRD、原型说明或需求文档后，可在此发起评审、追踪分析结果并沉淀测试依据。', action: '立即上传' };
});
function resetFilters() { searchKeyword.value = ''; statusFilter.value = ''; typeFilter.value = ''; uploaderFilter.value = ''; handleSearch(); }
function selectTab(tab: RequirementTab) { if (activeTab.value === tab) return; activeTab.value = tab; statusFilter.value = ''; handleSearch(); }
async function handleTabKeys(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault(); const index = tabs.findIndex(tab => tab.key === activeTab.value);
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  selectTab(tabs[target].key); await nextTick(); document.getElementById('requirement-tab-' + activeTab.value)?.focus();
}
function handleEmptyAction() { if (hasFilters.value) resetFilters(); else if (activeTab.value === 'documents') showUploadModal(); else void openReviewPicker(); }
function getReviewStage(status: DocumentStatus) {
  return ({ uploaded: '等待分析', processing: '解析文档中', module_split: '拆分模块中', user_reviewing: '待确认模块', ready_for_review: '等待评审', reviewing: '评审进行中', review_completed: '评审已完成', failed: '处理失败' })[status] || '等待处理';
}
async function loadOverview() {
  const project = currentProjectId.value; if (!project) return;
  const requestId = ++overviewRequestId; overviewLoading.value = true; overviewError.value = '';
  const params: Partial<DocumentListParams>[] = [{}, { has_review: true }, { status: 'uploaded' }, { status: 'review_completed' }];
  const responses = await Promise.allSettled(params.map(filter => RequirementDocumentService.getDocumentList({ project: String(project), page: 1, page_size: 1, ...filter })));
  if (requestId !== overviewRequestId || currentProjectId.value !== project) return;
  responses.forEach((result, index) => {
    const data = result.status === 'fulfilled' && result.value.status === 'success' ? result.value.data : null;
    overview[overviewMetrics[index].key] = data ? (Array.isArray(data) ? data.length : data.count) : null;
  });
  if (responses.some(result => result.status === 'rejected' || result.value.status !== 'success')) overviewError.value = '部分项目统计暂不可用，文档列表仍可继续操作。';
  overviewLoading.value = false;
}
const reviewPickerVisible = ref(false), pickerLoading = ref(false), pickerError = ref(''), selectedReviewId = ref('');
const reviewCandidates = ref<RequirementDocument[]>([]);
async function openReviewPicker() {
  if (!currentProjectId.value) return;
  const project = currentProjectId.value; reviewPickerVisible.value = true; pickerLoading.value = true; pickerError.value = ''; selectedReviewId.value = ''; reviewCandidates.value = [];
  try {
    const response = await RequirementDocumentService.getDocumentList({ project: String(project), status: 'ready_for_review', page_size: 100 });
    if (currentProjectId.value !== project) return;
    if (response.status !== 'success' || !response.data) throw new Error(response.message || '加载待评审文档失败');
    reviewCandidates.value = Array.isArray(response.data) ? response.data : response.data.results;
  } catch { pickerError.value = '待评审文档加载失败，请重试。'; } finally { pickerLoading.value = false; }
}
function confirmReviewSelection() { const document = reviewCandidates.value.find(item => item.id === selectedReviewId.value); if (!document) return; reviewPickerVisible.value = false; startReview(document); }

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showTotal: true,
  showPageSize: true,
});

const uploadModalVisible = ref(false);
const uploadLoading = ref(false);
const uploadFormRef = ref();
const uploadRef = ref();
const fileList = ref<any[]>([]);

const uploadForm = reactive<CreateDocumentRequest & { uploadType: 'file' | 'content' }>({
  title: '',
  description: '',
  document_type: 'pdf',
  project: '',
  uploadType: 'file',
  file: undefined,
  content: ''
});

const reviewConfigVisible = ref(false);
const reviewAction = ref<'start' | 'restart' | 'retry'>('start');
const currentDocument = ref<RequirementDocument | null>(null);
const reviewConfig = ref({
  max_workers: 3
});
const REVIEW_POLL_INTERVAL_MS = 3000;
const REVIEW_POLL_MAX_ATTEMPTS = 120;
let reviewPollTimer: ReturnType<typeof setTimeout> | null = null;
let reviewPollAttempts = 0;
const trackedReviewingDocumentIds = new Set<string>();

const uploadRules = {
  title: [
    { required: true, message: '请输入文档标题' },
    { maxLength: 200, message: '标题长度不能超过200个字符' }
  ],
  description: [
    { maxLength: 500, message: '描述长度不能超过500个字符' }
  ],
  file: [
    {
      required: true,
      message: '请选择文件',
      validator: (_value: any, callback: Function) => {
        if (uploadForm.uploadType === 'file' && !uploadForm.file) {
          callback('请选择文件');
        } else {
          callback();
        }
      }
    }
  ],
  content: [
    {
      required: true,
      message: '请输入文档内容',
      validator: (_value: any, callback: Function) => {
        if (uploadForm.uploadType === 'content' && !uploadForm.content) {
          callback('请输入文档内容');
        } else {
          callback();
        }
      }
    }
  ]
};

const columns = [
  {
    title: '文档标题',
    dataIndex: 'title',
    slotName: 'title',
    width: 270,
    ellipsis: true,
    tooltip: true
  },
  {
    title: '状态',
    dataIndex: 'status',
    slotName: 'status',
    width: 100
  },
  {
    title: '类型',
    dataIndex: 'document_type',
    slotName: 'document_type',
    width: 110
  },
  {
    title: '评审进度',
    slotName: 'stats',
    width: 150
  },
  {
    title: '上传者',
    dataIndex: 'uploader_name',
    width: 80,
    ellipsis: true
  },
  {
    title: '上传时间',
    dataIndex: 'uploaded_at',
    width: 170,
    render: ({ record }: { record: RequirementDocument }) => {
      const date = new Date(record.uploaded_at);
      return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    }
  },
  {
    title: '操作',
    slotName: 'actions',
    width: 240,
    fixed: 'right',
    align: 'center'
  }
];

const currentProjectId = computed(() => projectStore.currentProjectId);

const hasReviewingDocuments = (documents: RequirementDocument[] = documentList.value) => {
  return trackedReviewingDocumentIds.size > 0 || documents.some((document) => document.status === 'reviewing');
};

const resetTrackedReviewingDocuments = () => {
  trackedReviewingDocumentIds.clear();
};

const trackReviewingDocument = (documentId: string) => {
  if (documentId) {
    trackedReviewingDocumentIds.add(documentId);
  }
};

const untrackReviewingDocument = (documentId: string) => {
  trackedReviewingDocumentIds.delete(documentId);
};

const syncTrackedReviewingDocuments = (documents: RequirementDocument[] = documentList.value) => {
  documents.forEach((document) => {
    if (document.status === 'reviewing') {
      trackReviewingDocument(document.id);
    } else if (trackedReviewingDocumentIds.has(document.id)) {
      untrackReviewingDocument(document.id);
    }
  });
};

const clearReviewPollingTimer = () => {
  if (reviewPollTimer !== null) {
    clearTimeout(reviewPollTimer);
    reviewPollTimer = null;
  }
};

const stopReviewPolling = () => {
  clearReviewPollingTimer();
  reviewPollAttempts = 0;
};

const markDocumentAsReviewing = (documentId: string) => {
  trackReviewingDocument(documentId);
  const target = documentList.value.find((document) => document.id === documentId);
  if (target) {
    target.status = 'reviewing';
  }
};

const updateDocumentInList = (nextDocument: DocumentDetail | RequirementDocument) => {
  const target = documentList.value.find((document) => document.id === nextDocument.id);
  if (target) {
    Object.assign(target, nextDocument);
  }
};

const notifyTrackedDocumentFinalStatus = (document: RequirementDocument) => {
  if (document.status === 'review_completed') {
    Message.success('需求文档《' + document.title + '》评审已完成');
  } else if (document.status === 'failed') {
    Message.error('需求文档《' + document.title + '》评审失败，请重试');
  }
};

const notifyReviewStatusChanges = (
  previousStatuses: Map<string, DocumentStatus>,
  nextDocuments: RequirementDocument[]
) => {
  nextDocuments.forEach((document) => {
    const previousStatus = previousStatuses.get(document.id);

    if (previousStatus === 'reviewing' && document.status === 'review_completed') {
      Message.success('需求文档《' + document.title + '》评审已完成');
    } else if (previousStatus === 'reviewing' && document.status === 'failed') {
      Message.error('需求文档《' + document.title + '》评审失败，请重试');
    }
  });
};

const refreshTrackedReviewStatuses = async () => {
  const trackedIds = Array.from(trackedReviewingDocumentIds);
  if (trackedIds.length === 0) {
    return loadDocuments({ silent: true });
  }

  let shouldReloadList = false;
  const responses = await Promise.all(
    trackedIds.map((documentId) => RequirementDocumentService.getDocumentDetail(documentId))
  );

  responses.forEach((response, index) => {
    if (response.status !== 'success' || !response.data) {
      return;
    }

    const nextDocument = response.data;
    updateDocumentInList(nextDocument);

    if (nextDocument.status === 'reviewing') {
      trackReviewingDocument(nextDocument.id);
      return;
    }

    if (trackedReviewingDocumentIds.has(nextDocument.id)) {
      untrackReviewingDocument(nextDocument.id);
      notifyTrackedDocumentFinalStatus(nextDocument);
    }
    shouldReloadList = true;
  });

  if (shouldReloadList || !hasReviewingDocuments()) {
    await loadDocuments({ silent: true });
  }

  return true;
};

const refreshReviewStatuses = async () => {
  reviewPollAttempts = 0;
  if (trackedReviewingDocumentIds.size > 0) {
    await refreshTrackedReviewStatuses();
    return;
  }
  await loadDocuments({ silent: true });
};

const handleWindowFocus = () => {
  if (hasReviewingDocuments()) {
    void refreshReviewStatuses();
  }
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && hasReviewingDocuments()) {
    void refreshReviewStatuses();
  }
};

const scheduleReviewPolling = () => {
  clearReviewPollingTimer();

  if (!hasReviewingDocuments()) {
    reviewPollAttempts = 0;
    return;
  }

  reviewPollTimer = setTimeout(async () => {
    reviewPollTimer = null;
    reviewPollAttempts += 1;

    if (reviewPollAttempts >= REVIEW_POLL_MAX_ATTEMPTS) {
      stopReviewPolling();
      Message.warning('需求评审耗时较长，请稍后手动刷新查看结果');
      return;
    }

    if (trackedReviewingDocumentIds.size > 0) {
      await refreshTrackedReviewStatuses();
    } else {
      await loadDocuments({ silent: true });
    }

    if (hasReviewingDocuments()) {
      scheduleReviewPolling();
    }
  }, REVIEW_POLL_INTERVAL_MS);
};

const getStatusColor = (status: DocumentStatus) => {
  const colorMap = {
    uploaded: 'blue',
    processing: 'orange',
    module_split: 'orange',
    user_reviewing: 'purple',
    ready_for_review: 'cyan',
    reviewing: 'orange',
    review_completed: 'green',
    failed: 'red'
  };
  return colorMap[status] || 'gray';
};

const getStatusText = (status: DocumentStatus) => {
  return DocumentStatusDisplay[status] || status;
};

const getTypeText = (type: DocumentType) => {
  return DocumentTypeDisplay[type] || type;
};

const loadDocuments = async ({ silent = false }: { silent?: boolean } = {}) => {
  const requestId = ++listRequestId;
  const projectId = currentProjectId.value;
  if (!currentProjectId.value) {
    stopReviewPolling();
    resetTrackedReviewingDocuments();
    if (!silent) {
      Message.warning('请先选择项目');
    }
    return false;
  }

  const previousStatuses = new Map(
    documentList.value.map((document) => [document.id, document.status] as const)
  );

  if (!silent) {
    loading.value = true;
  }
  listError.value = '';
  try {
    const params: DocumentListParams = {
      project: String(currentProjectId.value),
      page: pagination.current,
      page_size: pagination.pageSize
    };

    if (searchKeyword.value) {
      params.search = searchKeyword.value;
    }
    if (statusFilter.value) {
      params.status = statusFilter.value;
    }
    if (typeFilter.value) {
      params.document_type = typeFilter.value;
    }
    if (uploaderFilter.value) params.uploader = uploaderFilter.value;
    if (activeTab.value === 'reviews') params.has_review = true;
    if (activeTab.value === 'reports') params.status = 'review_completed';

    const response = await RequirementDocumentService.getDocumentList(params);

    if (requestId !== listRequestId || currentProjectId.value !== projectId) return false;

    if (response.status === 'success') {
      if (Array.isArray(response.data)) {
        documentList.value = response.data;
        pagination.total = response.data.length;
      } else if (response.data.results) {
        documentList.value = response.data.results;
        pagination.total = response.data.count;
      } else {
        documentList.value = [];
        pagination.total = 0;
      }
      notifyReviewStatusChanges(previousStatuses, documentList.value);
      if (documentList.value.some(document => previousStatuses.has(document.id) && previousStatuses.get(document.id) !== document.status)) void loadOverview();
      syncTrackedReviewingDocuments(documentList.value);
      if (hasReviewingDocuments(documentList.value)) {
        scheduleReviewPolling();
      } else {
        stopReviewPolling();
      }
      return true;
    } else {
      if (!silent) {
      listError.value = response.message || '加载文档列表失败，请稍后重试。';
      Message.error(response.message || '加载文档列表失败');
      }
    }
  } catch (error) {
    if (!silent && requestId === listRequestId && currentProjectId.value === projectId) {
    listError.value = '加载文档列表失败，请检查网络后重试。';
    console.error('加载文档列表失败:', error);
    Message.error('加载文档列表失败');
    }
  } finally {
    if (requestId === listRequestId) {
      loading.value = false;
    }
  }

  return false;
};

const handleSearch = () => {
  pagination.current = 1;
  loadDocuments();
};

const handlePageChange = (page: number) => {
  pagination.current = page;
  loadDocuments();
};

const handlePageSizeChange = (pageSize: number) => {
  pagination.pageSize = pageSize;
  pagination.current = 1;
  loadDocuments();
};

const showUploadModal = () => {
  if (!currentProjectId.value) {
    Message.warning('请先选择项目');
    return;
  }
  uploadForm.project = String(currentProjectId.value);
  console.log('打开上传弹窗，项目 ID:', uploadForm.project);
  uploadModalVisible.value = true;
};

const handleFileChange = (fileListParam: any[], file: any) => {
  console.log('文件选择变化:', fileListParam, file);

  fileList.value = fileListParam;

  if (file && file.file) {
    uploadForm.file = file.file;
    console.log('设置文件列表项:', file.file);

    const fileName = file.file.name;
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension && ['pdf', 'doc', 'docx', 'txt', 'md'].includes(extension)) {
      uploadForm.document_type = extension as DocumentType;
    }
    if (!uploadForm.title) {
      uploadForm.title = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    }
  } else if (fileListParam.length === 0) {
    uploadForm.file = undefined;
    console.log('文件被移除');
  }
};

const handleUploadTypeChange = () => {
  if (uploadForm.uploadType === 'content') {
    uploadForm.document_type = 'txt';
    uploadForm.file = undefined;
    fileList.value = [];
  } else if (uploadForm.uploadType === 'file') {
    uploadForm.document_type = 'pdf';
    uploadForm.content = '';
  }
};

const handleUpload = async (done: (closed: boolean) => void) => {
  try {
    const errors = await uploadFormRef.value?.validate();
    if (errors) { done(false); return; }
    if (!uploadForm.title.trim()) {
      Message.error('请输入文档标题');
      done(false);
      return;
    }

    if (uploadForm.uploadType === 'file' && !uploadForm.file) {
      Message.error('请选择文件');
      done(false);
      return;
    }

    if (uploadForm.uploadType === 'content' && (!uploadForm.content || !uploadForm.content.trim())) {
      Message.error('请输入文档内容');
      done(false);
      return;
    }

    if (!uploadForm.project) {
      Message.error('请先选择项目');
      done(false);
      return;
    }

    uploadLoading.value = true;

    const response = await RequirementDocumentService.uploadDocument(uploadForm);

    if (response.status === 'success') {
      Message.success('文档上传成功');
      void loadOverview();
      uploadModalVisible.value = false;
      done(true);
      resetUploadForm();
      await loadDocuments();
    } else {
      Message.error(response.message || '文档上传失败');
      done(false);
    }
  } catch (error) {
    console.error('文档上传失败:', error);
    Message.error('文档上传失败');
    done(false);
  } finally {
    uploadLoading.value = false;
  }
};

const resetUploadForm = () => {
  uploadFormRef.value?.resetFields();
  fileList.value = [];
  Object.assign(uploadForm, {
    title: '',
    description: '',
    document_type: 'pdf',
    project: String(currentProjectId.value || ''),
    uploadType: 'file',
    file: undefined,
    content: ''
  });
};

const formatFileSize = (size: number | undefined): string => {
  if (!size || isNaN(size)) return '未知大小';
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / (1024 * 1024)).toFixed(1) + ' MB';
};

const removeFile = (index: number) => {
  fileList.value.splice(index, 1);
  uploadForm.file = undefined;
};

const viewDocument = (document: RequirementDocument) => {
  router.push(`/requirements/${document.id}`);
};


const startReview = (document: RequirementDocument) => {
  currentDocument.value = document;
  reviewAction.value = 'start';
  reviewConfigVisible.value = true;
};

const restartReview = (document: RequirementDocument) => {
  currentDocument.value = document;
  reviewAction.value = 'restart';
  reviewConfigVisible.value = true;
};

const retryReview = (document: RequirementDocument) => {
  currentDocument.value = document;
  reviewAction.value = 'retry';
  reviewConfigVisible.value = true;
};

const confirmReview = async () => {
  if (!currentDocument.value) return;
  
  reviewConfigVisible.value = false;
  loading.value = true;
  
  const options = {
    analysis_type: 'comprehensive' as const,
    parallel_processing: true,
    max_workers: reviewConfig.value.max_workers
  };

  try {
    let response;
    const documentId = currentDocument.value.id;
    
    if (reviewAction.value === 'restart') {
      response = await RequirementDocumentService.restartReview(documentId, options);
    } else {
      response = await RequirementDocumentService.startReview(documentId, options);
    }

    if (response.status === 'success') {
      const actionText = reviewAction.value === 'restart' ? '重新评审' : '需求评审';
      Message.success(`${actionText}已启动（并发数：${reviewConfig.value.max_workers}）`);
      void loadOverview();
      markDocumentAsReviewing(documentId);
      reviewPollAttempts = 0;
      scheduleReviewPolling();
      await loadDocuments({ silent: true });
    } else {
      Message.error(response.message || '评审启动失败');
    }
  } catch (error) {
    console.error('评审启动失败:', error);
    Message.error('评审启动失败');
  } finally {
    loading.value = false;
    currentDocument.value = null;
  }
};

const viewReports = (document: RequirementDocument) => {
  if (document.id) {
    router.push(`/requirements/${document.id}/report`);
  } else {
    Message.warning('暂无评审报告');
  }
};

const deleteDocument = async (document: RequirementDocument) => {
  try {
    loading.value = true;
    const response = await RequirementDocumentService.deleteDocument(document.id);

    if (response.status === 'success') {
      Message.success('文档删除成功');
      void loadOverview();
      loadDocuments();
    } else {
      Message.error(response.message || '文档删除失败');
    }
  } catch (error) {
    console.error('文档删除失败:', error);
    Message.error('文档删除失败');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  window.addEventListener('focus', handleWindowFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
  window.removeEventListener('focus', handleWindowFocus);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  stopReviewPolling();
  resetTrackedReviewingDocuments();
});

watch(currentProjectId, async projectId => {
  ++listRequestId; ++overviewRequestId; loading.value = false; overviewLoading.value = false;
  stopReviewPolling(); resetTrackedReviewingDocuments(); documentList.value = []; projectMembers.value = [];
  pagination.current = 1; pagination.total = 0; listError.value = ''; overviewError.value = '';
  searchKeyword.value = ''; statusFilter.value = ''; typeFilter.value = ''; uploaderFilter.value = '';
  reviewPickerVisible.value = false; reviewConfigVisible.value = false; uploadModalVisible.value = false;
  overviewMetrics.forEach(metric => overview[metric.key] = null);
  uploadForm.project = projectId ? String(projectId) : '';
  if (!projectId) return;
  void loadDocuments(); void loadOverview();
  const response = await getProjectMembers(projectId);
  if (currentProjectId.value === projectId && response.success) projectMembers.value = response.data || [];
}, { immediate: true });
</script>

<style scoped src="./requirement-management.css"></style>
