export interface RoomMember {
  id: string
  name: string
  shortName: string
  role: 'owner' | 'player' | 'tea'
  balance: number
}

export interface RoomRule {
  teaFeeType: 'percent' | 'full'
  teaFeePercent: number
  teaFeeFullThreshold: number
  teaFeeFullAmount: number
  teaFeeCap: number
  voiceBroadcast: boolean
  keepScreenOn: boolean
  layout: 'top' | 'left'
}

export interface LedgerEntry {
  id: string
  title: string
  description: string
  time: string
}

export interface RoomState {
  roomId: string
  roomName: string
  ownerId: string
  currentUserId: string
  mode: 'single' | 'group'
  connected: boolean
  members: RoomMember[]
  rules: RoomRule
  ledger: LedgerEntry[]
}

export interface HistoryRecord {
  id: string
  roomName: string
  finishedAt: string
  summary: string
  profit: number
}

export interface AppState {
  profileName: string
  profileTags: string[]
  room: RoomState
  history: HistoryRecord[]
}

export interface SettlementPlanItem {
  from: string
  to: string
  amount: number
}

export interface BatchAccountingEntry {
  targetId: string
  amount: number
}

export interface SettlementSummary {
  plans: SettlementPlanItem[]
  teaFeeAmount: number
  winnerName: string
  loserName: string
  transferCount: number
  totalAbsProfit: number
}

const STORAGE_KEY = 'poker-accounting-state'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const createRoom = (roomId: string): RoomState => ({
  roomId,
  roomName: '松月包间',
  ownerId: 'east',
  currentUserId: 'deer',
  mode: 'single',
  connected: true,
  rules: {
    teaFeeType: 'percent',
    teaFeePercent: 10,
    teaFeeFullThreshold: 10,
    teaFeeFullAmount: 1,
    teaFeeCap: 6,
    voiceBroadcast: true,
    keepScreenOn: false,
    layout: 'top',
  },
  members: [
    { id: 'east', name: '东东', shortName: '东', role: 'owner', balance: 142 },
    { id: 'aze', name: '阿泽', shortName: '泽', role: 'player', balance: -64 },
    { id: 'deer', name: '小鹿', shortName: '鹿', role: 'player', balance: -98 },
    { id: 'tea', name: '茶水', shortName: '茶', role: 'tea', balance: 20 },
  ],
  ledger: [
    {
      id: 'ledger-1',
      title: '小鹿 向 东东 支付 88',
      description: '自动扣除茶水费 6，到手 82，房间版本 v128',
      time: '18:36',
    },
    {
      id: 'ledger-2',
      title: '阿泽 批量支付 东东 / 茶水',
      description: '多人输给庄家，一键完成同步记账',
      time: '18:21',
    },
    {
      id: 'ledger-3',
      title: '房主修改规则：语音播报开启',
      description: '页面偏好已同步给全员',
      time: '18:08',
    },
  ],
})

const initialState = (): AppState => ({
  profileName: '小鹿',
  profileTags: ['手气波动型', '常打四人局', '近 3 场回暖'],
  room: createRoom('8251'),
  history: [
    {
      id: 'history-1',
      roomName: '东湖麻将局',
      finishedAt: '4 月 8 日 22:18',
      summary: '最终结算：小鹿 → 东东 98，茶水 20',
      profit: -98,
    },
    {
      id: 'history-2',
      roomName: '夜宵德州局',
      finishedAt: '4 月 6 日 19:40',
      summary: '共 9 笔流水，已归档',
      profit: 76,
    },
    {
      id: 'history-3',
      roomName: '老友局',
      finishedAt: '4 月 2 日 21:06',
      summary: '支持查看每局时间、盈亏和结算动作',
      profit: -118,
    },
  ],
})

let cache: AppState | null = null

const normalizeRoomRules = (rules: Partial<RoomRule> | undefined): RoomRule => ({
  teaFeeType: rules?.teaFeeType === 'full' ? 'full' : 'percent',
  teaFeePercent: typeof rules?.teaFeePercent === 'number' ? rules.teaFeePercent : 10,
  teaFeeFullThreshold: typeof rules?.teaFeeFullThreshold === 'number' ? rules.teaFeeFullThreshold : 10,
  teaFeeFullAmount: typeof rules?.teaFeeFullAmount === 'number' ? rules.teaFeeFullAmount : 1,
  teaFeeCap: typeof rules?.teaFeeCap === 'number' ? rules.teaFeeCap : 6,
  voiceBroadcast: typeof rules?.voiceBroadcast === 'boolean' ? rules.voiceBroadcast : true,
  keepScreenOn: typeof rules?.keepScreenOn === 'boolean' ? rules.keepScreenOn : false,
  layout: rules?.layout === 'left' ? 'left' : 'top',
})

const normalizeState = (state: AppState): AppState => {
  state.room.rules = normalizeRoomRules(state.room.rules)
  return state
}

const saveState = (state: AppState) => {
  cache = clone(normalizeState(state))
  wx.setStorageSync(STORAGE_KEY, cache)
}

