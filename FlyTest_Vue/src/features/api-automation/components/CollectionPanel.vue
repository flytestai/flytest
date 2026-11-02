<template>
  <div class="collection-panel-wrapper">
    <a-card class="collection-panel fc-directory fc-panel" :bordered="false">
      <div class="collection-panel-content">
        <div class="fc-directory-search-row">
          <a-input-search v-model="searchKeyword" placeholder="搜索目录或接口" allow-clear @search="onSearch" @input="onSearch" />
          <button class="fc-directory-add" type="button" aria-label="新增根目录" title="新增根目录" @click="handleAction('addRoot')">＋</button>
        </div>

        <div class="tree-container">
          <div v-if="loading" class="collection-loading-container">
            <a-spin />
          </div>
          <a-tree
            v-else-if="treeData.length > 0"
            :data="filteredTreeData"
            :field-names="{ key: 'key', title: 'name', children: 'children' }"
            show-line
            block-node
            v-model:selected-keys="selectedKeys"
            v-model:expanded-keys="expandedKeys"
            @select="onSelect"
          >
            <template #title="nodeData">
              <div class="fc-directory-node">
                <span class="fc-directory-node__label">{{ nodeData.name }}</span>
                <span v-if="nodeData.type === 'request'" class="fc-directory-node__method">{{ nodeData.method }}</span>
                <span v-else class="fc-directory-node__count">{{ nodeData.requestCount || 0 }}</span>
                <DirectoryNodeMenu v-if="nodeData.type === 'collection'" :label="nodeData.name"
                  :items="[{ value: 'addChild', label: '新增子目录' }, { value: 'edit', label: '编辑目录' }, { value: 'delete', label: '删除目录' }]"
                  @action="value => handleCollectionContextAction(nodeData, value)" />
              </div>
            </template>
          </a-tree>
          <a-empty v-else description="暂无接口目录" />
        </div>
      </div>
    </a-card>

    <a-modal class="fc-dialog"
      v-model:visible="modalVisible"
      :title="isEditing ? '编辑接口目录' : '新增接口目录'"
      :ok-loading="submitLoading"
      @before-ok="handleSubmit"
      @cancel="handleCancel"
    >
      <a-form class="fc-form" ref="formRef" :model="formData" layout="vertical">
        <a-form-item v-if="parentCollection" label="父目录">
          <a-input :model-value="parentCollection.name" disabled />
        </a-form-item>
        <a-form-item field="name" label="目录名称" :rules="[{ required: true, message: '请输入目录名称' }]">
          <a-input v-model="formData.name" placeholder="请输入目录名称" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import DirectoryNodeMenu from '@/components/workspace/DirectoryNodeMenu.vue'

import { computed, ref, watch } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { useProjectStore } from '@/store/projectStore'
import { apiRequestApi, collectionApi } from '../api'
import type { ApiAutomationSelection, ApiCollection, ApiCollectionForm, ApiRequest } from '../types'

interface CollectionTreeCollectionNode extends Omit<ApiCollection, 'children'> {
  type: 'collection'
  key: string
  requestCount: number
  children?: CollectionTreeNode[]
}

interface CollectionTreeRequestNode extends ApiRequest {
  type: 'request'
  key: string
  displayCollectionId: number
}

type CollectionTreeNode = CollectionTreeCollectionNode | CollectionTreeRequestNode

const props = defineProps<{ selectedCollectionId?: number }>()
const emit = defineEmits<{
  (e: 'select', selection: ApiAutomationSelection): void
  (e: 'updated'): void
  (e: 'navigate'): void
}>()

const projectStore = useProjectStore()
const projectId = computed(() => projectStore.currentProject?.id)

const loading = ref(false)
const searchKeyword = ref('')
const treeData = ref<CollectionTreeCollectionNode[]>([])
const selectedKeys = ref<string[]>([])
const expandedKeys = ref<string[]>([])
const currentTreeSelection = ref<CollectionTreeNode | null>(null)
const collectionMap = ref(new Map<number, ApiCollection>())

const modalVisible = ref(false)
const isEditing = ref(false)
const submitLoading = ref(false)
const formRef = ref()
const parentCollection = ref<ApiCollection | null>(null)
const currentCollection = ref<ApiCollection | null>(null)
const formData = ref<ApiCollectionForm>({
  project: 0,
  name: '',
  parent: null,
})

const actionCollectionId = computed(() =>
  currentTreeSelection.value?.type === 'collection' ? currentTreeSelection.value.id : null
)

