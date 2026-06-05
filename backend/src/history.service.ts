import { Injectable, Logger } from '@nestjs/common';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

export type HistoryAction = 'create' | 'update' | 'delete';

export interface HistoryEntry {
  time: string; // ISO
  account: string;
  fqdn: string;
  action: HistoryAction;
  old: string | null; // прежний IP
  new: string | null; // новый IP
  ttl?: number;
}

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);
  private readonly dir = process.env.DATA_DIR || join(process.cwd(), 'data');
  private readonly file = join(this.dir, 'history.jsonl');

  constructor() {
    try {
      if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
    } catch (e: any) {
      this.logger.error(`Не удалось создать каталог истории ${this.dir}: ${e?.message}`);
    }
  }

  add(entry: Omit<HistoryEntry, 'time'>): void {
    const record: HistoryEntry = { time: new Date().toISOString(), ...entry };
    try {
      appendFileSync(this.file, JSON.stringify(record) + '\n', 'utf-8');
    } catch (e: any) {
      this.logger.error(`Не удалось записать историю: ${e?.message}`);
    }
  }

  list(limit = 500): HistoryEntry[] {
    try {
      if (!existsSync(this.file)) return [];
      const lines = readFileSync(this.file, 'utf-8').split('\n').filter(Boolean);
      const parsed: HistoryEntry[] = [];
      for (const line of lines) {
        try {
          parsed.push(JSON.parse(line));
        } catch {
          /* пропускаем битую строку */
        }
      }
      // новые сверху
      return parsed.reverse().slice(0, limit);
    } catch (e: any) {
      this.logger.error(`Не удалось прочитать историю: ${e?.message}`);
      return [];
    }
  }
}
