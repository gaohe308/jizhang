import { clearAuthSession, getAuthSession, loginWithWechat, validateSession } from '../../utils/auth'
import { createFreshRoom, getAppState, getProfileStats, getWeeklyProfileStats } from '../../utils/mock'

interface HomePageData {
  roomId: string
  onlineCount: number
  wins: number
  totalGames: number
  totalProfit: number
  winRate: string
  authVisible: boolean
  authLoading: boolean
  authNickname: string
}

Page<HomePageData>({
  data: {
    roomId: '',
    onlineCount: 0,
    wins: 0,
    totalGames: 0,
    totalProfit: 0,
    winRate: '0.0%',
    authVisible: false,
    authLoading: false,
    authNickname: '',
  },

  async onShow() {
    await this.ensureLoginStatus()
    this.loadPageData()
  },

  loadPageData() {
    const { room } = getAppState()
    const weeklyStats = getWeeklyProfileStats()
    const profileStats = getProfileStats()

    this.setData({
      roomId: room.roomId,
      onlineCount: room.members.filter((item) => item.role !== 'tea').length,
      wins: weeklyStats.wins,
      totalGames: weeklyStats.totalGames,
      totalProfit: profileStats.totalProfit,
      winRate: weeklyStats.winRate,
    })
  },

  async ensureLoginStatus() {
    const app = getApp<IAppOption>()
    const localSession = getAuthSession()

    this.setData({
      authNickname: localSession?.user.nickname || '',
    })

    if (!localSession) {
      app.globalData.authSession = null
      app.globalData.authChecked = true
      this.setData({
        authVisible: true,
      })
      return false
    }

    try {
      const session = await validateSession()

      app.globalData.authSession = session
      app.globalData.authChecked = true

      this.setData({
        authVisible: false,
        authNickname: session?.user.nickname || '',
      })

      return true
    } catch (error) {
      clearAuthSession()
      app.globalData.authSession = null
      app.globalData.authChecked = true

      this.setData({
        authVisible: true,
      })

      wx.showToast({
        title: error instanceof Error ? error.message : '\u767b\u5f55\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55',
        icon: 'none',
      })

      return false
    }
  },

  requireAuth() {
    const session = getApp<IAppOption>().globalData.authSession
    if (session?.token) {
      return true
    }

    this.setData({
      authVisible: true,
    })

    wx.showToast({
      title: '\u8bf7\u5148\u5b8c\u6210\u5fae\u4fe1\u767b\u5f55',
      icon: 'none',
    })

    return false
  },

  async handleWechatLogin() {
    if (this.data.authLoading) {
      return
    }

    this.setData({
      authLoading: true,
    })

    try {
      const session = await loginWithWechat()
      const app = getApp<IAppOption>()

      app.globalData.authSession = session
      app.globalData.authChecked = true

      this.setData({
        authVisible: false,
        authLoading: false,
        authNickname: session.user.nickname,
      })

      wx.showToast({
        title: '\u767b\u5f55\u6210\u529f',
        icon: 'success',
      })
    } catch (error) {
      this.setData({
        authLoading: false,
      })

      wx.showToast({
        title: error instanceof Error ? error.message : '\u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5',
        icon: 'none',
      })
    }
  },

  handleCreateRoom() {
    if (!this.requireAuth()) {
      return
    }

    const state = createFreshRoom()

    wx.showToast({
      title: `\u5df2\u521b\u5efa\u623f\u95f4 ${state.room.roomId}`,
      icon: 'none',
    })

    wx.redirectTo({
      url: '/pages/room/index',
    })
  },

  handleJoinRoom() {
    if (!this.requireAuth()) {
      return
    }

    wx.redirectTo({
      url: '/pages/room/index',
    })
  },
})
