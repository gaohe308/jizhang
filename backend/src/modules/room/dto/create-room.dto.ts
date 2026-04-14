import { IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  roomName?: string
}
