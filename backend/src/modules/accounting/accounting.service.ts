import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EntryType, LayoutMode, TeaFeeType } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  BatchAccountingInputItem,
  MemberBalanceSnapshot,
  RoomRuleSnapshot,
} from '../../shared/types/room.types'
import { applyBatchAccounting, applySingleAccounting } from './domain/accounting-calculator'

@Injectable()
export class AccountingService {
  constructor(private readonly prismaService: PrismaService) {}

  private buildRuleSnapshot(room: {
    rules: {
      teaFeeType: TeaFeeType
      teaFeePercent: number
      teaFeeFullThreshold: number
      teaFeeFullAmount: number
      teaFeeCap: number
      voiceBroadcast: boolean
      keepScreenOn: boolean
      layoutMode: LayoutMode
    } | null
  }): RoomRuleSnapshot {
    if (!room.rules) {
      throw new NotFoundException('Room rules not found.')
    }

    return {
      teaFeeType: room.rules.teaFeeType === TeaFeeType.FULL ? 'full' : 'percent',
      teaFeePercent: room.rules.teaFeePercent,
      teaFeeFullThreshold: room.rules.teaFeeFullThreshold,
      teaFeeFullAmount: room.rules.teaFeeFullAmount,
      teaFeeCap: room.rules.teaFeeCap,
      voiceBroadcast: room.rules.voiceBroadcast,
      keepScreenOn: room.rules.keepScreenOn,
      layoutMode: room.rules.layoutMode === LayoutMode.LEFT ? 'left' : 'top',
    }
  }

  private buildMemberSnapshots(room: {
    members: Array<{
      id: string
      displayName: string
      role: 'OWNER' | 'PLAYER' | 'TEA'
      balance: number
    }>
  }): MemberBalanceSnapshot[] {
    return room.members.map((member) => ({
      id: member.id,
      name: member.displayName,
      role: member.role.toLowerCase() as MemberBalanceSnapshot['role'],
      balance: member.balance,
    }))
  }

  applySingleTransfer(params: {
    currentUserId: string
    targetMemberIds: string[]
    amount: number
    members: MemberBalanceSnapshot[]
    rules: RoomRuleSnapshot
  }) {
    return applySingleAccounting(params)
  }

  applyBatchTransfer(params: {
    currentUserId: string
    entries: BatchAccountingInputItem[]
    members: MemberBalanceSnapshot[]
    rules: RoomRuleSnapshot
  }) {
    return applyBatchAccounting(params)
  }

  async submitSingleTransfer(params: {
    roomId: string
    userId: string
    requestId: string
    targetMemberId: string
    amount: number
  }) {
    const room = await this.prismaService.room.findUnique({
      where: { id: params.roomId },
      include: {
        members: true,
        rules: true,
      },
    })

    if (!room) {
      throw new NotFoundException('Room not found.')
    }

    const operator = room.members.find((member) => member.userId === params.userId) || null
    if (!operator) {
      throw new ForbiddenException('You are not a member of this room.')
    }

    const result = this.applySingleTransfer({
      currentUserId: operator.id,
      targetMemberIds: [params.targetMemberId],
      amount: params.amount,
      members: this.buildMemberSnapshots(room),
      rules: this.buildRuleSnapshot(room),
    })

    const nextVersion = room.currentVersion + 1

    await this.prismaService.$transaction(async (tx) => {
      for (const member of result.members) {
        await tx.roomMember.update({
          where: { id: member.id },
          data: { balance: member.balance },
        })
      }

      await tx.room.update({
        where: { id: room.id },
        data: {
          currentVersion: nextVersion,
        },
      })

      await tx.ledgerEntry.create({
        data: {
          roomId: room.id,
          requestId: params.requestId,
          operatorMemberId: result.ledger.operatorId,
          entryType: EntryType.SINGLE_TRANSFER,
          title: result.ledger.title,
          description: result.ledger.description,
          roomVersion: nextVersion,
          items: {
            create: result.ledger.items.map((item) => ({
              fromMemberId: item.fromMemberId,
              toMemberId: item.toMemberId,
              amount: item.amount,
              teaFee: item.teaFee,
              netAmount: item.netAmount,
            })),
          },
        },
      })
    })

    return { success: true, roomVersion: nextVersion }
  }

  async submitBatchTransfer(params: {
    roomId: string
    userId: string
    requestId: string
    entries: BatchAccountingInputItem[]
  }) {
    const room = await this.prismaService.room.findUnique({
      where: { id: params.roomId },
      include: {
        members: true,
        rules: true,
      },
    })

    if (!room) {
      throw new NotFoundException('Room not found.')
    }

    const operator = room.members.find((member) => member.userId === params.userId) || null
    if (!operator) {
      throw new ForbiddenException('You are not a member of this room.')
    }

    const result = this.applyBatchTransfer({
      currentUserId: operator.id,
      entries: params.entries,
      members: this.buildMemberSnapshots(room),
      rules: this.buildRuleSnapshot(room),
    })

    const nextVersion = room.currentVersion + 1

    await this.prismaService.$transaction(async (tx) => {
      for (const member of result.members) {
        await tx.roomMember.update({
          where: { id: member.id },
          data: { balance: member.balance },
        })
      }

      await tx.room.update({
        where: { id: room.id },
        data: {
          currentVersion: nextVersion,
        },
      })

      await tx.ledgerEntry.create({
        data: {
          roomId: room.id,
          requestId: params.requestId,
          operatorMemberId: result.ledger.operatorId,
          entryType: EntryType.BATCH_TRANSFER,
          title: result.ledger.title,
          description: result.ledger.description,
          roomVersion: nextVersion,
          items: {
            create: result.ledger.items.map((item) => ({
              fromMemberId: item.fromMemberId,
              toMemberId: item.toMemberId,
              amount: item.amount,
              teaFee: item.teaFee,
              netAmount: item.netAmount,
            })),
          },
        },
      })
    })

    return { success: true, roomVersion: nextVersion }
  }
}
