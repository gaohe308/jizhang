import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RuleController } from './rule.controller'
import { RuleService } from './rule.service'

@Module({
  imports: [AuthModule],
  controllers: [RuleController],
  providers: [RuleService],
  exports: [RuleService],
})
export class RuleModule {}
