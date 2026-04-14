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
}

interface ApiError extends Error {
  statusCode?: number
}

const BASE_URL = 'http://127.0.0.1:3000/api'
const AUTH_STORAGE_KEY = 'poker-bookkeeping-auth-session'

const normalizeUrl = (url: string) => (url.startsWith('/') ? url : `/${url}`)

const createError = (message: string, statusCode?: number): ApiError => {
  const error = new Error(message) as ApiError
  error.statusCode = statusCode
  return error
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

export const request = <T>(options: RequestOptions): Promise<T> =>
  new Promise((resolve, reject) => {
    const session = options.withAuth ? getStoredSession() : null

    wx.request({
      url: `${BASE_URL}${normalizeUrl(options.url)}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: 10000,
      header: {
        'content-type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      success: (response) => {
        const { statusCode, data } = response

        if (statusCode >= 200 && statusCode < 300) {
          resolve(data as T)
          return
        }

        const payload = data as { message?: string | string[] }
        const message = Array.isArray(payload?.message)
          ? payload.message.join(', ')
          : payload?.message || '\u8bf7\u6c42\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5'

        reject(createError(message, statusCode))
      },
      fail: () => {
        reject(createError('\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\uff0c\u8bf7\u786e\u8ba4\u672c\u5730\u540e\u7aef\u5df2\u542f\u52a8'))
      },
    })
  })
