import { IsString, MaxLength, MinLength } from 'class-validator'

export class UpdateMemberNicknameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  displayName!: string
}
