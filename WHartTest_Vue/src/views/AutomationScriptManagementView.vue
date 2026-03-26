<template>
  <div class="automation-script-management">
    <a-card class="filter-card">
      <div class="filter-row">
        <a-space wrap>
          <a-button type="primary" @click="openCreateModal">
            <template #icon><icon-plus /></template>
            新建脚本
          </a-button>
          <a-select
            v-model="filterStatus"
            placeholder="脚本状态"
            allow-clear
            class="filter-select"
            @change="handleFilterChange"
          >
            <a-option value="active">启用</a-option>
            <a-option value="draft">草稿</a-option>
            <a-option value="deprecated">已废弃</a-option>
          </a-select>
          <a-select
            v-model="filterSource"
            placeholder="来源"
            allow-clear
            class="filter-select"
            @change="handleFilterChange"
          >
            <a-option value="ai_generated">AI 生成</a-option>
            <a-option value="manual">手动编写</a-option>
          </a-select>
          <a-input-search
            v-model="searchKeyword"
            placeholder="搜索脚本名称"
            class="search-input"
            @search="handleFilterChange"
          />
        </a-space>
        <a-button type="primary" @click="fetchScripts">
          <template #icon><icon-refresh /></template>
          刷新
        </a-button>
      </div>
    </a-card>

    <a-card class="table-card">
      <a-table
        :data="scripts"
        :loading="loading"
        :pagination="pagination"
        :header-cell-style="{ textAlign: 'center' }"
        :scroll="{ x: 900 }"
        @page-change="handlePageChange"
      >
        <template #columns>
          <a-table-column title="ID" data-index="id" :width="50" align="center" />
          <a-table-column title="脚本名称" data-index="name" :width="140" align="center" ellipsis>
            <template #cell="{ record }">
              <a-link @click="showDetail(record)">{{ record.name }}</a-link>
            </template>
          </a-table-column>
          <a-table-column title="关联用例" data-index="test_case_name" :width="120" align="center" ellipsis />
          <a-table-column title="类型" data-index="script_type" :width="120" align="center">
            <template #cell="{ record }">
              <a-tag color="blue">{{ getScriptTypeLabel(record.script_type) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="来源" data-index="source" :width="70" align="center">
            <template #cell="{ record }">
              <a-tag :color="getSourceColor(record.source)">
                {{ getSourceLabel(record.source) }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="状态" data-index="status" :width="70" align="center">
            <template #cell="{ record }">
              <a-badge :status="getStatusBadge(record.status)" :text="getStatusLabel(record.status)" />
            </template>
          </a-table-column>
          <a-table-column title="版本" data-index="version" :width="60" align="center">
            <template #cell="{ record }">v{{ record.version }}</template>
          </a-table-column>
          <a-table-column title="最近" data-index="latest_status" :width="80" align="center">
            <template #cell="{ record }">
              <template v-if="record.latest_status">
                <a-tag :color="getExecutionStatusColor(record.latest_status)">
                  {{ getExecutionStatusLabel(record.latest_status) }}
                </a-tag>
              </template>
              <span v-else class="text-gray">未执行</span>
            </template>
          </a-table-column>
          <a-table-column title="创建时间" data-index="created_at" :width="100" align="center">
            <template #cell="{ record }">
              {{ formatTime(record.created_at) }}
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="210" fixed="right" align="center">
            <template #cell="{ record }">
              <a-space :size="2">
                <a-button type="text" size="small" @click="showDetail(record)">
                  <icon-eye />
                </a-button>
                <a-button type="text" size="small" @click="openEditModal(record)">
                  <icon-edit />
                </a-button>
                <a-button
                  type="text"
                  size="small"
                  :loading="executingId === record.id"
                  @click="executeScript(record, false)"
                  title="快速执行（无头模式）"
                >
                  <icon-play-arrow />
                </a-button>
                <a-popconfirm
                  content="确定要删除此脚本吗？"
                  @ok="deleteScript(record.id)"
                >
                  <a-button type="text" size="small" status="danger">
                    <icon-delete />
                  </a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 脚本详情抽屉 -->
    <a-drawer
      v-model:visible="detailVisible"
      :title="currentScript?.name || '脚本详情'"
      :width="drawerWidth"
      :footer="false"
    >
      <template v-if="currentScript">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item label="脚本名称">{{ currentScript.name }}</a-descriptions-item>
          <a-descriptions-item label="版本">v{{ currentScript.version }}</a-descriptions-item>
          <a-descriptions-item label="关联用例">{{ currentScript.test_case_name }}</a-descriptions-item>
          <a-descriptions-item label="脚本类型">{{ getScriptTypeLabel(currentScript.script_type) }}</a-descriptions-item>
          <a-descriptions-item label="来源">{{ getSourceLabel(currentScript.source) }}</a-descriptions-item>
          <a-descriptions-item label="状态">{{ getStatusLabel(currentScript.status) }}</a-descriptions-item>
          <a-descriptions-item label="目标URL" :span="2">{{ currentScript.target_url || '未指定' }}</a-descriptions-item>
          <a-descriptions-item label="描述" :span="2">{{ currentScript.description || '无' }}</a-descriptions-item>
        </a-descriptions>

        <a-divider>脚本代码</a-divider>
        <div class="code-container">
          <pre><code>{{ currentScript.script_content }}</code></pre>
        </div>

        <a-divider>执行历史</a-divider>
        <a-table
          :data="currentScript.executions || []"
          :loading="executionsLoading"
          size="small"
          row-key="id"
          v-model:expanded-keys="executionExpandedKeys"
          :expandable="{ width: 50 }"
        >
          <template #columns>
            <a-table-column title="ID" data-index="id" :width="60" />
            <a-table-column title="状态" data-index="status" :width="80">
              <template #cell="{ record }">
                <a-tag :color="getExecutionStatusColor(record.status)">
                  {{ getExecutionStatusLabel(record.status) }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="执行时间" data-index="created_at" :width="180">
              <template #cell="{ record }">{{ formatTime(record.created_at) }}</template>
            </a-table-column>
            <a-table-column title="耗时" data-index="execution_time" :width="80">
              <template #cell="{ record }">
                {{ record.execution_time ? `${record.execution_time.toFixed(2)}s` : '-' }}
              </template>
            </a-table-column>
            <a-table-column title="执行人" data-index="executor_detail">
              <template #cell="{ record }">
                {{ record.executor_detail?.username || '-' }}
              </template>
            </a-table-column>
          </template>
          <!-- 展开行显示详细报告 -->
          <template #expand-row="{ record }">
            <div class="execution-detail">
              <template v-if="record.error_message">
                <div class="detail-section error">
                  <div class="detail-label">❌ 错误信息</div>
                  <pre class="detail-content">{{ record.error_message }}</pre>
                </div>
              </template>
              <template v-if="record.stack_trace">
                <div class="detail-section">
                  <div class="detail-label">堆栈跟踪</div>
                  <pre class="detail-content stack-trace">{{ record.stack_trace }}</pre>
                </div>
              </template>
              <template v-if="record.output">
                <div class="detail-section">
                  <div class="detail-label">输出日志</div>
                  <pre class="detail-content">{{ record.output }}</pre>
                </div>
              </template>
              <template v-if="record.screenshots && record.screenshots.length > 0">
                <div class="detail-section">
                  <div class="detail-label">截图 ({{ record.screenshots.length }})</div>
                  <a-image-preview-group infinite>
                    <div class="screenshots">
                      <a-image 
                        v-for="(screenshot, idx) in record.screenshots" 
                        :key="idx"
                        :src="`/media/${screenshot}`"
                        width="120"
                        height="80"
                        fit="cover"
                        :preview-props="{ actionsLayout: ['zoomIn', 'zoomOut', 'rotateLeft', 'rotateRight', 'originalSize'] }"
                      />
                    </div>
                  </a-image-preview-group>
                </div>
              </template>
              <template v-if="record.videos && record.videos.length > 0">
                <div class="detail-section">
                  <div class="detail-label">🎬 录屏 ({{ record.videos.length }})</div>
                  <div class="videos">
                    <video 
                      v-for="(video, idx) in record.videos" 
                      :key="idx"
                      :src="`/media/${video}`"
                      controls
                      class="video-player"
                    />
                  </div>
                </div>
              </template>
              <template v-if="!record.error_message && !record.output && !record.stack_trace && (!record.screenshots || record.screenshots.length === 0) && (!record.videos || record.videos.length === 0)">
                <div class="no-detail">暂无详细信息</div>
              </template>
            </div>
          </template>
        </a-table>
      </template>
    </a-drawer>

    <!-- 新建/编辑脚本弹窗 - 左右布局 -->
    <a-modal
      v-model:visible="editModalVisible"
      :title="isEditMode ? '编辑脚本' : '新建脚本'"
      :width="modalWidth"
      :body-style="{ padding: 0 }"
      :mask-closable="false"
      :footer="false"
      @cancel="closeEditModal"
    >
      <div class="script-editor-layout">
        <!-- 左侧面板 -->
        <div class="editor-left-panel">
          <!-- 预览模式：显示执行日志 -->
          <div v-if="isPreviewMode" class="execution-logs-panel">
            <div class="logs-header">
              <span class="logs-title">
                <icon-code-block /> 执行日志
              </span>
              <a-badge :status="previewStatusBadge" :text="previewStatusText" />
            </div>
            <div class="logs-content">
              <div v-for="(log, idx) in executionLogs" :key="idx" class="log-item">
                {{ log }}
              </div>
              <div v-if="executionLogs.length === 0" class="log-item log-placeholder">
                等待执行...
              </div>
            </div>
          </div>
          
          <!-- 编辑模式：显示表单 -->
          <a-form v-else :model="scriptForm" layout="vertical" :rules="formRules" ref="formRef" class="script-form">
            <a-form-item label="脚本名称" field="name" required>
              <a-input v-model="scriptForm.name" placeholder="请输入脚本名称" />
            </a-form-item>
            
            <a-form-item label="关联测试用例" field="test_case" required>
              <a-select
                v-model="scriptForm.test_case"
                placeholder="选择测试用例"
                :loading="testCasesLoading"
                allow-search
                :filter-option="false"
                @search="searchTestCases"
              >
                <a-option v-for="tc in testCaseOptions" :key="tc.id" :value="tc.id">
                  {{ tc.name }}
                </a-option>
              </a-select>
            </a-form-item>

            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item label="脚本类型" field="script_type">
                  <a-select v-model="scriptForm.script_type" placeholder="选择类型">
                    <a-option value="playwright_python">Python</a-option>
                    <a-option value="playwright_javascript">JavaScript</a-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="状态" field="status">
                  <a-select v-model="scriptForm.status" placeholder="选择状态">
                    <a-option value="draft">草稿</a-option>
                    <a-option value="active">启用</a-option>
                    <a-option value="deprecated">已废弃</a-option>
                  </a-select>
                </a-form-item>
              </a-col>
            </a-row>

            <a-form-item label="来源" field="source">
              <a-select v-model="scriptForm.source" placeholder="选择来源">
                <a-option value="manual">手动编写</a-option>
                <a-option value="ai_generated">AI 生成</a-option>
              </a-select>
            </a-form-item>

            <a-form-item label="目标URL" field="target_url">
              <a-input v-model="scriptForm.target_url" placeholder="测试的目标网址" />
            </a-form-item>

            <a-form-item label="超时时间（秒）" field="timeout_seconds">
              <a-input-number v-model="scriptForm.timeout_seconds" :min="10" :max="600" style="width: 100%;" />
            </a-form-item>

            <a-form-item label="描述" field="description">
              <a-textarea v-model="scriptForm.description" placeholder="脚本描述" :auto-size="{ minRows: 2, maxRows: 4 }" />
            </a-form-item>

            <div class="form-actions">
              <a-space>
                <a-button @click="closeEditModal">取消</a-button>
                <a-button type="primary" :loading="saving" @click="handleSaveScript">
                  {{ isEditMode ? '保存修改' : '创建脚本' }}
                </a-button>
              </a-space>
            </div>
          </a-form>
        </div>

        <!-- 右侧：代码编辑器 + 执行预览 -->
        <div class="editor-right-panel">
          <div class="editor-header">
            <span class="editor-title">
              <icon-code /> 脚本代码
              <a-tag size="small" :color="scriptForm.script_type === 'playwright_python' ? 'blue' : 'orange'">
                {{ scriptForm.script_type === 'playwright_python' ? 'Python' : 'JavaScript' }}
              </a-tag>
            </span>
            <a-space v-if="isEditMode">
              <a-button
                v-if="!isPreviewMode"
                size="small"
                type="primary"
                status="success"
                :loading="isExecuting"
                @click="startLivePreview"
              >
                <template #icon><icon-play-arrow /></template>
                调试执行
              </a-button>
              <a-button
                v-else-if="isExecuting"
                size="small"
                status="danger"
                @click="stopLivePreview"
              >
                <template #icon><icon-pause /></template>
                停止执行
              </a-button>
              <a-button
                v-else
                size="small"
                type="secondary"
                @click="stopLivePreview"
              >
                <template #icon><icon-close /></template>
                关闭预览
              </a-button>
            </a-space>
          </div>
          
          <!-- 代码编辑器 / 执行预览切换 -->
          <div class="editor-content">
            <!-- 预览模式：显示浏览器画面 -->
            <div v-if="isPreviewMode" class="preview-container">
              <div class="preview-frame">
                <img
                  v-if="currentFrame"
                  :src="'data:image/jpeg;base64,' + currentFrame"
                  class="preview-image"
                  alt="浏览器画面"
                />
                <div v-else class="preview-placeholder">
                  <icon-loading v-if="isExecuting" spin :size="48" />
                  <span>{{ isExecuting ? '正在启动浏览器...' : '等待执行' }}</span>
                </div>
              </div>
              <!-- 帧回放控制条 - 点状指示器 -->
              <div v-if="frameHistory.length > 1 && !isExecuting" class="frame-playback-bar">
                <a-button size="mini" @click="prevFrame" :disabled="currentFrameIndex <= 0">
                  <icon-left />
                </a-button>
                <div class="frame-dots">
                  <div
                    v-for="(_, index) in frameHistory"
                    :key="index"
                    class="frame-dot"
                    :class="{ active: index === currentFrameIndex }"
                    @click="selectFrame(index)"
                    :title="`帧 ${index + 1}`"
                  />
                </div>
                <a-button size="mini" @click="nextFrame" :disabled="currentFrameIndex >= frameHistory.length - 1">
                  <icon-right />
                </a-button>
                <span class="frame-info">{{ currentFrameIndex + 1 }} / {{ frameHistory.length }}</span>
              </div>
            </div>
            
            <!-- 编辑模式：显示 Monaco 编辑器 -->
            <div v-else class="monaco-container">
              <VueMonacoEditor
                v-model:value="scriptForm.script_content"
                :language="monacoLanguage"
                theme="vs-dark"
                :options="monacoOptions"
                @mount="handleEditorMount"
              />
            </div>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, shallowRef, watch } from 'vue';
import { Message, type FormInstance } from '@arco-design/web-vue';
	import { 
	  IconRefresh, IconEye, IconPlayArrow, IconDelete, IconPlus, IconEdit, IconCode, IconPause, IconLoading, IconCodeBlock, IconClose, IconLeft, IconRight
	} from '@arco-design/web-vue/es/icon';
	import { useProjectStore } from '@/store/projectStore';
	import request from '@/utils/request';
	import {
	  createAutomationScript,
	  deleteAutomationScript,
	  executeAutomationScript,
	  getAutomationScript,
	  listAutomationScriptExecutions,
	  listAutomationScripts,
	  updateAutomationScript,
	} from '@/services/automationScriptService';
	import { VueMonacoEditor } from '@guolao/vue-monaco-editor';

interface AutomationScript {
  id: number;
  name: string;
  test_case: number;
  test_case_name: string;
  script_type: string;
  source: string;
  status: string;
  version: number;
  target_url: string;
  description: string;
  script_content: string;
  timeout_seconds: number;
  created_at: string;
  latest_status: string | null;
  executions?: any[];
}

interface TestCaseOption {
  id: number;
  name: string;
}

interface ScriptForm {
  name: string;
  test_case: number | undefined;
  script_type: string;
  source: string;
  status: string;
  target_url: string;
  description: string;
  script_content: string;
  timeout_seconds: number;
}

const projectStore = useProjectStore();
const loading = ref(false);
const scripts = ref<AutomationScript[]>([]);
const searchKeyword = ref('');
const filterStatus = ref<string | undefined>();
const filterSource = ref<string | undefined>();
const executingId = ref<number | null>(null);

// 响应式宽度计算
const windowWidth = ref(window.innerWidth);
const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth;
};

const drawerWidth = computed(() => {
  if (windowWidth.value < 600) return '100%';
  if (windowWidth.value < 900) return '90%';
  return 800;
});

const modalWidth = computed(() => {
  if (windowWidth.value < 600) return '100%';
  if (windowWidth.value < 1000) return '95%';
  if (windowWidth.value < 1400) return '90%';
  return 1400;
});

// 详情抽屉
const detailVisible = ref(false);
const currentScript = ref<AutomationScript | null>(null);
const executionsLoading = ref(false);
const executionExpandedKeys = ref<number[]>([]);

// 编辑弹窗
const editModalVisible = ref(false);
const isEditMode = ref(false);
const editingScriptId = ref<number | null>(null);
const formRef = ref<FormInstance>();
const testCasesLoading = ref(false);
const testCaseOptions = ref<TestCaseOption[]>([]);
const saving = ref(false);

const getDefaultForm = (): ScriptForm => ({
  name: '',
  test_case: undefined,
  script_type: 'playwright_python',
  source: 'manual',
  status: 'draft',
  target_url: '',
  description: '',
  script_content: '',
  timeout_seconds: 60,
});

const scriptForm = reactive<ScriptForm>(getDefaultForm());

const formRules = {
  name: [{ required: true, message: '请输入脚本名称' }],
  test_case: [{ required: true, message: '请选择关联的测试用例' }],
  script_content: [{ required: true, message: '请输入脚本代码' }],
};

// Monaco Editor 配置
const editorRef = shallowRef();
const monacoLanguage = computed(() => 
  scriptForm.script_type === 'playwright_python' ? 'python' : 'javascript'
);

const monacoOptions = {
  automaticLayout: true,
  minimap: { enabled: true },
  fontSize: 14,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  tabSize: 4,
  insertSpaces: true,
  formatOnPaste: true,
  renderWhitespace: 'selection' as const,
  bracketPairColorization: { enabled: true },
  padding: { top: 10 },
};

const handleEditorMount = (editor: any) => {
  editorRef.value = editor;
};

// 实时执行预览
const isPreviewMode = ref(false);
const isExecuting = ref(false);
const currentFrame = ref<string>('');
const executionLogs = ref<string[]>([]);
const previewStatus = ref<'idle' | 'connecting' | 'running' | 'completed' | 'error'>('idle');
let previewWebSocket: WebSocket | null = null;

// 帧历史（用于回放）
const frameHistory = ref<string[]>([]);
const currentFrameIndex = ref(0);

// 帧回放控制
const selectFrame = (index: number) => {
  if (frameHistory.value[index]) {
    currentFrameIndex.value = index;
    currentFrame.value = frameHistory.value[index];
  }
};

const prevFrame = () => {
  if (currentFrameIndex.value > 0) {
    currentFrameIndex.value--;
    currentFrame.value = frameHistory.value[currentFrameIndex.value];
  }
};

const nextFrame = () => {
  if (currentFrameIndex.value < frameHistory.value.length - 1) {
    currentFrameIndex.value++;
    currentFrame.value = frameHistory.value[currentFrameIndex.value];
  }
};

const previewStatusBadge = computed(() => {
  const map: Record<string, 'default' | 'processing' | 'success' | 'error'> = {
    idle: 'default',
    connecting: 'processing',
    running: 'processing',
    completed: 'success',
    error: 'error',
  };
  return map[previewStatus.value] || 'default';
});

const previewStatusText = computed(() => {
  const map: Record<string, string> = {
    idle: '等待执行',
    connecting: '正在连接...',
    running: '执行中',
    completed: '执行完成',
    error: '执行出错',
  };
  return map[previewStatus.value] || '';
});

// 获取用户 Token
const getUserToken = (): string => {
  // 从 localStorage 获取 JWT access token
  return localStorage.getItem('auth-accessToken') || '';
};

// 构建保存 payload
const buildScriptPayload = () => ({
  name: scriptForm.name,
  test_case: scriptForm.test_case,
  script_type: scriptForm.script_type,
  source: scriptForm.source,
  status: scriptForm.status,
  target_url: scriptForm.target_url,
  description: scriptForm.description,
  script_content: scriptForm.script_content,
  timeout_seconds: scriptForm.timeout_seconds,
});

// 静默保存脚本（不关闭弹窗，用于调试执行前自动保存）
const silentSaveScript = async (): Promise<boolean> => {
  const projectId = projectStore.currentProjectId;
  if (!projectId) {
    Message.warning('请先选择项目');
    return false;
  }

  try {
    // validate() 校验失败时会 reject，成功时返回 undefined
    await formRef.value?.validate();
  } catch {
    Message.warning('请先填写必填字段');
    return false;
  }
  
	try {
	  const payload = buildScriptPayload();
	  
	  if (isEditMode.value && editingScriptId.value) {
	    await updateAutomationScript(projectId, editingScriptId.value, payload);
	  } else {
	    const response = await createAutomationScript(projectId, payload);
	    // 新建脚本后更新 editingScriptId，这样 WebSocket 能找到脚本
	    editingScriptId.value = response.data.id;
	    isEditMode.value = true;
	  }
	  return true;
	} catch (error: any) {
	  Message.error(error.response?.data?.detail || error.message || '保存失败');
	  return false;
	}
};

// 开始实时预览
const startLivePreview = async () => {
  // 先自动保存脚本内容
  const saved = await silentSaveScript();
  if (!saved) {
    return;
  }
  
  isPreviewMode.value = true;
  isExecuting.value = true;
  previewStatus.value = 'connecting';
  currentFrame.value = '';
  executionLogs.value = [];
  frameHistory.value = [];  // 清空帧历史
  currentFrameIndex.value = 0;
  
  // 构建 WebSocket URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const token = getUserToken();
  const wsUrl = `${protocol}//${host}/ws/execution-preview/${editingScriptId.value}/?token=${token}`;
  
  try {
    previewWebSocket = new WebSocket(wsUrl);
    
    previewWebSocket.onopen = () => {
      previewStatus.value = 'running';
      executionLogs.value.push('[连接成功] 开始执行脚本...');
      // 发送开始执行命令
      previewWebSocket?.send(JSON.stringify({
        action: 'start',
        headless: true,
        fps: 10
      }));
    };
    
    previewWebSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 调试日志：打印接收到的消息类型
        console.log('[DEBUG WS] 收到消息, type:', data.type, ', 原始数据长度:', event.data.length);
        
        if (data.type === 'frame') {
          console.log('[DEBUG WS] 处理 frame 消息, 数据长度:', data.data?.length || 0);
          // 更新当前帧并保存到历史（限制最多100帧，避免内存溢出）
          currentFrame.value = data.data;
          frameHistory.value.push(data.data);
          if (frameHistory.value.length > 100) {
            frameHistory.value.shift();
          }
          currentFrameIndex.value = frameHistory.value.length - 1;
        } else if (data.type === 'status') {
          console.log('[DEBUG WS] 处理 status 消息:', data.status, data.message);
          // 更新状态
          if (data.status === 'completed') {
            previewStatus.value = 'completed';
            isExecuting.value = false;
          } else if (data.status === 'error') {
            previewStatus.value = 'error';
            isExecuting.value = false;
          }
          executionLogs.value.push(`[${data.status}] ${data.message}`);
        } else if (data.type === 'log') {
          console.log('[DEBUG WS] 处理 log 消息:', data.message?.substring(0, 100));
          executionLogs.value.push(data.message);
        } else {
          console.warn('[DEBUG WS] 未知消息类型:', data.type, ', 完整数据:', JSON.stringify(data).substring(0, 200));
          // 未知类型也添加到日志以便调试
          executionLogs.value.push(`[未知类型 ${data.type}] ${JSON.stringify(data).substring(0, 100)}`);
        }
        
        // 限制日志数量
        if (executionLogs.value.length > 100) {
          executionLogs.value = executionLogs.value.slice(-100);
        }
      } catch (e) {
        console.error('解析 WebSocket 消息失败:', e, ', 原始数据:', event.data?.substring(0, 200));
      }
    };
    
    previewWebSocket.onerror = (error) => {
      console.error('WebSocket 错误:', error);
      previewStatus.value = 'error';
      isExecuting.value = false;
      executionLogs.value.push('[错误] WebSocket 连接失败');
    };
    
    previewWebSocket.onclose = () => {
      // 连接关闭时，如果还在执行中，标记为错误
      if (isExecuting.value) {
        previewStatus.value = 'error';
        isExecuting.value = false;
        executionLogs.value.push('[断开] 连接已关闭');
      }
      // 不清理 currentFrame，让用户继续查看最后一帧
    };
  } catch (error) {
    console.error('创建 WebSocket 失败:', error);
    previewStatus.value = 'error';
    isExecuting.value = false;
    Message.error('无法连接到执行服务器');
  }
};

