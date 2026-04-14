import { Injectable, UnauthorizedException } from '@nestjs/common'
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

    const query = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    })

    const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`)
    const session = (await response.json()) as WechatSessionResponse

    if (!session.openid || session.errcode) {
      throw new UnauthorizedException(session.errmsg || 'WeChat login failed.')
    }

    const user = await this.prismaService.user.upsert({
      where: {
        openid: session.openid,
      },
      update: {
        unionid: session.unionid,
      },
      create: {
        openid: session.openid,
        unionid: session.unionid,
        nickname: `微信用户${session.openid.slice(-4)}`,
      },
    })

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
