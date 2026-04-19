export type MiniProgramEnvVersion = 'develop' | 'trial' | 'release'

export const API_BASE_URL_STORAGE_KEY = 'poker-api-base-url-override'

export const CLOUDBASE_BACKEND_HTTP_BASE_URL =
  'https://cloud1-9gh8rxwd3720ac2-9c7088062.service.tcloudbase.com/backend-http/api'

const API_BASE_URLS: Record<MiniProgramEnvVersion, string> = {
  develop: CLOUDBASE_BACKEND_HTTP_BASE_URL,
  trial: CLOUDBASE_BACKEND_HTTP_BASE_URL,
  release: CLOUDBASE_BACKEND_HTTP_BASE_URL,
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

const getStoredApiBaseUrlOverride = () => {
  const storageValue = wx.getStorageSync(API_BASE_URL_STORAGE_KEY)
  return typeof storageValue === 'string' ? storageValue.trim() : ''
}

const dedupeBaseUrls = (urls: string[]) => {
  const seen = new Set<string>()

  return urls.filter((url) => {
    if (!url || seen.has(url)) {
      return false
    }

    seen.add(url)
    return true
  })
}

export const getMiniProgramEnvVersion = (): MiniProgramEnvVersion => {
  try {
    const accountInfo = wx.getAccountInfoSync?.()
    const envVersion = accountInfo?.miniProgram?.envVersion
    return envVersion === 'trial' || envVersion === 'release' ? envVersion : 'develop'
  } catch (error) {
    return 'develop'
  }
}

export const getApiBaseUrlCandidates = () => {
  const override = getStoredApiBaseUrlOverride()
  const normalizedOverride = override ? normalizeBaseUrl(override) : ''
  const envVersion = getMiniProgramEnvVersion()
  const configuredBaseUrl = API_BASE_URLS[envVersion]
  const fallback = normalizeBaseUrl(CLOUDBASE_BACKEND_HTTP_BASE_URL)

  if (normalizedOverride) {
    return dedupeBaseUrls([
      normalizedOverride,
      configuredBaseUrl ? normalizeBaseUrl(configuredBaseUrl) : '',
      fallback,
    ])
  }

  if (configuredBaseUrl) {
    return dedupeBaseUrls([normalizeBaseUrl(configuredBaseUrl), fallback])
  }

  console.warn(`[api] ${envVersion} env has no configured base url, fallback to CloudBase ${fallback}`)
  return [fallback]
}

export const getApiBaseUrl = () => {
  const [preferredBaseUrl] = getApiBaseUrlCandidates()
  return preferredBaseUrl
}

export const setApiBaseUrlOverride = (value: string) => {
  const nextValue = value.trim()
  if (!nextValue) {
    wx.removeStorageSync(API_BASE_URL_STORAGE_KEY)
    return
  }

  wx.setStorageSync(API_BASE_URL_STORAGE_KEY, normalizeBaseUrl(nextValue))
}

export const clearApiBaseUrlOverride = () => {
  wx.removeStorageSync(API_BASE_URL_STORAGE_KEY)
}
