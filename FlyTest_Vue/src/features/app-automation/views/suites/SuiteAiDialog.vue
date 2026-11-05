<template>
  <a-modal v-model:visible="visible" title="AI 生成测试套件" :width="Math.min(680,width - 24)" :footer="false" :mask-closable="!loading">
    <a-alert>AI 仅从现有用例中建议组合与执行顺序，采用后仍需人工确认并保存。</a-alert>
    <a-form layout="vertical" :model="{prompt,filter}">
      <a-form-item label="测试目标"><a-textarea v-model="prompt" placeholder="例如：针对登录、支付链路组织发布前冒烟测试" :max-length="2000" :auto-size="{minRows:3,maxRows:6}" /></a-form-item>
      <a-form-item label="候选用例筛选"><a-input v-model="filter" placeholder="搜索用例名称、说明或标签" /></a-form-item>
    </a-form>
    <p>当前候选 {{ candidates.length }} 条（最多 200 条，请按关键词缩小范围）</p>
    <a-alert v-if="error" type="warning">{{ error }}</a-alert>
    <a-button class="fc-ai-action" type="primary" :loading="loading" :disabled="!prompt.trim() || !candidates.length || candidates.length > 200" @click="generate">生成建议</a-button>
    <section v-if="proposal" class="suite-ai-proposal"><h3>{{ proposal.name }}</h3><p>{{ proposal.description }}</p><ol><li v-for="id in proposal.test_case_ids" :key="id">{{ cases.find(item=>item.id===id)?.name }}</li></ol><a-button type="primary" @click="emit('apply',proposal);visible=false">采用并编辑套件</a-button></section>
  </a-modal>
</template>
<script setup lang="ts">
import {ref,computed,watch} from 'vue'
import {useWindowSize} from '@vueuse/core'
import type {AppTestCase} from '../../types'
import {AppAutomationService} from '../../services/appAutomationService'
const props=defineProps<{projectId:number;cases:AppTestCase[]}>()
const visible=defineModel<boolean>('visible',{required:true})
type Proposal={name:string;description:string;test_case_ids:number[]}
const emit=defineEmits<{apply:[proposal:Proposal]}>()
const {width}=useWindowSize(),prompt=ref(''),filter=ref(''),loading=ref(false),error=ref(''),proposal=ref<Proposal|null>(null)
const candidates=computed(()=>props.cases.filter(item=>`${item.name} ${item.description} ${item.tags.join(' ')}`.toLowerCase().includes(filter.value.trim().toLowerCase())))
const generate=async()=>{loading.value=true;error.value='';proposal.value=null;const project=props.projectId;try{const value=await AppAutomationService.planSuite({project_id:project,prompt:prompt.value,cases:candidates.value.map(({id,name,description,tags})=>({id,name,description,tags}))});if(project!==props.projectId)return;const allowed=new Set(candidates.value.map(item=>item.id));if(!value.test_case_ids?.length||value.test_case_ids.some(id=>!allowed.has(id)))throw Error('AI 返回的用例不在当前候选范围内');proposal.value=value}catch{error.value='AI 规划暂不可用，请确认 Django 已加载套件规划接口，并配置可用模型。'}finally{loading.value=false}}
watch(()=>props.projectId,()=>{proposal.value=null;visible.value=false})
</script>
