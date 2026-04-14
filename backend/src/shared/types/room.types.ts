export type MemberRole = 'owner' | 'player' | 'tea'
export type TeaFeeType = 'percent' | 'full'
export type LayoutMode = 'top' | 'left'

export interface RoomRuleSnapshot {
  teaFeeType: TeaFeeType
  teaFeePercent: number
  teaFeeFullThreshold: number
  teaFeeFullAmount: number
  teaFeeCap: number
  voiceBroadcast: boolean
  keepScreenOn: boolean
  layoutMode: LayoutMode
}

export interface MemberBalanceSnapshot {
  id: string
  name: string
  role: MemberRole
  balance: number
}

export interface LedgerMutationItem {
  fromMemberId: string
  toMemberId: string
  amount: number
  teaFee: number
  netAmount: number
}

export interface LedgerMutationResult {
  items: LedgerMutationItem[]
  operatorId: string
  title: string
  description: string
}

export interface BatchAccountingInputItem {
  targetMemberId: string
  amount: number
}

export interface SettlementPlanItem {
  fromMemberId: string
  fromName: string
  toMemberId: string
  toName: string
  amount: number
}

export interface SettlementSummary {
  plans: SettlementPlanItem[]
  teaFeeAmount: number
  winnerMemberId: string | null
  winnerName: string
  loserMemberId: string | null
  loserName: string
  transferCount: number
  totalAbsProfit: number
}
