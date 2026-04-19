import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthTokenGuard } from '../../common/guards/auth-token.guard'
import { AuthUser } from '../../common/interfaces/auth-user.interface'
import { CreateRoomDto } from './dto/create-room.dto'
import { JoinRoomDto } from './dto/join-room.dto'
import { RoomService } from './room.service'

@UseGuards(AuthTokenGuard)
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @HttpCode(200)
  createRoom(@CurrentUser() user: AuthUser, @Body() dto: CreateRoomDto) {
    return this.roomService.createRoom(user.userId, user.openid, dto.roomName)
  }

  @Post('join')
  @HttpCode(200)
  joinRoom(@CurrentUser() user: AuthUser, @Body() dto: JoinRoomDto) {
    return this.roomService.joinRoom(user.userId, user.openid, dto.roomCode)
  }

  @Get(':roomId')
  getRoomSnapshot(@CurrentUser() user: AuthUser, @Param('roomId') roomId: string) {
    return this.roomService.getRoomSnapshot(user.userId, roomId)
  }
}
