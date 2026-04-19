import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Controller('health')
export class HealthController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  check() {
    const diagnostics = this.prismaService.getDiagnostics()

    return {
      ok: diagnostics.connected,
      runtime: process.env.APP_RUNTIME || 'local',
      service: 'poker-bookkeeping-backend',
      time: new Date().toISOString(),
      database: diagnostics,
    }
  }
}
