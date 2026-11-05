<template>
  <div class="page-shell fc-page app-devices-page">
    <DevicesReferenceWorkspace
      :devices="devices"
      :loading="loading"
      :load-error="loadError"
      :auto-refresh-enabled="autoRefreshEnabled"
      :last-updated-text="lastUpdatedText"
      :screenshot-loading-id="screenshotLoadingId"
      :can-lock="canLock"
      :can-unlock="canUnlock"
      :can-reconnect="canReconnect"
      :can-disconnect="canDisconnect"
      @refresh="loadData()"
      @auto-refresh="toggleAutoRefresh"
      @connect="showConnectModal = true"
      @discover="discover"
      @detail="openDetail"
      @edit="openEdit"
      @screenshot="previewScreenshot"
      @lock="lock"
      @unlock="unlock"
      @reconnect="reconnect"
      @disconnect="disconnect"
      @remove="remove"
    />

    <DeviceConnectDialog
      v-model:visible="showConnectModal"
      :connect-form="connectForm"
      :connect-device="connect"
    />

    <DeviceEditDialog
      v-model:visible="editVisible"
      :edit-form="editForm"
      :edit-saving="editSaving"
      :submit-device="submitEdit"
    />

    <DeviceDetailDialog
      v-model:visible="detailVisible"
      :current-device="currentDevice"
      :format-date-time="formatDateTime"
      :get-status-label="getStatusLabel"
      :get-connection-label="getConnectionLabel"
      :format-endpoint="formatEndpoint"
    />

    <DeviceScreenshotDialog
      v-model:visible="screenshotVisible"
      :current-screenshot="currentScreenshot"
      :format-timestamp="formatTimestamp"
    />
  </div>
</template>

<script setup lang="ts">
import {
  DeviceConnectDialog,
  DeviceDetailDialog,
  DeviceEditDialog,
  DeviceScreenshotDialog,
  useAppAutomationDevices,
} from './devices'
import DevicesReferenceWorkspace from './devices/DevicesReferenceWorkspace.vue'

const {
  loading,
  loadError,
  editSaving,
  autoRefreshEnabled,
  showConnectModal,
  screenshotVisible,
  screenshotLoadingId,
  detailVisible,
  editVisible,
  currentScreenshot,
  currentDevice,
  devices,
  connectForm,
  editForm,
  lastUpdatedText,
  formatDateTime,
  formatTimestamp,
  getStatusLabel,
  getConnectionLabel,
  formatEndpoint,
  canLock,
  canUnlock,
  canReconnect,
  canDisconnect,
  loadData,
  discover,
  connect,
  openDetail,
  openEdit,
  submitEdit,
  lock,
  unlock,
  disconnect,
  reconnect,
  previewScreenshot,
  remove,
  toggleAutoRefresh,
} = useAppAutomationDevices()
</script>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding: 8px 6px 10px;
}

.page-shell :deep(.arco-card),
.page-shell :deep(.device-card),
.page-shell :deep(.stats-card) {
  border-radius: 12px;
  box-shadow: var(--theme-card-shadow);
}

.page-shell :deep(.arco-card-body) {
  padding: 20px;
}

@media (max-width: 900px) {
  .page-shell {
    gap: 16px;
    padding: 0;
  }

  .page-shell :deep(.arco-card-body) {
    padding: 18px;
  }
}
</style>

<style>
.app-automation-shell .app-devices-page { padding: 0 !important; }
</style>
