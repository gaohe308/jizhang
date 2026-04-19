import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EntryType } from '../../../generated/client/index'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class MemberService {
  constructor(private readonly prismaService: PrismaService) {}

  async updateNickname(userId: string, openid: string, roomId: string, displayName: string) {
    const room = await this.prismaService.room.findUnique({
      where: { id: roomId },
      include: {
        members: true,
      },
    })

    if (!room) {
      throw new NotFoundException('Room not found.')
    }

    const member = room.members.find((item) => item.userId === userId) || null
    if (!member) {
      throw new ForbiddenException('You are not a member of this room.')
    }

    const nextVersion = room.currentVersion + 1

    await this.prismaService.$transaction(async (tx) => {
      await tx.roomMember.update({
        where: { id: member.id },
        data: {
          displayName: displayName.trim(),
        },
      })

      await tx.room.update({
        where: { id: room.id },
        data: {
          currentVersion: nextVersion,
        },
      })

      await tx.ledgerEntry.create({
        data: {
          cloudbaseOpenId: openid,
          roomId: room.id,
          operatorMemberId: member.id,
          entryType: EntryType.SYSTEM,
          title: `${member.displayName} 修改了昵称`,
          description: `新昵称：${displayName.trim()}`,
          roomVersion: nextVersion,
        },
      })
    })

    return { success: true }
  }
}
