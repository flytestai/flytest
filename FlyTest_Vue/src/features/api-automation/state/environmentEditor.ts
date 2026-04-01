import type {
  ApiEnvironment,
  ApiEnvironmentCookieSpec,
  ApiEnvironmentEditorModel,
  ApiEnvironmentForm,
  ApiEnvironmentSpecPayload,
  ApiEnvironmentVariableSpec,
  ApiNamedValueSpec,
} from '../types'

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export const createEnvironmentHeaderSpec = (overrides: Partial<ApiNamedValueSpec> = {}): ApiNamedValueSpec => ({
  name: '',
  value: '',
  enabled: true,
  order: 0,
  ...overrides,
})

export const createEnvironmentVariableSpec = (
  overrides: Partial<ApiEnvironmentVariableSpec> = {}
): ApiEnvironmentVariableSpec => ({
  name: '',
  value: '',
  enabled: true,
  is_secret: false,
  order: 0,
  ...overrides,
})

export const createEnvironmentCookieSpec = (
  overrides: Partial<ApiEnvironmentCookieSpec> = {}
): ApiEnvironmentCookieSpec => ({
  name: '',
  value: '',
  domain: '',
  path: '/',
  enabled: true,
  order: 0,
  ...overrides,
})

export const createEmptyEnvironmentEditorModel = (
  overrides: Partial<ApiEnvironmentEditorModel> = {}
): ApiEnvironmentEditorModel => ({
  headers: [],
  variables: [],
  cookies: [],
  ...overrides,
})

const normalizeHeaders = (headers?: ApiNamedValueSpec[] | Record<string, any> | null): ApiNamedValueSpec[] => {
  if (Array.isArray(headers)) {
    return headers.map((item, index) =>
      createEnvironmentHeaderSpec({
        ...item,
        enabled: item.enabled ?? true,
        order: item.order ?? index,
      })
    )
  }
  if (headers && typeof headers === 'object') {
    return Object.entries(headers).map(([name, value], index) =>
      createEnvironmentHeaderSpec({
        name,
        value,
        enabled: true,
        order: index,
      })
    )
  }
  return []
}

const normalizeVariables = (
  variables?: ApiEnvironmentVariableSpec[] | Record<string, any> | null
): ApiEnvironmentVariableSpec[] => {
  if (Array.isArray(variables)) {
    return variables.map((item, index) =>
      createEnvironmentVariableSpec({
        ...item,
        enabled: item.enabled ?? true,
        is_secret: item.is_secret ?? false,
        order: item.order ?? index,
      })
    )
  }
  if (variables && typeof variables === 'object') {
    return Object.entries(variables).map(([name, value], index) =>
      createEnvironmentVariableSpec({
        name,
        value,
        enabled: true,
        is_secret: false,
        order: index,
      })
    )
  }
  return []
}

const normalizeCookies = (cookies?: ApiEnvironmentCookieSpec[] | null): ApiEnvironmentCookieSpec[] => {
  if (!Array.isArray(cookies)) return []
  return cookies.map((item, index) =>
    createEnvironmentCookieSpec({
      ...item,
      domain: item.domain || '',
      path: item.path || '/',
      enabled: item.enabled ?? true,
      order: item.order ?? index,
    })
  )
}

const normalizeEditorModel = (
  value?: Partial<ApiEnvironment> | Partial<ApiEnvironmentForm> | null
): ApiEnvironmentEditorModel => {
  const specPayload = (value?.environment_specs || {}) as Partial<ApiEnvironmentSpecPayload>
  return createEmptyEnvironmentEditorModel({
    headers: normalizeHeaders(specPayload.headers ?? value?.common_headers),
    variables: normalizeVariables(specPayload.variables ?? value?.variables),
    cookies: normalizeCookies(specPayload.cookies),
  })
}

const sortByOrder = <T extends { order?: number }>(items: T[]) =>
  [...items].sort((left, right) => (left.order ?? 0) - (right.order ?? 0))

export const environmentToEditorModel = (
  value?: Partial<ApiEnvironment> | Partial<ApiEnvironmentForm> | null
): ApiEnvironmentEditorModel => normalizeEditorModel(value)

export const environmentEditorModelToPayload = (model: ApiEnvironmentEditorModel): ApiEnvironmentSpecPayload => ({
  headers: sortByOrder(model.headers).map((item, index) =>
    createEnvironmentHeaderSpec({
      ...cloneJson(item),
      name: item.name.trim(),
      order: index,
    })
  ).filter(item => item.name),
  variables: sortByOrder(model.variables).map((item, index) =>
    createEnvironmentVariableSpec({
      ...cloneJson(item),
      name: item.name.trim(),
      order: index,
    })
  ).filter(item => item.name),
  cookies: sortByOrder(model.cookies).map((item, index) =>
    createEnvironmentCookieSpec({
      ...cloneJson(item),
      name: item.name.trim(),
      path: item.path || '/',
      order: index,
    })
  ).filter(item => item.name),
})

export const environmentEditorModelToHeaderMap = (model: ApiEnvironmentEditorModel): Record<string, any> => {
  return environmentEditorModelToPayload(model).headers.reduce<Record<string, any>>((acc, item) => {
    if (item.enabled === false) return acc
    acc[item.name] = item.value
    return acc
  }, {})
}

export const environmentEditorModelToVariableMap = (model: ApiEnvironmentEditorModel): Record<string, any> => {
  return environmentEditorModelToPayload(model).variables.reduce<Record<string, any>>((acc, item) => {
    if (item.enabled === false) return acc
    acc[item.name] = item.value
    return acc
  }, {})
}
