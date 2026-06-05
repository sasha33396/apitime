import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Account, AccountsService } from './accounts.service';
import { TimewebService } from './timeweb.service';
import { AuthGuard } from './auth/auth.guard';

interface UpdateBody {
  value?: string;
  ttl?: number;
}

interface CreateBody {
  subdomain?: string; // имя поддомена (пусто = корень). Можно и полное fqdn.
  value?: string;
  ttl?: number;
}

@UseGuards(AuthGuard)
@Controller()
export class DnsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly tw: TimewebService,
  ) {}

  private resolve(index: string): Account {
    const acc = this.accounts.get(Number(index));
    if (!acc) throw new NotFoundException('Аккаунт не найден');
    return acc;
  }

  /** Собирает полное имя из введённого поддомена. */
  private buildFqdn(acc: Account, raw?: string): string {
    const name = (raw || '').trim().replace(/\.+$/, '').toLowerCase();
    if (!name) return acc.domain;
    if (name === acc.domain || name.endsWith(`.${acc.domain}`)) return name;
    return `${name}.${acc.domain}`;
  }

  @Get('accounts')
  list() {
    return { accounts: this.accounts.publicList() };
  }

  @Get('records')
  async records(@Query('account') account: string) {
    const acc = this.resolve(account);
    const records = await this.tw.listARecords(acc);
    return { records, domain: acc.domain };
  }

  @Post('records')
  async create(@Query('account') account: string, @Body() body: CreateBody) {
    const acc = this.resolve(account);
    const value = (body?.value || '').trim();
    if (!value) throw new BadRequestException('Не указан IP-адрес');
    const fqdn = this.buildFqdn(acc, body?.subdomain);
    await this.tw.create(acc, fqdn, value, Number(body?.ttl) || 60);
    return { ok: true };
  }

  @Patch('records')
  async update(
    @Query('account') account: string,
    @Query('fqdn') fqdn: string,
    @Query('id') id: string,
    @Body() body: UpdateBody,
  ) {
    const acc = this.resolve(account);
    const value = (body?.value || '').trim();
    if (!value) throw new BadRequestException('Не указан IP-адрес');
    if (!fqdn) throw new BadRequestException('Не указан fqdn записи');
    await this.tw.update(acc, fqdn, Number(id), value, Number(body?.ttl) || 60);
    return { ok: true };
  }

  @Delete('records')
  async remove(
    @Query('account') account: string,
    @Query('fqdn') fqdn: string,
    @Query('id') id: string,
  ) {
    const acc = this.resolve(account);
    if (!fqdn) throw new BadRequestException('Не указан fqdn записи');
    await this.tw.remove(acc, fqdn, Number(id));
    return { ok: true };
  }
}
