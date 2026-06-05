import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { Account } from './accounts.service';

const API_BASE = 'https://api.timeweb.cloud';

export interface ARecord {
  id: number;
  fqdn: string; // полное имя, где живёт запись (корень или поддомен)
  value: string;
  ttl: number;
}

/** Достаёт значение записи (IP для A) из поля value или вложенного data. */
function extractValue(r: any): string {
  if (!r || typeof r !== 'object') return '';
  if (r.value != null && r.value !== '') return String(r.value);
  const d = r.data;
  if (d && typeof d === 'object') {
    for (const k of ['value', 'ip', 'address']) {
      if (d[k]) return String(d[k]);
    }
  }
  return '';
}

@Injectable()
export class TimewebService {
  private async call(
    token: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<any> {
    let res: Response;
    try {
      res = await fetch(API_BASE + path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e: any) {
      throw new HttpException(
        `Не удалось подключиться к Timeweb API: ${e?.message ?? e}`,
        502,
      );
    }

    const text = await res.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!res.ok) {
      const msg =
        data?.message || data?.error_code || data?.raw || `HTTP ${res.status}`;
      throw new HttpException(
        `Ошибка Timeweb API ${res.status}: ${msg}`,
        res.status >= 500 ? 502 : res.status,
      );
    }
    return data;
  }

  /** Список fqdn'ов домена: сам домен + все его поддомены. */
  private async listFqdns(acc: Account): Promise<string[]> {
    const fqdns = new Set<string>([acc.domain]);
    try {
      const info = await this.call(
        acc.token,
        'GET',
        `/api/v1/domains/${acc.domain}`,
      );
      const subs: any[] = info?.domain?.subdomains ?? [];
      for (const s of subs) {
        const fqdn = typeof s === 'string' ? s : s?.fqdn;
        if (fqdn) fqdns.add(fqdn);
      }
    } catch {
      // если не удалось получить инфо о домене — работаем хотя бы с корнем
    }
    return [...fqdns];
  }

  private async recordsFor(acc: Account, fqdn: string): Promise<ARecord[]> {
    try {
      const data = await this.call(
        acc.token,
        'GET',
        `/api/v1/domains/${fqdn}/dns-records?limit=500`,
      );
      const recs: any[] = data?.dns_records ?? [];
      return recs
        .filter((r) => r.type === 'A')
        .map((r) => ({
          id: r.id,
          fqdn,
          value: extractValue(r),
          ttl: r.ttl ?? 600,
        }));
    } catch {
      return [];
    }
  }

  /** Все A-записи домена и его поддоменов. */
  async listARecords(acc: Account): Promise<ARecord[]> {
    const fqdns = await this.listFqdns(acc);
    const groups = await Promise.all(fqdns.map((f) => this.recordsFor(acc, f)));

    // дедупликация по id на случай пересечений
    const byId = new Map<number, ARecord>();
    for (const rec of groups.flat()) byId.set(rec.id, rec);

    return [...byId.values()].sort((a, b) => {
      if (a.fqdn === acc.domain) return -1; // корень сверху
      if (b.fqdn === acc.domain) return 1;
      return a.fqdn.localeCompare(b.fqdn);
    });
  }

  /** Проверяем, что fqdn принадлежит домену аккаунта (защита от чужих доменов). */
  private assertOwned(acc: Account, fqdn: string) {
    if (fqdn !== acc.domain && !fqdn.endsWith(`.${acc.domain}`)) {
      throw new BadRequestException(`fqdn ${fqdn} не относится к домену ${acc.domain}`);
    }
  }

  create(acc: Account, fqdn: string, value: string, ttl: number) {
    this.assertOwned(acc, fqdn);
    return this.call(acc.token, 'POST', `/api/v2/domains/${fqdn}/dns-records`, {
      type: 'A',
      value,
      ttl,
    });
  }

  update(acc: Account, fqdn: string, id: number, value: string, ttl: number) {
    this.assertOwned(acc, fqdn);
    return this.call(
      acc.token,
      'PATCH',
      `/api/v2/domains/${fqdn}/dns-records/${id}`,
      { type: 'A', value, ttl },
    );
  }

  remove(acc: Account, fqdn: string, id: number) {
    this.assertOwned(acc, fqdn);
    return this.call(
      acc.token,
      'DELETE',
      `/api/v2/domains/${fqdn}/dns-records/${id}`,
    );
  }
}
