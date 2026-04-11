import {
  BatchAccountingEntry,
  getAppState,
  LedgerEntry,
  renameMember,
  RoomMember,
  setRoomMode,
  setRoomLayout,
  submitAccounting,
  submitBatchAccounting,
  toggleRule,
  updateTeaRule,
} from '../../utils/mock'

interface BatchTransferItem {
  id: string
  name: string
  shortName: string
  role: RoomMember['role']
  amount: string
}

interface RoomPageData {
  statusBarHeight: number
  menuTop: number
  menuHeight: number
  navBarHeight: number
  hintMessages: string[]
  batchPopupVisible: boolean
  batchTransfers: BatchTransferItem[]
  teaSettingsVisible: boolean
  teaFeeType: 'percent' | 'full'
  teaFeePercent: string
  teaFeeFullThreshold: string
  teaFeeFullAmount: string
  teaFeeCap: string
  roomId: string
  roomName: string
  ownerName: string
  currentUserId: string
  connected: boolean
  layoutMode: 'top' | 'left'
  mode: 'single' | 'group'
  teaRuleText: string
  layoutText: string
  voiceBroadcast: boolean
  keepScreenOn: boolean
  members: RoomMember[]
  displayMembers: RoomMember[]
  teaMember: RoomMember | null
  ledger: LedgerEntry[]
  selectedTargetIds: string[]
  popupVisible: boolean
  amountText: string
  popupTitle: string
  popupDescription: string
  renameVisible: boolean
  renameTargetId: string
  renameValue: string
  settingsVisible: boolean
}

const layoutMap = {
  top: '顶部布局',
  left: '左侧布局',
}

