<template>
  <div class="element-workspace">
    <section class="element-summary" aria-label="元素资产概览">
      <article v-for="metric in metrics" :key="metric.label" class="element-metric" :class="metric.tone"><span class="element-metric-icon"><component :is="metric.icon"/></span><div><span>{{metric.label}}</span><strong>{{metric.value}}</strong></div></article>
      <article class="element-ai-card"><div><icon-robot/><strong>AI 识别元素</strong></div><p>从页面截图辅助生成元素</p><a-button class="element-ai-button fc-ai-action" type="primary" @click="emit('recognize',pageName)">开始识别 <icon-arrow-right/></a-button></article>
    </section>
    <a-alert v-if="loadError" type="warning" title="元素数据加载失败">保留上次成功读取的数据，请刷新重试。</a-alert>
    <div class="element-assets-layout">
      <aside class="element-directory" aria-label="页面目录">
        <header><h3>页面目录</h3><a-button type="text" aria-label="新增元素页面" @click="pageDialog=true"><icon-plus/></a-button></header>
        <a-input v-model="pageSearch" allow-clear :input-attrs="{'aria-label':'搜索元素页面'}" placeholder="搜索页面名称"><template #suffix><icon-search/></template></a-input>
        <nav aria-label="按页面浏览元素">
          <button class="element-project" :aria-pressed="activePage === ''" @click="activePage='' "><icon-folder/><strong>{{projectName || '当前项目'}}</strong><small>{{elements.length}}</small></button>
          <button v-for="item in visiblePages" :key="item.name" :class="{active:activePage === 'page:'+item.name}" :aria-pressed="activePage === 'page:'+item.name" @click="activePage='page:'+item.name"><icon-right/><icon-folder/><span>{{item.name}}</span><small>{{item.count}}</small></button>
          <button v-if="unassignedCount && (!pageSearch || '未分组'.includes(pageSearch))" :class="{active:activePage==='unassigned'}" :aria-pressed="activePage==='unassigned'" @click="activePage='unassigned'"><icon-right/><icon-folder/><span>未分组</span><small>{{unassignedCount}}</small></button>
          <p v-if="!visiblePages.length && pageSearch" class="element-directory-empty">没有匹配的页面</p>
        </nav>
        <footer>页面随首个元素保存创建，复用与维护状态按已标记数据统计。</footer>
      </aside>
      <section class="element-list-panel" aria-label="元素列表">
        <header class="element-list-heading"><h3>{{pageName || (activePage==='unassigned'?'未分组':'全部页面')}} / 元素列表 <small>({{filtered.length}})</small></h3><div class="element-list-actions">
          <a-dropdown @select="transferAction"><a-button><icon-import/> 导入/导出</a-button><template #content><a-doption value="import">导入元素 JSON</a-doption><a-doption value="export-all">导出当前项目全部元素</a-doption><a-doption value="export-selected" :disabled="!selected.length">导出已选元素</a-doption></template></a-dropdown>
          <a-dropdown @select="batchAction"><a-button :disabled="!selected.length || batchBusy" :loading="batchBusy"><icon-command/> 批量操作 <icon-down/></a-button><template #content><a-doption value="reuse">标记为复用</a-doption><a-doption value="no-reuse">标记为不复用</a-doption><a-doption value="maintenance">标记为待维护</a-doption><a-doption value="normal">标记为正常</a-doption></template></a-dropdown>
          <a-button type="primary" @click="emit('create',pageName)"><icon-plus/> 新增元素</a-button>
        </div></header>
        <div class="element-filters">
          <a-select v-model="activePage" class="element-mobile-pages" aria-label="元素页面目录"><a-option value="">全部页面</a-option><a-option v-for="item in pages" :key="item.name" :value="'page:'+item.name">{{item.name}} ({{item.count}})</a-option><a-option v-if="unassignedCount" value="unassigned">未分组 ({{unassignedCount}})</a-option></a-select>
          <a-input v-model="search" allow-clear :input-attrs="{'aria-label':'搜索元素'}" placeholder="搜索元素名称或定位表达式"><template #prefix><icon-search/></template></a-input>
          <a-select v-model="selector" allow-clear aria-label="筛选元素定位方式" placeholder="定位方式"><a-option v-for="item in selectors" :key="item" :value="item">{{item}}</a-option></a-select>
          <a-select v-model="reuse" allow-clear aria-label="筛选元素复用状态" placeholder="是否复用"><a-option value="yes">是</a-option><a-option value="no">否</a-option><a-option value="unknown">未标记</a-option></a-select>
          <a-button :loading="loading" aria-label="刷新元素列表" @click="emit('refresh')"><icon-refresh/></a-button>
        </div>
        <div v-if="selected.length || search || selector || reuse" class="element-selection"><span v-if="selected.length">已选择 {{selected.length}} 项</span><a-button v-if="selected.length" type="text" size="mini" @click="selected=[]">取消选择</a-button><a-button v-if="search || selector || reuse" type="text" size="mini" @click="resetFilters">重置筛选</a-button></div>
        <a-table v-model:selected-keys="selected" class="element-reference-table" row-key="id" :data="filtered" :loading="loading" :scroll="{x:940}" :row-selection="{type:'checkbox',showCheckedAll:true,onlyCurrent:true}" :pagination="pagination" @page-change="page=$event" @page-size-change="pageSize=$event;page=1">
          <template #columns>
            <a-table-column title="元素名称" :width="190"><template #cell="{record}"><button class="element-name" @click="emit('detail',record)"><component :is="elementControl(record)==='image'?IconImage:elementControl(record)==='checkbox'?IconCheckSquare:IconApps"/><span><strong>{{record.name}}</strong><small v-if="elementMaintenance(record)==='needs_maintenance'" class="element-error">待维护</small><small v-else-if="record.config?.review_status==='pending'">AI 候选 · 待审核</small><small v-else-if="!record.is_active">已停用</small></span></button></template></a-table-column>
            <a-table-column title="元素类型" :width="100"><template #cell="{record}"><span class="element-type" :class="elementControl(record)">{{elementControlLabel(record)}}</span></template></a-table-column>
            <a-table-column title="定位方式" :width="125"><template #cell="{record}"><span class="element-selector" :class="record.selector_type">{{elementSelector(record)}}</span></template></a-table-column>
            <a-table-column title="定位表达式" :width="280"><template #cell="{record}"><code class="element-expression" :title="elementExpression(record)">{{elementExpression(record)}}</code></template></a-table-column>
            <a-table-column title="是否复用" :width="90"><template #cell="{record}"><span class="element-reuse" :class="{yes:elementReusable(record)===true}">{{elementReusable(record)===true?'是':elementReusable(record)===false?'否':'未标记'}}</span></template></a-table-column>
            <a-table-column title="操作" fixed="right" :width="142"><template #cell="{record}"><div class="element-row-actions"><a-button type="text" :aria-label="`编辑元素 ${record.name}`" @click="emit('edit',record)"><icon-edit/></a-button><a-button type="text" :aria-label="`复制元素 ${record.name}`" @click="emit('duplicate',record)"><icon-copy/></a-button><a-button type="text" status="danger" :aria-label="`删除元素 ${record.name}`" @click="emit('remove',record.id)"><icon-delete/></a-button><a-dropdown @select="value => rowAction(value,record)"><a-button type="text" :aria-label="`更多操作 ${record.name}`"><icon-more/></a-button><template #content><a-doption value="detail">查看详情</a-doption><a-doption value="toggle">{{record.is_active?'停用元素':'启用元素'}}</a-doption></template></a-dropdown></div></template></a-table-column>
          </template>
          <template #empty><div class="element-empty"><icon-apps/><strong>{{loadError?'暂时无法读取元素':elements.length?'没有匹配的元素':'暂无元素资产'}}</strong><p>按页面维护定位元素，让测试步骤可复用、易维护。</p><a-button v-if="loadError" @click="emit('refresh')">重试</a-button><a-button v-else type="primary" @click="emit('create',pageName)">新增元素</a-button></div></template>
        </a-table>
        <p v-if="batchReport" class="element-batch-report" role="status">{{batchReport}}</p>
      </section>
    </div>
    <a-modal v-model:visible="pageDialog" title="新增页面" :on-before-ok="createPage"><a-input v-model="newPage" placeholder="输入页面名称，例如：登录注册" :max-length="100"/><p class="element-help">下一步创建该页面的首个元素；元素保存成功后，页面会显示在目录中。</p></a-modal>
    <a-modal v-model:visible="importVisible" title="导入元素 JSON" width="760px" :mask-closable="!importing" :closable="!importing" :esc-to-close="!importing" :confirm-loading="importing" :ok-button-props="{disabled:!importRows.some(row=>row.state==='ready'||row.state==='failed')}" :cancel-button-props="{disabled:importing}" :ok-text="'确认导入'" :on-before-ok="importElements">
      <div class="element-import"><label for="element-json-file">选择元素导出文件（JSON，最大 5 MB / 2000 项）</label><input id="element-json-file" :key="importVisible?'open':'closed'" type="file" accept=".json,application/json" :disabled="importing" @change="readImportFile"/><a-alert type="info">仅向当前项目新增记录，不覆盖已有同名元素。图片路径仍受项目权限检查，跨项目图片需重新上传。</a-alert><p v-if="importError" role="alert" class="element-error">{{importError}}</p><ul class="element-import-rows"><li v-for="(row,index) in importRows" :key="index"><span>{{row.payload.name}}</span><small :class="{ 'element-error': row.state==='failed' }">{{row.state==='saved'?'已导入':row.state==='duplicate'?'同名跳过':row.state==='failed'?row.error:'待导入'}}</small></li></ul><p v-if="importReport" role="status" class="element-help">{{importReport}}</p></div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {Message} from '@arco-design/web-vue'
