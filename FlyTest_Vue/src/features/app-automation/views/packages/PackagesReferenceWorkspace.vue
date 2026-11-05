<template>
  <div class="package-workspace">
    <section class="package-summary" aria-label="应用包概览">
      <article v-for="metric in metrics" :key="metric.label" class="package-metric"><span class="package-metric-icon" :class="metric.tone"><PackagePlatformIcon v-if="metric.platform" :platform="metric.platform"/><component v-else :is="metric.icon"/></span><div><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong></div></article>
      <div class="package-rate" :aria-label="`安装率 ${installationRate === null ? '暂无记录' : installationRate.toFixed(1) + '%'}`"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="49"/><circle class="package-rate-value" cx="60" cy="60" r="49" :stroke-dasharray="`${(installationRate || 0) * 3.0788} 307.88`"/></svg><div><strong>{{ installationRate === null ? '—' : installationRate.toFixed(1) + '%' }}</strong><span>安装率</span></div></div>
    </section>
    <a-alert v-if="loadError" type="warning" title="应用包数据加载失败">保留上次成功读取的数据，请刷新重试。</a-alert>
    <section class="package-inventory" aria-label="应用包列表">
      <div class="package-toolbar">
        <div class="package-filters">
          <a-select v-model="platform" aria-label="应用包平台"><a-option value="">全部平台</a-option><a-option value="android">Android</a-option><a-option value="ios">iOS</a-option></a-select>
          <a-input v-model="search" allow-clear :input-attrs="{ 'aria-label': '搜索应用包' }" placeholder="搜索应用包名称、包名或版本号" class="package-search"><template #prefix><icon-search/></template></a-input>
          <a-select v-model="status" allow-clear aria-label="应用包安装状态" placeholder="安装状态"><a-option value="installed">已安装</a-option><a-option value="partial">部分安装</a-option><a-option value="installing">安装中</a-option><a-option value="failed">安装失败</a-option><a-option value="unknown">无安装记录</a-option></a-select>
          <a-select v-model="version" allow-clear aria-label="应用包版本" placeholder="版本"><a-option value="latest">最新归档版本</a-option><a-option value="unmarked">未标记版本</a-option><a-option v-for="item in versions" :key="item" :value="item">{{ item }}</a-option></a-select>
          <a-select v-model="format" allow-clear aria-label="应用包格式" placeholder="文件格式"><a-option v-for="item in ['apk','aab','ipa']" :key="item" :value="item">{{ item.toUpperCase() }}</a-option></a-select>
        </div>
        <div class="package-actions"><a-dropdown @select="batchAction"><a-button :disabled="!selected.length || batchBusy" :loading="batchBusy"><icon-command/> 批量操作 <icon-down/></a-button><template #content><a-doption value="download" :disabled="!fileSupport">下载选中文件</a-doption><a-doption value="export">导出应用信息</a-doption></template></a-dropdown><a-button :loading="loading" aria-label="刷新应用包" @click="emit('refresh')"><icon-refresh/> 刷新</a-button><a-button type="primary" @click="emit('create')"><icon-upload/> 上传应用包</a-button></div>
      </div>
      <div v-if="selected.length || hasFilters" class="package-selection"><span>{{ selected.length ? `已选择 ${selected.length} 项` : `筛选结果 ${filtered.length} 项` }}</span><a-button v-if="selected.length" type="text" size="mini" @click="selected = []">取消选择</a-button><a-button v-if="hasFilters" type="text" size="mini" @click="resetFilters">重置筛选</a-button></div>
      <a-table v-model:selected-keys="selected" :data="filtered" :loading="loading" row-key="id" class="package-reference-table" :row-selection="{type:'checkbox',showCheckedAll:true,onlyCurrent:true}" :pagination="pagination" :scroll="{x:1200}" @page-change="page = $event" @page-size-change="pageSize = $event; page = 1">
        <template #columns>
          <a-table-column title="应用包名称" :width="205"><template #cell="{record}"><button class="package-name" @click="emit('edit',record)"><span class="package-app-icon" :class="record.platform"><icon-apps/></span><span><strong>{{ record.name }}</strong><small>{{ packageFormat(record).toUpperCase() || '应用信息' }}</small></span></button></template></a-table-column>
          <a-table-column title="包名" data-index="package_name" :width="175" ellipsis tooltip/>
          <a-table-column title="平台" :width="75"><template #cell="{record}"><PackagePlatformIcon :platform="record.platform"/></template></a-table-column>
          <a-table-column title="版本号" :width="140"><template #cell="{record}"><span>{{ record.version_name || '未标记' }}<small v-if="record.version_code"> ({{ record.version_code }})</small></span></template></a-table-column>
          <a-table-column title="包大小" :width="105"><template #cell="{record}">{{ packageSize(record.file_size) }}</template></a-table-column>
          <a-table-column title="上传时间" :width="150"><template #cell="{record}"><time>{{ formatDate(record.uploaded_at) }}</time></template></a-table-column>
          <a-table-column title="安装状态" :width="155"><template #cell="{record}"><button class="package-status" :class="packageInstallation(record).key" @click="openInstallations(record)"><i/><span>{{ packageInstallation(record).label }}</span></button></template></a-table-column>
          <a-table-column title="备注" data-index="description" :width="150" ellipsis tooltip/>
          <a-table-column title="操作" fixed="right" :width="124"><template #cell="{record}"><div class="package-row-actions"><a-button type="text" :loading="downloadId === record.id" :disabled="!fileSupport || !record.has_file" :title="record.has_file ? '下载安装包' : '尚未上传文件'" :aria-label="`下载应用包 ${record.name}`" @click="download(record)"><icon-download/></a-button><a-button type="text" :aria-label="`设备安装 ${record.name}`" @click="openInstallations(record)"><icon-mobile/></a-button><a-dropdown @select="value => rowAction(value,record)"><a-button type="text" :aria-label="`更多操作 ${record.name}`"><icon-more/></a-button><template #content><a-doption value="edit">编辑应用信息 / 更新文件</a-doption><a-doption value="install">设备安装与进度</a-doption><a-doption value="delete" :disabled="record.can_delete === false"><span class="package-danger">删除应用记录</span></a-doption></template></a-dropdown></div></template></a-table-column>
        </template>
        <template #empty><div class="package-empty"><icon-archive/><strong>{{ loadError ? '暂时无法读取应用包' : hasFilters ? '没有匹配的应用包' : '暂无应用包' }}</strong><p>{{ hasFilters ? '调整筛选条件或搜索其他应用' : '上传 APK / AAB / IPA，集中管理应用版本与分发' }}</p><a-button v-if="loadError" @click="emit('refresh')">重试</a-button><a-button v-else-if="hasFilters" @click="resetFilters">重置筛选</a-button><a-button v-else type="primary" @click="emit('create')">上传应用包</a-button></div></template>
      </a-table>
      <footer class="package-footnote"><span>共 {{ packages.length }} 项应用记录 · 已安装统计为至少一台设备成功安装当前归档文件的应用数</span><span v-if="!fileSupport">当前服务未提供文件接口，仍可维护应用信息</span></footer>
      <p v-if="batchReport" class="package-batch-report" role="status">{{ batchReport }}</p>
    </section>
    <a-modal v-model:visible="installVisible" title="设备安装与进度" width="680px" :footer="false" :mask-closable="!installing" :closable="!installing" :esc-to-close="!installing">
      <div v-if="currentPackage" class="package-install-dialog">
        <div class="package-install-heading"><PackagePlatformIcon :platform="currentPackage.platform"/><div><strong>{{ currentPackage.name }}</strong><small>{{ currentPackage.version_name || '未标记版本' }} · {{ packageFormat(currentPackage).toUpperCase() || '未上传文件' }}</small></div></div>
        <a-alert v-if="!canInstall" type="info">{{ !fileSupport ? '当前文件服务尚未部署，暂不支持文件上传与设备安装。' : !currentPackage.has_file ? '请先上传安装包文件。' : '当前执行器直接支持 APK；AAB 需转换为 APK，IPA 需要接入 iOS 安装驱动。' }}</a-alert>
        <div v-if="canInstall" class="package-install-controls"><a-select v-model="selectedDevice" placeholder="选择在线空闲 Android 设备" aria-label="安装目标设备" :loading="devicesLoading" :disabled="installing"><a-option v-for="device in availableDevices" :key="device.id" :value="device.id">{{device.name || device.device_id}}</a-option></a-select><a-button type="primary" :loading="installing" :disabled="!selectedDevice" @click="install">安装到设备</a-button></div>
        <a-alert v-if="deviceError" type="warning">{{deviceError}}</a-alert>
        <p v-if="canInstall && !devicesLoading && !availableDevices.length && !deviceError" class="package-install-note">暂无在线空闲 Android 设备，请先连接设备后重试。</p>
        <ul v-if="currentPackage.installations?.length" class="package-install-list"><li v-for="entry in currentPackage.installations" :key="entry.device_id"><div><strong>{{entry.device_name}}</strong><span>{{entry.status === 'installed' ? '安装完成' : entry.status === 'installing' ? '正在安装，等待设备确认' : '安装失败'}}</span></div><a-progress v-if="entry.status === 'installed'" :percent="1" status="success"/><div v-else-if="entry.status === 'installing'" class="package-install-pending" role="status">安装中，设备未提供字节进度</div><p v-if="entry.error" class="package-danger">{{entry.error}}</p></li></ul>
        <a-empty v-else description="当前归档文件暂无设备安装记录"/>
        <p class="package-install-note">安装记录仅反映本平台发起的任务，不代表设备上全部应用的实时盘点。</p>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconArchive, IconLayers, IconCheckCircle, IconSearch, IconCommand, IconDown, IconRefresh, IconUpload, IconApps, IconDownload, IconMobile, IconMore } from '@arco-design/web-vue/es/icon'
