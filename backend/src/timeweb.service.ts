import { HttpException, Injectable } from '@nestjs/common';
import { Account } from './accounts.service';

const API_BASE = 'https://api.timeweb.cloud';

export interface DnsRecord {
  id: number;
  type: string;
  subdomain: string;
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

  async listARecords(acc: Account): Promise<DnsRecord[]> {
    const data = await this.call(
      acc.token,
      'GET',
      `/api/v1/domains/${acc.domain}/dns-records?limit=500`,
    );
    const records: any[] = data?.dns_records ?? [];
    return records
      .map((r) => ({
        id: r.id,
        type: r.type,
        subdomain: r.subdomain || r.fqdn || '',
        value: extractValue(r),
        ttl: r.ttl,
      }))
      .filter((r) => r.type === 'A');
  }

  create(acc: Account, value: string, ttl: number) {
    return this.call(acc.token, 'POST', `/api/v2/domains/${acc.domain}/dns-records`, {
      type: 'A',
      value,
      ttl,
    });
  }

  update(acc: Account, id: number, value: string, ttl: number) {
    return this.call(
      acc.token,
      'PATCH',
      `/api/v2/domains/${acc.domain}/dns-records/${id}`,
      { type: 'A', value, ttl },
    );
  }

  remove(acc: Account, id: number) {
    return this.call(
      acc.token,
      'DELETE',
      `/api/v2/domains/${acc.domain}/dns-records/${id}`,
    );
  }
}