const collectionCount = computed(() => collectionMap.value.size)
const requestCount = computed(() => treeData.value.reduce((total, node) => total + (node.requestCount || 0), 0))

const localeCompareZh = (left: string, right: string) => left.localeCompare(right, 'zh-CN')

const flattenCollectionMap = (nodes: ApiCollection[], map = new Map<number, ApiCollection>()) => {
  nodes.forEach(node => {
    map.set(node.id, node)
    if (node.children?.length) {
      flattenCollectionMap(node.children, map)
    }
  })
  return map
}

const buildTreeData = (collections: ApiCollection[], requests: ApiRequest[]) => {
  const requestMap = requests.reduce((acc, request) => {
    const list = acc.get(request.collection) || []
    list.push(request)
    acc.set(request.collection, list)
    return acc
  }, new Map<number, ApiRequest[]>())

  const sortByOrderAndName = <T extends { order?: number; name?: string }>(items: T[]) =>
    [...items].sort((left, right) => {
      if ((left.order || 0) !== (right.order || 0)) {
        return (left.order || 0) - (right.order || 0)
      }
      return localeCompareZh(left.name || '', right.name || '')
    })

  const createRequestNodes = (collectionId: number): CollectionTreeRequestNode[] =>
    sortByOrderAndName(requestMap.get(collectionId) || []).map(request => ({
      ...request,
      type: 'request' as const,
      key: `request-${request.id}`,
      displayCollectionId: collectionId,
    }))

  const createCollectionNodes = (nodes: ApiCollection[]): CollectionTreeCollectionNode[] =>
    sortByOrderAndName(nodes).map(node => {
      const collectionNodes = createCollectionNodes(node.children || [])
      const requestNodes = createRequestNodes(node.id)
      const children = [...collectionNodes, ...requestNodes]

      return {
        ...node,
        type: 'collection',
        key: `collection-${node.id}`,
        requestCount: requestNodes.length + collectionNodes.reduce((total, child) => total + child.requestCount, 0),
        children: children.length ? children : undefined,
      }
    })

  return createCollectionNodes(collections)
}

const cloneCollectionNode = (
  node: CollectionTreeCollectionNode,
  children: CollectionTreeNode[]
): CollectionTreeCollectionNode => ({
  ...node,
  children,
})

const filteredTreeData = computed<CollectionTreeCollectionNode[]>(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return treeData.value

  const filterTree = (nodes: CollectionTreeNode[]): CollectionTreeNode[] =>
    nodes.reduce((acc, node) => {
      const matched = (node.name || '').toLowerCase().includes(keyword)
      if (node.type === 'request') {
        if (matched) acc.push(node)
        return acc
      }

      const children = filterTree(node.children || [])
      if (matched || children.length > 0) {
        acc.push(cloneCollectionNode(node, children))
      }
      return acc
    }, [] as CollectionTreeNode[])

  return filterTree(treeData.value) as CollectionTreeCollectionNode[]
})

const findNodeByKey = (nodes: CollectionTreeNode[], key: string): CollectionTreeNode | null => {
  for (const node of nodes) {
    if (node.key === key) return node
    if (node.type === 'collection' && node.children?.length) {
      const found = findNodeByKey(node.children, key)
      if (found) return found
    }
  }
  return null
}

const emitSelection = (node: CollectionTreeNode | null) => {
  if (!node) {
    emit('select', {
      type: null,
      collection: null,
      request: null,
    })
    return
  }

  if (node.type === 'request') {
    emit('select', {
      type: 'request',
      collection: collectionMap.value.get(node.displayCollectionId) || null,
      request: node,
    })
    return
  }

  emit('select', {
    type: 'collection',
    collection: collectionMap.value.get(node.id) || null,
    request: null,
  })
}

watch(() => props.selectedCollectionId, id => {
  if (!id) { selectedKeys.value = []; currentTreeSelection.value = null }
  else if ((currentTreeSelection.value?.type === 'request' ? currentTreeSelection.value.displayCollectionId : currentTreeSelection.value?.id) !== id) { selectedKeys.value = ['collection-' + id]; currentTreeSelection.value = findNodeByKey(treeData.value, selectedKeys.value[0]) }
})
const syncSelectionState = () => {
  if (!selectedKeys.value.length && props.selectedCollectionId) selectedKeys.value = ['collection-' + props.selectedCollectionId]
  const currentSelectedKey = selectedKeys.value[0]
  const nextSelectedNode = currentSelectedKey ? findNodeByKey(treeData.value, currentSelectedKey) : null
  currentTreeSelection.value = nextSelectedNode

  const nextExpandedKeys = expandedKeys.value.filter(key => Boolean(findNodeByKey(treeData.value, key)))
  expandedKeys.value = nextExpandedKeys.length ? nextExpandedKeys : treeData.value.map(node => node.key)

  if (!nextSelectedNode) {
    selectedKeys.value = []
  }

  emitSelection(nextSelectedNode)
}

