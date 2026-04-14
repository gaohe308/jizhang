import { IsBoolean } from 'class-validator'

export class ArchiveRoomDto {
  @IsBoolean()
  confirm!: boolean
}
