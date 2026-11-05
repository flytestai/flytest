<template>
  <div class="page-shell fc-page">
    <SettingsReferenceWorkspace :project-id="projectStore.currentProjectId" :fallback="fallbackEnvironment" @executor="drawerTab='config';drawerVisible=true" @diagnostics="drawerTab='diagnostics';drawerVisible=true" @refresh="reloadAll" />
    <a-drawer v-model:visible="drawerVisible" title="全局执行器配置与诊断" :width="Math.min(1000,width-16)" :footer="false">
      <a-alert>以下 ADB、工作目录及默认超时属于全局执行器配置，会影响该服务的所有项目。环境列表为项目级配置管理。</a-alert>
      <a-tabs v-model:active-key="drawerTab"><a-tab-pane key="config" title="执行器配置">
        <SettingsEnvironmentCard :form="form" :saving="saving" :detecting="detecting" :diagnostics-loading="diagnosticsLoading" @reload-all="reloadAll" @refresh-diagnostics="loadDiagnostics(true)" @detect-adb="detectAdb" @save="save" />
      </a-tab-pane><a-tab-pane key="diagnostics" title="服务与运行诊断">
      <SettingsServiceHealthCard
        :service-health="serviceHealth"
        :diagnostics="diagnostics"
        :runtime-capabilities="runtimeCapabilities"
        :runtime-ready="runtimeReady"
        :ready-capability-count="readyCapabilityCount"
        :workspace-root="form.workspace_root"
        :default-timeout="form.default_timeout"
        :overall-status-color="overallStatusColor"
        :overall-status-label="overallStatusLabel"
        :format-time="formatTime"
        :service-health-loading="serviceHealthLoading"
        :diagnostics-loading="diagnosticsLoading"
        :runtime-loading="runtimeLoading"
        @refresh-service-health="loadServiceHealth(true)"
        @reload-all="reloadAll"
      />



      <SettingsAdbDiagnosticsCard
        :diagnostics="diagnostics"
        :status-color="statusColor"
        :status-label="statusLabel"
        :format-time="formatTime"
      />

      <SettingsRuntimeCard
        :runtime-capabilities="runtimeCapabilities"
        :runtime-ready="runtimeReady"
        :installed-dependency-count="installedDependencyCount"
        :runtime-loading="runtimeLoading"
        :format-time="formatTime"
        @refresh-runtime="loadRuntimeCapabilities(true)"
      />
      </a-tab-pane></a-tabs>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import {ref,computed} from 'vue'
import {useWindowSize} from '@vueuse/core'
import {useProjectStore} from '@/store/projectStore'
import SettingsReferenceWorkspace from './settings/SettingsReferenceWorkspace.vue'
import type {EnvironmentProfile} from './settings/environmentModels'
const projectStore=useProjectStore(),{width}=useWindowSize(),drawerVisible=ref(false),drawerTab=ref('config')

import {
  SettingsAdbDiagnosticsCard,
  SettingsEnvironmentCard,
  SettingsRuntimeCard,
  SettingsServiceHealthCard,
  useAppAutomationSettings,
} from './settings'

const {
  saving,
  detecting,
  diagnosticsLoading,
  runtimeLoading,
  serviceHealthLoading,
  form,
  diagnostics,
  runtimeCapabilities,
  serviceHealth,
  statusLabel,
  statusColor,
  installedDependencyCount,
  readyCapabilityCount,
  runtimeReady,
  overallStatusColor,
  overallStatusLabel,
  formatTime,
  loadDiagnostics,
  loadRuntimeCapabilities,
  loadServiceHealth,
  detectAdb,
  reloadAll,
  save,
} = useAppAutomationSettings()
const fallbackEnvironment=computed<EnvironmentProfile>(()=>({
  id:'global-executor',name:'当前全局执行器',kind:'executor',platform:'android',network:'intranet',device_ids:[],endpoint:'',description:'ADB、运行依赖及自动化服务的真实配置',enabled:true,
  health:!diagnostics.checked_at||!serviceHealth.checked_at?'unchecked':overallStatusColor.value==='green'?'available':overallStatusColor.value==='red'||Boolean(diagnostics.error)?'error':'unchecked',
  health_message:overallStatusLabel.value,checked_at:diagnostics.checked_at||null,updated_at:diagnostics.checked_at||serviceHealth.checked_at||''
}))

</script>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding: 0 !important;
}

.settings-hero {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 24px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background:
    var(--theme-surface);
  box-shadow: var(--theme-card-shadow);
}

.settings-hero__copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 720px;
}

.settings-hero__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--theme-accent);
}

.settings-hero__copy h3 {
  margin: 0;
  font-size: 28px;
  line-height: 1.08;
  color: var(--theme-text);
}

.settings-hero__copy p {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--theme-text-secondary);
}

.settings-hero__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(120px, 1fr));
  gap: 12px;
  min-width: 280px;
}

.settings-meta-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.16);
  background: var(--theme-surface);
}

.settings-meta-card span {
  font-size: 12px;
  color: var(--theme-text-secondary);
}

.settings-meta-card strong {
  font-size: 26px;
  line-height: 1;
  color: var(--theme-text);
}

.settings-shell {
  display: grid;
  gap: 18px;
  max-width: 980px;
}

.page-shell :deep(.arco-card) {
  border-radius: 12px;
  box-shadow: var(--theme-card-shadow);
}

.page-shell :deep(.arco-card-body) {
  padding: 20px;
}

@media (max-width: 768px) {
  .page-shell {
    gap: 16px;
    padding: 4px;
  }

  .settings-hero {
    flex-direction: column;
    padding: 20px;
    border-radius: 12px;
  }

  .settings-hero__copy h3 {
    font-size: 24px;
  }

  .settings-hero__meta {
    min-width: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .settings-shell {
    max-width: 100%;
  }

  .page-shell :deep(.arco-card-body) {
    padding: 18px;
  }
}
</style>
