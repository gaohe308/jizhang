import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HealthModule } from './modules/health/health.module'
import { PrismaModule } from './prisma/prisma.module'
import { AccountingModule } from './modules/accounting/accounting.module'
import { SettlementModule } from './modules/settlement/settlement.module'
import { AuthModule } from './modules/auth/auth.module'
import { UserModule } from './modules/user/user.module'
import { RoomModule } from './modules/room/room.module'
import { MemberModule } from './modules/member/member.module'
import { RuleModule } from './modules/rule/rule.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    RoomModule,
    MemberModule,
    RuleModule,
    HealthModule,
    AccountingModule,
    SettlementModule,
  ],
})
export class AppModule {}
