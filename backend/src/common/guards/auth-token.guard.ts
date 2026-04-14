import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AuthUser } from '../interfaces/auth-user.interface'

@Injectable()
export class AuthTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>
      user?: AuthUser
    }>()

    const authorization = request.headers.authorization || request.headers.Authorization
    if (!authorization) {
      throw new UnauthorizedException('Missing authorization header.')
    }

    const [scheme, token] = authorization.split(' ')
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header.')
    }

    const payload = this.jwtService.verify(token)
    request.user = {
      userId: payload.sub,
      openid: payload.openid,
      nickname: payload.nickname,
    }
    return true
  }
}
