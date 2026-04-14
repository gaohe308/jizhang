import { IsInt, IsString, Min, MinLength } from 'class-validator'

export class SingleAccountingDto {
  @IsString()
  @MinLength(8)
  requestId!: string

  @IsString()
  targetMemberId!: string

  @IsInt()
  @Min(1)
  amount!: number
}
