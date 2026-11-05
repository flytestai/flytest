<template>
  <section class="knowledge-reference">
    <header class="knowledge-hero">
      <div class="knowledge-heading"><span class="knowledge-hero-icon"><icon-layers /></span><div><h1>知识库管理</h1><p>沉淀团队知识，让需求、文档与测试经验持续复用</p></div></div>
      <svg class="knowledge-hero-art" viewBox="0 0 280 130" aria-hidden="true"><path d="M0 130 100 62 210 0 280 130" fill="currentColor" opacity=".06"/><path d="m88 77 68-30 72 29-70 32z" fill="currentColor" opacity=".14"/><path d="m88 77 70 31v22L88 99zm70 31 70-32v23l-70 31" fill="currentColor" opacity=".22"/><g transform="translate(130 13) rotate(17 32 35)"><rect width="62" height="78" rx="12" fill="currentColor" opacity=".65"/><path d="M16 24h30M16 37h30M16 50h18" stroke="white" stroke-width="5" stroke-linecap="round"/></g></svg>
      <a-space wrap><a-button @click="$emit('config')"><template #icon><icon-settings /></template>知识库配置</a-button><a-button type="primary" @click="$emit('create')"><template #icon><icon-plus /></template>新建知识库</a-button></a-space>
    </header>
    <div class="knowledge-metrics">
      <article v-for="metric in metrics" :key="metric.label" class="knowledge-metric" :class="metric.tone"><span class="knowledge-metric-icon"><component :is="metric.icon" /></span><div><span>{{ metric.label }}</span><strong>{{ number(metric.value) }}</strong><small>{{ metric.hint }}</small></div></article>
    </div>
    <a-alert v-if="summaryError" type="warning" class="knowledge-notice">{{ summaryError }} <a-button type="text" size="mini" @click="loadSummary">重新获取统计</a-button></a-alert>
    <div class="knowledge-columns">
      <main class="knowledge-list-panel">
        <div class="knowledge-list-top"><div class="knowledge-segments" role="group" aria-label="知识库状态"><button v-for="tab in tabs" :key="tab.key" :class="{ active: stateFilter === tab.key }" :disabled="tab.key === 'processing' && !summary" @click="setState(tab.key)">{{ tab.label }} <span>({{ number(tab.count) }})</span></button></div><div class="knowledge-view-toggle"><a-button :type="view === 'list' ? 'outline' : 'text'" aria-label="列表视图" :aria-pressed="view === 'list'" @click="view = 'list'"><icon-unordered-list /></a-button><a-button :type="view === 'grid' ? 'outline' : 'text'" aria-label="卡片视图" :aria-pressed="view === 'grid'" @click="view = 'grid'"><icon-apps /></a-button></div></div>
        <div class="knowledge-filters">
          <a-input-search v-model="search" allow-clear placeholder="搜索知识库名称 / 描述 / 项目" :input-attrs="{ 'aria-label': '搜索知识库' }" @search="filterChanged" @press-enter="filterChanged" @clear="filterChanged" />
          <a-select v-model="projectSelection" :disabled="!!projectStore.currentProjectId" aria-label="所属项目" @change="scopeChanged"><a-option value="">全部项目</a-option><a-option v-for="item in projectStore.projectOptions" :key="item.value" :value="String(item.value)">{{ item.label }}</a-option></a-select>
          <a-select v-model="stateFilter" aria-label="筛选知识库状态" @change="filterChanged"><a-option value="">全部状态</a-option><a-option value="active">启用中</a-option><a-option value="processing" :disabled="!summary">处理中</a-option><a-option value="disabled">已停用</a-option></a-select>
          <a-select v-model="accessFilter" aria-label="筛选接入类型" :disabled="!summary" @change="filterChanged"><a-option value="">全部接入类型</a-option><a-option value="file">本地文件</a-option><a-option value="url">网页链接</a-option><a-option value="text">文本内容</a-option></a-select>
          <a-button aria-label="刷新知识库" :loading="loading" @click="refresh"><icon-refresh /></a-button>
        </div>
        <a-alert v-if="listError" type="error">{{ listError }} <a-button type="text" @click="loadList">重试</a-button></a-alert>
        <a-table v-if="view === 'list'" class="knowledge-table" row-key="id" :data="rows" :loading="loading" :pagination="false" :scroll="{ x: 930 }" :bordered="false">
          <template #columns>
            <a-table-column title="知识库名称" :width="190"><template #cell="{ record }"><div class="knowledge-name-cell"><span class="knowledge-file-icon"><icon-book /></span><div><button class="knowledge-name" @click="$emit('open', record)">{{ record.name }}</button><small>分块 {{ record.chunk_size }} · 重叠 {{ record.chunk_overlap }}</small></div></div></template></a-table-column>
            <a-table-column title="描述" :width="140"><template #cell="{ record }"><span class="knowledge-description" :title="record.description">{{ record.description || '暂无描述' }}</span></template></a-table-column>
            <a-table-column title="所属项目" :width="120"><template #cell="{ record }"><span class="knowledge-project"><icon-folder />{{ projectName(record) }}</span></template></a-table-column>
            <a-table-column title="文档 / 分块" :width="105"><template #cell="{ record }"><div class="knowledge-volume"><span><icon-file /> {{ number(record.document_count) }} 文档</span><span><icon-layers /> {{ number(record.chunk_count) }} 分块</span></div></template></a-table-column>
            <a-table-column title="状态" :width="85"><template #cell="{ record }"><a-tag :color="status(record).color">{{ status(record).label }}</a-tag></template></a-table-column>
            <a-table-column title="最近更新" :width="115" sortable :sorter="(a: KnowledgeBase, b: KnowledgeBase) => Date.parse(a.updated_at) - Date.parse(b.updated_at)"><template #cell="{ record }"><span :title="record.updated_at">{{ date(record.updated_at) }}</span></template></a-table-column>
            <a-table-column title="创建人" :width="100"><template #cell="{ record }"><span class="knowledge-owner"><i>{{ (record.creator_name || '?').slice(0, 2).toUpperCase() }}</i>{{ record.creator_name || '未知' }}</span></template></a-table-column>
            <a-table-column title="操作" :width="75" fixed="right"><template #cell="{ record }"><a-button type="text" :aria-label="'编辑 ' + record.name" @click="$emit('edit', record)"><icon-edit /></a-button><a-dropdown @select="(value: string) => action(value, record)"><a-button type="text" :aria-label="'更多 ' + record.name"><icon-more /></a-button><template #content><a-doption value="open">管理文档</a-doption><a-doption value="upload">上传文档</a-doption><a-doption value="stats">查看统计</a-doption><a-doption value="delete">删除知识库</a-doption></template></a-dropdown></template></a-table-column>
          </template>
          <template #empty><div class="knowledge-empty"><icon-book /><strong>{{ listError ? '知识库加载失败' : search || stateFilter || accessFilter ? '没有匹配的知识库' : '建立团队的第一座知识库' }}</strong><p>汇集项目文档与测试经验，让知识随时可用</p><a-button v-if="!listError" @click="search || stateFilter || accessFilter ? resetFilters() : $emit('create')">{{ search || stateFilter || accessFilter ? '重置筛选' : '新建知识库' }}</a-button></div></template>
        </a-table>
        <a-spin v-else :loading="loading" class="knowledge-grid-wrap"><div class="knowledge-grid"><article v-for="row in rows" :key="row.id" class="knowledge-grid-card"><div><span class="knowledge-file-icon"><icon-book /></span><a-tag :color="status(row).color">{{ status(row).label }}</a-tag></div><button class="knowledge-name" @click="$emit('open', row)">{{ row.name }}</button><p>{{ row.description || '暂无描述' }}</p><small>{{ projectName(row) }}</small><footer><span>{{ number(row.document_count) }} 文档 · {{ number(row.chunk_count) }} 分块</span><a-button type="text" :aria-label="'编辑 ' + row.name" @click="$emit('edit', row)"><icon-edit /></a-button></footer></article></div><div v-if="!rows.length" class="knowledge-empty">{{ listError ? '知识库加载失败，请重试' : '没有匹配的知识库' }}</div></a-spin>
        <footer class="knowledge-pagination"><span>共 {{ total.toLocaleString() }} 条记录</span><a-pagination :current="page" :page-size="pageSize" :total="total" size="small" show-page-size :page-size-options="[10, 20, 50]" @change="pageChanged" @page-size-change="sizeChanged" /></footer>
      </main>
      <aside class="knowledge-insights">
        <section class="knowledge-insight-card"><h2>知识接入概览 <a-tooltip content="按文档实际上传方式统计；同一知识库可以包含多种接入类型。"><icon-info-circle /></a-tooltip></h2><div class="knowledge-source-layout"><div class="knowledge-donut" :style="{ background: sourceGradient }"><div><strong>{{ number(summary?.documents) }}</strong><span>文档总量</span></div></div><div class="knowledge-source-legend"><div v-for="source in sources" :key="source.key"><i :style="{ background: source.color }" /><span>{{ source.label }}</span><b>{{ summary ? source.percent + '%' : '—' }}</b><small>{{ number(summary ? source.count : null) }}</small></div></div></div><p v-if="summary && !summary.documents" class="knowledge-muted">上传文档后查看接入分布</p></section>
        <section class="knowledge-insight-card"><h2>热门检索主题 <span>近 30 天</span></h2><div v-if="summary?.hot_queries.length" class="knowledge-topics"><div v-for="topic in summary.hot_queries" :key="topic.query"><span :title="topic.query">{{ topic.query }}</span><div><i :style="{ width: topic.count / summary.hot_queries[0]!.count * 100 + '%' }" /></div><small>{{ topic.count.toLocaleString() }}</small></div></div><div v-else class="knowledge-sidebar-empty"><icon-search /><span>{{ summary ? '暂无检索记录' : '检索统计暂不可用' }}</span><small>根据知识库真实查询日志统计</small></div></section>
        <section class="knowledge-insight-card"><h2>快速接入知识</h2><div class="knowledge-quick"><button @click="$emit('upload')"><icon-upload /><strong>上传文档</strong><small>文件 / 文本 / 链接</small></button><button @click="showRepositoryHelp = true"><icon-branch /><strong>代码仓库</strong><small>导入代码文档</small></button><button @click="openRequirements"><icon-link /><strong>需求文档</strong><small>查看项目需求</small></button></div></section>
      </aside>
    </div>
    <a-modal v-model:visible="showRepositoryHelp" title="接入代码仓库知识" :width="480" :footer="false"><a-alert>当前支持文件、文本和网页链接导入，暂不支持 Git / SVN 自动同步。</a-alert><p>可将仓库中的 README、Markdown 或接口说明上传到知识库，后续在文档详情中维护与重新处理。</p><a-button type="primary" @click="showRepositoryHelp = false; $emit('upload')">选择知识库并上传</a-button></a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { Modal } from '@arco-design/web-vue';
