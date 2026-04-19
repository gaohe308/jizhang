import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../prisma/prisma.service'

interface WechatSessionResponse {
  openid?: string
  session_key?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

  async login(code: string) {
    const appId = this.configService.get<string>('WECHAT_APP_ID')
    const appSecret = this.configService.get<string>('WECHAT_APP_SECRET')

    if (!appId || !appSecret) {
      throw new UnauthorizedException('WeChat app credentials are not configured.')
    }

    const wechatApiTimeoutMs = Number(this.configService.get<string>('WECHAT_API_TIMEOUT_MS') || '5000')

    const query = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    })

    let session: WechatSessionResponse

    try {
      const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`, {
        signal: AbortSignal.timeout(wechatApiTimeoutMs),
      })

      session = (await response.json()) as WechatSessionResponse
    } catch (error) {
      this.logger.error(
        `Failed to call WeChat jscode2session within ${wechatApiTimeoutMs}ms.`,
        error instanceof Error ? error.stack : undefined,
      )

      throw new ServiceUnavailableException(
        '微信登录服务暂时不可用，请稍后重试；如果持续失败，请检查云函数公网访问配置。',
      )
    }

    if (!session.openid || session.errcode) {
      this.logger.warn(`WeChat login failed: errcode=${session.errcode}, errmsg=${session.errmsg}`)
      throw new UnauthorizedException(session.errmsg || 'WeChat login failed.')
    }

    const openid = session.openid

    const user = await this.prismaService.runWithReconnect('auth.login.userUpsert', () =>
      this.prismaService.user.upsert({
        where: {
          openid,
        },
        update: {
          cloudbaseOpenId: openid,
          unionid: session.unionid,
        },
        create: {
          cloudbaseOpenId: openid,
          openid,
          unionid: session.unionid,
          nickname: `微信用户${openid.slice(-4)}`,
        },
      }),
    )

    const token = await this.jwtService.signAsync({
      sub: user.id,
      openid: user.openid,
      nickname: user.nickname,
    })

    return {
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
      },
    }
  }
}
