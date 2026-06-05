import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { parseCookies } from './cookie.util';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = parseCookies(req.headers.cookie)[this.auth.cookieName];
    const user = this.auth.verify(token);
    if (!user) throw new UnauthorizedException('Требуется вход');
    return true;
  }
}