import { IconLayers, IconSettings, IconPlus, IconBook, IconFile, IconSearch, IconFolder, IconRefresh, IconEdit, IconMore, IconUnorderedList, IconApps, IconInfoCircle, IconUpload, IconBranch, IconLink } from '@arco-design/web-vue/es/icon';
import { useProjectStore } from '@/store/projectStore';
import { KnowledgeService } from '../services/knowledgeService';
import type { KnowledgeBase, KnowledgeWorkspaceSummary } from '../types/knowledge';
import './knowledge-reference.css';
const props = defineProps<{ revision: number }>();
const emit = defineEmits<{ create: []; config: []; open: [record: KnowledgeBase]; edit: [record: KnowledgeBase]; stats: [record: KnowledgeBase]; delete: [record: KnowledgeBase]; upload: [record?: KnowledgeBase] }>();
const projectStore = useProjectStore(); const router = useRouter();
const rows = ref<KnowledgeBase[]>([]); const total = ref(0); const loading = ref(false); const listError = ref('');
const summary = ref<KnowledgeWorkspaceSummary | null>(null); const summaryError = ref('');
const search = ref(''); const stateFilter = ref(''); const accessFilter = ref(''); const projectFilter = ref('');
const page = ref(1); const pageSize = ref(10); const view = ref('list'); const showRepositoryHelp = ref(false);
const projectSelection = computed({ get: () => String(projectStore.currentProjectId || projectFilter.value || ''), set: (value: string) => { projectFilter.value = value; } });
const scope = computed(() => projectStore.currentProjectId || projectFilter.value || undefined);
let listVersion = 0; let summaryVersion = 0;
const number = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('zh-CN');
const date = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
const projectName = (row: KnowledgeBase) => row.project_name || projectStore.projectOptions.find(p => String(p.value) === String(row.project))?.label || '未知项目';
const status = (row: KnowledgeBase) => !row.is_active ? { label: '已停用', color: 'gray' } : row.processing_documents ? { label: '处理中', color: 'blue' } : { label: '启用中', color: 'green' };
const metrics = computed(() => [
  { label: '知识库总数', value: summary.value?.knowledge_bases, icon: IconBook, tone: 'teal', hint: '沉淀团队知识资产' },
  { label: '文档总量', value: summary.value?.documents, icon: IconFile, tone: 'blue', hint: '覆盖文件、文本与网页' },
  { label: '已索引向量片段', value: summary.value?.indexed_chunks, icon: IconLayers, tone: 'purple', hint: '已写入向量索引的分块' },
  { label: '本月检索次数', value: summary.value?.monthly_queries, icon: IconSearch, tone: 'teal', hint: '本月累计真实查询' },
]);
const tabs = computed(() => [{ key: '', label: '全部', count: summary.value?.knowledge_bases }, { key: 'active', label: '启用中', count: summary.value?.states.active }, { key: 'processing', label: '处理中', count: summary.value?.states.processing }, { key: 'disabled', label: '停用', count: summary.value?.states.disabled }]);
const sources = computed(() => [{ key: 'file', label: '本地文件', color: '#00ad99' }, { key: 'url', label: '网页链接', color: '#268bfa' }, { key: 'text', label: '文本内容', color: '#9a6bf0' }].map(s => { const count = summary.value?.sources[s.key as 'file' | 'url' | 'text'] || 0; return { ...s, count, percent: summary.value?.documents ? Math.round(count / summary.value.documents * 100) : 0 }; }));
const sourceGradient = computed(() => { const sum = sources.value.reduce((n, s) => n + s.count, 0); if (!sum) return 'var(--theme-surface-soft, #eef2f6)'; let start = 0; return 'conic-gradient(' + sources.value.map(s => { const previous = start; start += s.count / sum * 100; return s.color + ' ' + previous + '% ' + start + '%'; }).join(',') + ')'; });
async function loadList() {
  const version = ++listVersion; loading.value = true; listError.value = ''; rows.value = [];
  try {
    const response = await KnowledgeService.getKnowledgeBases({ project: scope.value, page: page.value, page_size: pageSize.value, search: search.value.trim() || undefined, ordering: '-updated_at', ...(summary.value ? { workspace_state: stateFilter.value, access_type: accessFilter.value } : stateFilter.value ? { is_active: stateFilter.value === 'active' } : {}) });
    if (version !== listVersion) return;
    rows.value = Array.isArray(response) ? response : response.results; total.value = Array.isArray(response) ? response.length : response.count;
    if (page.value > 1 && !rows.value.length) { page.value = 1; void loadList(); }
  } catch { if (version === listVersion) { listError.value = '知识库加载失败，请刷新重试。'; total.value = 0; } }
  finally { if (version === listVersion) loading.value = false; }
}
async function loadSummary() {
  const version = ++summaryVersion; summaryError.value = '';
  try { const response = await KnowledgeService.getWorkspaceSummary(scope.value); if (version === summaryVersion) summary.value = response; }
  catch (error: unknown) { if (version === summaryVersion) { summary.value = null; summaryError.value = (error as { status?: number }).status === 404 ? '汇总统计接口尚未启用，当前仅展示知识库列表。' : '汇总统计暂不可用，列表操作仍可使用。'; if (stateFilter.value === 'processing') stateFilter.value = ''; accessFilter.value = ''; } }
}
function filterChanged() { page.value = 1; void loadList(); }
function scopeChanged() { page.value = 1; rows.value = []; summary.value = null; void refresh(); }
function setState(value: string) { stateFilter.value = value; filterChanged(); }
function resetFilters() { search.value = ''; stateFilter.value = ''; accessFilter.value = ''; filterChanged(); }
function pageChanged(value: number) { page.value = value; void loadList(); }
function sizeChanged(value: number) { pageSize.value = value; page.value = 1; void loadList(); }
async function refresh() { await loadSummary(); await loadList(); }
function action(value: string, row: KnowledgeBase) {
  if (value === 'open') emit('open', row); else if (value === 'stats') emit('stats', row); else if (value === 'upload') emit('upload', row);
  else if (value === 'delete') Modal.warning({ title: '删除知识库', content: '删除“' + row.name + '”及其文档与分块？此操作无法撤销。', hideCancel: false, onOk: () => emit('delete', row) });
}
function openRequirements() { void router.push('/requirements'); }
watch(() => [projectStore.currentProjectId, props.revision], () => { ++listVersion; ++summaryVersion; rows.value = []; total.value = 0; summary.value = null; projectFilter.value = ''; page.value = 1; search.value = ''; stateFilter.value = ''; accessFilter.value = ''; void refresh(); }, { immediate: true });
onBeforeUnmount(() => { ++listVersion; ++summaryVersion; });
</script>
