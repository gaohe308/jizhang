import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { SettlementController } from './settlement.controller'
import { SettlementService } from './settlement.service'

@Module({
  imports: [AuthModule],
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
