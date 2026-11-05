<template>
  <a-modal v-model:visible="visible" title="AI 识别元素" width="920px" :footer="false" :mask-closable="!recognizing" :closable="!recognizing" :esc-to-close="!recognizing">
    <div class="element-recognition">
      <section class="element-recognition-source">
        <label for="element-screenshot-file">页面截图</label>
        <input id="element-screenshot-file" :key="visible ? 'open' : 'closed'" type="file" accept="image/png,image/jpeg,image/webp" :disabled="recognizing" @change="selectImage"/>
        <img v-if="image" :src="image" alt="待识别的页面截图"/>
        <div v-else class="element-recognition-placeholder"><icon-scan/><span>选择 PNG / JPEG / WebP 截图</span><small>最大 5 MB</small></div>
        <p>点击识别后，截图发送给已配置的视觉模型。截图只能提供外观与坐标，无法可靠推断 ResourceId 或 XPath。</p>
      </section>
      <section class="element-recognition-results">
        <a-spin v-if="modelLoading" tip="检查视觉模型"/>
        <a-alert v-else-if="!visionReady" type="warning" title="视觉模型尚未就绪">{{modelError || '请先配置并激活支持视觉的模型，再进行截图识别。'}}<a-button type="text" @click="configureModel">前往模型配置</a-button></a-alert>
        <div v-else class="element-recognition-model"><icon-robot/> {{modelName}} <span>视觉模型</span></div>
        <a-form-item label="所属页面"><a-input v-model="pageName" placeholder="例如：登录注册" :max-length="100" :disabled="recognizing"/></a-form-item>
        <a-button class="element-ai-button fc-ai-action" type="primary" :loading="recognizing" :disabled="!visionReady || !image || modelLoading" @click="recognize"><icon-scan/> 开始识别</a-button>
        <p v-if="error" class="element-error" role="alert">{{error}}</p>
        <p v-if="hasResult" class="element-recognition-note">识别到 {{candidates.length}} 个可用候选，尚未保存。请逐项检查坐标、页面和设备分辨率。</p>
        <ul v-if="candidates.length" class="element-candidates"><li v-for="(candidate,index) in candidates" :key="index"><div><strong>{{candidate.name}}</strong><small>{{elementControlLabel(candidate)}} · Position {{candidate.selector_value}}</small></div><a-button size="small" @click="adopt(candidate)">采用并编辑</a-button></li></ul>
        <a-empty v-else-if="hasResult" description="未识别到可用元素，请更换截图重试"/>
        <footer><span>也可使用现有设备截图功能手动取点或框选。</span><a-button :disabled="recognizing" @click="capture"><icon-camera/> 设备截图框选</a-button></footer>
      </section>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { IconScan, IconRobot, IconCamera } from '@arco-design/web-vue/es/icon'
import { getActiveLlmConfig } from '@/features/langgraph/services/llmConfigService'
import { AppAutomationService } from '../../services/appAutomationService'
import type { AppElement } from '../../types'
import { elementControlLabel } from './elementPresentation'
const props = defineProps<{projectId:number;defaultPage:string}>()
const visible = defineModel<boolean>('visible',{required:true})
const emit = defineEmits<{ draft:[record:AppElement];capture:[pageName:string] }>()
const router=useRouter(), image=ref(''), pageName=ref(''), modelLoading=ref(false), modelError=ref(''), modelName=ref(''), visionReady=ref(false), recognizing=ref(false), error=ref(''), hasResult=ref(false), candidates=ref<AppElement[]>([])
let version=0
watch(visible,async value=>{const current=++version;if(!value)return;image.value='';pageName.value=props.defaultPage;modelError.value='';modelName.value='';visionReady.value=false;error.value='';hasResult.value=false;candidates.value=[];recognizing.value=false;modelLoading.value=true
  try{const response=await getActiveLlmConfig();if(current!==version)return;if(response.status!=='success')throw new Error('无法读取模型配置，请检查模型服务后重试');visionReady.value=response.data?.supports_vision===true;modelName.value=response.data?.config_name||response.data?.name||''}catch(err:any){if(current===version)modelError.value=err.message||'读取视觉模型配置失败'}finally{if(current===version)modelLoading.value=false}})
watch(()=>props.projectId,()=>{version++;visible.value=false})
function selectImage(event:Event){const file=(event.target as HTMLInputElement).files?.[0];error.value='';hasResult.value=false;candidates.value=[];image.value='';if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){error.value='请选择不超过 5 MB 的 PNG / JPEG / WebP 图片';return}const current=version;const reader=new FileReader();reader.onload=()=>{if(current===version)image.value=String(reader.result||'')};reader.onerror=()=>{if(current===version)error.value='读取截图失败'};reader.readAsDataURL(file)}
async function recognize(){if(recognizing.value||!image.value||!visionReady.value)return;const current=version;recognizing.value=true;error.value='';hasResult.value=false;candidates.value=[]
  try{const result=await AppAutomationService.recognizeScreenshotElements(props.projectId,image.value,pageName.value.trim());if(current!==version)return;candidates.value=result.elements.map((item,index)=>({...item,id:-(index+1),updated_at:new Date().toISOString()}));hasResult.value=true}catch(err:any){if(current===version)error.value=err.message||'截图识别失败，请检查视觉模型连接'}finally{if(current===version)recognizing.value=false}}
function adopt(record:AppElement){emit('draft',{...record,id:0});visible.value=false}
function capture(){visible.value=false;emit('capture',pageName.value.trim())}
function configureModel(){visible.value=false;void router.push('/llm-configs')}
</script>