import type { AppPackage, AppDevice } from '../../types'
import { AppAutomationService } from '../../services/appAutomationService'
import { devicePlatform } from '../devices/devicePresentation'
import { packageFormat, packageSize, packageInstallation, latestPackageIds, savePackageBlob } from './packagePresentation'
import PackagePlatformIcon from './PackagePlatformIcon.vue'
import './packages-reference.css'
const props = defineProps<{ packages: AppPackage[]; projectId: number; loading: boolean; fileSupport: boolean; loadError: string }>()
const emit = defineEmits<{ refresh: []; create: []; edit: [record: AppPackage]; remove: [record: AppPackage] }>()
const search = ref(''), platform = ref(''), status = ref(''), version = ref(''), format = ref(''), page = ref(1), pageSize = ref(10), selected = ref<(string|number)[]>([]), batchBusy = ref(false), batchReport = ref(''), downloadId = ref<number|null>(null)
const latest = computed(() => latestPackageIds(props.packages)), installedCount = computed(() => props.packages.filter(item => packageInstallation(item).installed > 0).length)
const hasInstallationData = computed(() => props.packages.some(item => item.installations?.length))
const installationRate = computed(() => props.packages.length && hasInstallationData.value ? installedCount.value / props.packages.length * 100 : null)
const metrics = computed(() => [
  {label:'应用包总数',value:props.packages.length,icon:IconArchive,platform:'',tone:'teal'},
  {label:'Android 包',value:props.packages.filter(item=>item.platform==='android').length,icon:IconArchive,platform:'android',tone:'green'},
  {label:'iOS 包',value:props.packages.filter(item=>item.platform==='ios').length,icon:IconArchive,platform:'ios',tone:'muted'},
  {label:'最新版本',value:latest.value.size || '—',icon:IconLayers,platform:'',tone:'muted'},
  {label:'已安装',value:hasInstallationData.value ? installedCount.value : '—',icon:IconCheckCircle,platform:'',tone:'teal'},
])
const versions = computed(() => [...new Set(props.packages.map(item=>item.version_name).filter((item): item is string => Boolean(item)))].sort())
const hasFilters = computed(() => Boolean(search.value || platform.value || status.value || version.value || format.value))
const filtered = computed(() => props.packages.filter(item => (!search.value.trim() || [item.name,item.package_name,item.version_name,item.version_code].join(' ').toLowerCase().includes(search.value.trim().toLowerCase())) && (!platform.value || item.platform===platform.value) && (!status.value || packageInstallation(item).key===status.value) && (!format.value || packageFormat(item)===format.value) && (!version.value || (version.value==='latest' ? latest.value.has(item.id) : version.value==='unmarked' ? !item.version_name && !item.version_code : item.version_name===version.value))))
const pagination = computed(() => ({current:page.value,pageSize:pageSize.value,total:filtered.value.length,showTotal:true,showPageSize:true,pageSizeOptions:[10,20,50]}))
function resetFilters(){ search.value='';platform.value='';status.value='';version.value='';format.value='' }
function formatDate(value?:string){ if(!value || Number.isNaN(Date.parse(value))) return '未上传'; return new Date(value).toLocaleString('zh-CN',{hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) }
watch([search,platform,status,version,format],()=>{page.value=1;selected.value=[];batchReport.value=''})
watch(()=>props.packages,()=>{selected.value=selected.value.filter(id=>props.packages.some(item=>item.id===id));page.value=Math.min(page.value,Math.max(1,Math.ceil(filtered.value.length/pageSize.value)))})
async function download(record:AppPackage){ downloadId.value=record.id;try{ const blob=await AppAutomationService.downloadPackageFile(record.id);savePackageBlob(blob,record.file_name || `${record.name}.${packageFormat(record)}`) }catch(error:any){Message.error(error.message || '下载失败')}finally{downloadId.value=null} }
async function batchAction(action:unknown){ if(batchBusy.value)return;const records=props.packages.filter(item=>selected.value.includes(item.id));if(!records.length)return
  if(action==='export'){const safe=(value:unknown)=>'"'+String(value??'').replace(/^[\s]*[=+@-]/,"'$&").replace(/"/g,'""')+'"';const rows=[['应用名称','包名','平台','版本号','格式','安装状态'],...records.map(item=>[item.name,item.package_name,item.platform,item.version_name,packageFormat(item),packageInstallation(item).label])];savePackageBlob(new Blob(['\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'应用包信息.csv');batchReport.value=`已导出 ${records.length} 项应用信息`;return}
  if(action!=='download' || !props.fileSupport)return;batchBusy.value=true;let success=0;const failures:string[]=[];const projectId=props.projectId
  try{for(const record of records){if(props.projectId!==projectId)break;if(!record.has_file){failures.push(record.name+'（无文件）');continue}try{savePackageBlob(await AppAutomationService.downloadPackageFile(record.id),record.file_name || record.name);success++}catch{failures.push(record.name)}}if(props.projectId===projectId)batchReport.value=`下载成功 ${success} 项 · 未完成 ${failures.length} 项${failures.length?'：'+failures.join('、'):''}`}finally{batchBusy.value=false}}
function rowAction(action:unknown,record:AppPackage){if(action==='edit')emit('edit',record);if(action==='install')void openInstallations(record);if(action==='delete')emit('remove',record)}
const installVisible=ref(false),currentPackage=ref<AppPackage|null>(null),devices=ref<AppDevice[]>([]),devicesLoading=ref(false),deviceError=ref(''),selectedDevice=ref<number>(),installing=ref(false)
let generation=0,pollTimer:ReturnType<typeof setInterval>|undefined,polling=false
const availableDevices=computed(()=>devices.value.filter(item=>devicePlatform(item)==='Android'&&['available','online'].includes(item.status)))
const canInstall=computed(()=>props.fileSupport&&currentPackage.value?.has_file&&packageFormat(currentPackage.value)==='apk'&&currentPackage.value.platform==='android')
function stopPolling(){if(pollTimer)clearInterval(pollTimer);pollTimer=undefined}
async function pollInstallations(){if(!props.fileSupport||!currentPackage.value||polling)return;const target=currentPackage.value.id,version=generation;polling=true;try{const data=await AppAutomationService.getPackageInstallations(target);if(version===generation&&currentPackage.value?.id===target)currentPackage.value={...currentPackage.value,...data}}catch{if(version===generation)deviceError.value='安装记录刷新失败，可关闭后重试'}finally{polling=false}}
async function openInstallations(record:AppPackage){const version=++generation;stopPolling();currentPackage.value={...record};installVisible.value=true;selectedDevice.value=undefined;deviceError.value='';devices.value=[];if(!props.fileSupport)return;devicesLoading.value=true
  try{const [list]=await Promise.all([AppAutomationService.getDevices(),pollInstallations()]);if(version!==generation)return;devices.value=list;pollTimer=setInterval(()=>{void pollInstallations()},3000)}catch{if(version===generation)deviceError.value='设备列表加载失败，请关闭后重试'}finally{if(version===generation)devicesLoading.value=false}}
async function install(){if(!currentPackage.value||!selectedDevice.value||installing.value||!canInstall.value)return;const target=currentPackage.value.id,device=availableDevices.value.find(item=>item.id===selectedDevice.value),version=generation;if(!device)return;installing.value=true
  currentPackage.value.installations=[...(currentPackage.value.installations||[]).filter(item=>item.device_id!==device.id),{device_id:device.id,device_name:device.name,status:'installing',progress:null,updated_at:new Date().toISOString()}]
  try{const result=await AppAutomationService.installPackageFile(target,device.id);if(version!==generation)return;currentPackage.value.installations=[...(currentPackage.value.installations||[]).filter(item=>item.device_id!==device.id),result];result.status==='installed'?Message.success('设备已确认安装完成'):Message.error(result.error||'安装失败');emit('refresh')}
  catch(error:any){if(version===generation){Message.error(error.message||'安装请求失败，请刷新核对设备结果');await pollInstallations()}}
  finally{if(version===generation){installing.value=false;devices.value=devices.value.filter(item=>item.id!==device.id)}}}
watch(installVisible,value=>{if(!value){generation++;stopPolling();currentPackage.value=null}})
watch(()=>props.projectId,()=>{generation++;stopPolling();installVisible.value=false;installing.value=false;selected.value=[];resetFilters();batchReport.value=''})
onBeforeUnmount(()=>{generation++;stopPolling()})
</script>
