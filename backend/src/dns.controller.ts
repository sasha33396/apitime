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
} from '@nestjs/common';
import { Account, AccountsService } from './accounts.service';
import { TimewebService } from './timeweb.service';

interface RecordBody {
  value?: string;
  ttl?: number;
}

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
  async create(@Query('account') account: string, @Body() body: RecordBody) {
    const acc = this.resolve(account);
    const value = (body?.value || '').trim();
    if (!value) throw new BadRequestException('Не указан IP-адрес');
    await this.tw.create(acc, value, body?.ttl || 600);
    return { ok: true };
  }

  @Patch('records')
  async update(
    @Query('account') account: string,
    @Query('id') id: string,
    @Body() body: RecordBody,
  ) {
    const acc = this.resolve(account);
    const value = (body?.value || '').trim();
    if (!value) throw new BadRequestException('Не указан IP-адрес');
    await this.tw.update(acc, Number(id), value, body?.ttl || 600);
    return { ok: true };
  }

  @Delete('records')
  async remove(@Query('account') account: string, @Query('id') id: string) {
    const acc = this.resolve(account);
    await this.tw.remove(acc, Number(id));
    return { ok: true };
  }
}