// 停止实时预览
const stopLivePreview = () => {
  if (previewWebSocket) {
    // 如果还在执行中，发送停止命令
    if (isExecuting.value) {
      previewWebSocket.send(JSON.stringify({ action: 'stop' }));
      executionLogs.value.push('[停止] 用户主动停止执行');
    }
    previewWebSocket.close();
    previewWebSocket = null;
  }
  
  isExecuting.value = false;
  previewStatus.value = 'idle';
  
  // 清理画面、帧历史并关闭预览模式
  isPreviewMode.value = false;
  currentFrame.value = '';
  frameHistory.value = [];
  currentFrameIndex.value = 0;
};

// 分页
const pagination = ref({
  current: 1,
  pageSize: 20,
  total: 0,
  showTotal: true,
  showJumper: true,
});

// 获取脚本列表
	const fetchScripts = async () => {
	  loading.value = true;
	  try {
	    const params: Record<string, string | number> = {
	      page: pagination.value.current,
	      page_size: pagination.value.pageSize,
	    };
    
    if (projectStore.currentProjectId) {
      params.project_id = projectStore.currentProjectId;
    }
	    if (filterStatus.value) params.status = filterStatus.value;
	    if (filterSource.value) params.source = filterSource.value;
	    if (searchKeyword.value) params.search = searchKeyword.value;
	    
	    const response = await listAutomationScripts(params as any);
	    // 响应拦截器会将后端的 { status, data: [...] } 转换为 { data: [...] }
	    scripts.value = response.data.data || response.data.results || [];
	    // 优先使用后端返回的 count，否则使用当前结果长度
	    pagination.value.total = response.data.count ?? scripts.value.length;
	  } catch (error: any) {
	    Message.error(error.message || '获取脚本列表失败');
	  } finally {
	    loading.value = false;
	  }
	};