const updateState = (updater: (draft: AppState) => void): AppState => {
  const draft = getAppState()
  updater(draft)
  saveState(draft)
  return clone(normalizeState(draft))
}

export const getAppState = (): AppState => {
  if (cache) {
    return clone(cache)
  }

  const stored = wx.getStorageSync(STORAGE_KEY) as AppState | ''
  if (stored && typeof stored === 'object' && 'room' in stored) {
    cache = clone(normalizeState(stored))
    return clone(cache)
  }

  const state = initialState()
  saveState(state)
  return clone(state)
}

export const getProfileStats = () => {
  const { history } = getAppState()
  const totalGames = history.length
  const wins = history.filter((item) => item.profit > 0).length
  const totalProfit = history.reduce((sum, item) => sum + item.profit, 0)
  const winRate = totalGames === 0 ? '0.0%' : `${((wins / totalGames) * 100).toFixed(1)}%`
  return { totalGames, wins, totalProfit, winRate }
}

const parseHistoryDate = (value: string) => {
  const match = value.match(/(\d+)\s*月\s*(\d+)\s*日(?:\s*(\d{2}):(\d{2}))?/)
  if (!match) {
    return null
  }

  const now = new Date()
  const month = Number(match[1]) - 1
  const day = Number(match[2])
  const hour = match[3] ? Number(match[3]) : 0
  const minute = match[4] ? Number(match[4]) : 0
  return new Date(now.getFullYear(), month, day, hour, minute, 0, 0)
}

export const getWeeklyProfileStats = () => {
  const { history } = getAppState()
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = startOfToday.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfToday.getDate() + mondayOffset)

  const weeklyHistory = history.filter((item) => {
    const date = parseHistoryDate(item.finishedAt)
    return Boolean(date && date >= startOfWeek && date <= now)
  })

  const totalGames = weeklyHistory.length
  const wins = weeklyHistory.filter((item) => item.profit > 0).length
  const winRate = totalGames === 0 ? '0.0%' : `${((wins / totalGames) * 100).toFixed(1)}%`

  return { totalGames, wins, winRate }
}

const formatClock = (date: Date) => `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`

const formatHistoryTime = (date: Date) =>
  `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`

const getMember = (room: RoomState, memberId: string) => room.members.find((item) => item.id === memberId) || null

const computeTeaFee = (amount: number, room: RoomState) => {
  const fee =
    room.rules.teaFeeType === 'full'
      ? Math.floor(amount / Math.max(room.rules.teaFeeFullThreshold, 1)) * room.rules.teaFeeFullAmount
      : Math.round((amount * room.rules.teaFeePercent) / 100)
  return Math.min(fee, room.rules.teaFeeCap)
}

export const createFreshRoom = () =>
  updateState((draft) => {
    draft.room = createRoom(`${Math.floor(1000 + Math.random() * 9000)}`)
  })

export const renameMember = (memberId: string, nextName: string) =>
  updateState((draft) => {
    const member = getMember(draft.room, memberId)
    if (!member) {
      return
    }

    const name = nextName.trim()
    if (!name) {
      return
    }

    member.name = name
    member.shortName = name.slice(0, 1)
  })

export const setRoomMode = (mode: RoomState['mode']) =>
  updateState((draft) => {
    draft.room.mode = mode
  })

export const toggleRule = (key: 'voiceBroadcast' | 'keepScreenOn') =>
  updateState((draft) => {
    draft.room.rules[key] = !draft.room.rules[key]
  })

export const updateTeaRule = (payload: {
  teaFeeType: RoomRule['teaFeeType']
  teaFeePercent: number
  teaFeeFullThreshold: number
  teaFeeFullAmount: number
  teaFeeCap: number
}) =>
  updateState((draft) => {
    draft.room.rules.teaFeeType = payload.teaFeeType
    draft.room.rules.teaFeePercent = payload.teaFeePercent
    draft.room.rules.teaFeeFullThreshold = payload.teaFeeFullThreshold
    draft.room.rules.teaFeeFullAmount = payload.teaFeeFullAmount
    draft.room.rules.teaFeeCap = payload.teaFeeCap

    draft.room.ledger.unshift({
      id: `ledger-${Date.now()}`,
      title: '房主修改茶水规则',
      description:
        payload.teaFeeType === 'full'
          ? `每满 ${payload.teaFeeFullThreshold} 抽 ${payload.teaFeeFullAmount}，封顶 ${payload.teaFeeCap}`
          : `${payload.teaFeePercent}% 抽水，封顶 ${payload.teaFeeCap}`,
      time: formatClock(new Date()),
    })
  })

export const setRoomLayout = (layout: RoomRule['layout']) =>
  updateState((draft) => {
    draft.room.rules.layout = layout
  })

