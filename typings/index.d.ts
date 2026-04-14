/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo
    authSession?: {
      token: string
      user: {
        id: string
        nickname: string
        avatarUrl?: string | null
      }
    } | null
    authChecked?: boolean
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback
}