// 筛选变化时重置页码并刷新
const handleFilterChange = () => {
  pagination.value.current = 1;
  fetchScripts();
};

// 分页变化
const handlePageChange = (page: number) => {
  pagination.value.current = page;
  fetchScripts();
};

// 显示详情
const showDetail = async (script: AutomationScript) => {
  const projectId = projectStore.currentProjectId;
  if (!projectId) {
    Message.warning('请先选择项目');
    return;
  }

  currentScript.value = script;
  detailVisible.value = true;
  executionExpandedKeys.value = [];
  
  // 加载完整脚本信息和执行历史
	  executionsLoading.value = true;
	  try {
	    const [scriptRes, execRes] = await Promise.all([
	      getAutomationScript(projectId, script.id),
	      listAutomationScriptExecutions(projectId, script.id)
	    ]);
	    // 响应拦截器会将后端的 { data: {...} } 解包
	    const scriptData = scriptRes.data.data || scriptRes.data;
	    const execData = execRes.data.data || execRes.data.results || execRes.data || [];
	    currentScript.value = {
      ...scriptData,
      executions: execData
    };
  } catch (error) {
    console.error('加载脚本详情失败:', error);
  } finally {
    executionsLoading.value = false;
  }
};

// 执行脚本
const executeScript = async (script: AutomationScript, recordVideo: boolean = false) => {
  const projectId = projectStore.currentProjectId;
  if (!projectId) {
    Message.warning('请先选择项目');
    return;
  }

	  executingId.value = script.id;
	  const modeText = recordVideo ? '录屏模式' : '快速模式';
	  try {
	    await executeAutomationScript(projectId, script.id, { record_video: recordVideo });
	    Message.success(`脚本执行已启动（${modeText}）`);
	    // 刷新列表以显示最新执行状态
	    fetchScripts();
	  } catch (error: any) {
	    Message.error(error.response?.data?.error || '执行脚本失败');
	  } finally {
	    executingId.value = null;
	  }
	};

