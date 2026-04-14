import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator'

export class UpdateRoomRuleDto {
  @IsOptional()
  @IsIn(['percent', 'full'])
  teaFeeType?: 'percent' | 'full'

  @IsOptional()
  @IsInt()
  @Min(0)
  teaFeePercent?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  teaFeeFullThreshold?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  teaFeeFullAmount?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  teaFeeCap?: number

  @IsOptional()
  @IsIn(['top', 'left'])
  layoutMode?: 'top' | 'left'

  @IsOptional()
  @IsBoolean()
  voiceBroadcast?: boolean

  @IsOptional()
  @IsBoolean()
  keepScreenOn?: boolean
}
