<template>
  <section class="web-data-workspace">
    <Teleport to="#web-workspace-metrics"><div v-show="active" class="web-metrics" aria-label="列表统计">
      <article v-for="(metric,index) in metrics" :key="metric.label" class="web-metric" :class="[`web-metric--${index}`,{'web-metric--danger':metric.label.includes('失败') && Number(metric.value)>0}]">
        <span class="web-metric__icon"><component :is="icons[index]" /></span>
        <div><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong></div>
      </article>
    </div></Teleport>
    <div class="web-data-layout" :class="{'web-data-layout--detail':selected && wide}">
      <div class="web-data-main"><slot /></div>
      <aside v-if="selected && wide" ref="asideElement" class="web-data-aside" :style="{maxHeight:asideHeight+'px'}"><Preview /></aside>
    </div>
    <a-drawer v-if="!wide && active" class="web-preview-drawer" :visible="!!selected" :width="Math.min(width-24,480)" :footer="false" :header="false" unmount-on-close @cancel="selectedId=null"><Preview /></a-drawer>
  </section>
</template>
<script setup lang="ts">
import {computed,ref,watch,h,defineComponent,inject} from 'vue'
import {workspacePaneKey} from '@/components/workspace/workspaceContext'
import {useMediaQuery,useWindowSize,useElementBounding} from '@vueuse/core'
import {IconApps,IconLayers,IconCheckCircle,IconClockCircle} from '@arco-design/web-vue/es/icon'
import WebRecordPreview from './WebRecordPreview.vue'
import './web-workspace.css'
const props=defineProps<{kind:string;rows:object[];total?:number;loading?:boolean}>()
const active=inject(workspacePaneKey,ref(true))
const emit=defineEmits<{edit:[record:never];inspect:[record:never]}>()
type Row=Record<string,unknown>
const rows=computed(()=>props.rows as Row[])
const wide=useMediaQuery('(min-width: 1500px)'),{width,height}=useWindowSize()
const asideElement=ref<HTMLElement>()
const {top}=useElementBounding(asideElement)
const asideHeight=computed(()=>Math.max(180,height.value-top.value-24))
const selectedId=ref<unknown>(null)
const selected=computed(()=>rows.value.find(row=>row.id===selectedId.value))
watch(rows,list=>{if(!list.some(row=>row.id===selectedId.value)) selectedId.value=wide.value?list[0]?.id??null:null},{immediate:true})
const select=(row:Row)=>{selectedId.value=row.id}
const onRowClick=(row:Row,event:Event)=>{if((event.target as HTMLElement)?.closest('button,a,input,.arco-switch,.arco-checkbox'))return;select(row)}
const rowClass=(row:Row)=>row.id===selectedId.value?'web-row-selected':''
defineExpose({select,onRowClick,rowClass})
const icons=[IconApps,IconLayers,IconCheckCircle,IconClockCircle]
const metrics=computed(()=>{
 const list=rows.value,total=props.loading?'—':props.total??list.length
 const count=(key:string)=>list.filter(row=>Boolean(row[key])).length
 const unique=(key:string)=>new Set(list.map(row=>row[key]).filter(value=>value!==undefined&&value!==null)).size
 const sum=(key:string)=>list.reduce((n,row)=>n+Number(row[key]||0),0)
 const entries:Record<string,[string,unknown][] >={
 pages:[['页面总数',total],['本页模块',unique('module')],['本页元素',sum('element_count')],['本页页面',list.length]],
 'page-steps':[['步骤总数',total],['本页关联页面',unique('page')],['本页操作数',sum('step_count')],['本页步骤',list.length]],
 testcases:[['用例总数',total],['本页未执行',list.filter(r=>r.status===0).length],['本页步骤数',sum('step_count')],['本页失败',list.filter(r=>r.status===3).length]],
 'execution-records':[['执行总数',total],['本页通过',list.filter(r=>r.status===2).length],['本页运行中',list.filter(r=>r.status===1).length],['本页失败',list.filter(r=>r.status===3).length]],
 'batch-records':[['批次总数',total],['本页运行中',list.filter(r=>r.status===1).length],['本页已通过用例',sum('passed_cases')],['本页失败用例',sum('failed_cases')]],
 'public-data':[['数据总数',total],['本页已启用',count('is_enabled')],['本页类型数',unique('type')],['本页数据',list.length]],
 'env-config':[['环境总数',total],['本页默认环境',count('is_default')],['本页浏览器类型',unique('browser')],['本页无头模式',count('headless')]],
 actuators:[['已连接执行器',total],['接收任务',count('is_open')],['浏览器类型',unique('browser_type')],['调试模式',count('debug')]],
 }
 return (entries[props.kind]||[]).map(([label,value])=>({label,value:props.loading?'—':value}))
})
const Preview=defineComponent({setup:()=>()=>selected.value?h(WebRecordPreview,{kind:props.kind,record:selected.value,onClose:()=>{selectedId.value=null},onEdit:()=>emit('edit',selected.value as never),onInspect:()=>emit('inspect',selected.value as never)}):null})
</script>