// 删除脚本
const deleteScript = async (id: number) => {
  const projectId = projectStore.currentProjectId;
	  if (!projectId) {
	    Message.warning('请先选择项目');
	    return;
	  }

	  try {
	    await deleteAutomationScript(projectId, id);
	    Message.success('脚本已删除');
	    fetchScripts();
	  } catch (error: any) {
	    Message.error(error.message || '删除失败');
	  }
	};

// 搜索测试用例
const searchTestCases = async (keyword: string) => {
  const projectId = projectStore.currentProjectId;
  if (!projectId) {
    testCaseOptions.value = [];
    return;
  }
  
  testCasesLoading.value = true;
  try {
    const params: any = { search: keyword, page_size: 50 };
    const response = await request.get(`/projects/${projectId}/testcases/`, { params });
    const data = response.data.data || response.data.results || response.data || [];
    testCaseOptions.value = data.map((tc: any) => ({ id: tc.id, name: tc.name }));
  } catch {
    testCaseOptions.value = [];
  } finally {
    testCasesLoading.value = false;
  }
};

// 加载初始测试用例（编辑时需要显示已选择的用例）
const loadInitialTestCases = async (selectedId?: number) => {
  const projectId = projectStore.currentProjectId;
  if (!projectId) {
    testCaseOptions.value = [];
    return;
  }
  
  testCasesLoading.value = true;
  try {
    const params: any = { page_size: 20 };
    const response = await request.get(`/projects/${projectId}/testcases/`, { params });
    const data = response.data.data || response.data.results || response.data || [];
    testCaseOptions.value = data.map((tc: any) => ({ id: tc.id, name: tc.name }));
    
    // 如果有已选择的用例且不在列表中，单独加载
    if (selectedId && !testCaseOptions.value.some(tc => tc.id === selectedId)) {
      const tcRes = await request.get(`/projects/${projectId}/testcases/${selectedId}/`);
      const tcData = tcRes.data.data || tcRes.data;
      testCaseOptions.value.unshift({ id: tcData.id, name: tcData.name });
    }
  } catch {
    testCaseOptions.value = [];
  } finally {
    testCasesLoading.value = false;
  }
};

