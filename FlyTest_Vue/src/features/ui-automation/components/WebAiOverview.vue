<template>
 <Teleport to="#web-workspace-metrics"><div v-show="active" class="web-metrics web-ai-metrics"><article v-for="(item,index) in metrics" :key="item[0]" class="web-metric" :class="`web-metric--${index}`"><span class="web-metric__icon"><component :is="icons[index]" /></span><div><span>{{ item[0] }}</span><strong>{{ loading?'读取中':item[1] }}</strong></div></article></div></Teleport>
 <div class="web-ai-overview">
  <section class="web-ai-panel"><header><div><h3>运行能力总览</h3><p>从页面理解到执行结果回传，逐项确认运行条件。</p></div><a-button :loading="loading" @click="$emit('refresh')"><icon-refresh /> 刷新能力</a-button></header>
   <div class="web-ai-flow"><div v-for="(step,index) in flow" :key="step[0]"><component :is="icons[index]" /><strong>{{ step[0] }}</strong><span>{{ step[1] }}</span></div></div>
   <h4>配置检查清单</h4><dl class="web-ai-checks"><template v-for="check in checks" :key="check[0]"><dt>{{check[0]}}</dt><dd><a-tag :color="check[1]===true?'green':check[1]===false?'orange':'gray'">{{check[1]===true?'已就绪':check[1]===false?'未就绪':'待读取'}}</a-tag></dd></template></dl>
   <a-alert v-if="error" type="warning">{{error}}</a-alert><a-alert v-else-if="summary" type="info">{{summary}}</a-alert><a-alert v-else-if="!capabilities && !loading" type="info">暂未读取到运行能力，请刷新后重试。</a-alert>
  </section>
  <section class="web-ai-panel web-ai-advice"><h3><icon-bulb /> 配置建议</h3><p>根据当前配置与浏览器检测结果展示。</p><a-spin :loading="loading" style="width:100%"><a-alert v-for="issue in capabilities?.issues || []" :key="issue" type="warning">{{issue}}</a-alert><div v-for="(advice,index) in capabilities?.recommendations || []" :key="advice" class="web-ai-advice-item"><span>{{String(index+1).padStart(2,'0')}}</span><p>{{advice}}</p></div><p v-if="capabilities && !capabilities.recommendations?.length">当前没有额外配置建议。</p></a-spin><router-link class="web-ai-model-link" to="/llm-configs">前往模型配置 →</router-link><div class="web-ai-environment"><strong>默认环境</strong><p>{{ capabilities?.default_environment?.name || '未配置' }}</p><p v-if="capabilities?.default_environment">{{capabilities.default_environment.browser}} · {{capabilities.default_environment.headless?'无头模式':'有头模式'}}</p><router-link to="/ui-automation?tab=env-config">管理环境配置 →</router-link></div></section>
 </div>
</template>
<script setup lang="ts">
import {computed,inject,ref} from 'vue'
import {IconDesktop,IconLayers,IconEye,IconApps,IconRefresh,IconBulb} from '@arco-design/web-vue/es/icon'
import {workspacePaneKey} from '@/components/workspace/workspaceContext'
import {AI_BACKEND_LABELS,type UiAIRuntimeCapabilities} from '../types'
import './web-workspace.css'
const props=defineProps<{capabilities:UiAIRuntimeCapabilities|null;loading:boolean;error?:string;summary?:string}>()
defineEmits<{refresh:[]}>()
const active=inject(workspacePaneKey,ref(true))
const icons=[IconDesktop,IconLayers,IconEye,IconApps]
const flow=[['读取页面','获取页面结构与元素'],['规划任务','理解目标与生成步骤'],['浏览器执行','在真实浏览器中操作'],['回传结果','保存执行日志与产物']]
const metrics=computed(()=>[['执行后端',props.capabilities?AI_BACKEND_LABELS[props.capabilities.execution_backend]:'—'],['当前模型',props.capabilities?.model_config_name||'未配置'],['视觉模式',props.capabilities?.vision_mode_ready?'可执行':'暂不可用'],['默认环境',props.capabilities?.default_environment?.name||'未配置']])
const checks=computed(()=>[['浏览器执行依赖',props.capabilities?.browser_use_available],['浏览器可执行文件',props.capabilities?.browser_executable_found],['LLM 模型配置',props.capabilities?.llm_configured],['文本模式',props.capabilities?.text_mode_ready],['视觉模式',props.capabilities?.vision_mode_ready]])
</script>
