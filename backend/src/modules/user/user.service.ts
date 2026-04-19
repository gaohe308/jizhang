import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

const startOfWeek = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = start.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + mondayOffset)
  start.setHours(0, 0, 0, 0)
  return start
}

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async getMe(userId: string) {
    return this.prismaService.runWithReconnect('user.getMe', () =>
      this.prismaService.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          openid: true,
          nickname: true,
          avatarUrl: true,
          createdAt: true,
        },
      }),
    )
  }

  async getStats(userId: string) {
    const history = await this.prismaService.runWithReconnect('user.getStats.history', () =>
      this.prismaService.historyRecord.findMany({
        where: { userId },
        select: {
          profit: true,
          finishedAt: true,
        },
      }),
    )

    const totalGames = history.length
    const wins = history.filter((item) => item.profit > 0).length
    const totalProfit = history.reduce((sum, item) => sum + item.profit, 0)

    const weeklyStart = startOfWeek()
    const weeklyHistory = history.filter((item) => item.finishedAt >= weeklyStart)
    const weeklyGames = weeklyHistory.length
    const weeklyWins = weeklyHistory.filter((item) => item.profit > 0).length

    return {
      totalGames,
      wins,
      totalProfit,
      winRate: totalGames === 0 ? '0.0%' : `${((wins / totalGames) * 100).toFixed(1)}%`,
      weekly: {
        totalGames: weeklyGames,
        wins: weeklyWins,
        winRate: weeklyGames === 0 ? '0.0%' : `${((weeklyWins / weeklyGames) * 100).toFixed(1)}%`,
      },
    }
  }

  async getHistory(userId: string) {
    return this.prismaService.runWithReconnect('user.getHistory', () =>
      this.prismaService.historyRecord.findMany({
        where: { userId },
        orderBy: {
          finishedAt: 'desc',
        },
      }),
    )
  }

  async clearHistory(userId: string) {
    await this.prismaService.runWithReconnect('user.clearHistory', () =>
      this.prismaService.historyRecord.deleteMany({
        where: { userId },
      }),
    )

    return { success: true }
  }
}