// 打开新建弹窗
const openCreateModal = () => {
  isEditMode.value = false;
  editingScriptId.value = null;
  Object.assign(scriptForm, getDefaultForm());
  loadInitialTestCases();
  editModalVisible.value = true;
};

// 打开编辑弹窗
const openEditModal = async (script: AutomationScript) => {
  const projectId = projectStore.currentProjectId;
  if (!projectId) {
    Message.warning('请先选择项目');
    return;
  }

  isEditMode.value = true;
  editingScriptId.value = script.id;
  
  // 加载完整脚本数据
  try {
    const response = await getAutomationScript(projectId, script.id);
    const data = response.data.data || response.data;
    
    Object.assign(scriptForm, {
      name: data.name || '',
      test_case: data.test_case,
      script_type: data.script_type || 'playwright_python',
      source: data.source || 'manual',
      status: data.status || 'draft',
      target_url: data.target_url || '',
      description: data.description || '',
      script_content: data.script_content || '',
      timeout_seconds: data.timeout_seconds || 60,
    });
    
    await loadInitialTestCases(data.test_case);
    editModalVisible.value = true;
  } catch (error: any) {
    Message.error(error.message || '加载脚本详情失败');
  }
};

// 关闭编辑弹窗
const closeEditModal = () => {
  // 关闭弹窗前清理 WebSocket 连接
  stopLivePreview();
  editModalVisible.value = false;
  formRef.value?.resetFields();
};