const fetchCollections = async () => {
  if (!projectId.value) {
    treeData.value = []
    collectionMap.value = new Map()
    currentTreeSelection.value = null
    selectedKeys.value = []
    expandedKeys.value = []
    emitSelection(null)
    return
  }

  loading.value = true
  try {
    const [collectionRes, requestRes] = await Promise.all([
      collectionApi.tree(projectId.value),
      apiRequestApi.list({ project: projectId.value }),
    ])
    const collections = Array.isArray(collectionRes.data?.data) ? collectionRes.data.data : []
    const requests = Array.isArray(requestRes.data?.data) ? requestRes.data.data : []

    collectionMap.value = flattenCollectionMap(collections)
    treeData.value = buildTreeData(collections, requests)
    syncSelectionState()
  } catch (error) {
    console.error('[CollectionPanel] 获取接口层级失败:', error)
    Message.error('获取接口层级失败')
    treeData.value = []
    collectionMap.value = new Map()
    currentTreeSelection.value = null
    selectedKeys.value = []
    expandedKeys.value = []
    emitSelection(null)
  } finally {
    loading.value = false
  }
}

const onSearch = () => {}

const onSelect = (keys: (string | number)[], data: { node?: CollectionTreeNode }) => {
  const selectedKey = keys.length > 0 ? String(keys[0]) : ''
  const node = selectedKey ? (data.node || findNodeByKey(treeData.value, selectedKey)) : null
  selectedKeys.value = selectedKey ? [selectedKey] : []
  currentTreeSelection.value = node || null
  emitSelection(node || null)
  emit('navigate')
}

const restoreSelection = (requestId?: number, collectionId?: number) => {
  const key = requestId ? `request-${requestId}` : collectionId ? `collection-${collectionId}` : ''
  selectedKeys.value = key ? [key] : []
  currentTreeSelection.value = key ? findNodeByKey(treeData.value, key) : null
}

const selectCollectionNode = (node: CollectionTreeCollectionNode) => {
  selectedKeys.value = [node.key]
  currentTreeSelection.value = node
  emitSelection(node)
}

const handleCollectionNodeContextMenu = (node: CollectionTreeNode) => {
  if (node.type === 'collection') {
    selectCollectionNode(node)
  }
}

const handleCollectionContextAction = (
  node: CollectionTreeNode,
  value: string | number | Record<string, any> | undefined
) => {
  handleCollectionNodeContextMenu(node)
  void handleAction(value)
}

const resetForm = () => {
  formData.value = {
    project: projectId.value || 0,
    name: '',
    parent: null,
  }
  formRef.value?.clearValidate?.()
}

const handleAction = async (value: string | number | Record<string, any> | undefined) => {
  const actionValue = String(value || '')

  switch (actionValue) {
    case 'addRoot':
      isEditing.value = false
      currentCollection.value = null
      parentCollection.value = null
      resetForm()
      modalVisible.value = true
      break
    case 'addChild':
      if (!actionCollectionId.value) {
        Message.warning('请先选择一个目录')
        return
      }
      isEditing.value = false
      currentCollection.value = null
      parentCollection.value = collectionMap.value.get(actionCollectionId.value) || null
      resetForm()
      formData.value.parent = actionCollectionId.value
      modalVisible.value = true
      break
    case 'edit': {
      if (!actionCollectionId.value) {
        Message.warning('请先选择一个目录')
        return
      }
      const target = collectionMap.value.get(actionCollectionId.value)
      if (!target) return
      isEditing.value = true
      currentCollection.value = target
      parentCollection.value = target.parent ? collectionMap.value.get(target.parent) || null : null
      formData.value = {
        project: target.project,
        name: target.name,
        parent: target.parent,
        order: target.order,
      }
      modalVisible.value = true
      break
    }
    case 'delete': {
      if (!actionCollectionId.value) {
        Message.warning('请先选择一个目录')
        return
      }
      const targetId = actionCollectionId.value
      const target = collectionMap.value.get(targetId)
      if (!target) return
      Modal.warning({
        title: '确认删除',
        content: `确定要删除接口目录“${target.name}”吗？其子目录和接口会一并删除。`,
        okText: '确认',
        cancelText: '取消',
        onOk: async () => {
          try {
            await collectionApi.delete(targetId)
            Message.success('目录删除成功')
            currentTreeSelection.value = null
            selectedKeys.value = []
            emitSelection(null)
            emit('updated')
            fetchCollections()
          } catch (error: any) {
            Message.error(error?.error || '删除接口目录失败')
          }
        },
      })
      break
    }
  }
}

