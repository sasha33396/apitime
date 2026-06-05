import { Injectable, Logger } from '@nestjs/common';

export interface Account {
  name: string;
  token: string;
  domain: string;
}

/**
 * Читает список аккаунтов из переменных окружения вида:
 *   TW_ACCOUNT_1_NAME, TW_ACCOUNT_1_TOKEN, TW_ACCOUNT_1_DOMAIN
 *   TW_ACCOUNT_2_NAME, TW_ACCOUNT_2_TOKEN, TW_ACCOUNT_2_DOMAIN
 *   ...сколько угодно
 */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  private accounts: Account[] = [];

  constructor() {
    this.load();
  }

  private load() {
    const found: Record<number, Partial<Account>> = {};
    for (const [key, value] of Object.entries(process.env)) {
      const m = key.match(/^TW_ACCOUNT_(\d+)_(NAME|TOKEN|DOMAIN)$/);
      if (!m || value == null) continue;
      const idx = Number(m[1]);
      found[idx] = found[idx] || {};
      const field = m[2].toLowerCase() as keyof Account;
      found[idx][field] = value;
    }

    this.accounts = Object.keys(found)
      .map(Number)
      .sort((a, b) => a - b)
      .map((i) => found[i])
      .filter((a): a is Account => Boolean(a.token && a.domain))
      .map((a) => ({ name: a.name || a.domain, token: a.token, domain: a.domain }));

    if (this.accounts.length === 0) {
      this.logger.warn(
        'Не найдено ни одного аккаунта. Задайте TW_ACCOUNT_1_TOKEN / TW_ACCOUNT_1_DOMAIN в .env',
      );
    } else {
      this.logger.log(`Загружено аккаунтов: ${this.accounts.length}`);
    }
  }

  get(index: number): Account | undefined {
    return this.accounts[index];
  }

  publicList() {
    return this.accounts.map((a) => ({ name: a.name, domain: a.domain }));
  }
}
