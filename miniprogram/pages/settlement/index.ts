import { archiveCurrentRoom, getAppState, getSettlementSummary, SettlementPlanItem } from '../../utils/mock'

interface SettlementPageData {
  roomName: string
  roomId: string
  winnerName: string
  loserName: string
  transferCount: number
  teaFeeAmount: number
  totalAbsProfit: number
  plans: SettlementPlanItem[]
  confirmVisible: boolean
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
  },
  onShow() {
    this.loadPageData()
  },
  loadPageData() {
    const { room } = getAppState()
    const settlement = getSettlementSummary()
    this.setData({
      roomName: room.roomName,
      roomId: room.roomId,
      winnerName: settlement.winnerName,
      loserName: settlement.loserName,
      transferCount: settlement.transferCount,
      teaFeeAmount: settlement.teaFeeAmount,
      totalAbsProfit: settlement.totalAbsProfit,
      plans: settlement.plans,
    })
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
  handleConfirmArchive() {
    archiveCurrentRoom()
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
