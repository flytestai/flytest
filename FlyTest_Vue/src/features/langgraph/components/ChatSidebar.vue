<template>
  <div class="chat-sidebar">
    <div class="conversation-history-search"><a-input-search v-model="search" placeholder="搜索历史会话" :input-attrs="{ 'aria-label': '搜索历史会话' }" allow-clear /><a-button type="text" size="small" :aria-pressed="batchMode" @click="batchMode = !batchMode; selectedSessions = []">{{ batchMode ? '完成' : '管理' }}</a-button></div>
    <div v-if="sessions.length && batchMode" class="fc-session-selection-tools">
      <a-button size="small" @click="toggleSelectAll">{{ selectedSessions.length ? '取消全选' : '全选' }}</a-button>
      <a-button v-if="selectedSessions.length" type="text" status="danger" size="small" @click="handleBatchDelete">删除选中 ({{ selectedSessions.length }})</a-button>
    </div>

    <div class="chat-history-list">
      <div v-if="sessions.length === 0" class="empty-history">
        <icon-message /><strong>暂无历史会话</strong><span>发送第一条消息后，会话会保存在这里。</span>
      </div>
      <div v-else-if="!filteredSessions.length" class="empty-history">没有匹配的会话</div>
      <template v-for="group in sessionGroups" :key="group.label"><h3 v-if="group.sessions.length" class="conversation-history-group">{{ group.label }}</h3>
      <div
        v-for="session in group.sessions"
        :key="session.id"
        :class="['chat-history-item', session.id === currentSessionId ? 'active' : '']"
      >
        <a-checkbox 
          v-if="batchMode"
          v-model="selectedSessions"
          :value="session.id"
          class="history-item-checkbox"
          :aria-label="'选择会话：' + session.title"
          @click.stop
        />
        <button type="button" class="history-item-content" :aria-current="session.id === currentSessionId ? 'true' : undefined" @click="$emit('switch-session', session.id)">
          <icon-message class="conversation-history-icon" aria-hidden="true" />
          <div class="history-item-info">
            <div class="history-item-title">{{ session.title || '未命名对话' }}</div>
            <div class="history-item-time">{{ formatTime(session.lastTime) }}</div>
          </div>
        </button>
        <div v-if="selectedSessions.length === 0" class="history-item-actions">
          <a-dropdown trigger="click"><a-button type="text" size="mini" :aria-label="'会话操作：' + session.title"><template #icon><icon-more /></template></a-button><template #content><a-doption @click="$emit('delete-session', session.id)"><template #icon><icon-delete /></template>删除会话</a-doption></template></a-dropdown>
        </div>
      </div>
      </template>
    </div>
    <div class="conversation-history-footer"><a-button type="text" :disabled="!sessions.length" @click="$emit('batch-delete-sessions', sessions.map(session => session.id))"><template #icon><icon-delete /></template>清空历史</a-button></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Button as AButton, Checkbox as ACheckbox, Space as ASpace, Modal, Message } from '@arco-design/web-vue';
import { IconDelete, IconMessage, IconMore } from '@arco-design/web-vue/es/icon';

interface ChatSession {
  id: string;
  title: string;
  lastTime: Date;
  messageCount: number;
}

interface Props {
  sessions: ChatSession[];
  currentSessionId: string;
  isLoading: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'create-new-chat': [];
  'switch-session': [id: string];
  'delete-session': [id: string];
  'batch-delete-sessions': [sessionIds: string[]];
}>();

// 选中的会话列表
const selectedSessions = ref<string[]>([]);
const search = ref(''), batchMode = ref(false);
const filteredSessions = computed(() => props.sessions.filter(session => (session.title || '未命名对话').toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())));
const sessionGroups = computed(() => {
  const today = new Date(); today.setHours(0,0,0,0);
  const week = new Date(today); week.setDate(week.getDate() - 7);
  const groups = [{label:'今天', sessions:[] as ChatSession[]},{label:'最近 7 天',sessions:[] as ChatSession[]},{label:'更早',sessions:[] as ChatSession[]}];
  filteredSessions.value.forEach(session => groups[session.lastTime >= today ? 0 : session.lastTime >= week ? 1 : 2].sessions.push(session));
  return groups;
});
watch(() => props.sessions.map(session => session.id), ids => { selectedSessions.value = selectedSessions.value.filter(id => ids.includes(id)); });

// 计算是否全选
const isAllSelected = computed(() => {
  return filteredSessions.value.length > 0 && filteredSessions.value.every(session => selectedSessions.value.includes(session.id));
});

// 全选/取消全选
const toggleSelectAll = () => {
  if (isAllSelected.value || selectedSessions.value.length > 0) {
    // 取消全选
    selectedSessions.value = [];
  } else {
    // 全选
    selectedSessions.value = filteredSessions.value.map(session => session.id);
  }
};

// 批量删除处理
const handleBatchDelete = () => {
  if (selectedSessions.value.length === 0) {
    Message.warning('请先选择要删除的对话');
    return;
  }

  Modal.confirm({
    title: '确认批量删除',
    content: `确定要删除选中的 ${selectedSessions.value.length} 个对话吗？此操作不可恢复。`,
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: {
      status: 'danger',
    },
    onOk: () => {
      emit('batch-delete-sessions', [...selectedSessions.value]);
      selectedSessions.value = [];
    },
  });
};

// 格式化时间显示
const formatTime = (date: Date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime()) || date.getTime() === 0) {
    return '时间未知';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date >= today) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  } else if (date >= yesterday) {
    return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  } else {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
};
</script>

<style scoped>
.chat-sidebar {
  width: 280px;
  background-color: var(--theme-surface);
  border-right: 1px solid var(--theme-border);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--theme-border);
}

.header-row {
  display: flex;
  align-items: center;
  width: 100%;
}

.chat-history-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.empty-history {
  padding: 16px;
  color: var(--theme-text-tertiary);
  text-align: center;
}

.chat-history-item {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
}

.chat-history-item:hover {
  background-color: var(--theme-surface-soft);
}

.chat-history-item.active {
  background-color: var(--theme-accent-soft);
}

.history-item-checkbox {
  margin-right: 8px;
  flex-shrink: 0;
}

.history-item-content {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.history-item-icon {
  font-size: 16px;
  color: var(--theme-text-secondary);
  margin-right: 8px;
}

.history-item-info {
  flex: 1;
  min-width: 0;
}

.history-item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--theme-text);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-item-time {
  font-size: 12px;
  color: var(--theme-text-tertiary);
}

.history-item-actions {
  opacity: 0;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.chat-history-item:hover .history-item-actions {
  opacity: 1;
}
</style>
