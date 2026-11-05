<template>
  <div class="device-workspace">
    <a-alert v-if="loadError" type="warning" title="设备数据加载失败">{{devices.length ? '当前保留上次成功加载的数据，请刷新后重试。' : '暂时无法读取设备列表，请检查设备服务并刷新重试。'}}</a-alert>
    <section class="device-summary" aria-label="设备状态概览">
      <article v-for="metric in metrics" :key="metric.key" class="device-metric" :class="`device-tone-${metric.key}`">
        <span class="device-metric-icon"><component :is="metric.icon" /></span>
        <div><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong></div>
      </article>
      <div class="device-rate" :aria-label="`在线率 ${onlineRate === null ? '暂无数据' : onlineRate + '%'}`">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="device-rate-track" cx="60" cy="60" r="49"/><circle class="device-rate-value" cx="60" cy="60" r="49" :stroke-dasharray="`${(onlineRate || 0) * 3.0788} 307.88`"/></svg>
        <div><strong>{{ onlineRate === null ? '—' : onlineRate.toFixed(1) + '%' }}</strong><span>在线率</span></div>
      </div>
    </section>

    <section class="device-inventory" aria-label="设备列表">
      <div class="device-toolbar">
        <div class="device-filters">
          <a-select v-model="platform" aria-label="设备平台" class="device-platform"><a-option value="">全部设备</a-option><a-option value="Android">Android</a-option><a-option value="iOS">iOS</a-option><a-option value="未知平台">未知平台</a-option></a-select>
          <a-input v-model="search" allow-clear :input-attrs="{ 'aria-label': '搜索设备' }" placeholder="搜索设备名称、序列号或型号" class="device-search"><template #prefix><icon-search /></template></a-input>
          <a-select v-model="kind" aria-label="设备类型" placeholder="设备类型" allow-clear><a-option value="真机">真机</a-option><a-option value="模拟器">模拟器</a-option><a-option value="未识别">未识别</a-option></a-select>
          <a-select v-model="version" aria-label="系统版本" placeholder="系统版本" allow-clear><a-option v-for="item in versions" :key="item" :value="item">{{ item }}</a-option></a-select>
          <a-select v-model="status" aria-label="设备状态" placeholder="状态" allow-clear><a-option v-for="(label, key) in deviceStateLabels" :key="key" :value="key">{{ label }}</a-option></a-select>
        </div>
        <div class="device-toolbar-actions">
          <a-dropdown @select="batchAction"><a-button :disabled="!selected.length || batchBusy" :loading="batchBusy"><icon-command /> 批量操作 <icon-down /></a-button><template #content><a-doption value="lock">锁定可用设备</a-doption><a-doption value="unlock">释放可释放设备</a-doption></template></a-dropdown>
          <a-button :loading="loading" aria-label="刷新设备列表" @click="emit('refresh')"><icon-refresh /> 刷新</a-button>
          <a-dropdown @select="addAction"><a-button type="primary"><icon-plus /> 添加设备</a-button><template #content><a-doption value="connect">连接网络 Android 设备</a-doption><a-doption value="discover">发现本机 ADB 设备</a-doption></template></a-dropdown>
        </div>
      </div>
      <div v-if="selected.length || hasFilters" class="device-selection">
        <span>{{ selected.length ? `已选择 ${selected.length} 台设备` : `筛选结果 ${filtered.length} 台` }}</span>
        <a-button v-if="selected.length" type="text" size="mini" @click="selected = []">取消选择</a-button>
        <a-button v-if="hasFilters" type="text" size="mini" @click="resetFilters">重置筛选</a-button>
      </div>
      <a-table v-model:selected-keys="selected" class="device-reference-table" :data="filtered" :loading="loading" row-key="id" :row-selection="{ type: 'checkbox', showCheckedAll: true, onlyCurrent: true }" :pagination="pagination" :scroll="{ x: 1180 }" :row-class="rowClass" @page-change="page = $event" @page-size-change="pageSize = $event; page = 1">
        <template #columns>
          <a-table-column title="设备名称" :width="180"><template #cell="{ record }"><button class="device-name" @click="emit('detail', record)"><span class="device-phone" :class="{ ios: devicePlatform(record) === 'iOS' }"><icon-mobile /></span><strong>{{ record.name || record.device_id }}</strong></button></template></a-table-column>
          <a-table-column title="设备类型" :width="85"><template #cell="{ record }"><span class="device-kind" :class="{ simulator: deviceKind(record) === '模拟器' }">{{ deviceKind(record) }}</span></template></a-table-column>
          <a-table-column title="平台版本" :width="130"><template #cell="{ record }"><span class="device-platform-value" :class="{ ios: devicePlatform(record) === 'iOS' }"><icon-mobile />{{ devicePlatform(record) }} {{ deviceVersion(record) }}</span></template></a-table-column>
          <a-table-column title="型号" :width="135"><template #cell="{ record }"><span :title="deviceModel(record)">{{ deviceModel(record) }}</span></template></a-table-column>
          <a-table-column title="序列号" data-index="device_id" :width="150" ellipsis tooltip />
          <a-table-column title="状态" :width="95"><template #cell="{ record }"><span class="device-state" :class="`device-state-${deviceState(record)}`" :title="record.status === 'stopping' ? '正在停止，设备暂被占用' : record.status"><i />{{ deviceStateLabels[deviceState(record)] }}</span></template></a-table-column>
          <a-table-column title="使用情况" :width="145"><template #cell="{ record }"><div class="device-usage" :aria-label="deviceUsage(record) === null ? '使用率未上报' : `使用率 ${deviceUsage(record)}%`"><span><i :style="{ width: (deviceUsage(record) || 0) + '%' }"/></span><small>{{ deviceUsage(record) === null ? '未上报' : deviceUsage(record) + '%' }}</small></div></template></a-table-column>
          <a-table-column title="最后在线" :width="155"><template #cell="{ record }"><time>{{ formatDate(record.last_seen_at) }}</time></template></a-table-column>
          <a-table-column title="操作" :width="124" fixed="right"><template #cell="{ record }"><div class="device-row-actions">
            <a-tooltip :content="startReason(record)"><a-button type="text" :disabled="!canStart(record)" :aria-label="`启动测试 ${record.name}`" @click="start(record)"><icon-play-arrow /></a-button></a-tooltip>
            <a-button type="text" :aria-label="`编辑设备 ${record.name}`" @click="emit('edit', record)"><icon-edit /></a-button>
            <a-dropdown @select="value => rowAction(value, record)"><a-button type="text" :aria-label="`更多操作 ${record.name}`"><icon-more /></a-button><template #content>
              <a-doption value="detail">查看详情</a-doption><a-doption value="screenshot" :disabled="devicePlatform(record) !== 'Android' || deviceState(record) !== 'online' || screenshotLoadingId === record.id">查看截图</a-doption>
              <a-doption v-if="canLock(record)" value="lock">锁定设备</a-doption><a-doption v-if="canUnlock(record)" value="unlock">释放设备</a-doption>
              <a-doption v-if="canReconnect(record) && devicePlatform(record) === 'Android'" value="reconnect">重新连接</a-doption><a-doption v-if="canDisconnect(record) && devicePlatform(record) === 'Android'" value="disconnect">断开连接</a-doption>
              <a-doption value="remove" :disabled="record.can_delete === false"><span class="device-delete">删除设备记录</span></a-doption>
            </template></a-dropdown>
          </div></template></a-table-column>
        </template>
        <template #empty><div class="device-empty"><icon-mobile /><strong>{{ loadError ? '暂时无法读取设备' : hasFilters ? '没有匹配的设备' : '暂无测试设备' }}</strong><p>{{ loadError ? '请检查设备服务后重新加载' : hasFilters ? '调整平台、类型、版本或状态筛选后重试' : '连接网络 Android 设备或发现本机 ADB 设备，开始管理测试环境' }}</p><a-button v-if="loadError" @click="emit('refresh')">重试</a-button><a-button v-else-if="hasFilters" @click="resetFilters">重置筛选</a-button><a-button v-else type="primary" @click="emit('connect')">添加设备</a-button></div></template>
      </a-table>
      <footer class="device-inventory-footer"><span>设备池共 {{ devices.length }} 台 · 最后刷新 {{ lastUpdatedText }}</span><label>每 30 秒自动刷新 <a-switch size="small" :model-value="autoRefreshEnabled" @change="emit('auto-refresh', $event)" /></label></footer>
      <p v-if="batchReport" class="device-batch-report" role="status">{{ batchReport }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { IconMobile, IconCheckCircle, IconClockCircle, IconMinusCircle, IconExclamationCircle, IconSearch, IconRefresh, IconPlus, IconDown, IconPlayArrow, IconEdit, IconMore, IconCommand } from '@arco-design/web-vue/es/icon'
import { useAuthStore } from '@/store/authStore'
import type { AppDevice } from '../../types'
import { AppAutomationService } from '../../services/appAutomationService'
import { deviceState, deviceStateLabels, devicePlatform, deviceVersion, deviceKind, deviceModel, deviceUsage } from './devicePresentation'
import './devices-reference.css'

const props = defineProps<{
  devices: AppDevice[]; loading: boolean; loadError: string; autoRefreshEnabled: boolean; lastUpdatedText: string; screenshotLoadingId: number | null
  canLock: (device: AppDevice) => boolean; canUnlock: (device: AppDevice) => boolean
  canReconnect: (device: AppDevice) => boolean; canDisconnect: (device: AppDevice) => boolean
}>()
const emit = defineEmits<{
  refresh: []; connect: []; discover: []; detail: [device: AppDevice]; edit: [device: AppDevice]
  screenshot: [id: number]; lock: [id: number]; unlock: [id: number]; reconnect: [device: AppDevice]
  disconnect: [id: number]; remove: [id: number]; 'auto-refresh': [value: string | number | boolean]
}>()
const router = useRouter(), authStore = useAuthStore()
const search = ref(''), platform = ref(''), kind = ref(''), version = ref(''), status = ref('')
const selected = ref<(string | number)[]>([]), page = ref(1), pageSize = ref(10), batchBusy = ref(false), batchReport = ref('')
const totals = computed(() => props.devices.reduce((result, item) => { result[deviceState(item)]++; return result }, { online: 0, busy: 0, offline: 0, unavailable: 0 }))
const metrics = computed(() => [
  { key: 'total', label: '设备总数', value: props.devices.length, icon: IconMobile },
  { key: 'online', label: '在线设备', value: totals.value.online, icon: IconCheckCircle },
  { key: 'busy', label: '忙碌中', value: totals.value.busy, icon: IconClockCircle },
  { key: 'offline', label: '离线设备', value: totals.value.offline, icon: IconMinusCircle },
  { key: 'unavailable', label: '不可用', value: totals.value.unavailable, icon: IconExclamationCircle },
])
const onlineRate = computed(() => props.devices.length ? totals.value.online / props.devices.length * 100 : null)
const versions = computed(() => [...new Set(props.devices.map(item => deviceVersion(item) ? `${devicePlatform(item)} ${deviceVersion(item)}` : '').filter(Boolean))].sort())
const hasFilters = computed(() => Boolean(search.value || platform.value || kind.value || version.value || status.value))
const filtered = computed(() => props.devices.filter(item => {
  const needle = search.value.trim().toLowerCase()
  return (!needle || [item.name, item.device_id, deviceModel(item)].some(value => String(value || '').toLowerCase().includes(needle)))
    && (!platform.value || devicePlatform(item) === platform.value) && (!kind.value || deviceKind(item) === kind.value)
    && (!version.value || `${devicePlatform(item)} ${deviceVersion(item)}` === version.value) && (!status.value || deviceState(item) === status.value)
}))
const pagination = computed(() => ({ current: page.value, pageSize: pageSize.value, total: filtered.value.length, showTotal: true, showPageSize: true, pageSizeOptions: [10, 20, 50] }))
watch([search, platform, kind, version, status], () => { page.value = 1; selected.value = []; batchReport.value = '' })
watch(() => props.devices, () => { selected.value = selected.value.filter(id => props.devices.some(item => item.id === id)); page.value = Math.min(page.value, Math.max(1, Math.ceil(filtered.value.length / pageSize.value))) })
function resetFilters() { search.value = ''; platform.value = ''; kind.value = ''; version.value = ''; status.value = '' }
function rowClass(record: AppDevice) { return selected.value.includes(record.id) ? 'device-row-selected' : '' }
function formatDate(value?: string | null) { if (!value) return '未上报'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '未上报' : date.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
function canStart(record: AppDevice) { return devicePlatform(record) === 'Android' && deviceState(record) === 'online' }
function startReason(record: AppDevice) { return devicePlatform(record) !== 'Android' ? '当前执行服务支持 Android；该平台执行器尚未接入' : canStart(record) ? '选择测试用例，使用此设备执行' : '设备需在线且空闲后才能启动测试' }
function start(record: AppDevice) { if (canStart(record)) { void router.push({ path: '/app-automation', query: { tab: 'test-cases', deviceId: String(record.id) } }); Message.info(`已选择 ${record.name || record.device_id}，请选择要执行的用例`) } }
function addAction(value: string | number | Record<string, unknown> | undefined) { if (value === 'connect') emit('connect'); if (value === 'discover') emit('discover') }
function rowAction(value: string | number | Record<string, unknown> | undefined, record: AppDevice) {
  if (value === 'detail') emit('detail', record)
  if (value === 'screenshot') emit('screenshot', record.id)
  if (value === 'lock') emit('lock', record.id)
  if (value === 'unlock') emit('unlock', record.id)
  if (value === 'reconnect') emit('reconnect', record)
  if (value === 'disconnect') emit('disconnect', record.id)
  if (value === 'remove') emit('remove', record.id)
}
async function batchAction(action: string | number | Record<string, unknown> | undefined) {
  if (batchBusy.value || !['lock', 'unlock'].includes(String(action))) return
  const records = props.devices.filter(item => selected.value.includes(item.id))
  const eligible = records.filter(item => action === 'lock' ? props.canLock(item) : props.canUnlock(item))
  if (!eligible.length) { Message.warning('选中设备均不满足此操作条件'); return }
  batchBusy.value = true
  const errors: string[] = []; let completed = 0
  try {
    // Run sequentially to keep ADB/device lock operations ordered and avoid a request burst.
    for (const item of eligible) {
      try { if (action === 'lock') await AppAutomationService.lockDevice(item.id, authStore.currentUser?.username || 'FeiCe'); else await AppAutomationService.unlockDevice(item.id); completed++; selected.value = selected.value.filter(id => id !== item.id) }
      catch { errors.push(item.name || item.device_id) }
    }
    batchReport.value = `成功 ${completed} 台 · 失败 ${errors.length} 台 · 跳过 ${records.length - eligible.length} 台${errors.length ? `；操作失败：${errors.join('、')}` : ''}`
    if (errors.length) Message.warning('部分设备操作失败，请查看列表下方结果'); else Message.success('批量操作完成')
    emit('refresh')
  } finally { batchBusy.value = false }
}
</script>
