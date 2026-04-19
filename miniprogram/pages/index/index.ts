import { clearAuthSession, getAuthSession, loginWithWechat, validateSession } from '../../utils/auth'
import {
  createRoom,
  fetchMyStats,
  getCurrentRoomSnapshot,
  joinRoom,
  setCurrentRoomSnapshot,
} from '../../utils/api'

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
  loading: boolean
}

const openEditableModal = () =>
  new Promise<string | null>((resolve) => {
    wx.showModal({
      title: '加入房间',
      content: '请输入 4 位房间号',
      editable: true,
      placeholderText: '例如 8251',
      success: (result) => {
        const modalResult = result as WechatMiniprogram.ShowModalSuccessCallbackResult & { content?: string }
        if (!result.confirm) {
          resolve(null)
          return
        }

        resolve((modalResult.content || '').trim())
      },
      fail: () => resolve(null),
    } as WechatMiniprogram.ShowModalOption & { editable: boolean; placeholderText: string })
  })

const openScanCode = () =>
  new Promise<string | null>((resolve) => {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (result) => {
        const raw = (result.result || '').trim()
        const matchedCode = raw.match(/\b\d{4,16}\b/)
        resolve(matchedCode ? matchedCode[0] : raw)
      },
      fail: () => resolve(null),
    })
  })

Page<HomePageData & { pendingRoomCode?: string }>({
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
    loading: false,
    pendingRoomCode: '',
  },

  onLoad(options?: Record<string, string>) {
    if (options?.roomCode) {
      this.setData({
        pendingRoomCode: options.roomCode,
      })
    }

    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline'],
    })
  },

  async onShow() {
    const isLoggedIn = await this.ensureLoginStatus()
    if (!isLoggedIn) {
      this.resetPageData()
      return
    }

    await this.loadPageData()

    if (this.data.pendingRoomCode) {
      const roomCode = this.data.pendingRoomCode
      this.setData({ pendingRoomCode: '' })
      await this.joinRoomByCode(roomCode)
    }
  },

  resetPageData() {
    this.setData({
      roomId: '',
      onlineCount: 0,
      wins: 0,
      totalGames: 0,
      totalProfit: 0,
      winRate: '0.0%',
    })
  },

  async loadPageData() {
    this.setData({ loading: true })

    try {
      const [stats, room] = await Promise.all([fetchMyStats(), Promise.resolve(getCurrentRoomSnapshot())])

      this.setData({
        roomId: room?.roomCode || '',
        onlineCount: room ? room.members.filter((item) => item.role !== 'tea').length : 0,
        wins: stats.weekly.wins,
        totalGames: stats.weekly.totalGames,
        totalProfit: stats.totalProfit,
        winRate: stats.weekly.winRate,
        loading: false,
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({
        title: error instanceof Error ? error.message : '首页数据加载失败',
        icon: 'none',
      })
    }
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
        title: error instanceof Error ? error.message : '登录已失效，请重新登录',
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
      title: '请先完成微信登录',
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
        title: '登录成功',
        icon: 'success',
      })

      try {
        await this.loadPageData()
      } catch (error) {
        console.error('[index] post-login data load failed', error)
      }

      if (this.data.pendingRoomCode) {
        const roomCode = this.data.pendingRoomCode
        this.setData({ pendingRoomCode: '' })
        await this.joinRoomByCode(roomCode)
      }
    } catch (error) {
      this.setData({
        authLoading: false,
      })

      wx.showToast({
        title: error instanceof Error ? error.message : '登录失败，请稍后重试',
        icon: 'none',
      })
    }
  },

  async handleCreateRoom() {
    if (!this.requireAuth()) {
      return
    }

    try {
      const room = await createRoom()
      setCurrentRoomSnapshot(room)

      wx.showToast({
        title: `已创建房间 ${room.roomCode}`,
        icon: 'none',
      })

      wx.redirectTo({
        url: '/pages/room/index',
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '创建房间失败',
        icon: 'none',
      })
    }
  },

  async joinRoomByCode(roomCode: string) {
    try {
      const room = await joinRoom(roomCode)
      setCurrentRoomSnapshot(room)

      wx.showToast({
        title: `已加入房间 ${room.roomCode}`,
        icon: 'none',
      })

      wx.redirectTo({
        url: '/pages/room/index',
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '加入房间失败',
        icon: 'none',
      })
    }
  },

  async handleJoinRoom() {
    if (!this.requireAuth()) {
      return
    }

    const scannedRoomCode = await openScanCode()
    const roomCode = scannedRoomCode || (await openEditableModal())
    if (!roomCode) {
      return
    }

    await this.joinRoomByCode(roomCode)
  },
})
