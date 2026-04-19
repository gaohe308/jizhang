import {
  fetchRoomSnapshot,
  getCurrentRoomSnapshot,
  LedgerEntry,
  RoomMember,
  RoomSnapshot,
  setCurrentRoomSnapshot,
  submitBatchAccounting,
  submitSingleAccounting,
  updateMemberNickname,
  updateRoomRules,
} from '../../utils/api'
import { updateStoredAuthUserProfile } from '../../utils/auth'

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
  activeRoomId: string
}

const ROOM_MODE_STORAGE_KEY = 'poker-room-ui-mode'
const ROOM_POLL_INTERVAL = 3000
let roomPollingTimer: number | null = null

const isRetryableRoomLoadError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  const statusCode =
    'statusCode' in error ? Number((error as Error & { statusCode?: unknown }).statusCode) : 0
  const message = error.message.toLowerCase()

  return (
    statusCode >= 500 ||
    message.includes('function invoke failed') ||
    message.includes('internal server error') ||
    message.includes('timeout')
  )
}

const layoutMap: Record<'top' | 'left', string> = {
  top: '顶部布局',
  left: '左侧布局',
}

const formatLedgerTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
}

const getLocalRoomMode = (): RoomPageData['mode'] => {
  const mode = wx.getStorageSync(ROOM_MODE_STORAGE_KEY)
  return mode === 'group' ? 'group' : 'single'
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
    activeRoomId: '',
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

    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline'],
    })
  },

  async onShow() {
    await this.loadPageData()
    this.startRoomPolling()
  },

  onHide() {
    this.stopRoomPolling()
  },

  onUnload() {
    this.stopRoomPolling()
  },

  onShareAppMessage() {
    return {
      title: `${this.data.ownerName || '牌友'} 邀请你加入 ${this.data.roomName || '记账房间'}`,
      path: `/pages/index/index?roomCode=${this.data.roomId}`,
    }
  },

  onShareTimeline() {
    return {
      title: `${this.data.roomName || '记账房间'} 房间邀请`,
      query: `roomCode=${this.data.roomId}`,
    }
  },

  startRoomPolling() {
    this.stopRoomPolling()

    roomPollingTimer = setInterval(() => {
      void this.refreshRoomSnapshot(true)
    }, ROOM_POLL_INTERVAL) as unknown as number
  },

  stopRoomPolling() {
    if (roomPollingTimer) {
      clearInterval(roomPollingTimer)
      roomPollingTimer = null
    }
  },

  applyRoomSnapshot(room: RoomSnapshot) {
    const owner = room.members.find((item) => item.id === room.ownerMemberId) || null
    const currentUserMemberId = room.currentUserMemberId || ''
    const displayMembers = room.members
      .filter((item) => item.role !== 'tea')
      .sort((left, right) => {
        if (left.id === currentUserMemberId) {
          return -1
        }
        if (right.id === currentUserMemberId) {
          return 1
        }
        return 0
      })
    const teaMember = room.members.find((item) => item.role === 'tea') || null
    const rules = room.rules || {
      teaFeeType: 'percent' as const,
      teaFeePercent: 10,
      teaFeeFullThreshold: 10,
      teaFeeFullAmount: 1,
      teaFeeCap: 6,
      layoutMode: 'top' as const,
      voiceBroadcast: true,
      keepScreenOn: false,
    }

    this.setData({
      hintMessages: [
        '点击他人头像记账',
        '点击自己头像修改名字',
        '右下角可进入房间结算',
        `当前房间版本 v${room.currentVersion}`,
      ],
      teaFeeType: rules.teaFeeType,
      teaFeePercent: `${rules.teaFeePercent}`,
      teaFeeFullThreshold: `${rules.teaFeeFullThreshold}`,
      teaFeeFullAmount: `${rules.teaFeeFullAmount}`,
      teaFeeCap: `${rules.teaFeeCap}`,
      roomId: room.roomCode,
      roomName: room.roomName,
      ownerName: owner ? owner.name : '房主',
      currentUserId: currentUserMemberId,
      connected: room.status === 'active',
      layoutMode: rules.layoutMode,
      mode: getLocalRoomMode(),
      teaRuleText:
        rules.teaFeeType === 'full'
          ? `每满 ${rules.teaFeeFullThreshold} 抽 ${rules.teaFeeFullAmount} / 上限 ${rules.teaFeeCap}`
          : `${rules.teaFeePercent}% 抽水 / 上限 ${rules.teaFeeCap}`,
      layoutText: layoutMap[rules.layoutMode],
      voiceBroadcast: rules.voiceBroadcast,
      keepScreenOn: rules.keepScreenOn,
      members: room.members.map((item) => ({
        ...item,
        name: item.role === 'tea' ? '茶水' : item.name,
      })),
      displayMembers: displayMembers.map((item) => ({
        ...item,
        name: item.role === 'tea' ? '茶水' : item.name,
      })),
      teaMember: teaMember
        ? {
            ...teaMember,
            name: '茶水',
          }
        : null,
      ledger: room.ledger.slice(0, 12).map((item) => ({
        ...item,
        time: formatLedgerTime(item.time),
      })),
      activeRoomId: room.roomId,
    })
  },

  async refreshRoomSnapshot(silent = false) {
    const room = getCurrentRoomSnapshot()
    if (!room?.roomId) {
      if (!silent) {
        wx.showToast({
          title: '当前没有进行中的房间',
          icon: 'none',
        })
        wx.redirectTo({
          url: '/pages/index/index',
        })
      }
      return
    }

    try {
      const latestRoom = await fetchRoomSnapshot(room.roomId)
      setCurrentRoomSnapshot(latestRoom)
      this.applyRoomSnapshot(latestRoom)
    } catch (error) {
      if (isRetryableRoomLoadError(error)) {
        try {
          const latestRoom = await fetchRoomSnapshot(room.roomId)
          setCurrentRoomSnapshot(latestRoom)
          this.applyRoomSnapshot(latestRoom)
          return
        } catch (retryError) {
          error = retryError
        }
      }
      if (!silent) {
        wx.showToast({
          title: error instanceof Error ? error.message : '房间数据加载失败',
          icon: 'none',
        })
      }
    }
  },

  async loadPageData() {
    await this.refreshRoomSnapshot(false)
  },

  handleModeTap(event: WechatMiniprogram.BaseEvent) {
    const { mode } = event.currentTarget.dataset as { mode: RoomPageData['mode'] }
    if (!mode || mode === this.data.mode) {
      return
    }

    wx.setStorageSync(ROOM_MODE_STORAGE_KEY, mode)
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

    this.openAccountingPopup([member.id], `${this.getCurrentUserName()} 转给 ${member.name}`, '确认后会自动同步房间流水和余额')
  },

  handleOpenBatchPopup() {
    this.setData({
      batchPopupVisible: true,
      batchTransfers: this.buildBatchTransfers(),
    })
  },

  openAccountingPopup(targetIds: string[], title: string, description: string) {
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

  async handleConfirmAccounting() {
    const amount = Number(this.data.amountText)
    if (!amount || !this.data.activeRoomId || this.data.selectedTargetIds.length === 0) {
      wx.showToast({
        title: '请输入有效金额',
        icon: 'none',
      })
      return
    }

    try {
      await submitSingleAccounting(this.data.activeRoomId, this.data.selectedTargetIds[0], amount)
      this.setData({
        popupVisible: false,
        amountText: '',
        selectedTargetIds: [],
      })
      await this.loadPageData()
      wx.showToast({
        title: '记账成功',
        icon: 'success',
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '记账失败',
        icon: 'none',
      })
    }
  },

  async handleRuleToggle(event: WechatMiniprogram.BaseEvent) {
    const { ruleKey } = event.currentTarget.dataset as { ruleKey: 'voiceBroadcast' | 'keepScreenOn' }
    if (!ruleKey || !this.data.activeRoomId) {
      return
    }

    try {
      const nextValue = !this.data[ruleKey]
      const payload =
        ruleKey === 'voiceBroadcast'
          ? { voiceBroadcast: nextValue }
          : { keepScreenOn: nextValue }
      await updateRoomRules(this.data.activeRoomId, payload)

      if (ruleKey === 'keepScreenOn') {
        wx.setKeepScreenOn({
          keepScreenOn: nextValue,
        })
      }

      await this.loadPageData()
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '设置更新失败',
        icon: 'none',
      })
    }
  },

  async handleLayoutSelect(event: WechatMiniprogram.BaseEvent) {
    const { layout } = event.currentTarget.dataset as { layout: RoomPageData['layoutMode'] }
    if (!layout || layout === this.data.layoutMode || !this.data.activeRoomId) {
      return
    }

    try {
      await updateRoomRules(this.data.activeRoomId, {
        layoutMode: layout,
      })
      await this.loadPageData()
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '布局切换失败',
        icon: 'none',
      })
    }
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

  async handleRenameConfirm() {
    if (!this.data.activeRoomId || !this.data.renameValue.trim()) {
      wx.showToast({
        title: '请输入新的名字',
        icon: 'none',
      })
      return
    }

    try {
      const result = await updateMemberNickname(this.data.activeRoomId, this.data.renameValue)
      const nextSession = updateStoredAuthUserProfile({
        id: result.user.id,
        nickname: result.user.nickname,
      })

      if (nextSession) {
        getApp<IAppOption>().globalData.authSession = nextSession
      }

      this.setData({
        renameVisible: false,
        renameTargetId: '',
        renameValue: '',
      })
      await this.loadPageData()
      wx.showToast({
        title: '名字已更新',
        icon: 'none',
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '修改名字失败',
        icon: 'none',
      })
    }
  },

  goSettlement() {
    wx.navigateTo({
      url: '/pages/settlement/index',
    })
  },

  handleInviteTap() {
    if (!this.data.roomId) {
      return
    }

    wx.setClipboardData({
      data: this.data.roomId,
      success: () => {
        wx.showToast({
          title: '房间号已复制，可从右上角继续分享',
          icon: 'none',
        })
      },
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
    const batchTransfers = this.data.batchTransfers.map((item) =>
      item.id === targetId
        ? {
            ...item,
            amount,
          }
        : item,
    )

    this.setData({
      batchTransfers,
    })
  },

  handleSyncBatchAmount() {
    const syncSource = this.data.batchTransfers.find((item) => Number(item.amount) > 0)
    if (!syncSource?.amount) {
      wx.showToast({
        title: '请先输入一个金额',
        icon: 'none',
      })
      return
    }

    this.setData({
      batchTransfers: this.data.batchTransfers.map((item) => ({
        ...item,
        amount: syncSource.amount,
      })),
    })
  },

  async handleConfirmBatchTransfer() {
    if (!this.data.activeRoomId) {
      return
    }

    const entries = this.data.batchTransfers
      .map((item) => ({
        targetMemberId: item.id,
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

    try {
      await submitBatchAccounting(this.data.activeRoomId, entries)
      this.setData({
        batchPopupVisible: false,
        batchTransfers: [],
      })
      await this.loadPageData()
      wx.showToast({
        title: '批量记账成功',
        icon: 'success',
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '批量记账失败',
        icon: 'none',
      })
    }
  },

  handleOpenTeaSettings() {
    this.setData({
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

  async handleConfirmTeaSettings() {
    const teaFeePercent = Number(this.data.teaFeePercent)
    const teaFeeFullThreshold = Number(this.data.teaFeeFullThreshold)
    const teaFeeFullAmount = Number(this.data.teaFeeFullAmount)
    const teaFeeCap = Number(this.data.teaFeeCap)

    if (!this.data.activeRoomId) {
      return
    }

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

    try {
      await updateRoomRules(this.data.activeRoomId, {
        teaFeeType: this.data.teaFeeType,
        teaFeePercent: Math.min(teaFeePercent || 0, 100),
        teaFeeFullThreshold,
        teaFeeFullAmount,
        teaFeeCap,
      })
      this.setData({
        teaSettingsVisible: false,
      })
      await this.loadPageData()
      wx.showToast({
        title: '茶水规则已更新',
        icon: 'success',
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '茶水规则更新失败',
        icon: 'none',
      })
    }
  },

  handleGoHome() {
    wx.redirectTo({
      url: '/pages/index/index',
    })
  },

  handleToolbarTap(event: WechatMiniprogram.BaseEvent) {
    const { action } = event.currentTarget.dataset as { action: string }
    if (action === 'settings') {
      this.setData({
        settingsVisible: true,
      })
    }
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

  handleContactServiceError() {
    wx.showToast({
      title: '请先在小程序后台开启客服能力',
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
