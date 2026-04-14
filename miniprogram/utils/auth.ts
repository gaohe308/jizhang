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
          reject(new Error('\u83b7\u53d6\u5fae\u4fe1\u767b\u5f55\u51ed\u8bc1\u5931\u8d25'))
          return
        }

        resolve(result.code)
      },
      fail: () => {
        reject(new Error('\u5fae\u4fe1\u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5'))
      },
    })
  })

export const loginWithWechat = async (): Promise<AuthSession> => {
  const code = await getWechatCode()
  const session = await request<AuthSession>({
    url: '/auth/login',
    method: 'POST',
    data: { code },
  })

  setStoredSession(session)
  return session
}
