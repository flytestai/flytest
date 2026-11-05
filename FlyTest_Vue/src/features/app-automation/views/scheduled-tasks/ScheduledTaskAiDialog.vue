<template>
  <a-modal v-model:visible="visible" title="AI 生成定时任务" :width="Math.min(660,width-24)" :footer="false" :mask-closable="!loading">
    <a-alert>描述回归目标与频率，AI 仅生成 UTC 调度建议；采用后以暂停状态进入表单，需确认设备、关联对象并保存。</a-alert>
    <a-form layout="vertical" :model="{prompt}"><a-form-item label="任务目标与执行频率"><a-textarea v-model="prompt" placeholder="例如：每个工作日北京时间早上 8 点执行登录回归" :max-length="2000" :auto-size="{minRows:4,maxRows:7}" /></a-form-item></a-form>
    <a-alert v-if="error" type="warning">{{error}}</a-alert>
    <a-button class="fc-ai-action" type="primary" :disabled="!prompt.trim()" :loading="loading" @click="generate">生成调度建议</a-button>
    <section v-if="proposal" class="schedule-ai-proposal"><h3>{{proposal.name}}</h3><p>{{proposal.description}}</p><dl><dt>触发方式</dt><dd>{{proposal.trigger_type==='CRON'?'Cron 表达式':'周期执行'}}</dd><dt>调度规则</dt><dd>{{proposal.trigger_type==='CRON'?proposal.cron_expression+'（UTC）':`每 ${proposal.interval_seconds} 秒`}}</dd><dt>初始状态</dt><dd>暂停 · 保存后按需激活</dd></dl><a-button type="primary" @click="emit('apply',proposal);visible=false">采用并编辑任务</a-button></section>
  </a-modal>
</template>
<script setup lang="ts">
import {ref,watch} from 'vue'
import {useWindowSize} from '@vueuse/core'
import {AppAutomationService} from '../../services/appAutomationService'
export type ScheduleProposal={name:string;description:string;trigger_type:'CRON'|'INTERVAL';cron_expression:string;interval_seconds:number}
const props=defineProps<{projectId:number}>(),visible=defineModel<boolean>('visible',{required:true})
const emit=defineEmits<{apply:[proposal:ScheduleProposal]}>()
const {width}=useWindowSize(),prompt=ref(''),loading=ref(false),error=ref(''),proposal=ref<ScheduleProposal|null>(null)
let version=0
const generate=async()=>{const request=++version,project=props.projectId;loading.value=true;error.value='';proposal.value=null;try{const value=await AppAutomationService.planScheduledTask({project_id:project,prompt:prompt.value});if(request!==version||project!==props.projectId||!visible.value)return;proposal.value=value}catch{if(request===version)error.value='AI 调度规划暂不可用，请确认 Django 已加载新版接口，并配置可用模型。可直接使用“新建任务”配置调度。'}finally{if(request===version)loading.value=false}}
watch(()=>props.projectId,()=>{++version;loading.value=false;proposal.value=null;visible.value=false})
watch(visible,value=>{if(!value){++version;loading.value=false;proposal.value=null;error.value=''}})
</script>
<style scoped>.schedule-ai-proposal{margin-top:18px;padding:16px;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-surface)}.schedule-ai-proposal dl{display:grid;grid-template-columns:90px 1fr;gap:10px}.schedule-ai-proposal dd{margin:0;overflow-wrap:anywhere}.schedule-ai-proposal dt{color:var(--theme-text-secondary)}.arco-alert{margin-bottom:16px}</style>
