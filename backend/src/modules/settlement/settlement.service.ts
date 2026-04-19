import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { MemberRole, RoomStatus } from '../../../generated/client/index'
import { PrismaService } from '../../prisma/prisma.service'
import { MemberBalanceSnapshot } from '../../shared/types/room.types'
import { buildSettlementSummary } from './domain/settlement-calculator'

@Injectable()
export class SettlementService {
  constructor(private readonly prismaService: PrismaService) {}

  buildSummary(members: MemberBalanceSnapshot[]) {
    return buildSettlementSummary(members)
  }

  private buildMemberSnapshots(room: {
    members: Array<{
      id: string
      displayName: string
      role: MemberRole
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

  async getPreview(userId: string, roomId: string) {
    const room = await this.prismaService.room.findUnique({
      where: { id: roomId },
      include: {
        members: true,
      },
    })

    if (!room) {
      throw new NotFoundException('Room not found.')
    }

    const isMember = room.members.some((member) => member.userId === userId)
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this room.')
    }

    return this.buildSummary(this.buildMemberSnapshots(room))
  }

  async archiveRoom(userId: string, openid: string, roomId: string) {
    const room = await this.prismaService.room.findUnique({
      where: { id: roomId },
      include: {
        members: true,
      },
    })

    if (!room || room.status !== RoomStatus.ACTIVE) {
      throw new NotFoundException('Room not found.')
    }

    const operator = room.members.find((member) => member.userId === userId) || null
    if (!operator || operator.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Only the room owner can archive the room.')
    }

    const summary = this.buildSummary(this.buildMemberSnapshots(room))

    await this.prismaService.$transaction(async (tx) => {
      const settlement = await tx.settlement.create({
        data: {
          cloudbaseOpenId: openid,
          roomId,
          teaFeeAmount: summary.teaFeeAmount,
          transferCount: summary.transferCount,
          totalAbsProfit: summary.totalAbsProfit,
          createdByUserId: userId,
          items: {
            create: summary.plans.map((item) => ({
              cloudbaseOpenId: openid,
              fromMemberId: item.fromMemberId,
              toMemberId: item.toMemberId,
              amount: item.amount,
            })),
          },
        },
      })

      await tx.historyRecord.createMany({
        data: room.members
          .filter((member) => member.role !== MemberRole.TEA && member.userId)
          .map((member) => ({
            cloudbaseOpenId: openid,
            userId: member.userId!,
            roomId,
            roomName: room.roomName,
            profit: member.balance,
            summary:
              summary.plans
                .slice(0, 2)
                .map((item) => `${item.fromName} -> ${item.toName} ${item.amount}`)
                .join('，') || '本局已完成清算归档',
            finishedAt: settlement.createdAt,
          })),
      })

      await tx.room.update({
        where: { id: roomId },
        data: {
          status: RoomStatus.ARCHIVED,
          archivedAt: settlement.createdAt,
        },
      })
    })

    return {
      success: true,
      summary,
    }
  }
}
