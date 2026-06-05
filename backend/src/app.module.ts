import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { TimewebService } from './timeweb.service';
import { DnsController } from './dns.controller';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthController } from './auth/auth.controller';

@Module({
  controllers: [DnsController, AuthController],
  providers: [AccountsService, TimewebService, AuthService, AuthGuard],
})
export class AppModule {}