// 保存脚本
const handleSaveScript = async () => {
  const projectId = projectStore.currentProjectId;
  if (!projectId) {
    Message.warning('请先选择项目');
    return;
  }

  try {
    // validate() 校验失败时会 reject
    await formRef.value?.validate();
  } catch {
    // 校验失败，表单会自动显示错误提示
    return;
  }
  
  saving.value = true;
  try {
    const payload = buildScriptPayload();
    
    if (isEditMode.value && editingScriptId.value) {
      await updateAutomationScript(projectId, editingScriptId.value, payload);
      Message.success('脚本已更新');
    } else {
      await createAutomationScript(projectId, payload);
      Message.success('脚本已创建');
    }
    
    editModalVisible.value = false;
    fetchScripts();
  } catch (error: any) {
    Message.error(error.response?.data?.detail || error.message || '保存失败');
  } finally {
    saving.value = false;
  }
};

// 格式化时间
const formatTime = (time: string) => {
  if (!time) return '-';
  return new Date(time).toLocaleString('zh-CN');
};

// 标签映射
const getScriptTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    'playwright_python': 'Playwright Python',
    'playwright_javascript': 'Playwright JS',
  };
  return map[type] || type;
};

const getSourceLabel = (source: string) => {
  const map: Record<string, string> = {
    'ai_generated': 'AI 生成',
    'recorded': '录制',
    'manual': '手动',
  };
  return map[source] || source;
};

