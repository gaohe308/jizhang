import { clearMyHistory, fetchMyHistory, fetchMyProfile, fetchMyStats, HistoryRecord } from '../../utils/api'

interface ProfilePageData {
  profileName: string
  avatarText: string
  tags: string[]
  totalGames: number
  wins: number
  winRate: string
  totalProfit: number
  history: HistoryRecord[]
  clearVisible: boolean
}

const formatHistoryTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.getMonth() + 1} 月${date.getDate()} 日 ${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
}

const buildTags = (stats: {
  totalGames: number
  wins: number
  totalProfit: number
  winRate: string
}) => {
  const tags = [stats.totalGames >= 10 ? '常打牌局' : '轻量上桌']

  if (Number(stats.winRate.replace('%', '')) >= 50) {
    tags.push('本周手感在线')
  } else {
    tags.push('稳扎稳打型')
  }

  tags.push(stats.totalProfit >= 0 ? '净收益为正' : '继续追分中')
  return tags
}

Page<ProfilePageData>({
  data: {
    profileName: '',
    avatarText: '牌',
    tags: [],
    totalGames: 0,
    wins: 0,
    winRate: '0.0%',
    totalProfit: 0,
    history: [],
    clearVisible: false,
  },

  async onShow() {
    await this.loadPageData()
  },

  async loadPageData() {
    try {
      const [profile, stats, history] = await Promise.all([fetchMyProfile(), fetchMyStats(), fetchMyHistory()])

      this.setData({
        profileName: profile.nickname,
        avatarText: profile.nickname ? profile.nickname.slice(0, 1) : '牌',
        tags: buildTags(stats),
        totalGames: stats.totalGames,
        wins: stats.wins,
        winRate: stats.winRate,
        totalProfit: stats.totalProfit,
        history: history.map((item) => ({
          ...item,
          finishedAt: formatHistoryTime(item.finishedAt),
        })),
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '个人数据加载失败',
        icon: 'none',
      })
    }
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

  async handleConfirmClear() {
    try {
      await clearMyHistory()
      this.setData({
        clearVisible: false,
      })
      await this.loadPageData()
      wx.showToast({
        title: '历史记录已清空',
        icon: 'none',
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '清空失败',
        icon: 'none',
      })
    }
  },
})
