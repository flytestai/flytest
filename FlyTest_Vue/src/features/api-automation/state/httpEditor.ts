import type {
  ApiAssertionSpec,
  ApiAuthSpec,
  ApiBodyMode,
  ApiExtractorSpec,
  ApiFileSpec,
  ApiHttpEditorModel,
  ApiNamedValueSpec,
  ApiRequest,
  ApiRequestForm,
  ApiRequestSpecPayload,
  ApiTestCase,
  ApiTestCaseOverrideSpecPayload,
  ApiTransportSpec,
} from '../types'

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const stringifyJson = (value: any, fallback = '{}') => {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

const parseJsonText = <T>(text: string, fallback: T): T => {
  if (!text.trim()) return fallback
  return JSON.parse(text) as T
}

export const createNamedValueSpec = (overrides: Partial<ApiNamedValueSpec> = {}): ApiNamedValueSpec => ({
  name: '',
  value: '',
  enabled: true,
  order: 0,
  ...overrides,
})

export const createFileSpec = (overrides: Partial<ApiFileSpec> = {}): ApiFileSpec => ({
  field_name: '',
  source_type: 'path',
  file_path: '',
  file_name: '',
  content_type: '',
  base64_content: '',
  enabled: true,
  order: 0,
  ...overrides,
})

export const createRequestAuthSpec = (overrides: Partial<ApiAuthSpec> = {}): ApiAuthSpec => ({
  auth_type: 'none',
  username: '',
  password: '',
  token_value: '',
  token_variable: 'token',
  header_name: 'Authorization',
  bearer_prefix: 'Bearer',
  api_key_name: '',
  api_key_in: 'header',
  api_key_value: '',
  cookie_name: '',
  bootstrap_request_id: null,
  bootstrap_request_name: '',
  bootstrap_token_path: '',
  ...overrides,
})

export const createOverrideAuthSpec = (overrides: Partial<ApiAuthSpec> = {}): ApiAuthSpec => ({
  auth_type: '',
  username: '',
  password: '',
  token_value: '',
  token_variable: '',
  header_name: '',
  bearer_prefix: '',
  api_key_name: '',
  api_key_in: '',
  api_key_value: '',
  cookie_name: '',
  bootstrap_request_id: null,
  bootstrap_request_name: '',
  bootstrap_token_path: '',
  ...overrides,
})

export const createRequestTransportSpec = (overrides: Partial<ApiTransportSpec> = {}): ApiTransportSpec => ({
  verify_ssl: true,
  proxy_url: '',
  client_cert: '',
  client_key: '',
  follow_redirects: true,
  retry_count: 0,
  retry_interval_ms: 500,
  ...overrides,
})

export const createOverrideTransportSpec = (overrides: Partial<ApiTransportSpec> = {}): ApiTransportSpec => ({
  verify_ssl: null,
  proxy_url: '',
  client_cert: '',
  client_key: '',
  follow_redirects: null,
  retry_count: null,
  retry_interval_ms: null,
  ...overrides,
})

export const createAssertionSpec = (overrides: Partial<ApiAssertionSpec> = {}): ApiAssertionSpec => ({
  assertion_type: 'status_code',
  target: 'body',
  selector: '',
  operator: 'equals',
  expected_text: '',
  expected_number: 200,
  expected_json: {},
  expected_json_text: '{}',
  min_value: null,
  max_value: null,
  schema_text: '',
  enabled: true,
  order: 0,
  ...overrides,
})

export const createExtractorSpec = (overrides: Partial<ApiExtractorSpec> = {}): ApiExtractorSpec => ({
  source: 'json_path',
  selector: '',
  variable_name: '',
  default_value: '',
  required: false,
  enabled: true,
  order: 0,
  ...overrides,
})

export const createEmptyHttpEditorModel = (overrides: Partial<ApiHttpEditorModel> = {}): ApiHttpEditorModel => ({
  method: 'GET',
  url: '',
  body_mode: 'none',
  timeout_ms: 30000,
  headers: [],
  query: [],
  cookies: [],
  form_fields: [],
  multipart_parts: [],
  files: [],
  auth: createRequestAuthSpec(),
  transport: createRequestTransportSpec(),
  assertions: [createAssertionSpec()],
  extractors: [],
  body_json_text: '{}',
  raw_text: '',
  xml_text: '',
  binary_base64: '',
  graphql_query: '',
  graphql_operation_name: '',
  graphql_variables_text: '{}',
  ...overrides,
})

const normalizeNamedItems = (items?: ApiNamedValueSpec[] | Record<string, any> | null) => {
  if (Array.isArray(items)) {
    return items.map((item, index) =>
      createNamedValueSpec({
        id: item.id,
        name: item.name || '',
        value: item.value ?? '',
        enabled: item.enabled ?? true,
        order: item.order ?? index,
      })
    )
  }
  if (items && typeof items === 'object') {
    return Object.entries(items).map(([name, value], index) =>
      createNamedValueSpec({
        name,
        value,
        enabled: true,
        order: index,
      })
    )
  }
  return []
}

const normalizeFiles = (items?: ApiFileSpec[] | null) => {
  if (!Array.isArray(items)) return []
  return items.map((item, index) =>
    createFileSpec({
      ...item,
      enabled: item.enabled ?? true,
      order: item.order ?? index,
    })
  )
}

const normalizeAssertions = (items?: ApiAssertionSpec[] | Array<Record<string, any>> | null) => {
  if (!Array.isArray(items) || !items.length) {
    return [createAssertionSpec()]
  }
  return items.map((item, index) =>
    createAssertionSpec({
      ...item,
      enabled: item.enabled ?? true,
      order: item.order ?? index,
      expected_json_text: stringifyJson(item.expected_json, '{}'),
    })
  )
}

const normalizeExtractors = (items?: ApiExtractorSpec[] | null) => {
  if (!Array.isArray(items)) return []
  return items.map((item, index) =>
    createExtractorSpec({
      ...item,
      enabled: item.enabled ?? true,
      order: item.order ?? index,
    })
  )
}

const requestBodyToEditorState = (bodyType: string, body: any) => {
  const body_mode = (bodyType || 'none') as ApiBodyMode
  return {
    body_mode,
    body_json_text: body_mode === 'json' ? stringifyJson(body, '{}') : '{}',
    raw_text: body_mode === 'raw' ? String(body ?? '') : '',
  }
}

const overrideFromLegacyScript = (testCase: ApiTestCase): ApiTestCaseOverrideSpecPayload => {
  const script = testCase.script || {}
  const overrides = script?.request_overrides && typeof script.request_overrides === 'object' ? script.request_overrides : {}
  const bodyType = String(overrides.body_type || '')
  const body = overrides.body
  const bodyState = requestBodyToEditorState(bodyType, body)
  return {
    method: String(overrides.method || testCase.request_method || 'GET'),
    url: String(overrides.url || testCase.request_url || ''),
    body_mode: bodyState.body_mode,
    body_json: bodyState.body_mode === 'json' ? parseJsonText(bodyState.body_json_text, {}) : {},
    raw_text: bodyState.raw_text,
    xml_text: '',
    binary_base64: '',
    graphql_query: '',
    graphql_operation_name: '',
    graphql_variables: {},
    timeout_ms: Number(overrides.timeout_ms || 30000),
    headers: normalizeNamedItems(overrides.headers || {}),
    query: normalizeNamedItems(overrides.params || {}),
    cookies: [],
    form_fields: bodyState.body_mode === 'form' ? normalizeNamedItems(body || {}) : [],
    multipart_parts: [],
    files: [],
    auth: createOverrideAuthSpec(),
    transport: createOverrideTransportSpec(),
  }
}

export const requestToHttpEditorModel = (request?: ApiRequest | null): ApiHttpEditorModel => {
  if (!request) return createEmptyHttpEditorModel()

  const spec = request.request_spec || {
    method: request.method,
    url: request.url,
    body_mode: (request.body_type || 'none') as ApiBodyMode,
    body_json: request.body_type === 'json' ? request.body || {} : {},
    raw_text: request.body_type === 'raw' ? String(request.body ?? '') : '',
    xml_text: '',
    binary_base64: '',
    graphql_query: '',
    graphql_operation_name: '',
    graphql_variables: {},
    timeout_ms: request.timeout_ms || 30000,
    headers: normalizeNamedItems(request.headers),
    query: normalizeNamedItems(request.params),
    cookies: [],
    form_fields: request.body_type === 'form' ? normalizeNamedItems(request.body || {}) : [],
    multipart_parts: [],
    files: [],
    auth: createRequestAuthSpec(),
    transport: createRequestTransportSpec(),
  }

  return createEmptyHttpEditorModel({
    method: spec.method || request.method,
    url: spec.url || request.url,
    body_mode: spec.body_mode || 'none',
    timeout_ms: spec.timeout_ms || request.timeout_ms || 30000,
    headers: normalizeNamedItems(spec.headers),
    query: normalizeNamedItems(spec.query),
    cookies: normalizeNamedItems(spec.cookies),
    form_fields: normalizeNamedItems(spec.form_fields),
    multipart_parts: normalizeNamedItems(spec.multipart_parts),
    files: normalizeFiles(spec.files),
    auth: createRequestAuthSpec(spec.auth || {}),
    transport: createRequestTransportSpec(spec.transport || {}),
    assertions: normalizeAssertions(request.assertion_specs || request.assertions),
    extractors: normalizeExtractors(request.extractor_specs),
    body_json_text: stringifyJson(spec.body_json, '{}'),
    raw_text: spec.raw_text || '',
    xml_text: spec.xml_text || '',
    binary_base64: spec.binary_base64 || '',
    graphql_query: spec.graphql_query || '',
    graphql_operation_name: spec.graphql_operation_name || '',
    graphql_variables_text: stringifyJson(spec.graphql_variables, '{}'),
  })
}

export const requestFormToHttpEditorModel = (form: ApiRequestForm): ApiHttpEditorModel => {
  const bodyState = requestBodyToEditorState(form.body_type, form.body)
  return createEmptyHttpEditorModel({
    method: form.method,
    url: form.url,
    body_mode: bodyState.body_mode,
    timeout_ms: form.timeout_ms || 30000,
    headers: normalizeNamedItems(form.headers || {}),
    query: normalizeNamedItems(form.params || {}),
    form_fields: form.body_type === 'form' ? normalizeNamedItems(form.body || {}) : [],
    assertions: normalizeAssertions(form.assertions as ApiAssertionSpec[]),
    body_json_text: bodyState.body_mode === 'json' ? stringifyJson(form.body, '{}') : '{}',
    raw_text: bodyState.raw_text,
  })
}

export const testCaseToHttpEditorModel = (testCase?: ApiTestCase | null): ApiHttpEditorModel => {
  if (!testCase) {
    return createEmptyHttpEditorModel({
      auth: createOverrideAuthSpec(),
      transport: createOverrideTransportSpec(),
      assertions: [createAssertionSpec()],
    })
  }

  const spec = testCase.request_override_spec || overrideFromLegacyScript(testCase)
  return createEmptyHttpEditorModel({
    method: spec.method || testCase.request_method || 'GET',
    url: spec.url || testCase.request_url || '',
    body_mode: spec.body_mode || 'none',
    timeout_ms: spec.timeout_ms || 30000,
    headers: normalizeNamedItems(spec.headers),
    query: normalizeNamedItems(spec.query),
    cookies: normalizeNamedItems(spec.cookies),
    form_fields: normalizeNamedItems(spec.form_fields),
    multipart_parts: normalizeNamedItems(spec.multipart_parts),
    files: normalizeFiles(spec.files),
    auth: createOverrideAuthSpec(spec.auth || {}),
    transport: createOverrideTransportSpec(spec.transport || {}),
    assertions: normalizeAssertions(testCase.assertion_specs || testCase.assertions),
    extractors: normalizeExtractors(testCase.extractor_specs),
    body_json_text: stringifyJson(spec.body_json, '{}'),
    raw_text: spec.raw_text || '',
    xml_text: spec.xml_text || '',
    binary_base64: spec.binary_base64 || '',
    graphql_query: spec.graphql_query || '',
    graphql_operation_name: spec.graphql_operation_name || '',
    graphql_variables_text: stringifyJson(spec.graphql_variables, '{}'),
  })
}

const normalizeNamedItemsForSubmit = (items: ApiNamedValueSpec[]) =>
  items
    .map((item, index) => ({
      id: item.id,
      name: item.name?.trim() || '',
      value: item.value ?? '',
      enabled: item.enabled ?? true,
      order: index,
    }))
    .filter(item => item.name)

const normalizeFilesForSubmit = (items: ApiFileSpec[]) =>
  items
    .map((item, index) => ({
      id: item.id,
      field_name: item.field_name?.trim() || '',
      source_type: item.source_type,
      file_path: item.file_path || '',
      file_name: item.file_name || '',
      content_type: item.content_type || '',
      base64_content: item.base64_content || '',
      enabled: item.enabled ?? true,
      order: index,
    }))
    .filter(item => item.field_name)

const normalizeAssertionsForSubmit = (items: ApiAssertionSpec[]) =>
  items
    .map((item, index) => ({
      id: item.id,
      enabled: item.enabled ?? true,
      order: index,
      assertion_type: item.assertion_type,
      target: item.target || '',
      selector: item.selector || '',
      operator: item.operator || 'equals',
      expected_text: item.expected_text || '',
      expected_number: item.expected_number ?? null,
      expected_json: parseJsonText(item.expected_json_text || stringifyJson(item.expected_json, '{}'), {}),
      min_value: item.min_value ?? null,
      max_value: item.max_value ?? null,
      schema_text: item.schema_text || '',
    }))
    .filter(item => item.assertion_type)

const normalizeExtractorsForSubmit = (items: ApiExtractorSpec[]) =>
  items
    .map((item, index) => ({
      id: item.id,
      enabled: item.enabled ?? true,
      order: index,
      source: item.source,
      selector: item.selector || '',
      variable_name: item.variable_name?.trim() || '',
      default_value: item.default_value || '',
      required: item.required ?? false,
    }))
    .filter(item => item.variable_name)

export const httpEditorModelToRequestSpec = (model: ApiHttpEditorModel): ApiRequestSpecPayload => ({
  method: model.method,
  url: model.url,
  body_mode: model.body_mode,
  body_json: model.body_mode === 'json' ? parseJsonText(model.body_json_text, {}) : {},
  raw_text: model.body_mode === 'raw' ? model.raw_text : '',
  xml_text: model.body_mode === 'xml' ? model.xml_text : '',
  binary_base64: model.body_mode === 'binary' ? model.binary_base64 : '',
  graphql_query: model.body_mode === 'graphql' ? model.graphql_query : '',
  graphql_operation_name: model.body_mode === 'graphql' ? model.graphql_operation_name : '',
  graphql_variables: model.body_mode === 'graphql' ? parseJsonText(model.graphql_variables_text, {}) : {},
  timeout_ms: Number(model.timeout_ms || 30000),
  headers: normalizeNamedItemsForSubmit(model.headers),
  query: normalizeNamedItemsForSubmit(model.query),
  cookies: normalizeNamedItemsForSubmit(model.cookies),
  form_fields: normalizeNamedItemsForSubmit(model.form_fields),
  multipart_parts: normalizeNamedItemsForSubmit(model.multipart_parts),
  files: normalizeFilesForSubmit(model.files),
  auth: cloneJson(model.auth),
  transport: cloneJson(model.transport),
})

export const httpEditorModelToTestCaseOverrideSpec = (
  model: ApiHttpEditorModel
): ApiTestCaseOverrideSpecPayload => ({
  ...httpEditorModelToRequestSpec(model),
})

export const httpEditorModelToAssertionSpecs = (model: ApiHttpEditorModel) => normalizeAssertionsForSubmit(model.assertions)

export const httpEditorModelToExtractorSpecs = (model: ApiHttpEditorModel) => normalizeExtractorsForSubmit(model.extractors)

export const bodyModeToLegacyBodyType = (bodyMode: ApiBodyMode): 'none' | 'json' | 'form' | 'raw' => {
  if (bodyMode === 'json' || bodyMode === 'graphql') return 'json'
  if (bodyMode === 'form' || bodyMode === 'urlencoded' || bodyMode === 'multipart') return 'form'
  if (bodyMode === 'none') return 'none'
  return 'raw'
}

export const requestSpecToLegacyBody = (spec: ApiRequestSpecPayload) => {
  if (spec.body_mode === 'json') {
    return spec.body_json || {}
  }
  if (spec.body_mode === 'form' || spec.body_mode === 'urlencoded') {
    return Object.fromEntries(normalizeNamedItemsForSubmit(spec.form_fields).map(item => [item.name, item.value]))
  }
  if (spec.body_mode === 'multipart') {
    return Object.fromEntries(normalizeNamedItemsForSubmit(spec.multipart_parts).map(item => [item.name, item.value]))
  }
  if (spec.body_mode === 'graphql') {
    return {
      query: spec.graphql_query || '',
      operationName: spec.graphql_operation_name || '',
      variables: spec.graphql_variables || {},
    }
  }
  if (spec.body_mode === 'xml') return spec.xml_text || ''
  if (spec.body_mode === 'binary') return spec.binary_base64 || ''
  if (spec.body_mode === 'raw') return spec.raw_text || ''
  return {}
}

export const requestSpecToLegacyHeaders = (spec: ApiRequestSpecPayload) =>
  Object.fromEntries(normalizeNamedItemsForSubmit(spec.headers).map(item => [item.name, item.value]))

export const requestSpecToLegacyParams = (spec: ApiRequestSpecPayload) =>
  Object.fromEntries(normalizeNamedItemsForSubmit(spec.query).map(item => [item.name, item.value]))
