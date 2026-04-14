import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthTokenGuard } from '../../common/guards/auth-token.guard'
import { AuthUser } from '../../common/interfaces/auth-user.interface'
import { BatchAccountingDto } from './dto/batch-accounting.dto'
import { SingleAccountingDto } from './dto/single-accounting.dto'
import { AccountingService } from './accounting.service'

@UseGuards(AuthTokenGuard)
@Controller('rooms/:roomId/accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Post('single')
  submitSingleTransfer(
    @CurrentUser() user: AuthUser,
    @Param('roomId') roomId: string,
    @Body() dto: SingleAccountingDto,
  ) {
    return this.accountingService.submitSingleTransfer({
      roomId,
      userId: user.userId,
      requestId: dto.requestId,
      targetMemberId: dto.targetMemberId,
      amount: dto.amount,
    })
  }

  @Post('batch')
  submitBatchTransfer(
    @CurrentUser() user: AuthUser,
    @Param('roomId') roomId: string,
    @Body() dto: BatchAccountingDto,
  ) {
    return this.accountingService.submitBatchTransfer({
      roomId,
      userId: user.userId,
      requestId: dto.requestId,
      entries: dto.entries,
    })
  }
}
