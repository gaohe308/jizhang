import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { AuthTokenGuard } from '../../common/guards/auth-token.guard'

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'dev-secret',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '7d') as never,
        },
      }),
    }),
  ],
  providers: [AuthService, AuthTokenGuard],
  controllers: [AuthController],
  exports: [JwtModule, AuthService, AuthTokenGuard],
})
export class AuthModule {}
