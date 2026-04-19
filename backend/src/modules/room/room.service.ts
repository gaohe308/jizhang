import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import {
  EntryType,
  LayoutMode,
  MemberRole,
  Prisma,
  RoomStatus,
  TeaFeeType,
} from '../../../generated/client/index'
import { PrismaService } from '../../prisma/prisma.service'

const roomInclude = {
  members: {
    orderBy: {
      createdAt: 'asc',
    },
  },
  rules: true,
  ledgerEntries: {
    orderBy: {
      occurredAt: 'desc',
    },
    take: 30,
  },
} satisfies Prisma.RoomInclude

type RoomWithRelations = Prisma.RoomGetPayload<{ include: typeof roomInclude }>

const randomCode = () => `${Math.floor(1000 + Math.random() * 9000)}`

@Injectable()
export class RoomService {
  constructor(private readonly prismaService: PrismaService) {}

  private mapRoomSnapshot(room: RoomWithRelations, currentUserId: string) {
    const currentUserMember = room.members.find((member) => member.userId === currentUserId) || null
    const ownerMember = room.members.find((member) => member.role === MemberRole.OWNER) || null

    return {
      roomId: room.id,
      roomCode: room.roomCode,
      roomName: room.roomName,
      status: room.status.toLowerCase(),
      currentVersion: room.currentVersion,
      ownerMemberId: ownerMember?.id || null,
      currentUserMemberId: currentUserMember?.id || null,
      members: room.members.map((member) => ({
        id: member.id,
        userId: member.userId,
        name: member.displayName,
        shortName: member.displayName.slice(0, 1),
        role: member.role.toLowerCase(),
        balance: member.balance,
        isOnline: member.isOnline,
      })),
      rules: room.rules
        ? {
            teaFeeType: room.rules.teaFeeType === TeaFeeType.FULL ? 'full' : 'percent',
            teaFeePercent: room.rules.teaFeePercent,
            teaFeeFullThreshold: room.rules.teaFeeFullThreshold,
            teaFeeFullAmount: room.rules.teaFeeFullAmount,
            teaFeeCap: room.rules.teaFeeCap,
            layoutMode: room.rules.layoutMode === LayoutMode.LEFT ? 'left' : 'top',
            voiceBroadcast: room.rules.voiceBroadcast,
            keepScreenOn: room.rules.keepScreenOn,
          }
        : null,
      ledger: room.ledgerEntries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        description: entry.description,
        roomVersion: entry.roomVersion,
        time: entry.occurredAt,
      })),
    }
  }

  private async generateRoomCode() {
    for (let index = 0; index < 10; index += 1) {
      const code = randomCode()
      const existing = await this.prismaService.room.findUnique({
        where: { roomCode: code },
        select: { id: true },
      })
      if (!existing) {
        return code
      }
    }

    throw new BadRequestException('Failed to generate a unique room code.')
  }

  async createRoom(userId: string, openid: string, roomName?: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found.')
    }

    const roomCode = await this.generateRoomCode()
    const nextRoomName = roomName?.trim() || '松月包间'

    const room = await this.prismaService.$transaction(async (tx) => {
      const createdRoom = await tx.room.create({
        data: {
          cloudbaseOpenId: openid,
          roomCode,
          roomName: nextRoomName,
          ownerUserId: user.id,
          status: RoomStatus.ACTIVE,
        },
      })

      await tx.roomMember.createMany({
        data: [
          {
            cloudbaseOpenId: openid,
            roomId: createdRoom.id,
            userId: user.id,
            displayName: user.nickname,
            role: MemberRole.OWNER,
            isOnline: true,
          },
          {
            cloudbaseOpenId: openid,
            roomId: createdRoom.id,
            userId: null,
            displayName: '茶水',
            role: MemberRole.TEA,
            isOnline: false,
          },
        ],
      })

      await tx.roomRule.create({
        data: {
          cloudbaseOpenId: openid,
          roomId: createdRoom.id,
          teaFeeType: TeaFeeType.PERCENT,
          teaFeePercent: 10,
          teaFeeFullThreshold: 10,
          teaFeeFullAmount: 1,
          teaFeeCap: 6,
          layoutMode: LayoutMode.TOP,
          voiceBroadcast: true,
          keepScreenOn: false,
        },
      })

      return tx.room.findUniqueOrThrow({
        where: { id: createdRoom.id },
        include: roomInclude,
      })
    })

    return this.mapRoomSnapshot(room, userId)
  }

  async joinRoom(userId: string, openid: string, roomCode: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found.')
    }

    const room = await this.prismaService.room.findUnique({
      where: { roomCode },
      include: roomInclude,
    })

    if (!room || room.status !== RoomStatus.ACTIVE) {
      throw new NotFoundException('Room not found.')
    }

    const existingMember = room.members.find((member) => member.userId === userId) || null

    if (existingMember) {
      await this.prismaService.roomMember.update({
        where: { id: existingMember.id },
        data: { isOnline: true },
      })

      const latestRoom = await this.prismaService.room.findUniqueOrThrow({
        where: { id: room.id },
        include: roomInclude,
      })
      return this.mapRoomSnapshot(latestRoom, userId)
    }

    const nextVersion = room.currentVersion + 1
    const joinedRoom = await this.prismaService.$transaction(async (tx) => {
      const member = await tx.roomMember.create({
        data: {
          cloudbaseOpenId: openid,
          roomId: room.id,
          userId: user.id,
          displayName: user.nickname,
          role: MemberRole.PLAYER,
          isOnline: true,
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
          title: `${user.nickname} 加入房间`,
          description: `成员数量已更新，房间版本 v${nextVersion}`,
          roomVersion: nextVersion,
        },
      })

      return tx.room.findUniqueOrThrow({
        where: { id: room.id },
        include: roomInclude,
      })
    })

    return this.mapRoomSnapshot(joinedRoom, userId)
  }

  async getRoomSnapshot(userId: string, roomId: string) {
    const room = await this.prismaService.room.findUnique({
      where: { id: roomId },
      include: roomInclude,
    })

    if (!room) {
      throw new NotFoundException('Room not found.')
    }

    const isMember = room.members.some((member) => member.userId === userId)
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this room.')
    }

    return this.mapRoomSnapshot(room, userId)
  }
}
