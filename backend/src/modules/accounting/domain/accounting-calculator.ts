import {
  BatchAccountingInputItem,
  LedgerMutationResult,
  MemberBalanceSnapshot,
  RoomRuleSnapshot,
} from '../../../shared/types/room.types'

const cloneMembers = (members: MemberBalanceSnapshot[]) => members.map((member) => ({ ...member }))

const getMember = (members: MemberBalanceSnapshot[], memberId: string) => members.find((member) => member.id === memberId) || null

export const calculateTeaFee = (amount: number, rules: RoomRuleSnapshot) => {
  const fee =
    rules.teaFeeType === 'full'
      ? Math.floor(amount / Math.max(rules.teaFeeFullThreshold, 1)) * rules.teaFeeFullAmount
      : Math.round((amount * rules.teaFeePercent) / 100)

  return Math.min(Math.max(fee, 0), rules.teaFeeCap)
}

export const applySingleAccounting = (params: {
  currentUserId: string
  targetMemberIds: string[]
  amount: number
  members: MemberBalanceSnapshot[]
  rules: RoomRuleSnapshot
}): { members: MemberBalanceSnapshot[]; ledger: LedgerMutationResult } => {
  const { amount, currentUserId, members, rules, targetMemberIds } = params

  if (amount <= 0) {
    throw new Error('Accounting amount must be greater than 0.')
  }

  const nextMembers = cloneMembers(members)
  const payer = getMember(nextMembers, currentUserId)
  const teaMember = nextMembers.find((member) => member.role === 'tea') || null

  if (!payer || !teaMember) {
    throw new Error('Payer or tea account is missing.')
  }

  const targets = targetMemberIds
    .map((targetId) => getMember(nextMembers, targetId))
    .filter((member): member is MemberBalanceSnapshot => Boolean(member && member.role !== 'tea' && member.id !== currentUserId))

  if (targets.length === 0) {
    throw new Error('At least one valid target member is required.')
  }

  const feePerTarget = calculateTeaFee(amount, rules)
  const netAmount = amount - feePerTarget
  const totalAmount = amount * targets.length
  const totalTeaFee = feePerTarget * targets.length

  payer.balance -= totalAmount
  teaMember.balance += totalTeaFee
  targets.forEach((target) => {
    target.balance += netAmount
  })

  const title =
    targets.length === 1
      ? `${payer.name} 向 ${targets[0].name} 支付 ${amount}`
      : `${payer.name} 批量支付 ${targets.map((target) => target.name).join(' / ')}`

  const description =
    targets.length === 1
      ? `自动扣除茶水费 ${feePerTarget}，到账 ${netAmount}`
      : `每人 ${amount}，茶水共 ${totalTeaFee}，已同步批量记账`

  return {
    members: nextMembers,
    ledger: {
      operatorId: payer.id,
      title,
      description,
      items: targets.map((target) => ({
        fromMemberId: payer.id,
        toMemberId: target.id,
        amount,
        teaFee: feePerTarget,
        netAmount,
      })),
    },
  }
}

export const applyBatchAccounting = (params: {
  currentUserId: string
  entries: BatchAccountingInputItem[]
  members: MemberBalanceSnapshot[]
  rules: RoomRuleSnapshot
}): { members: MemberBalanceSnapshot[]; ledger: LedgerMutationResult } => {
  const { currentUserId, entries, members, rules } = params

  const nextMembers = cloneMembers(members)
  const payer = getMember(nextMembers, currentUserId)
  const teaMember = nextMembers.find((member) => member.role === 'tea') || null

  if (!payer || !teaMember) {
    throw new Error('Payer or tea account is missing.')
  }

  const validEntries = entries
    .map((entry) => ({
      amount: entry.amount,
      target: getMember(nextMembers, entry.targetMemberId),
    }))
    .filter(
      (entry): entry is { amount: number; target: MemberBalanceSnapshot } =>
        Boolean(entry.target && entry.target.id !== currentUserId && entry.amount > 0),
    )

  if (validEntries.length === 0) {
    throw new Error('At least one valid batch entry is required.')
  }

  let totalTeaFee = 0
  let totalAmount = 0
  const items = validEntries.map(({ amount, target }) => {
    const teaFee = target.role === 'tea' ? 0 : calculateTeaFee(amount, rules)
    const netAmount = target.role === 'tea' ? amount : amount - teaFee

    totalAmount += amount
    payer.balance -= amount

    if (target.role === 'tea') {
      target.balance += amount
    } else {
      target.balance += netAmount
      teaMember.balance += teaFee
      totalTeaFee += teaFee
    }

    return {
      fromMemberId: payer.id,
      toMemberId: target.id,
      amount,
      teaFee,
      netAmount,
    }
  })

  const title = `${payer.name} 批量支付 ${validEntries.map((entry) => entry.target.name).join(' / ')}`
  const descriptionParts = [`共 ${validEntries.length} 人`, `合计 ${totalAmount}`]

  if (totalTeaFee > 0) {
    descriptionParts.push(`自动扣茶水 ${totalTeaFee}`)
  }

  return {
    members: nextMembers,
    ledger: {
      operatorId: payer.id,
      title,
      description: descriptionParts.join('，'),
      items,
    },
  }
}