const getSourceColor = (source: string) => {
  const map: Record<string, string> = {
    'ai_generated': 'green',
    'recorded': 'blue',
    'manual': 'gray',
  };
  return map[source] || 'gray';
};

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    'active': '启用',
    'draft': '草稿',
    'deprecated': '已废弃',
  };
  return map[status] || status;
};

const getStatusBadge = (status: string) => {
  const map: Record<string, 'success' | 'warning' | 'danger'> = {
    'active': 'success',
    'draft': 'warning',
    'deprecated': 'danger',
  };
  return map[status] || 'default';
};

const getExecutionStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    'pending': '等待中',
    'running': '执行中',
    'pass': '通过',
    'fail': '失败',
    'error': '错误',
    'cancelled': '已取消',
  };
  return map[status] || status;
};

const getExecutionStatusColor = (status: string) => {
  const map: Record<string, string> = {
    'pending': 'gray',
    'running': 'blue',
    'pass': 'green',
    'fail': 'red',
    'error': 'orange',
    'cancelled': 'gray',
  };
  return map[status] || 'gray';
};

onMounted(() => {
  fetchScripts();
  window.addEventListener('resize', updateWindowWidth);
});

watch(() => projectStore.currentProjectId, () => {
  pagination.value.current = 1;
  fetchScripts();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth);
  if (previewWebSocket) {
    previewWebSocket.close();
    previewWebSocket = null;
  }
});
</script>