Page<RoomPageData>({
  data: {
    statusBarHeight: 0,
    menuTop: 0,
    menuHeight: 32,
    navBarHeight: 88,
    hintMessages: [],
    batchPopupVisible: false,
    batchTransfers: [],
    teaSettingsVisible: false,
    teaFeeType: 'percent',
    teaFeePercent: '10',
    teaFeeFullThreshold: '10',
    teaFeeFullAmount: '1',
    teaFeeCap: '6',
    roomId: '',
    roomName: '',
    ownerName: '',
    currentUserId: '',
    connected: true,
    layoutMode: 'top',
    mode: 'single',
    teaRuleText: '',
    layoutText: '',
    voiceBroadcast: true,
    keepScreenOn: false,
    members: [],
    displayMembers: [],
    teaMember: null,
    ledger: [],
    selectedTargetIds: [],
    popupVisible: false,
    amountText: '',
    popupTitle: '',
    popupDescription: '',
    renameVisible: false,
    renameTargetId: '',
    renameValue: '',
    settingsVisible: false,
  },
  onLoad() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const statusBarHeight = windowInfo.statusBarHeight || 0
    const menuTop = menuButton ? menuButton.top : statusBarHeight + 6
    const menuHeight = menuButton ? menuButton.height : 32
    const navBarHeight = menuButton ? menuButton.bottom + 8 : statusBarHeight + 44
    this.setData({
      statusBarHeight,
      menuTop,
      menuHeight,
      navBarHeight,
    })
  },
  onShow() {
    this.loadPageData()
  },
  loadPageData() {
    const { room } = getAppState()
    const owner = room.members.find((item) => item.id === room.ownerId)
    const displayMembers = room.members
      .filter((item) => item.role !== 'tea')
      .sort((left, right) => {
        if (left.id === room.currentUserId) {
          return -1
        }
        if (right.id === room.currentUserId) {
          return 1
        }
        return 0
      })
    const teaMember = room.members.find((item) => item.role === 'tea') || null
    this.setData({
      hintMessages: [
        '点击他人头像记账',
        '点击自己头像修改昵称',
        '右下角可快速结算',
        room.connected ? '当前房间已实时同步' : '当前房间正在重连',
      ],
      teaFeeType: room.rules.teaFeeType,
      teaFeePercent: `${room.rules.teaFeePercent}`,
      teaFeeFullThreshold: `${room.rules.teaFeeFullThreshold}`,
      teaFeeFullAmount: `${room.rules.teaFeeFullAmount}`,
      teaFeeCap: `${room.rules.teaFeeCap}`,
      roomId: room.roomId,
      roomName: room.roomName,
      ownerName: owner ? owner.name : '房主',
      currentUserId: room.currentUserId,
      connected: room.connected,
      layoutMode: room.rules.layout,
      mode: room.mode,
      teaRuleText:
        room.rules.teaFeeType === 'full'
          ? `每满 ${room.rules.teaFeeFullThreshold} 抽 ${room.rules.teaFeeFullAmount} / 封顶 ${room.rules.teaFeeCap}`
          : `${room.rules.teaFeePercent}% 抽水 / 封顶 ${room.rules.teaFeeCap}`,
      layoutText: layoutMap[room.rules.layout],
      voiceBroadcast: room.rules.voiceBroadcast,
      keepScreenOn: room.rules.keepScreenOn,
      members: room.members,
      displayMembers,
      teaMember,
      ledger: room.ledger.slice(0, 8),
    })
  },
  handleModeTap(event: WechatMiniprogram.BaseEvent) {
    const { mode } = event.currentTarget.dataset as { mode: RoomPageData['mode'] }
    if (!mode || mode === this.data.mode) {
      return
    }
    setRoomMode(mode)
    this.setData({
      mode,
      selectedTargetIds: [],
    })
  },
  handleMemberTap(event: WechatMiniprogram.BaseEvent) {
    const { memberId } = event.currentTarget.dataset as { memberId: string }
    const member = this.data.members.find((item) => item.id === memberId)
    if (!member || member.role === 'tea') {
      return
    }

    if (member.id === this.data.currentUserId) {
      this.setData({
        renameVisible: true,
        renameTargetId: member.id,
        renameValue: member.name,
      })
      return
    }

    this.openAccountingPopup([member.id], `${this.getCurrentUserName()} 支付给 ${member.name}`, '确认后会自动生成流水并同步余额')
  },
  handleOpenBatchPopup() {
    this.setData({
      batchPopupVisible: true,
      batchTransfers: this.buildBatchTransfers(),
    })
  },
  openAccountingPopup(targetIds: string[], title: string, description: string) {
    if (title.indexOf('批量') > -1 || targetIds.length > 1) {
      this.setData({
        batchPopupVisible: true,
        batchTransfers: this.buildBatchTransfers(),
      })
      return
    }

    this.setData({
      popupVisible: true,
      selectedTargetIds: targetIds,
      amountText: '',
      popupTitle: title,
      popupDescription: description,
    })
  },
  handlePopupVisibleChange(event: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    this.setData({
      popupVisible: event.detail.visible,
    })
  },
  handleDigitTap(event: WechatMiniprogram.BaseEvent) {
    const { key } = event.currentTarget.dataset as { key: string }
    if (!key) {
      return
    }

    const nextValue = `${this.data.amountText}${key}`.slice(0, 4)
    this.setData({
      amountText: nextValue,
    })
  },
  handleDeleteTap() {
    this.setData({
      amountText: this.data.amountText.slice(0, -1),
    })
  },
  handleClearTap() {
    this.setData({
      amountText: '',
    })
  },
  handleConfirmAccounting() {
    const amount = Number(this.data.amountText)
    if (!amount) {
      wx.showToast({
        title: '请输入金额',
        icon: 'none',
      })
      return
    }

    submitAccounting(this.data.selectedTargetIds, amount)
    this.setData({
      popupVisible: false,
      amountText: '',
      selectedTargetIds: [],
    })
    this.loadPageData()
    wx.showToast({
      title: '记账成功',
      icon: 'success',
    })
  },
  handleRuleToggle(event: WechatMiniprogram.BaseEvent) {
    const { ruleKey } = event.currentTarget.dataset as { ruleKey: 'voiceBroadcast' | 'keepScreenOn' }
    if (!ruleKey) {
      return
    }
    toggleRule(ruleKey)
    const state = getAppState()
    if (ruleKey === 'keepScreenOn') {
      wx.setKeepScreenOn({
        keepScreenOn: state.room.rules.keepScreenOn,
      })
    }
    this.loadPageData()
  },
  handleLayoutSelect(event: WechatMiniprogram.BaseEvent) {
    const { layout } = event.currentTarget.dataset as { layout: RoomPageData['layoutMode'] }
    if (!layout || layout === this.data.layoutMode) {
      return
    }

    setRoomLayout(layout)
    this.loadPageData()
  },
  handleRenameStart(event: WechatMiniprogram.BaseEvent) {
    const { memberId } = event.currentTarget.dataset as { memberId: string }
    const member = this.data.members.find((item) => item.id === memberId)
    if (!member || member.role === 'tea') {
      return
    }

    this.setData({
      renameVisible: true,
      renameTargetId: member.id,
      renameValue: member.name,
    })
  },
  handleRenameInput(event: WechatMiniprogram.Input) {
    this.setData({
      renameValue: event.detail.value,
    })
  },
  handleRenameVisibleChange(event: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    this.setData({
      renameVisible: event.detail.visible,
    })
  },
  handleRenameConfirm() {
    renameMember(this.data.renameTargetId, this.data.renameValue)
    this.setData({
      renameVisible: false,
      renameTargetId: '',
      renameValue: '',
    })
    this.loadPageData()
    wx.showToast({
      title: '昵称已更新',
      icon: 'none',
    })
  },
  goSettlement() {
    wx.navigateTo({
      url: '/pages/settlement/index',
    })
  },
  handleInviteTap() {
    wx.showToast({
      title: '邀请能力待接入',
      icon: 'none',
    })
  },
  handleOpenBatchTransfer() {
    this.handleOpenBatchPopup()
  },
  handleBatchPopupVisibleChange(event: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    this.setData({
      batchPopupVisible: event.detail.visible,
    })
  },
  handleCloseBatchTransfer() {
    this.setData({
      batchPopupVisible: false,
    })
  },
  handleBatchAmountInput(event: WechatMiniprogram.Input) {
    const { targetId } = event.currentTarget.dataset as { targetId: string }
    const amount = event.detail.value.replace(/[^\d]/g, '').slice(0, 4)
    const batchTransfers = this.data.batchTransfers.map((item) => {
      if (item.id === targetId) {
        return {
          id: item.id,
          name: item.name,
          shortName: item.shortName,
          role: item.role,
          amount,
        }
      }
      return item
    })

    this.setData({
      batchTransfers,
    })
  },
  handleSyncBatchAmount() {
    let syncAmount = ''
    for (let index = 0; index < this.data.batchTransfers.length; index += 1) {
      const current = this.data.batchTransfers[index]
      if (Number(current.amount) > 0) {
        syncAmount = current.amount
        break
      }
    }
    if (!syncAmount) {
      wx.showToast({
        title: '请先输入一个金额',
        icon: 'none',
      })
      return
    }

    this.setData({
      batchTransfers: this.data.batchTransfers.map((item) => ({
        id: item.id,
        name: item.name,
        shortName: item.shortName,
        role: item.role,
        amount: syncAmount,
      })),
    })
  },
  handleConfirmBatchTransfer() {
    const entries: BatchAccountingEntry[] = this.data.batchTransfers
      .map((item) => ({
        targetId: item.id,
        amount: Number(item.amount),
      }))
      .filter((item) => item.amount > 0)

    if (entries.length === 0) {
      wx.showToast({
        title: '请至少填写一笔金额',
        icon: 'none',
      })
      return
    }

    submitBatchAccounting(entries)
    this.setData({
      batchPopupVisible: false,
      batchTransfers: [],
    })
    this.loadPageData()
    wx.showToast({
      title: '批量记账成功',
      icon: 'success',
    })
  },
  handleOpenTeaSettings() {
    const { room } = getAppState()
    this.setData({
      teaFeeType: room.rules.teaFeeType,
      teaFeePercent: `${room.rules.teaFeePercent}`,
      teaFeeFullThreshold: `${room.rules.teaFeeFullThreshold}`,
      teaFeeFullAmount: `${room.rules.teaFeeFullAmount}`,
      teaFeeCap: `${room.rules.teaFeeCap}`,
      teaSettingsVisible: true,
    })
  },
  handleTeaSettingsVisibleChange(event: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    this.setData({
      teaSettingsVisible: event.detail.visible,
    })
  },
  handleCloseTeaSettings() {
    this.setData({
      teaSettingsVisible: false,
    })
  },
  handleTeaTypeTap(event: WechatMiniprogram.BaseEvent) {
    const { type } = event.currentTarget.dataset as { type: RoomPageData['teaFeeType'] }
    if (!type) {
      return
    }
    this.setData({
      teaFeeType: type,
    })
  },
  handleTeaInput(event: WechatMiniprogram.Input) {
    const { field } = event.currentTarget.dataset as {
      field: 'teaFeePercent' | 'teaFeeFullThreshold' | 'teaFeeFullAmount' | 'teaFeeCap'
    }
    const value = event.detail.value.replace(/[^\d]/g, '').slice(0, 4)
    this.setData({
      [field]: value,
    } as Pick<RoomPageData, 'teaFeePercent' | 'teaFeeFullThreshold' | 'teaFeeFullAmount' | 'teaFeeCap'>)
  },
  handleConfirmTeaSettings() {
    const teaFeePercent = Number(this.data.teaFeePercent)
    const teaFeeFullThreshold = Number(this.data.teaFeeFullThreshold)
    const teaFeeFullAmount = Number(this.data.teaFeeFullAmount)
    const teaFeeCap = Number(this.data.teaFeeCap)

    if (this.data.teaFeeType === 'percent' && teaFeePercent <= 0) {
      wx.showToast({
        title: '请输入有效比例',
        icon: 'none',
      })
      return
    }

    if (this.data.teaFeeType === 'full' && (teaFeeFullThreshold <= 0 || teaFeeFullAmount <= 0)) {
      wx.showToast({
        title: '请完善满额规则',
        icon: 'none',
      })
      return
    }

    if (teaFeeCap <= 0) {
      wx.showToast({
        title: '请输入茶水上限',
        icon: 'none',
      })
      return
    }

    updateTeaRule({
      teaFeeType: this.data.teaFeeType,
      teaFeePercent: Math.min(teaFeePercent || 0, 100),
      teaFeeFullThreshold,
      teaFeeFullAmount,
      teaFeeCap,
    })
    this.setData({
      teaSettingsVisible: false,
    })
    this.loadPageData()
    wx.showToast({
      title: '茶水规则已更新',
      icon: 'success',
    })
  },
  handleGoHome() {
    wx.redirectTo({
      url: '/pages/index/index',
    })
  },
  handleToolbarTap(event: WechatMiniprogram.BaseEvent) {
    const { action } = event.currentTarget.dataset as { action: string }
    const actionTextMap: Record<string, string> = {
      more: '更多操作待接入',
    }

    if (action === 'settings') {
      this.setData({
        settingsVisible: true,
      })
      return
    }

    wx.showToast({
      title: actionTextMap[action] || '功能待接入',
      icon: 'none',
    })
  },
  handleSettingsVisibleChange(event: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    this.setData({
      settingsVisible: event.detail.visible,
    })
  },
  handleCloseSettings() {
    this.setData({
      settingsVisible: false,
    })
  },
  handleContactService() {
    wx.showToast({
      title: '客服能力待接入',
      icon: 'none',
    })
  },
  buildBatchTransfers() {
    return this.data.members
      .filter((item) => item.id !== this.data.currentUserId && item.role !== 'tea')
      .map((item) => ({
        id: item.id,
        name: item.name,
        shortName: item.shortName,
        role: item.role,
        amount: '',
      }))
  },
  getCurrentUserName() {
    const currentUser = this.data.members.find((item) => item.id === this.data.currentUserId)
    return currentUser ? currentUser.name : '我'
  },
})
