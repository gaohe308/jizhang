import { request } from './http'

export interface RoomMember {
  id: string
  userId: string | null
  name: string
  shortName: string
  role: 'owner' | 'player' | 'tea'
  balance: number
  isOnline: boolean
}

export interface RoomRule {
  teaFeeType: 'percent' | 'full'
  teaFeePercent: number
  teaFeeFullThreshold: number
  teaFeeFullAmount: number
  teaFeeCap: number
  layoutMode: 'top' | 'left'
  voiceBroadcast: boolean
  keepScreenOn: boolean
}

export interface LedgerEntry {
  id: string
  title: string
  description: string
  roomVersion: number
  time: string
}

export interface RoomSnapshot {
  roomId: string
  roomCode: string
  roomName: string
  status: 'active' | 'archived'
  currentVersion: number
  ownerMemberId: string | null
  currentUserMemberId: string | null
  members: RoomMember[]
  rules: RoomRule | null
  ledger: LedgerEntry[]
}

export interface UserStats {
  totalGames: number
  wins: number
  totalProfit: number
  winRate: string
  weekly: {
    totalGames: number
    wins: number
    winRate: string
  }
}

export interface HistoryRecord {
  id: string
  roomName: string
  finishedAt: string
  summary: string
  profit: number
}

export interface UserProfile {
  id: string
  openid: string
  nickname: string
  avatarUrl?: string | null
  createdAt: string
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

const CURRENT_ROOM_STORAGE_KEY = 'poker-current-room-snapshot'

const createRequestId = () => `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

export const getCurrentRoomSnapshot = () => {
  const snapshot = wx.getStorageSync(CURRENT_ROOM_STORAGE_KEY) as RoomSnapshot | ''
  if (!snapshot || typeof snapshot !== 'object' || !('roomId' in snapshot)) {
    return null
  }
  return snapshot
}

export const setCurrentRoomSnapshot = (snapshot: RoomSnapshot) => {
  wx.setStorageSync(CURRENT_ROOM_STORAGE_KEY, snapshot)
}

export const clearCurrentRoomSnapshot = () => {
  wx.removeStorageSync(CURRENT_ROOM_STORAGE_KEY)
}

export const fetchMyProfile = () =>
  request<UserProfile>({
    url: '/users/me',
    withAuth: true,
  })

export const fetchMyStats = () =>
  request<UserStats>({
    url: '/users/me/stats',
    withAuth: true,
  })

export const fetchMyHistory = () =>
  request<HistoryRecord[]>({
    url: '/users/me/history',
    withAuth: true,
  })

export const clearMyHistory = () =>
  request<{ success: boolean }>({
    url: '/users/me/history',
    method: 'DELETE',
    withAuth: true,
  })

export const createRoom = (roomName?: string) =>
  request<RoomSnapshot>({
    url: '/rooms',
    method: 'POST',
    data: roomName ? { roomName } : {},
    withAuth: true,
  })

export const joinRoom = (roomCode: string) =>
  request<RoomSnapshot>({
    url: '/rooms/join',
    method: 'POST',
    data: { roomCode: roomCode.trim() },
    withAuth: true,
  })

export const fetchRoomSnapshot = (roomId: string) =>
  request<RoomSnapshot>({
    url: `/rooms/${roomId}`,
    withAuth: true,
  })

export const updateMemberNickname = (roomId: string, displayName: string) =>
  request<{ success: boolean }>({
    url: `/rooms/${roomId}/members/me/nickname`,
    method: 'PATCH',
    data: { displayName: displayName.trim() },
    withAuth: true,
  })

export const updateRoomRules = (
  roomId: string,
  payload: Partial<{
    teaFeeType: 'percent' | 'full'
    teaFeePercent: number
    teaFeeFullThreshold: number
    teaFeeFullAmount: number
    teaFeeCap: number
    layoutMode: 'top' | 'left'
    voiceBroadcast: boolean
    keepScreenOn: boolean
  }>,
) =>
  request<{ success: boolean }>({
    url: `/rooms/${roomId}/rules`,
    method: 'PATCH',
    data: payload,
    withAuth: true,
  })

export const submitSingleAccounting = (roomId: string, targetMemberId: string, amount: number) =>
  request<{ success: boolean; roomVersion: number }>({
    url: `/rooms/${roomId}/accounting/single`,
    method: 'POST',
    data: {
      requestId: createRequestId(),
      targetMemberId,
      amount,
    },
    withAuth: true,
  })

export const submitBatchAccounting = (
  roomId: string,
  entries: Array<{ targetMemberId: string; amount: number }>,
) =>
  request<{ success: boolean; roomVersion: number }>({
    url: `/rooms/${roomId}/accounting/batch`,
    method: 'POST',
    data: {
      requestId: createRequestId(),
      entries,
    },
    withAuth: true,
  })

export const fetchSettlementPreview = (roomId: string) =>
  request<SettlementSummary>({
    url: `/rooms/${roomId}/settlement`,
    withAuth: true,
  })

export const archiveRoom = (roomId: string) =>
  request<{ success: boolean; summary: SettlementSummary }>({
    url: `/rooms/${roomId}/settlement/archive`,
    method: 'POST',
    data: { confirm: true },
    withAuth: true,
  })
