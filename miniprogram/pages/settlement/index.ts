import {
  archiveRoom,
  clearCurrentRoomSnapshot,
  fetchSettlementPreview,
  getCurrentRoomSnapshot,
} from '../../utils/api'

interface SettlementPlanViewItem {
  from: string
  to: string
  amount: number
}

interface SettlementPageData {
  roomName: string
  roomId: string
  winnerName: string
  loserName: string
  transferCount: number
  teaFeeAmount: number
  totalAbsProfit: number
  plans: SettlementPlanViewItem[]
  confirmVisible: boolean
  activeRoomId: string
}

Page<SettlementPageData>({
  data: {
    roomName: '',
    roomId: '',
    winnerName: '',
    loserName: '',
    transferCount: 0,
    teaFeeAmount: 0,
    totalAbsProfit: 0,
    plans: [],
    confirmVisible: false,
    activeRoomId: '',
  },

  async onShow() {
    await this.loadPageData()
  },

  async loadPageData() {
    const room = getCurrentRoomSnapshot()
    if (!room) {
      wx.showToast({
        title: '当前没有进行中的房间',
        icon: 'none',
      })
      wx.redirectTo({
        url: '/pages/index/index',
      })
      return
    }

    try {
      const settlement = await fetchSettlementPreview(room.roomId)

      this.setData({
        roomName: room.roomName,
        roomId: room.roomCode,
        activeRoomId: room.roomId,
        winnerName: settlement.winnerName,
        loserName: settlement.loserName,
        transferCount: settlement.transferCount,
        teaFeeAmount: settlement.teaFeeAmount,
        totalAbsProfit: settlement.totalAbsProfit,
        plans: settlement.plans.map((item) => ({
          from: item.fromName,
          to: item.toName,
          amount: item.amount,
        })),
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '结算预览加载失败',
        icon: 'none',
      })
    }
  },

  handleOpenConfirm() {
    this.setData({
      confirmVisible: true,
    })
  },

  handleCloseConfirm() {
    this.setData({
      confirmVisible: false,
    })
  },

  async handleConfirmArchive() {
    if (!this.data.activeRoomId) {
      return
    }

    try {
      await archiveRoom(this.data.activeRoomId)
      clearCurrentRoomSnapshot()
      this.setData({
        confirmVisible: false,
      })
      wx.showToast({
        title: '已归档并解散房间',
        icon: 'success',
      })
      wx.redirectTo({
        url: '/pages/index/index',
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '房间归档失败',
        icon: 'none',
      })
    }
  },

  handleGoBack() {
    wx.navigateBack({
      fail: () => {
        wx.redirectTo({
          url: '/pages/room/index',
        })
      },
    })
  },
})
