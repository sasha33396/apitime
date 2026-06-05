import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'apitime_session';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  readonly cookieName = COOKIE_NAME;

  private readonly user = (process.env.APP_USER || 'admin').trim();
  private readonly password = process.env.APP_PASSWORD || '';
  // Секрет для подписи сессии. Если не задан — стабильно выводим из логина/пароля,
  // чтобы сессии переживали перезапуск контейнера.
  private readonly secret =
    process.env.AUTH_SECRET ||
    createHash('sha256').update(`${this.user}:${this.password}`).digest('hex');

  constructor() {
    if (!this.password) {
      this.logger.warn(
        'APP_PASSWORD не задан в .env — вход будет невозможен. Укажите APP_USER и APP_PASSWORD.',
      );
    }
  }

  validate(user: string, password: string): boolean {
    if (!this.password) return false;
    return this.safeEqual(user, this.user) && this.safeEqual(password, this.password);
  }

  issue(user: string): string {
    const payload = Buffer.from(
      JSON.stringify({ u: user, exp: Date.now() + TTL_MS, n: randomBytes(6).toString('hex') }),
    ).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  verify(token?: string): string | null {
    if (!token) return null;
    const dot = token.lastIndexOf('.');
    if (dot < 1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (!this.safeEqual(sig, this.sign(payload))) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (!data.exp || Date.now() > data.exp) return null;
      return data.u as string;
    } catch {
      return null;
    }
  }

  ttlMs(): number {
    return TTL_MS;
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
