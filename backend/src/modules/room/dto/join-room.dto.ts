import { IsString, Length } from 'class-validator'

export class JoinRoomDto {
  @IsString()
  @Length(4, 16)
  roomCode!: string
}
