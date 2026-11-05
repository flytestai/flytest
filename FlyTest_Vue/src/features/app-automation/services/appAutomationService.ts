import { request } from '@/utils/request'
import { encodeAppAutomationAssetPath } from '../utils/assetPath'
import type {
  AppAdbDetectionResult,
  AppAdbDiagnostics,
  AppAutomationSettings,
  AppComponent,
  AppComponentPackageExportPayload,
  AppComponentPackageImportResult,
  AppComponentPackage,
  AppCustomComponent,
  AppDashboardStatistics,
  AppDevice,
  AppDeviceScreenshot,
  AppElement,
  AppExecution,
  AppImageCategory,
  AppNotificationLog,
  AppPackage,
  AppRuntimeCapabilities,
  AppServiceHealth,
  AppScenePlanRequest,
  AppScenePlanResponse,
  AppStepSuggestionRequest,
  AppStepSuggestionResponse,
  AppScheduledTaskMutationPayload,
  AppScheduledTask,
  AppScheduledTaskRunResult,
  AppTestCase,
  AppTestSuite,
} from '../types'

import type {EnvironmentProfile,EnvironmentInput} from '../views/settings/environmentModels'

const APP_BASE = '/app-automation'
async function unwrap<T>(config: Record<string, unknown>): Promise<T> {
  const response = await request<T>(config as never)
  if (response.success && response.data !== undefined) {
    return response.data
  }
  throw new Error(response.error || response.message || '请求失败')
}

async function unwrapBinary(config: Record<string, unknown>): Promise<Blob> {
  const response = await request<Blob>({
    ...config,
    responseType: 'blob',
  } as never)
  if (response.success && response.data instanceof Blob) {
    return response.data
  }
  throw new Error(response.error || response.message || 'Request failed')
}

async function createBlobObjectUrl(config: Record<string, unknown>): Promise<string> {
  const blob = await unwrapBinary(config)
  return URL.createObjectURL(blob)
}

async function unwrapText(config: Record<string, unknown>): Promise<string> {
  const blob = await unwrapBinary(config)
  return blob.text()
}

