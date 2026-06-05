import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { parseCookies } from './cookie.util';

interface LoginBody {
  username?: string;
  password?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(
    @Body() body: LoginBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (body?.username || '').trim();
    const pass = body?.password || '';
    if (!this.auth.validate(user, pass)) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }
    res.cookie(this.auth.cookieName, this.auth.issue(user), {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: this.auth.ttlMs(),
      path: '/',
    });
    return { user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.auth.cookieName, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: Request) {
    const token = parseCookies(req.headers.cookie)[this.auth.cookieName];
    const user = this.auth.verify(token);
    if (!user) throw new UnauthorizedException('Не авторизован');
    return { user };
  }
}
