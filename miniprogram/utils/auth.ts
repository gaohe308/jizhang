import {
  AuthSession,
  AuthUserProfile,
  clearStoredSession,
  getStoredSession,
  request,
  setStoredSession,
} from './http'

export const getAuthSession = () => getStoredSession()

export const clearAuthSession = () => {
  clearStoredSession()
}

interface RetryableAuthError extends Error {
  statusCode?: number
}

const isRetryableLoginError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  const normalizedMessage = error.message.toLowerCase()
  const statusCode = (error as RetryableAuthError).statusCode

  return (
    normalizedMessage.includes('timeout') ||
    normalizedMessage.includes('function invoke failed') ||
    normalizedMessage.includes('internal server error') ||
    statusCode === 408 ||
    !!statusCode && statusCode >= 500
  )
}

export const validateSession = async (): Promise<AuthSession | null> => {
  const session = getStoredSession()
  if (!session) {
    return null
  }

  const user = await request<AuthUserProfile>({
    url: '/users/me',
    withAuth: true,
  })

  const nextSession: AuthSession = {
    token: session.token,
    user: {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    },
  }

  setStoredSession(nextSession)
  return nextSession
}

const getWechatCode = (): Promise<string> =>
  new Promise((resolve, reject) => {
    wx.login({
      success: (result) => {
        if (!result.code) {
          reject(new Error('获取微信登录凭证失败'))
          return
        }

        resolve(result.code)
      },
      fail: () => {
        reject(new Error('微信登录失败，请稍后再试'))
      },
    })
  })

export const loginWithWechat = async (): Promise<AuthSession> => {
  let lastError: unknown

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const code = await getWechatCode()
      const session = await request<AuthSession>({
        url: '/auth/login',
        method: 'POST',
        data: { code },
      })

      setStoredSession(session)
      return session
    } catch (error) {
      lastError = error
      if (attempt >= 2 || !isRetryableLoginError(error)) {
        throw error
      }

      console.warn(`[auth] login attempt ${attempt} failed, retrying with a fresh wx.login code`, error)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('登录失败，请稍后重试')
}
