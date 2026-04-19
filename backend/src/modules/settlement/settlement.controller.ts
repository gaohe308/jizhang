import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthTokenGuard } from '../../common/guards/auth-token.guard'
import { AuthUser } from '../../common/interfaces/auth-user.interface'
import { ArchiveRoomDto } from './dto/archive-room.dto'
import { SettlementService } from './settlement.service'

@UseGuards(AuthTokenGuard)
@Controller('rooms/:roomId/settlement')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get()
  getPreview(@CurrentUser() user: AuthUser, @Param('roomId') roomId: string) {
    return this.settlementService.getPreview(user.userId, roomId)
  }

  @Post('archive')
  @HttpCode(200)
  archiveRoom(@CurrentUser() user: AuthUser, @Param('roomId') roomId: string, @Body() dto: ArchiveRoomDto) {
    if (!dto.confirm) {
      return {
        success: false,
        message: 'Archive confirmation is required.',
      }
    }

    return this.settlementService.archiveRoom(user.userId, user.openid, roomId)
  }
}