export const AppAutomationService = {
  recognizeScreenshotElements(projectId: number, image: string, pageName: string) {
    const [header, encoded] = image.split(',')
    const mime = header?.match(/^data:(image\/(?:png|jpeg|webp));base64$/)?.[1]
    if (!mime || !encoded) return Promise.reject(new Error('截图格式无效'))
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
    const data = new FormData()
    data.append('project_id', String(projectId)); data.append('page_name', pageName)
    data.append('screenshot', new Blob([bytes], {type:mime}), 'screenshot.' + (mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]))
    return unwrap<{ elements: Array<Omit<AppElement, 'id' | 'updated_at'>>; width: number; height: number; model: string }>({ url: '/lg/element-recognition/', method: 'POST', timeout: 120000, data })
  },
  getHealthStatus() {
    return unwrap<AppServiceHealth>({
      url: `${APP_BASE}/health`,
      method: 'GET',
    })
  },

  getDashboardStatistics(projectId?: number) {
    return unwrap<AppDashboardStatistics>({
      url: `${APP_BASE}/dashboard/statistics/`,
      method: 'GET',
      params: projectId ? { project_id: projectId } : undefined,
    })
  },

  getDevices(params?: { search?: string; status?: string }) {
    return unwrap<AppDevice[]>({
      url: `${APP_BASE}/devices/`,
      method: 'GET',
      params,
    })
  },

  captureDeviceScreenshot(id: number) {
    return unwrap<AppDeviceScreenshot>({
      url: `${APP_BASE}/devices/${id}/screenshot/`,
      method: 'POST',
    })
  },

  discoverDevices() {
    return unwrap<AppDevice[]>({
      url: `${APP_BASE}/devices/discover/`,
      method: 'GET',
    })
  },

  connectDevice(payload: { ip_address: string; port: number }) {
    return unwrap<AppDevice>({
      url: `${APP_BASE}/devices/connect/`,
      method: 'POST',
      data: payload,
    })
  },

  lockDevice(id: number, userName: string) {
    return unwrap<AppDevice>({
      url: `${APP_BASE}/devices/${id}/lock/`,
      method: 'POST',
      params: { user_name: userName },
    })
  },

  unlockDevice(id: number) {
    return unwrap<AppDevice>({
      url: `${APP_BASE}/devices/${id}/unlock/`,
      method: 'POST',
    })
  },

  disconnectDevice(id: number) {
    return unwrap<AppDevice>({
      url: `${APP_BASE}/devices/${id}/disconnect/`,
      method: 'POST',
    })
  },

  updateDevice(
    id: number,
    payload: {
      name?: string
      description?: string
      location?: string
      status?: string
    },
  ) {
    return unwrap<AppDevice>({
      url: `${APP_BASE}/devices/${id}/`,
      method: 'PATCH',
      data: payload,
    })
  },

  deleteDevice(id: number) {
    return unwrap<void>({
      url: `${APP_BASE}/devices/${id}/`,
      method: 'DELETE',
    })
  },

  getPackages(projectId: number, search?: string) {
    return unwrap<AppPackage[]>({
      url: `${APP_BASE}/packages/`,
      method: 'GET',
      params: { project_id: projectId, search },
    })
  },

  getPackageCapabilities() {
    return unwrap<{ files: boolean; formats: string[]; install_formats: string[]; max_bytes: number }>({ url: `${APP_BASE}/packages/capabilities/`, method: 'GET' })
  },
  uploadPackageFile(id: number, file: File, versionName: string, versionCode: string, onProgress?: (percent: number) => void) {
    const data = new FormData(); data.append('file', file)
    return unwrap<Partial<AppPackage>>({ url: `${APP_BASE}/packages/${id}/upload/`, method: 'POST', data, params: { version_name: versionName, version_code: versionCode }, timeout: 300000, onUploadProgress: (event: { loaded: number; total?: number }) => { if (event.total) onProgress?.(Math.round(event.loaded / event.total * 100)) } })
  },
  downloadPackageFile(id: number) {
    return unwrapBinary({ url: `${APP_BASE}/packages/${id}/download/`, method: 'GET', timeout: 300000 })
  },
  getPackageInstallations(id: number) {
    return unwrap<Partial<AppPackage>>({ url: `${APP_BASE}/packages/${id}/installations/`, method: 'GET' })
  },
  installPackageFile(id: number, deviceId: number) {
    return unwrap<import('../types').AppPackageInstallation>({ url: `${APP_BASE}/packages/${id}/install/`, method: 'POST', params: { device_id: deviceId }, timeout: 210000 })
  },

  createPackage(payload: Omit<AppPackage, 'id' | 'created_at' | 'updated_at'>) {
    return unwrap<AppPackage>({
      url: `${APP_BASE}/packages/`,
      method: 'POST',
      data: payload,
    })
  },

  updatePackage(id: number, payload: Omit<AppPackage, 'id' | 'created_at' | 'updated_at'>) {
    return unwrap<AppPackage>({
      url: `${APP_BASE}/packages/${id}/`,
      method: 'PUT',
      data: payload,
    })
  },

  deletePackage(id: number) {
    return unwrap<void>({
      url: `${APP_BASE}/packages/${id}/`,
      method: 'DELETE',
    })
  },

  getElements(projectId: number, search?: string, elementType?: string) {
    return unwrap<AppElement[]>({
      url: `${APP_BASE}/elements/`,
      method: 'GET',
      params: { project_id: projectId, search, element_type: elementType },
    })
  },

  fetchElementPreviewBlobUrl(id: number) {
    return createBlobObjectUrl({
      url: `${APP_BASE}/elements/${id}/preview/`,
      method: 'GET',
    })
  },

  fetchElementAssetBlobUrl(imagePath: string) {
    const normalized = encodeAppAutomationAssetPath(imagePath)
    return createBlobObjectUrl({
      url: `${APP_BASE}/elements/assets/${normalized}`,
      method: 'GET',
    })
  },

  getElementImageCategories(projectId: number) {
    return unwrap<AppImageCategory[]>({
      url: `${APP_BASE}/elements/image-categories/`,
      method: 'GET',
      params: { project_id: projectId },
    })
  },

  createElementImageCategory(name: string, projectId: number) {
    return unwrap<{ name: string }>({
      url: `${APP_BASE}/elements/image-categories/create/`,
      method: 'POST',
      data: { name, project_id: projectId },
    })
  },

  deleteElementImageCategory(name: string, projectId: number) {
    return unwrap<void>({
      url: `${APP_BASE}/elements/image-categories/${encodeURIComponent(name)}/`,
      method: 'DELETE',
      params: { project_id: projectId },
    })
  },

  uploadElementAsset(file: File, projectId: number, category = 'common', elementId?: number) {
    const formData = new FormData()
    formData.append('file', file)

    return unwrap<{
      project_id: number
      image_path: string
      file_hash: string
      image_category: string
      duplicate: boolean
      url?: string
      existing_element?: { id: number; name: string; image_path: string }
    }>({
      url: `${APP_BASE}/elements/upload/`,
      method: 'POST',
      params: {
        project_id: projectId,
        category,
        element_id: elementId,
      },
      data: formData,
    })
  },

  createElement(payload: Omit<AppElement, 'id' | 'updated_at'>) {
    return unwrap<AppElement>({
      url: `${APP_BASE}/elements/`,
      method: 'POST',
      data: payload,
    })
  },

  updateElement(id: number, payload: Omit<AppElement, 'id' | 'updated_at'>) {
    return unwrap<AppElement>({
      url: `${APP_BASE}/elements/${id}/`,
      method: 'PUT',
      data: payload,
    })
  },

  deleteElement(id: number) {
    return unwrap<void>({
      url: `${APP_BASE}/elements/${id}/`,
      method: 'DELETE',
    })
  },

  getTestCases(projectId: number, search?: string) {
    return unwrap<AppTestCase[]>({
      url: `${APP_BASE}/test-cases/`,
      method: 'GET',
      params: { project_id: projectId, search },
    })
  },

  getTestCase(id: number) {
    return unwrap<AppTestCase>({
      url: `${APP_BASE}/test-cases/${id}/`,
      method: 'GET',
    })
  },

  generateScenePlan(payload: AppScenePlanRequest) {
    return unwrap<AppScenePlanResponse>({
      url: `${APP_BASE}/ai/scene-plan/`,
      method: 'POST',
      data: payload,
    })
  },

  suggestStep(payload: AppStepSuggestionRequest) {
    return unwrap<AppStepSuggestionResponse>({
      url: `${APP_BASE}/ai/step-suggestion/`,
      method: 'POST',
      data: payload,
    })
  },

  createTestCase(payload: Omit<AppTestCase, 'id' | 'last_result' | 'last_run_at' | 'updated_at'>) {
    return unwrap<AppTestCase>({
      url: `${APP_BASE}/test-cases/`,
      method: 'POST',
      data: payload,
    })
  },

  updateTestCase(id: number, payload: Omit<AppTestCase, 'id' | 'last_result' | 'last_run_at' | 'updated_at'>) {
    return unwrap<AppTestCase>({
      url: `${APP_BASE}/test-cases/${id}/`,
      method: 'PUT',
      data: payload,
    })
  },

  deleteTestCase(id: number) {
    return unwrap<void>({
      url: `${APP_BASE}/test-cases/${id}/`,
      method: 'DELETE',
    })
  },

  executeTestCase(
    id: number,
    payload: { device_id: number; package_id?: number | null; trigger_mode: string; triggered_by: string },
  ) {
    return unwrap<AppExecution>({
      url: `${APP_BASE}/test-cases/${id}/execute/`,
      method: 'POST',
      data: payload,
    })
  },

  getExecutions(projectId: number, status?: string, search?: string, testSuiteId?: number) {
    return unwrap<AppExecution[]>({
      url: `${APP_BASE}/executions/`,
      method: 'GET',
      params: { project_id: projectId, status, search, test_suite_id: testSuiteId },
    })
  },

  getExecutionDetail(id: number) {
    return unwrap<AppExecution>({
      url: `${APP_BASE}/executions/${id}/`,
      method: 'GET',
    })
  },

  fetchExecutionReportText(id: number) {
    return unwrapText({
      url: `${APP_BASE}/executions/${id}/report/`,
      method: 'GET',
    })
  },

  fetchExecutionReportAssetBlobUrl(id: number, filePath: string) {
    const normalized = encodeAppAutomationAssetPath(filePath)
    return createBlobObjectUrl({
      url: `${APP_BASE}/executions/${id}/report/${normalized}`,
      method: 'GET',
    })
  },

  stopExecution(id: number) {
    return unwrap<AppExecution>({
      url: `${APP_BASE}/executions/${id}/stop/`,
      method: 'POST',
    })
  },

  deleteExecution(id: number) {
    return unwrap<void>({
      url: `${APP_BASE}/executions/${id}/`,
      method: 'DELETE',
    })
  },

  getComponents() {
    return unwrap<AppComponent[]>({
      url: `${APP_BASE}/components/`,
      method: 'GET',
    })
  },

  createComponent(payload: Omit<AppComponent, 'id' | 'updated_at'>) {
    return unwrap<AppComponent>({
      url: `${APP_BASE}/components/`,
      method: 'POST',
      data: payload,
    })
  },

  getCustomComponents() {
    return unwrap<AppCustomComponent[]>({
      url: `${APP_BASE}/custom-components/`,
      method: 'GET',
    })
  },

  createCustomComponent(payload: Omit<AppCustomComponent, 'id' | 'updated_at'>) {
    return unwrap<AppCustomComponent>({
      url: `${APP_BASE}/custom-components/`,
      method: 'POST',
      data: payload,
    })
  },

  updateCustomComponent(id: number, payload: Omit<AppCustomComponent, 'id' | 'updated_at'>) {
    return unwrap<AppCustomComponent>({
      url: `${APP_BASE}/custom-components/${id}/`,
      method: 'PUT',
      data: payload,
    })
  },

  deleteCustomComponent(id: number) {
    return unwrap<void>({
      url: `${APP_BASE}/custom-components/${id}/`,
      method: 'DELETE',
    })
  },

  getComponentPackages() {
    return unwrap<AppComponentPackage[]>({
      url: `${APP_BASE}/component-packages/`,
      method: 'GET',
    })
  },

  createComponentPackage(payload: Omit<AppComponentPackage, 'id' | 'updated_at'>) {
    return unwrap<AppComponentPackage>({
      url: `${APP_BASE}/component-packages/`,
      method: 'POST',
      data: payload,
    })
  },

  importComponentPackage(file: File, overwrite = true) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('overwrite', overwrite ? '1' : '0')

    return unwrap<AppComponentPackageImportResult>({
      url: `${APP_BASE}/component-packages/import/`,
      method: 'POST',
      data: formData,
    })
  },

  exportComponentPackage(params?: {
    export_format?: 'json' | 'yaml'
    include_disabled?: boolean
    name?: string
    version?: string
    author?: string
    description?: string
  }) {
    return unwrap<AppComponentPackageExportPayload>({
      url: `${APP_BASE}/component-packages/export/`,
      method: 'GET',
      params: {
        export_format: params?.export_format || 'yaml',
        include_disabled: params?.include_disabled ? 1 : 0,
        name: params?.name,
        version: params?.version,
        author: params?.author,
        description: params?.description,
      },
    })
  },

  deleteComponentPackage(id: number) {
    return unwrap<void>({
      url: `${APP_BASE}/component-packages/${id}/`,
      method: 'DELETE',
    })
  },

  getSuiteCapabilities() { return unwrap<{metadata:boolean;parallel:boolean;max_devices:number}>({url:`${APP_BASE}/test-suites/capabilities/`,method:'GET'}) },
  runSuiteParallel(id:number, payload:{device_ids:number[];package_name?:string;triggered_by:string}) { return unwrap<{suite_id:number;execution_ids:number[];test_case_count:number}>({url:`${APP_BASE}/test-suites/${id}/run-parallel/`,method:'POST',data:payload}) },
  planScheduledTask(payload:{project_id:number;prompt:string}) { return unwrap<{name:string;description:string;trigger_type:'CRON'|'INTERVAL';cron_expression:string;interval_seconds:number}>({url:'/lg/task-planning/',method:'POST',data:payload,timeout:60000}) },
  planSuite(payload:{project_id:number;prompt:string;cases:Array<{id:number;name:string;description:string;tags:string[]}>}) { return unwrap<{name:string;description:string;test_case_ids:number[]}>({url:'/lg/suite-planning/',method:'POST',data:payload,timeout:60000}) },
  getTestSuites(projectId: number, search?: string) {
    return unwrap<AppTestSuite[]>({
      url: `${APP_BASE}/test-suites/`,
      method: 'GET',
      params: { project_id: projectId, search },
    })
  },

  getTestSuite(id: number) {
    return unwrap<AppTestSuite>({
      url: `${APP_BASE}/test-suites/${id}/`,
      method: 'GET',
    })
  },

  createTestSuite(payload: { project_id: number; name: string; description: string; test_case_ids: number[]; group?: string; execution_strategy?: string }, createdBy?: string) {
    return unwrap<AppTestSuite>({
      url: `${APP_BASE}/test-suites/`,
      method: 'POST',
      data: payload,
      params: createdBy ? {created_by: createdBy} : undefined,
    })
  },

  updateTestSuite(id: number, payload: { project_id: number; name: string; description: string; test_case_ids: number[]; group?: string; execution_strategy?: string }) {
    return unwrap<AppTestSuite>({
      url: `${APP_BASE}/test-suites/${id}/`,
      method: 'PUT',
      data: payload,
    })
  },

  deleteTestSuite(id: number) {
    return unwrap<void>({
      url: `${APP_BASE}/test-suites/${id}/`,
      method: 'DELETE',
    })
  },

  runTestSuite(id: number, payload: { device_id: number; package_name?: string; triggered_by: string }) {
    return unwrap<{ suite_id: number; execution_ids: number[]; test_case_count: number }>({
      url: `${APP_BASE}/test-suites/${id}/run/`,
      method: 'POST',
      data: payload,
    })
  },

  getTestSuiteExecutions(id: number) {
    return unwrap<AppExecution[]>({
      url: `${APP_BASE}/test-suites/${id}/executions/`,
      method: 'GET',
    })
  },

  getScheduledTasks(projectId: number, params?: { search?: string; status?: string; task_type?: string; trigger_type?: string }) {
    return unwrap<AppScheduledTask[]>({
      url: `${APP_BASE}/scheduled-tasks/`,
      method: 'GET',
      params: { project_id: projectId, ...params },
    })
  },

  getScheduledTask(id: number) {
    return unwrap<AppScheduledTask>({
      url: `${APP_BASE}/scheduled-tasks/${id}/`,
      method: 'GET',
    })
  },

  createScheduledTask(payload: AppScheduledTaskMutationPayload) {
    return unwrap<AppScheduledTask>({
      url: `${APP_BASE}/scheduled-tasks/`,
      method: 'POST',
      data: payload,
    })
  },

  updateScheduledTask(id: number, payload: AppScheduledTaskMutationPayload) {
    return unwrap<AppScheduledTask>({
      url: `${APP_BASE}/scheduled-tasks/${id}/`,
      method: 'PUT',
      data: payload,
    })
  },

  deleteScheduledTask(id: number) {
    return unwrap<void>({
      url: `${APP_BASE}/scheduled-tasks/${id}/`,
      method: 'DELETE',
    })
  },

  pauseScheduledTask(id: number) {
    return unwrap<AppScheduledTask>({
      url: `${APP_BASE}/scheduled-tasks/${id}/pause/`,
      method: 'POST',
    })
  },

  resumeScheduledTask(id: number) {
    return unwrap<AppScheduledTask>({
      url: `${APP_BASE}/scheduled-tasks/${id}/resume/`,
      method: 'POST',
    })
  },

  runScheduledTaskNow(id: number, triggeredBy: string) {
    return unwrap<AppScheduledTaskRunResult>({
      url: `${APP_BASE}/scheduled-tasks/${id}/run_now/`,
      method: 'POST',
      params: { triggered_by: triggeredBy },
    })
  },

  getNotificationLogs(params?: {
    project_id?: number
    search?: string
    status?: string
    notification_type?: string
    task_id?: number
    start_date?: string
    end_date?: string
  }) {
    return unwrap<AppNotificationLog[]>({
      url: `${APP_BASE}/notification-logs/`,
      method: 'GET',
      params,
    })
  },

  retryNotificationLog(id: number) {
    return unwrap<AppNotificationLog>({
      url: `${APP_BASE}/notification-logs/${id}/retry/`,
      method: 'POST',
    })
  },

  async getEnvironmentCapabilities(){const response=await request<{profiles:boolean}>({url:APP_BASE+'/settings/environments/capabilities/',method:'GET'});if(response.success&&response.data)return response.data;throw Object.assign(new Error(response.error||response.message||'环境接口检测失败'),{status:(response as typeof response & {status?:number}).status})},
  getEnvironments(project_id:number){return unwrap<EnvironmentProfile[]>({url:APP_BASE+'/settings/environments/',method:'GET',params:{project_id}})},
  createEnvironment(project_id:number,data:EnvironmentInput){return unwrap<EnvironmentProfile>({url:APP_BASE+'/settings/environments/',method:'POST',params:{project_id},data})},
  updateEnvironment(project_id:number,id:string,data:EnvironmentInput){return unwrap<EnvironmentProfile>({url:APP_BASE+'/settings/environments/'+id+'/',method:'PUT',params:{project_id},data})},
  deleteEnvironment(project_id:number,id:string){return unwrap<null>({url:APP_BASE+'/settings/environments/'+id+'/',method:'DELETE',params:{project_id}})},
  batchEnvironments(project_id:number,ids:string[],enabled:boolean){return unwrap<EnvironmentProfile[]>({url:APP_BASE+'/settings/environments/batch/',method:'POST',params:{project_id},data:{ids,enabled}})},
  probeEnvironment(project_id:number,id:string){return unwrap<EnvironmentProfile>({url:APP_BASE+'/settings/environments/'+id+'/probe/',method:'POST',params:{project_id},timeout:60000})},
  importEnvironments(project_id:number,profiles:EnvironmentInput[]){return unwrap<EnvironmentProfile[]>({url:APP_BASE+'/settings/environments/import/',method:'POST',params:{project_id},data:{profiles}})},
  getSettings() {
    return unwrap<AppAutomationSettings>({
      url: `${APP_BASE}/settings/current/`,
      method: 'GET',
    })
  },

  getAdbDiagnostics() {
    return unwrap<AppAdbDiagnostics>({
      url: `${APP_BASE}/settings/diagnostics/`,
      method: 'GET',
    })
  },

  getRuntimeCapabilities() {
    return unwrap<AppRuntimeCapabilities>({
      url: `${APP_BASE}/settings/runtime-capabilities/`,
      method: 'GET',
    })
  },

  detectAdb() {
    return unwrap<AppAdbDetectionResult>({
      url: `${APP_BASE}/settings/detect-adb/`,
      method: 'POST',
    })
  },

  saveSettings(payload: AppAutomationSettings) {
    return unwrap<AppAutomationSettings>({
      url: `${APP_BASE}/settings/save/`,
      method: 'POST',
      data: payload,
    })
  },
}
