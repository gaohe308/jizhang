import { clearMyHistory, fetchMyHistory, fetchMyProfile, fetchMyStats, HistoryRecord, UserStats } from '../../utils/api'
import { getAuthSession, updateStoredAuthUserProfile } from '../../utils/auth'

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

const DEFAULT_NAME = '牌友'
const DEFAULT_STATS: UserStats = {
  totalGames: 0,
  wins: 0,
  totalProfit: 0,
  winRate: '0.0%',
  weekly: {
    totalGames: 0,
    wins: 0,
    winRate: '0.0%',
  },
}

const getDisplayName = (value?: string | null) => {
  const name = value?.trim()
  return name || DEFAULT_NAME
}

const getAvatarText = (name?: string | null) => getDisplayName(name).slice(0, 1)

const formatHistoryTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
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

const mapHistory = (history: HistoryRecord[]) =>
  history.map((item) => ({
    ...item,
    finishedAt: formatHistoryTime(item.finishedAt),
  }))

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '个人数据加载失败'

Page<ProfilePageData>({
  data: {
    profileName: DEFAULT_NAME,
    avatarText: getAvatarText(DEFAULT_NAME),
    tags: buildTags(DEFAULT_STATS),
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
    const session = getAuthSession()
    const cachedName = getDisplayName(session?.user.nickname)

    this.setData({
      profileName: cachedName,
      avatarText: getAvatarText(cachedName),
    })

    const [profileResult, statsResult, historyResult] = await Promise.allSettled([
      fetchMyProfile(),
      fetchMyStats(),
      fetchMyHistory(),
    ])

    const failures: string[] = []

    if (profileResult.status === 'fulfilled') {
      const profileName = getDisplayName(profileResult.value.nickname)
      const nextSession = updateStoredAuthUserProfile({
        id: profileResult.value.id,
        nickname: profileName,
        avatarUrl: profileResult.value.avatarUrl,
      })

      if (nextSession) {
        getApp<IAppOption>().globalData.authSession = nextSession
      }

      this.setData({
        profileName,
        avatarText: getAvatarText(profileName),
      })
    } else {
      failures.push(getErrorMessage(profileResult.reason))
    }

    if (statsResult.status === 'fulfilled') {
      this.setData({
        tags: buildTags(statsResult.value),
        totalGames: statsResult.value.totalGames,
        wins: statsResult.value.wins,
        winRate: statsResult.value.winRate,
        totalProfit: statsResult.value.totalProfit,
      })
    } else {
      failures.push(getErrorMessage(statsResult.reason))
    }

    if (historyResult.status === 'fulfilled') {
      this.setData({
        history: mapHistory(historyResult.value),
      })
    } else {
      failures.push(getErrorMessage(historyResult.reason))
    }

    if (failures.length > 0) {
      console.warn('[profile] partial data load failed', failures)
      wx.showToast({
        title: '部分个人数据暂时加载失败',
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