export const submitAccounting = (targetIds: string[], amount: number) =>
  updateState((draft) => {
    const room = draft.room
    const payer = getMember(room, room.currentUserId)
    const tea = getMember(room, 'tea')
    const targets = targetIds
      .map((id) => getMember(room, id))
      .filter((member): member is RoomMember => Boolean(member && member.role !== 'tea' && member.id !== room.currentUserId))

    if (!payer || !tea || targets.length === 0 || amount <= 0) {
      return
    }

    const feePerTarget = computeTeaFee(amount, room)
    const netIncome = amount - feePerTarget
    const totalAmount = amount * targets.length
    const totalFee = feePerTarget * targets.length

    payer.balance -= totalAmount
    tea.balance += totalFee
    targets.forEach((member) => {
      member.balance += netIncome
    })

    const title =
      targets.length === 1
        ? `${payer.name} 向 ${targets[0].name} 支付 ${amount}`
        : `${payer.name} 批量支付 ${targets.map((item) => item.name).join(' / ')}`
    const description =
      targets.length === 1
        ? `自动扣除茶水费 ${feePerTarget}，到手 ${netIncome}`
        : `每人 ${amount}，茶水费共 ${totalFee}，同步批量记账`

    room.ledger.unshift({
      id: `ledger-${Date.now()}`,
      title,
      description,
      time: formatClock(new Date()),
    })
  })

export const submitBatchAccounting = (entries: BatchAccountingEntry[]) =>
  updateState((draft) => {
    const room = draft.room
    const payer = getMember(room, room.currentUserId)
    const tea = getMember(room, 'tea')
    const validEntries = entries
      .map((entry) => ({
        amount: entry.amount,
        member: getMember(room, entry.targetId),
      }))
      .filter(
        (entry): entry is { amount: number; member: RoomMember } =>
          Boolean(entry.member && entry.member.id !== room.currentUserId && entry.amount > 0),
      )

    if (!payer || !tea || validEntries.length === 0) {
      return
    }

    let totalFee = 0
    let totalDirectTea = 0
    let totalAmount = 0

    validEntries.forEach(({ amount, member }) => {
      totalAmount += amount
      payer.balance -= amount

      if (member.role === 'tea') {
        member.balance += amount
        totalDirectTea += amount
        return
      }

      const fee = computeTeaFee(amount, room)
      totalFee += fee
      tea.balance += fee
      member.balance += amount - fee
    })

    const names = validEntries.map(({ member }) => member.name)
    const descriptionParts = [`共 ${validEntries.length} 人`, `合计 ${totalAmount}`]

    if (totalFee > 0) {
      descriptionParts.push(`自动扣茶水 ${totalFee}`)
    }
    if (totalDirectTea > 0) {
      descriptionParts.push(`直付茶水 ${totalDirectTea}`)
    }

    room.ledger.unshift({
      id: `ledger-${Date.now()}`,
      title: `${payer.name} 批量支付 ${names.join(' / ')}`,
      description: descriptionParts.join('，'),
      time: formatClock(new Date()),
    })
  })

export const getSettlementSummary = (): SettlementSummary => {
  const { room } = getAppState()
  const members = room.members.filter((item) => item.role !== 'tea')
  const debtors = members
    .filter((item) => item.balance < 0)
    .map((item) => ({ name: item.name, amount: Math.abs(item.balance) }))
  const creditors = members
    .filter((item) => item.balance > 0)
    .map((item) => ({ name: item.name, amount: item.balance }))

  const plans: SettlementPlanItem[] = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const amount = Math.min(debtor.amount, creditor.amount)
    plans.push({ from: debtor.name, to: creditor.name, amount })
    debtor.amount -= amount
    creditor.amount -= amount

    if (debtor.amount === 0) {
      debtorIndex += 1
    }
    if (creditor.amount === 0) {
      creditorIndex += 1
    }
  }

  const teaAccount = room.members.find((item) => item.role === 'tea')
  const sorted = members.slice().sort((a, b) => b.balance - a.balance)
  return {
    plans,
    teaFeeAmount: teaAccount ? teaAccount.balance : 0,
    winnerName: sorted[0] ? sorted[0].name : '暂无',
    loserName: sorted[sorted.length - 1] ? sorted[sorted.length - 1].name : '暂无',
    transferCount: plans.length,
    totalAbsProfit: members.filter((item) => item.balance > 0).reduce((sum, item) => sum + item.balance, 0),
  }
}

export const archiveCurrentRoom = () =>
  updateState((draft) => {
    const currentUser = getMember(draft.room, draft.room.currentUserId)
    const settlement = getSettlementSummary()
    draft.history.unshift({
      id: `history-${Date.now()}`,
      roomName: draft.room.roomName,
      finishedAt: formatHistoryTime(new Date()),
      summary: settlement.plans
        .slice(0, 2)
        .map((item) => `${item.from} → ${item.to} ${item.amount}`)
        .join('，') || '本局已完成清算归档',
      profit: currentUser ? currentUser.balance : 0,
    })
    draft.room = createRoom(`${Math.floor(1000 + Math.random() * 9000)}`)
  })

export const clearHistory = () =>
  updateState((draft) => {
    draft.history = []
  })