const handleSubmit = async (done: (closed: boolean) => void) => {
  if (!projectId.value) {
    Message.warning('请先选择项目')
    done(false)
    return
  }

  if (!formData.value.name.trim()) {
    Message.warning('请输入目录名称')
    done(false)
    return
  }

  submitLoading.value = true
  try {
    if (isEditing.value && currentCollection.value) {
      await collectionApi.update(currentCollection.value.id, formData.value)
      Message.success('目录更新成功')
    } else {
      await collectionApi.create(formData.value)
      Message.success('目录创建成功')
    }
    done(true)
    emit('updated')
    fetchCollections()
  } catch (error: any) {
    Message.error(error?.error || (isEditing.value ? '目录更新失败' : '目录创建失败'))
    done(false)
  } finally {
    submitLoading.value = false
  }
}

const handleCancel = () => {
  modalVisible.value = false
}

watch(
  projectId,
  newId => {
    if (newId) {
      searchKeyword.value = ''
      fetchCollections()
      return
    }

    treeData.value = []
    collectionMap.value = new Map()
    currentTreeSelection.value = null
    selectedKeys.value = []
    expandedKeys.value = []
    emitSelection(null)
  },
  { immediate: true }
)

defineExpose({
  refresh: fetchCollections,
  restoreSelection,
})
</script>

<style scoped>
.collection-panel-wrapper {
  width: 100%;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.collection-panel {
  min-height: 0;
  height: 100%;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: var(--theme-surface);
  box-shadow: var(--theme-card-shadow);
  overflow: hidden;
}

.collection-panel :deep(.arco-card-body) {
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 22px;
}

.collection-panel-content {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  gap: 18px;
}

.collection-panel-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.collection-panel-head__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--theme-accent);
}

.collection-panel-head__title {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.08;
  color: var(--theme-text);
}

.collection-panel-head__desc {
  font-size: 13px;
  line-height: 1.8;
  color: var(--theme-text-secondary);
}

.collection-overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.collection-overview__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: var(--theme-surface);
}

.collection-overview__label {
  font-size: 12px;
  color: var(--theme-text-secondary);
}

.collection-overview__value {
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
  color: var(--theme-text);
}

.collection-panel-header {
  display: flex;
  gap: 12px;
  align-items: center;
}

.collection-search {
  flex: 1;
}

.collection-panel-header :deep(.arco-input-wrapper),
.collection-actions :deep(.arco-btn) {
  min-height: 42px;
}

.collection-actions {
  display: flex;
  align-items: center;
}

.collection-action-button {
  min-width: 96px;
  padding-inline: 18px;
  border-radius: 12px;
}

.tree-container {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.1);
  background: rgba(248, 250, 252, 0.58);
  padding: 12px 10px 4px;
  overscroll-behavior: contain;
}

.tree-container :deep(.arco-tree-node) {
  margin-bottom: 8px;
}

.tree-container :deep(.arco-tree-node-title) {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
}

.tree-container :deep(.arco-tree-node-title:hover) {
  background: rgba(var(--theme-accent-rgb), 0.08);
  box-shadow: inset 0 0 0 1px rgba(var(--theme-accent-rgb), 0.06);
}

.tree-container :deep(.arco-tree-node-selected .arco-tree-node-title) {
  background: rgba(var(--theme-accent-rgb), 0.12);
  box-shadow: inset 0 0 0 1px rgba(var(--theme-accent-rgb), 0.12);
}

.collection-node-dropdown {
  display: block;
  width: 100%;
}

.tree-node {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.tree-node__copy {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.tree-node__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-node__method,
.tree-node__count {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.4;
}

.tree-node__method {
  background: rgba(15, 118, 110, 0.1);
  color: var(--theme-success);
  font-weight: 700;
}

.tree-node__count {
  background: rgba(37, 99, 235, 0.08);
  color: var(--theme-accent);
}

.tree-node--request .tree-node__name {
  color: var(--theme-text);
}

.collection-loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

@media (max-width: 768px) {
  .collection-panel-wrapper {
    width: 100%;
    height: 320px;
    min-width: 0;
  }

  .collection-panel-head__title {
    font-size: 24px;
  }

  .collection-overview,
  .collection-panel-header {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
