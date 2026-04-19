import { getApiBaseUrl, getApiBaseUrlCandidates } from './env'

export interface AuthUserProfile {
  id: string
  nickname: string
  avatarUrl?: string | null
}

export interface AuthSession {
  token: string
  user: AuthUserProfile
}

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: WechatMiniprogram.IAnyObject
  withAuth?: boolean
  retry?: number
}

interface ApiError extends Error {
  statusCode?: number
}

const AUTH_STORAGE_KEY = 'poker-bookkeeping-auth-session'
const REQUEST_TIMEOUT_MS = 15000

const normalizeUrl = (url: string) => (url.startsWith('/') ? url : `/${url}`)

const createError = (message: string, statusCode?: number): ApiError => {
  const error = new Error(message) as ApiError
  error.statusCode = statusCode
  return error
}

const isFallbackEligibleHttpError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  const statusCode = (error as ApiError).statusCode
  if (statusCode !== 404 && !!statusCode && statusCode < 500) {
    return false
  }

  const normalizedMessage = error.message.trim().toLowerCase()
  return (
    normalizedMessage === 'not found' ||
    normalizedMessage.includes('cannot post') ||
    normalizedMessage.includes('function invoke failed') ||
    normalizedMessage.includes('internal server error')
  )
}

export const getStoredSession = (): AuthSession | null => {
  const session = wx.getStorageSync(AUTH_STORAGE_KEY) as AuthSession | ''
  if (!session || typeof session !== 'object' || !('token' in session) || !('user' in session)) {
    return null
  }
  return session
}

export const setStoredSession = (session: AuthSession) => {
  wx.setStorageSync(AUTH_STORAGE_KEY, session)
}

export const clearStoredSession = () => {
  wx.removeStorageSync(AUTH_STORAGE_KEY)
}

const sendRequest = <T>(
  requestUrl: string,
  options: RequestOptions,
  session: AuthSession | null,
): Promise<T> =>
  new Promise((resolve, reject) => {
    wx.request({
      url: requestUrl,
      method: options.method || 'GET',
      data: options.data,
      timeout: REQUEST_TIMEOUT_MS,
      header: {
        'content-type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      success: (response) => {
        const { statusCode, data } = response
        const payload = data as { message?: string | string[]; statusCode?: number }
        const payloadStatusCode =
          typeof payload?.statusCode === 'number' ? payload.statusCode : undefined

        if (
          statusCode >= 200 &&
          statusCode < 300 &&
          (!payloadStatusCode || payloadStatusCode < 400)
        ) {
          resolve(data as T)
          return
        }

        const message = Array.isArray(payload?.message)
          ? payload.message.join(', ')
          : payload?.message || '请求失败，请稍后重试'

        reject(createError(message, payloadStatusCode || statusCode))
      },
      fail: (error) => {
        reject(error)
      },
    })
  })

export const request = <T>(options: RequestOptions): Promise<T> =>
  new Promise((resolve, reject) => {
    const session = options.withAuth ? getStoredSession() : null
    const candidateBaseUrls = getApiBaseUrlCandidates()
    const requestedPath = normalizeUrl(options.url)
    const method = options.method || 'GET'
    const maxRetry = typeof options.retry === 'number' ? options.retry : method === 'GET' ? 1 : 0

    const tryRequest = async (index: number, retryCount = 0): Promise<void> => {
      const baseUrl = candidateBaseUrls[index] || getApiBaseUrl()
      const requestUrl = `${baseUrl}${requestedPath}`
      console.info('[api] request start', {
        url: requestUrl,
        method,
        retryCount,
        withAuth: !!session,
      })

      try {
        const result = await sendRequest<T>(requestUrl, options, session)
        console.info('[api] request success', {
          url: requestUrl,
          method,
        })
        resolve(result)
      } catch (error) {
        const hasNextCandidate = index < candidateBaseUrls.length - 1
        const isNetworkFailure =
          !!error && typeof error === 'object' && ('errMsg' in error || 'errno' in error)
        const shouldFallbackForHttpError = isFallbackEligibleHttpError(error)
        const shouldRetryCurrentBase =
          retryCount < maxRetry && (isNetworkFailure || shouldFallbackForHttpError)

        if (shouldRetryCurrentBase) {
          console.warn('[api] transient request failure, retrying current base url', {
            url: requestUrl,
            method,
            retryCount: retryCount + 1,
            error,
          })
          await tryRequest(index, retryCount + 1)
          return
        }

        if ((isNetworkFailure || shouldFallbackForHttpError) && hasNextCandidate) {
          const nextBaseUrl = candidateBaseUrls[index + 1]
          console.warn(`[api] ${baseUrl} 不可用或路由不存在，自动切换到 ${nextBaseUrl}`, {
            error,
          })
          await tryRequest(index + 1, 0)
          return
        }

        console.error('[api] 请求失败', {
          url: requestUrl,
          method,
          retryCount,
          error,
        })

        if (error instanceof Error) {
          reject(error)
          return
        }

        reject(createError(`网络连接失败，请检查接口地址或后端服务：${baseUrl}`))
      }
    }

    void tryRequest(0)
  })
