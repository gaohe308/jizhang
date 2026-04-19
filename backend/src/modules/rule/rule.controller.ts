import { Body, Controller, HttpCode, Param, Patch, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthTokenGuard } from '../../common/guards/auth-token.guard'
import { AuthUser } from '../../common/interfaces/auth-user.interface'
import { UpdateRoomRuleDto } from './dto/update-room-rule.dto'
import { RuleService } from './rule.service'

@UseGuards(AuthTokenGuard)
@Controller('rooms/:roomId/rules')
export class RuleController {
  constructor(private readonly ruleService: RuleService) {}

  @Patch()
  @HttpCode(200)
  updateRules(@CurrentUser() user: AuthUser, @Param('roomId') roomId: string, @Body() dto: UpdateRoomRuleDto) {
    return this.ruleService.updateRules(user.userId, user.openid, roomId, dto)
  }
}
