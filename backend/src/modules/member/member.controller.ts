import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthTokenGuard } from '../../common/guards/auth-token.guard'
import { AuthUser } from '../../common/interfaces/auth-user.interface'
import { UpdateMemberNicknameDto } from './dto/update-member-nickname.dto'
import { MemberService } from './member.service'

@UseGuards(AuthTokenGuard)
@Controller('rooms/:roomId/members/me')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Patch('nickname')
  updateNickname(
    @CurrentUser() user: AuthUser,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateMemberNicknameDto,
  ) {
    return this.memberService.updateNickname(user.userId, roomId, dto.displayName)
  }
}
