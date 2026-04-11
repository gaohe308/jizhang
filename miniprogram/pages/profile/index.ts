import { clearHistory, getAppState, getProfileStats, HistoryRecord } from '../../utils/mock'

interface ProfilePageData {
  profileName: string
  tags: string[]
  totalGames: number
  wins: number
  winRate: string
  totalProfit: number
  history: HistoryRecord[]
  clearVisible: boolean
}

Page<ProfilePageData>({
  data: {
    profileName: '',
    tags: [],
    totalGames: 0,
    wins: 0,
    winRate: '0.0%',
    totalProfit: 0,
    history: [],
    clearVisible: false,
  },
  onShow() {
    this.loadPageData()
  },
  loadPageData() {
    const state = getAppState()
    const stats = getProfileStats()
    this.setData({
      profileName: state.profileName,
      tags: state.profileTags,
      totalGames: stats.totalGames,
      wins: stats.wins,
      winRate: stats.winRate,
      totalProfit: stats.totalProfit,
      history: state.history,
    })
  },
  handleOpenClear() {
    this.setData({
      clearVisible: true,
    })
  },
  handleCloseClear() {
    this.setData({
      clearVisible: false,
    })
  },
  handleConfirmClear() {
    clearHistory()
    this.setData({
      clearVisible: false,
    })
    this.loadPageData()
    wx.showToast({
      title: '历史已清空',
      icon: 'none',
    })
  },
})
