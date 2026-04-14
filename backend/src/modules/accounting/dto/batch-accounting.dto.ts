import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsInt, IsString, Min, MinLength, ValidateNested } from 'class-validator'

class BatchEntryDto {
  @IsString()
  targetMemberId!: string

  @IsInt()
  @Min(1)
  amount!: number
}

export class BatchAccountingDto {
  @IsString()
  @MinLength(8)
  requestId!: string

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchEntryDto)
  entries!: BatchEntryDto[]
}
