<template>
  <a-modal class="fc-dialog"
    v-model:visible="visibleModel"
    :title="form.id ? '编辑应用包' : '上传应用包'"
    :confirm-loading="submitting"
    :ok-text="selectedFile ? '保存并上传' : '保存应用信息'"
    :closable="!submitting" :mask-closable="!submitting" :esc-to-close="!submitting" :cancel-button-props="{ disabled: submitting }"
    width="640px"
    :on-before-ok="submitPackage"
  >
    <div class="dialog-shell">
      <div class="dialog-intro fc-dialog-intro">
        <span class="dialog-kicker">App Package</span>
        <strong>{{ form.id ? '更新应用信息与归档文件' : '归档应用版本，准备设备安装' }}</strong>
        <p>APK / AAB / IPA 统一管理。填写版本信息用于归档，安装状态由真实设备任务回写。</p>
      </div>
      <a-form :model="form" layout="vertical" class="dialog-form fc-form">
        <div class="form-grid">
          <div class="field-card">
            <a-form-item field="name" label="应用名称">
              <a-input v-model="form.name" placeholder="例如 Android 设置" />
            </a-form-item>
          </div>
          <div class="field-card">
            <a-form-item field="platform" label="平台">
              <a-select v-model="form.platform" placeholder="选择平台">
                <a-option value="android">Android</a-option>
                <a-option value="ios">iOS</a-option>
              </a-select>
            </a-form-item>
          </div>
        </div>
        <div class="field-card">
          <a-form-item field="package_name" label="包名">
            <a-input v-model="form.package_name" placeholder="例如 com.android.settings" />
          </a-form-item>
        </div>
        <div class="field-card">
          <a-form-item field="activity_name" label="启动 Activity">
            <a-input v-model="form.activity_name" :disabled="form.platform !== 'android'" placeholder="Android 可选，例如 .MainActivity" />
          </a-form-item>
        </div>
        <a-alert v-if="!fileSupport" type="warning" title="文件服务尚未就绪">当前运行的服务仅支持应用信息。更新 APP 服务后可上传文件、下载与安装；保存信息不会上传安装包。</a-alert>
        <div v-else class="package-file-input">
          <label for="app-package-file">安装包文件（可选）</label>
          <input id="app-package-file" :key="visibleModel ? 'open' : 'closed'" type="file" :accept="form.platform === 'ios' ? '.ipa' : '.apk,.aab'" :disabled="submitting" @change="selectFile"/>
          <strong v-if="selectedFile">{{selectedFile.name}}</strong>
          <small>支持 APK / AAB / IPA，最大 500 MB。更新文件后重新记录安装状态。AAB 需转换为 APK，IPA 需对应 iOS 驱动。</small>
          <a-progress v-if="submitting && selectedFile" :percent="uploadProgress / 100"/>
          <small v-if="submitting && selectedFile">{{ uploadProgress === 100 ? '文件已传输，正在等待服务校验与归档' : '正在上传，请勿关闭页面' }}</small>
        </div>
        <div v-if="fileSupport" class="form-grid">
          <a-form-item field="version_name" label="版本号"><a-input v-model="form.version_name" :disabled="!selectedFile || submitting" placeholder="例如 v2.6.0" :max-length="100"/></a-form-item>
          <a-form-item field="version_code" label="构建号"><a-input v-model="form.version_code" :disabled="!selectedFile || submitting" placeholder="例如 268" :max-length="64"/></a-form-item>
        </div>
        <div class="field-card">
          <a-form-item field="description" label="描述">
            <a-textarea
              v-model="form.description"
              placeholder="补充该应用包的用途、前置条件或执行时注意事项"
              :auto-size="{ minRows: 3, maxRows: 6 }"
            />
          </a-form-item>
        </div>
      </a-form>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import type { PackageEditorDialogProps } from './packageViewModels'

defineProps<PackageEditorDialogProps>()

const visibleModel = defineModel<boolean>('visible', { required: true })

const emit = defineEmits<{ 'select-file': [file: File | null] }>()
function selectFile(event: Event) { emit('select-file', (event.target as HTMLInputElement).files?.[0] || null) }
</script>

<style scoped>
.dialog-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.dialog-intro {
  padding: 18px 20px;
  border-radius: 12px;
  border: 1px solid rgba(var(--theme-accent-rgb), 0.18);
  background: var(--theme-surface);
}

.dialog-kicker {
  display: inline-block;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--theme-text-secondary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dialog-intro strong {
  display: block;
  color: var(--theme-text);
  font-size: 18px;
  line-height: 1.2;
}

.dialog-intro p {
  margin: 8px 0 0;
  color: var(--theme-text-secondary);
  line-height: 1.7;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field-card {
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid var(--theme-card-border);
  background: rgba(var(--theme-surface-rgb), 0.72);
}

.field-card :deep(.arco-form-item) {
  margin-bottom: 0;
}

.field-card :deep(.arco-input-wrapper),
.field-card :deep(.arco-select-view),
.field-card :deep(.arco-textarea-wrapper) {
  border-radius: 12px;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}

:deep(.arco-modal-title) {
  font-size: 18px;
}

:deep(.arco-modal-footer .arco-btn) {
  min-width: 96px;
  border-radius: 12px;
}
</style>
