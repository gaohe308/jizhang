import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EntryType, LayoutMode, MemberRole, TeaFeeType } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { UpdateRoomRuleDto } from './dto/update-room-rule.dto'

@Injectable()
export class RuleService {
  constructor(private readonly prismaService: PrismaService) {}

  async updateRules(userId: string, roomId: string, dto: UpdateRoomRuleDto) {
    const room = await this.prismaService.room.findUnique({
      where: { id: roomId },
      include: {
        members: true,
        rules: true,
      },
    })

    if (!room || !room.rules) {
      throw new NotFoundException('Room not found.')
    }

    const operator = room.members.find((member) => member.userId === userId) || null
    if (!operator || operator.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Only the room owner can update rules.')
    }

    const nextVersion = room.currentVersion + 1
    const teaFeeType = dto.teaFeeType === 'full' ? TeaFeeType.FULL : dto.teaFeeType === 'percent' ? TeaFeeType.PERCENT : room.rules.teaFeeType
    const layoutMode = dto.layoutMode === 'left' ? LayoutMode.LEFT : dto.layoutMode === 'top' ? LayoutMode.TOP : room.rules.layoutMode

    await this.prismaService.$transaction(async (tx) => {
      await tx.roomRule.update({
        where: { roomId },
        data: {
          teaFeeType,
          teaFeePercent: dto.teaFeePercent ?? room.rules!.teaFeePercent,
          teaFeeFullThreshold: dto.teaFeeFullThreshold ?? room.rules!.teaFeeFullThreshold,
          teaFeeFullAmount: dto.teaFeeFullAmount ?? room.rules!.teaFeeFullAmount,
          teaFeeCap: dto.teaFeeCap ?? room.rules!.teaFeeCap,
          layoutMode,
          voiceBroadcast: dto.voiceBroadcast ?? room.rules!.voiceBroadcast,
          keepScreenOn: dto.keepScreenOn ?? room.rules!.keepScreenOn,
          updatedByMemberId: operator.id,
        },
      })

      await tx.room.update({
        where: { id: roomId },
        data: {
          currentVersion: nextVersion,
        },
      })

      await tx.ledgerEntry.create({
        data: {
          roomId,
          operatorMemberId: operator.id,
          entryType: EntryType.RULE_CHANGE,
          title: `${operator.displayName} 修改了房间规则`,
          description: `房间规则已更新，房间版本 v${nextVersion}`,
          roomVersion: nextVersion,
        },
      })
    })

    return { success: true }
  }
}
