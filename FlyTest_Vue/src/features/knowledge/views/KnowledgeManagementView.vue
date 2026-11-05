<template>
  <div class="knowledge-management-reference fc-page">
    <KnowledgeReferenceWorkspace v-if="!selectedKB" :revision="revision" @create="editingKB = null; formVisible = true" @config="configVisible = true" @open="selectedKB = $event" @edit="editingKB = $event; formVisible = true" @stats="statsKBId = $event.id; statsVisible = true" @delete="deleteKnowledgeBase" @upload="chooseUpload" />
    <KnowledgeBaseDetail v-else :key="selectedKB.id" :knowledge-base="selectedKB" @refresh="revision++" @close="selectedKB = null; revision++" />
    <KnowledgeBaseFormModal :visible="formVisible" :knowledge-base="editingKB" @submit="formVisible = false; revision++" @cancel="formVisible = false" />
    <KnowledgeBaseStatsModal :visible="statsVisible" :knowledge-base-id="statsKBId" @close="statsVisible = false" />
    <KnowledgeGlobalConfigModal :visible="configVisible" @close="configVisible = false" @saved="revision++" />
    <a-modal v-model:visible="targetVisible" title="选择上传目标知识库" :width="460" :footer="false">
      <a-alert>选择知识库后，可上传文件、粘贴文本或接入网页链接。</a-alert>
      <a-input-search v-model="targetSearch" placeholder="搜索目标知识库" style="margin: 16px 0" @search="targetPage = 1; loadTargets()" @press-enter="targetPage = 1; loadTargets()" @clear="targetPage = 1; loadTargets()" allow-clear />
      <a-alert v-if="targetError" type="error">{{ targetError }}</a-alert>
      <a-list :loading="targetLoading" :data="targets" size="small"><template #item="{ item }"><a-list-item><a-button type="text" @click="startUpload(item)">{{ item.name }}</a-button><template #extra>{{ item.project_name }}</template></a-list-item></template><template #empty>暂无可选知识库，请先创建</template></a-list>
      <a-pagination v-if="targetTotal > 10" :current="targetPage" :total="targetTotal" :page-size="10" size="small" @change="targetPage = $event; loadTargets()" />
      <a-button style="margin-top: 16px" @click="targetVisible = false; editingKB = null; formVisible = true">新建知识库</a-button>
    </a-modal>
    <DocumentUploadModal v-if="uploadTarget" :key="uploadTarget.id" :visible="uploadVisible" :knowledge-base-id="uploadTarget.id" @cancel="uploadVisible = false" @submit="uploadVisible = false; revision++; Message.success('文档已上传，可在知识库中查看处理状态')" />
  </div>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useProjectStore } from '@/store/projectStore';
import { KnowledgeService } from '../services/knowledgeService';
import type { KnowledgeBase } from '../types/knowledge';
import KnowledgeReferenceWorkspace from '../components/KnowledgeReferenceWorkspace.vue';
import KnowledgeBaseDetail from '../components/KnowledgeBaseDetail.vue';
import KnowledgeBaseFormModal from '../components/KnowledgeBaseFormModal.vue';
import KnowledgeBaseStatsModal from '../components/KnowledgeBaseStatsModal.vue';
import KnowledgeGlobalConfigModal from '../components/KnowledgeGlobalConfigModal.vue';
import DocumentUploadModal from '../components/DocumentUploadModal.vue';
const store = useProjectStore(); const revision = ref(0);
const selectedKB = ref<KnowledgeBase | null>(null); const editingKB = ref<KnowledgeBase | null>(null);
const formVisible = ref(false); const configVisible = ref(false); const statsVisible = ref(false); const statsKBId = ref('');
const targetVisible = ref(false); const targetSearch = ref(''); const targets = ref<KnowledgeBase[]>([]); const targetLoading = ref(false); const targetError = ref(''); const targetPage = ref(1); const targetTotal = ref(0);
const uploadTarget = ref<KnowledgeBase | null>(null); const uploadVisible = ref(false); let targetVersion = 0;
async function deleteKnowledgeBase(record: KnowledgeBase) { try { await KnowledgeService.deleteKnowledgeBase(record.id); Message.success('知识库已删除'); revision.value++; } catch (e) { Message.error(e instanceof Error ? e.message : '删除失败'); } }
function startUpload(record: KnowledgeBase) { targetVisible.value = false; uploadTarget.value = record; uploadVisible.value = true; }
function chooseUpload(record?: KnowledgeBase) { if (record) { startUpload(record); return; } targetSearch.value = ''; targetPage.value = 1; targetVisible.value = true; void loadTargets(); }
async function loadTargets() { const version = ++targetVersion; targetLoading.value = true; targetError.value = ''; targets.value = []; try { const data = await KnowledgeService.getKnowledgeBases({ project: store.currentProjectId || undefined, search: targetSearch.value, page: targetPage.value, page_size: 10 }); if (version !== targetVersion) return; targets.value = Array.isArray(data) ? data : data.results; targetTotal.value = Array.isArray(data) ? data.length : data.count; } catch { if (version === targetVersion) targetError.value = '目标知识库加载失败，请重试'; } finally { if (version === targetVersion) targetLoading.value = false; } }
watch(() => store.currentProjectId, () => { selectedKB.value = null; editingKB.value = null; formVisible.value = false; statsVisible.value = false; targetVisible.value = false; uploadVisible.value = false; uploadTarget.value = null; ++targetVersion; });
onBeforeUnmount(() => { ++targetVersion; });
</script>
<style scoped>
.knowledge-management-reference{min-width:0;height:auto;min-height:100%;background:transparent;border:0;padding:0;box-shadow:none}.knowledge-management-reference :deep(.knowledge-base-detail){height:auto;padding:20px;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-surface)}.knowledge-management-reference :deep(.arco-modal){max-width:calc(100vw - 24px)}
</style>
