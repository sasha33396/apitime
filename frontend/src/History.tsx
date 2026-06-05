import { useEffect, useState } from 'react';
import { api, ApiError } from './api';

interface Entry {
  time: string;
  account: string;
  fqdn: string;
  action: 'create' | 'update' | 'delete';
  old: string | null;
  new: string | null;
  ttl?: number;
}

const ACTION_LABEL: Record<Entry['action'], string> = {
  create: 'создана',
  update: 'изменена',
  delete: 'удалена',
};

export default function History({
  onBack,
  onUnauthorized,
}: {
  onBack: () => void;
  onUnauthorized: () => void;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ history: Entry[] }>('GET', '/api/history');
        setEntries(data.history);
      } catch (e: any) {
        if (e instanceof ApiError && e.status === 401) return onUnauthorized();
        setError(e.message);
      }
    })();
  }, [onUnauthorized]);

  function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString();
  }

  return (
    <div>
      <header>
        <span>История изменений</span>
        <button className="reload" onClick={onBack}>
          назад
        </button>
      </header>
      <div className="wrap">
        {error && <div className="err">{error}</div>}
        {!entries && !error && <p className="muted">Загрузка…</p>}
        {entries && entries.length === 0 && (
          <p className="muted">Пока нет ни одной записи в истории.</p>
        )}
        {entries && entries.length > 0 && (
          <div className="acc">
            <table className="hist">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Аккаунт</th>
                  <th>Запись</th>
                  <th>Действие</th>
                  <th>Было → Стало</th>
                  <th>TTL</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className={`act-${e.action}`}>
                    <td className="nowrap">{fmt(e.time)}</td>
                    <td>{e.account}</td>
                    <td className="mono">{e.fqdn}</td>
                    <td>{ACTION_LABEL[e.action]}</td>
                    <td className="mono">
                      {e.old ?? '—'} <span className="arrow">→</span> {e.new ?? '—'}
                    </td>
                    <td>{e.ttl ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