import {IconLayers,IconFile,IconSync,IconTool,IconRobot,IconArrowRight,IconFolder,IconPlus,IconRight,IconSearch,IconImport,IconCommand,IconDown,IconRefresh,IconImage,IconCheckSquare,IconApps,IconEdit,IconCopy,IconDelete,IconMore} from '@arco-design/web-vue/es/icon'
import type {AppElement} from '../../types'
import {AppAutomationService} from '../../services/appAutomationService'
import {buildElementPayloadFromRecord} from './elementFormUtils'
import {elementPage,elementControl,elementControlLabel,elementReusable,elementMaintenance,elementSelector,elementExpression,downloadElements,parseElementImport,type ImportedElement} from './elementPresentation'
import './elements-reference.css'
const props=defineProps<{elements:AppElement[];loading:boolean;loadError:string;projectId:number;projectName:string}>()
const emit=defineEmits<{create:[pageName:string];edit:[record:AppElement];detail:[record:AppElement];duplicate:[record:AppElement];remove:[id:number];toggle:[record:AppElement,value:boolean];refresh:[];recognize:[pageName:string]}>()
const activePage=ref(''),pageSearch=ref(''),search=ref(''),selector=ref(''),reuse=ref(''),selected=ref<(string|number)[]>([]),page=ref(1),pageSize=ref(10),batchBusy=ref(false),batchReport=ref(''),pageDialog=ref(false),newPage=ref('')
const pages=computed(()=>{const counts=new Map<string,number>();for(const item of props.elements){const name=elementPage(item);if(name)counts.set(name,(counts.get(name)||0)+1)}return [...counts].map(([name,count])=>({name,count})).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'))})
const unassignedCount=computed(()=>props.elements.filter(item=>!elementPage(item)).length)
const visiblePages=computed(()=>pages.value.filter(item=>item.name.toLowerCase().includes(pageSearch.value.trim().toLowerCase())))
const pageName=computed(()=>activePage.value.startsWith('page:')?activePage.value.slice(5):'')
const knownReuse=computed(()=>props.elements.filter(item=>elementReusable(item)!==null))
const metrics=computed(()=>[
  {label:'元素总数',value:props.elements.length.toLocaleString('zh-CN'),icon:IconLayers,tone:''},
  {label:'页面覆盖数',value:pages.value.length,icon:IconFile,tone:''},
  {label:'复用率',value:knownReuse.value.length?(knownReuse.value.filter(item=>elementReusable(item)).length/knownReuse.value.length*100).toFixed(1)+'%':'—',icon:IconSync,tone:''},
  {label:'待维护元素',value:props.elements.some(item=>elementMaintenance(item)!==null)?props.elements.filter(item=>elementMaintenance(item)==='needs_maintenance').length:'—',icon:IconTool,tone:'danger'},
])
const selectors=computed(()=>[...new Set(props.elements.map(elementSelector))].sort())
const filtered=computed(()=>props.elements.filter(item=>(!activePage.value||(activePage.value==='unassigned'?!elementPage(item):elementPage(item)===pageName.value))&&(!search.value.trim()||[item.name,elementExpression(item)].join(' ').toLowerCase().includes(search.value.trim().toLowerCase()))&&(!selector.value||elementSelector(item)===selector.value)&&(!reuse.value||(reuse.value==='yes'?elementReusable(item)===true:reuse.value==='no'?elementReusable(item)===false:elementReusable(item)===null))))
const pagination=computed(()=>({current:page.value,pageSize:pageSize.value,total:filtered.value.length,showTotal:true,showPageSize:true,pageSizeOptions:[10,20,50]}))
watch([activePage,search,selector,reuse],()=>{page.value=1;selected.value=[];batchReport.value=''})
watch(()=>props.elements,()=>{selected.value=selected.value.filter(id=>props.elements.some(item=>item.id===id));if(activePage.value.startsWith('page:')&&!props.elements.some(item=>elementPage(item)===pageName.value))activePage.value='';page.value=Math.min(page.value,Math.max(1,Math.ceil(filtered.value.length/pageSize.value)))})
function resetFilters(){search.value='';selector.value='';reuse.value=''}
function createPage(){const name=newPage.value.trim();if(!name){Message.warning('请输入页面名称');return false}emit('create',name);newPage.value='';return true}
function rowAction(action:unknown,record:AppElement){if(action==='detail')emit('detail',record);if(action==='toggle')emit('toggle',record,!record.is_active)}
function transferAction(action:unknown){if(action==='import'){importVisible.value=true;importRows.value=[];importError.value='';importReport.value=''}if(action==='export-all')downloadElements(props.elements);if(action==='export-selected')downloadElements(props.elements.filter(item=>selected.value.includes(item.id)))}
async function batchAction(action:unknown){if(batchBusy.value||!['reuse','no-reuse','maintenance','normal'].includes(String(action)))return;const records=props.elements.filter(item=>selected.value.includes(item.id)),projectId=props.projectId;batchBusy.value=true;let success=0;const failed:string[]=[]
  try{for(const record of records){if(projectId!==props.projectId)break;const config={...record.config};if(action==='reuse'||action==='no-reuse')config.reusable=action==='reuse';else config.maintenance_status=action==='maintenance'?'needs_maintenance':'normal';try{await AppAutomationService.updateElement(record.id,buildElementPayloadFromRecord(record,{config}));success++;selected.value=selected.value.filter(id=>id!==record.id)}catch{failed.push(record.name)}}if(projectId===props.projectId){batchReport.value=`成功 ${success} 项 · 失败 ${failed.length} 项${failed.length?'：'+failed.join('、'):''}`;emit('refresh')}}finally{batchBusy.value=false}}
type ImportRow={payload:ImportedElement;state:'ready'|'duplicate'|'saved'|'failed';error?:string}
const importVisible=ref(false),importing=ref(false),importRows=ref<ImportRow[]>([]),importError=ref(''),importReport=ref('')
async function readImportFile(event:Event){const file=(event.target as HTMLInputElement).files?.[0],projectId=props.projectId;importRows.value=[];importError.value='';importReport.value='';if(!file)return;if(file.size>5*1024*1024){importError.value='导入文件不能超过 5 MB';return}
  try{const records=parseElementImport(await file.text(),projectId);if(projectId!==props.projectId||!importVisible.value)return;const names=new Set(props.elements.map(item=>item.name.toLowerCase()));importRows.value=records.map(payload=>{const duplicate=names.has(payload.name.toLowerCase());names.add(payload.name.toLowerCase());return {payload,state:duplicate?'duplicate':'ready'}})}catch(error:any){importError.value=error.message||'无法读取导入文件'}}
async function importElements(){if(importing.value)return false;const rows=importRows.value.filter(row=>row.state==='ready'||row.state==='failed'),projectId=props.projectId;importing.value=true
  try{for(const row of rows){if(projectId!==props.projectId)break;try{await AppAutomationService.createElement(row.payload);row.state='saved';row.error=''}catch(error:any){row.state='failed';row.error=error.message||'导入失败'}}if(projectId===props.projectId){const failed=importRows.value.filter(row=>row.state==='failed').length;importReport.value=`已导入 ${importRows.value.filter(row=>row.state==='saved').length} 项 · 失败 ${failed} 项 · 同名跳过 ${importRows.value.filter(row=>row.state==='duplicate').length} 项`;emit('refresh')}}finally{importing.value=false}return false}
watch(()=>props.projectId,()=>{activePage.value='';pageSearch.value='';resetFilters();selected.value=[];batchReport.value='';pageDialog.value=false;importVisible.value=false;importRows.value=[]})
</script>
