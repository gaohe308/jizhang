import { createFreshRoom, getAppState, getProfileStats, getWeeklyProfileStats } from '../../utils/mock'

interface HomePageData {
  roomId: string
  onlineCount: number
  wins: number
  totalGames: number
  totalProfit: number
  winRate: string
}

Page<HomePageData>({
  data: {
    roomId: '',
    onlineCount: 0,
    wins: 0,
    totalGames: 0,
    totalProfit: 0,
    winRate: '0.0%',
  },
  onShow() {
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
  handleCreateRoom() {
    const state = createFreshRoom()
    wx.showToast({
      title: `已创建房间 ${state.room.roomId}`,
      icon: 'none',
    })
    wx.redirectTo({
      url: '/pages/room/index',
    })
  },
  handleJoinRoom() {
    wx.redirectTo({
      url: '/pages/room/index',
    })
  },
  handleMessageTap() {
    wx.showToast({
      title: '消息中心待接入',
      icon: 'none',
    })
  },
  handleSettingTap() {
    wx.showToast({
      title: '设置能力待接入',
      icon: 'none',
    })
  },
})
