import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { TimewebService } from './timeweb.service';
import { DnsController } from './dns.controller';

@Module({
  controllers: [DnsController],
  providers: [AccountsService, TimewebService],
})
export class AppModule {}