<style scoped>
.automation-script-management {
  padding: 16px;
  overflow-x: hidden;
}

.filter-card {
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-select {
  width: 120px;
  min-width: 100px;
}

.search-input {
  width: 180px;
  min-width: 120px;
}

@media (max-width: 768px) {
  .filter-select,
  .search-input {
    width: 100%;
    flex: 1;
  }
}

.table-card {
  margin-bottom: 16px;
  overflow: hidden;
}

.table-card :deep(.arco-table) {
  width: 100%;
}

.table-card :deep(.arco-table-container) {
  overflow-x: auto;
}

.table-card :deep(.arco-table-content-scroll) {
  overflow-x: auto !important;
}

.table-card :deep(.arco-table-td) {
  white-space: nowrap;
}

.text-gray {
  color: #86909c;
}

.code-container {
  background: #f5f5f5;
  border-radius: 4px;
  padding: 16px;
  max-height: 400px;
  overflow: auto;
}

.code-container pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.code-container code {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
}

/* 执行报告详情样式 */
.execution-detail {
  padding: 12px 16px;
  background: #fafafa;
}

.detail-section {
  margin-bottom: 12px;
}

.detail-section.error .detail-content {
  color: #f53f3f;
  background: #fff1f0;
  border-color: #ffd6d6;
}

.detail-label {
  font-weight: 500;
  margin-bottom: 4px;
  color: #1d2129;
}

.detail-content {
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  padding: 8px 12px;
  margin: 0;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow: auto;
}

.detail-content.stack-trace {
  color: #86909c;
  font-size: 11px;
}

.screenshots {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.screenshots :deep(.arco-image) {
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  cursor: pointer;
}

.screenshots :deep(.arco-image:hover) {
  border-color: rgb(var(--primary-6));
}

.videos {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.video-player {
  max-width: 400px;
  max-height: 300px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
}

.no-detail {
  color: #86909c;
  text-align: center;
  padding: 16px;
}

/* 左右布局的脚本编辑器 */
.script-editor-layout {
  display: flex;
  height: 70vh;
  max-height: 700px;
  min-height: 400px;
  overflow: hidden;
}

@media (max-width: 900px) {
  .script-editor-layout {
    flex-direction: column;
    height: auto;
    max-height: none;
  }
}

.editor-left-panel {
  width: 320px;
  min-width: 280px;
  padding: 16px;
  border-right: 1px solid #e5e6eb;
  overflow-y: auto;
  background: #fafafa;
  display: flex;
  flex-direction: column;
}

@media (max-width: 900px) {
  .editor-left-panel {
    width: 100%;
    min-width: 0;
    border-right: none;
    border-bottom: 1px solid #e5e6eb;
    max-height: 300px;
  }
}

.script-form {
  flex: 1;
}

.script-form :deep(.arco-form-item) {
  margin-bottom: 16px;
}

.form-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e6eb;
  display: flex;
  justify-content: flex-end;
}

/* 执行日志面板 - 占满整个左侧区域 */
.execution-logs-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.logs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 500;
  color: #1d2129;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.logs-header .logs-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.execution-logs-panel .logs-content {
  flex: 1;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 12px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
}

.execution-logs-panel .log-item {
  color: #cccccc;
  line-height: 1.6;
  word-break: break-all;
}

.execution-logs-panel .log-placeholder {
  color: #666;
  font-style: italic;
}

.editor-right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  min-width: 0;
}

@media (max-width: 900px) {
  .editor-right-panel {
    min-height: 350px;
  }
}

.editor-header {
  padding: 12px 16px;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.editor-title {
  color: #cccccc;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.editor-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.monaco-container {
  flex: 1;
  min-height: 0;
}

/* 执行预览样式 */
.preview-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  padding: 12px;
}

.preview-status {
  padding: 8px 12px;
  background: #252526;
  border-radius: 4px;
  margin-bottom: 12px;
}

.preview-frame {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  min-height: 400px;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #666;
}

/* 帧回放控制条 */
.frame-playback-bar {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: #252526;
  border-radius: 4px;
  margin-top: 12px;
  gap: 8px;
}

.frame-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1;
  flex-wrap: wrap;
  max-height: 60px;
  overflow-y: auto;
  padding: 4px;
}

.frame-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #555;
  cursor: pointer;
  transition: all 0.2s;
}

.frame-dot:hover {
  background: #888;
  transform: scale(1.2);
}

.frame-dot.active {
  background: #1890ff;
  box-shadow: 0 0 4px #1890ff;
}

.frame-info {
  font-size: 12px;
  color: #999;
  min-width: 60px;
  text-align: right;
}
</style>
