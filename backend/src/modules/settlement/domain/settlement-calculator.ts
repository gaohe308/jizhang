import { MemberBalanceSnapshot, SettlementPlanItem, SettlementSummary } from '../../../shared/types/room.types'

const toAmount = (value: number) => Math.abs(value)

export const buildSettlementSummary = (members: MemberBalanceSnapshot[]): SettlementSummary => {
  const playerMembers = members.filter((member) => member.role !== 'tea')
  const teaMember = members.find((member) => member.role === 'tea') || null

  const debtors = playerMembers
    .filter((member) => member.balance < 0)
    .map((member) => ({
      memberId: member.id,
      name: member.name,
      amount: toAmount(member.balance),
    }))

  const creditors = playerMembers
    .filter((member) => member.balance > 0)
    .map((member) => ({
      memberId: member.id,
      name: member.name,
      amount: member.balance,
    }))

  const plans: SettlementPlanItem[] = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const amount = Math.min(debtor.amount, creditor.amount)

    plans.push({
      fromMemberId: debtor.memberId,
      fromName: debtor.name,
      toMemberId: creditor.memberId,
      toName: creditor.name,
      amount,
    })

    debtor.amount -= amount
    creditor.amount -= amount

    if (debtor.amount === 0) {
      debtorIndex += 1
    }
    if (creditor.amount === 0) {
      creditorIndex += 1
    }
  }

  const sorted = [...playerMembers].sort((left, right) => right.balance - left.balance)

  return {
    plans,
    teaFeeAmount: teaMember?.balance || 0,
    winnerMemberId: sorted[0]?.id || null,
    winnerName: sorted[0]?.name || '暂无',
    loserMemberId: sorted[sorted.length - 1]?.id || null,
    loserName: sorted[sorted.length - 1]?.name || '暂无',
    transferCount: plans.length,
    totalAbsProfit: playerMembers.filter((member) => member.balance > 0).reduce((sum, member) => sum + member.balance, 0),
  }
}
