import { Controller, Delete, Get, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthTokenGuard } from '../../common/guards/auth-token.guard'
import { AuthUser } from '../../common/interfaces/auth-user.interface'
import { UserService } from './user.service'

@UseGuards(AuthTokenGuard)
@Controller('users/me')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getMe(@CurrentUser() user: AuthUser) {
    return this.userService.getMe(user.userId)
  }

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser) {
    return this.userService.getStats(user.userId)
  }

  @Get('history')
  getHistory(@CurrentUser() user: AuthUser) {
    return this.userService.getHistory(user.userId)
  }

  @Delete('history')
  clearHistory(@CurrentUser() user: AuthUser) {
    return this.userService.clearHistory(user.userId)
  }
}
