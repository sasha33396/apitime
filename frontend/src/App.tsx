import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import Login from './Login';

interface AccountInfo {
  name: string;
  domain: string;
}

interface Rec {
  id: number;
  type: string;
  subdomain: string;
  value: string;
  ttl: number;
}

type AuthState = 'checking' | 'in' | 'out';

export default function App() {
  const [auth, setAuth] = useState<AuthState>('checking');
  const [accounts, setAccounts] = useState<AccountInfo[] | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const notify = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2600);
  }, []);

  // Если где-то прилетел 401 — значит сессия кончилась, показываем вход.
  const onUnauthorized = useCallback(() => setAuth('out'), []);

  const loadAccounts = useCallback(async () => {
    setError('');
    setAccounts(null);
    try {
      const data = await api<{ accounts: AccountInfo[] }>('GET', '/api/accounts');
      setAccounts(data.accounts);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError(e.message);
    }
  }, [onUnauthorized]);

  // Проверка сессии при загрузке.
  useEffect(() => {
    (async () => {
      try {
        await api('GET', '/api/auth/me');
        setAuth('in');
      } catch {
        setAuth('out');
      }
    })();
  }, []);

  useEffect(() => {
    if (auth === 'in') loadAccounts();
  }, [auth, loadAccounts]);

  async function logout() {
    try {
      await api('POST', '/api/auth/logout');
    } catch {
      /* игнорируем */
    }
    setAuth('out');
  }

  if (auth === 'checking') {
    return <p className="muted center">Загрузка…</p>;
  }
  if (auth === 'out') {
    return <Login onSuccess={() => setAuth('in')} />;
  }

  return (
    <div>
      <header>
        <span>A-записи доменов</span>
        <span className="header-actions">
          <button className="reload" onClick={loadAccounts}>
            обновить
          </button>
          <button className="reload" onClick={logout}>
            выйти
          </button>
        </span>
      </header>
      <div className="wrap">
        {error && <div className="err">{error}</div>}
        {!accounts && !error && <p className="muted">Загрузка…</p>}
        {accounts && accounts.length === 0 && (
          <p className="muted">Аккаунты не настроены — задайте TW_ACCOUNT_* в .env</p>
        )}
        {accounts &&
          accounts.map((a, i) => (
            <AccountCard
              key={i}
              index={i}
              info={a}
              notify={notify}
              onUnauthorized={onUnauthorized}
            />
          ))}
      </div>
      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}

function AccountCard({
  index,
  info,
  notify,
  onUnauthorized,
}: {
  index: number;
  info: AccountInfo;
  notify: (m: string) => void;
  onUnauthorized: () => void;
}) {
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [error, setError] = useState('');
  const [newIp, setNewIp] = useState('');
  const [busy, setBusy] = useState(false);

  function handleError(e: any) {
    if (e instanceof ApiError && e.status === 401) return onUnauthorized();
    notify(e.message);
  }

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api<{ records: Rec[] }>('GET', `/api/records?account=${index}`);
      setRecs(data.records);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError(e.message);
    }
  }, [index, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave(r: Rec, value: string) {
    try {
      await api('PATCH', `/api/records?account=${index}&id=${r.id}`, {
        value,
        ttl: r.ttl || 600,
      });
      notify(`Сохранено: ${value}`);
    } catch (e: any) {
      handleError(e);
    }
  }

  async function onDelete(r: Rec) {
    const label = r.subdomain && r.subdomain !== info.domain ? r.subdomain : '@';
    if (!confirm(`Удалить A-запись ${label} (${r.value})?`)) return;
    try {
      await api('DELETE', `/api/records?account=${index}&id=${r.id}`);
      notify('Удалено');
      load();
    } catch (e: any) {
      handleError(e);
    }
  }

  async function onAdd() {
    if (!newIp.trim()) {
      notify('Введите IP');
      return;
    }
    setBusy(true);
    try {
      await api('POST', `/api/records?account=${index}`, {
        value: newIp.trim(),
        ttl: 600,
      });
      setNewIp('');
      notify('Добавлено');
      load();
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="acc">
      <h2>
        <span>{info.name}</span>
        <span className="dom">{info.domain}</span>
      </h2>
      {error && <div className="err">{error}</div>}
      {!recs && !error && <div className="muted">Загрузка записей…</div>}
      {recs && recs.length === 0 && <div className="muted">A-записей пока нет.</div>}
      {recs &&
        recs.map((r) => (
          <RecordRow
            key={r.id}
            rec={r}
            domain={info.domain}
            onSave={onSave}
            onDelete={onDelete}
          />
        ))}
      <div className="addrow">
        <span className="tag">A</span>
        <span className="sub">новая запись (корень домена)</span>
        <input
          value={newIp}
          onChange={(e) => setNewIp(e.target.value)}
          placeholder="IP адрес"
        />
        <button className="add" disabled={busy} onClick={onAdd}>
          Добавить
        </button>
      </div>
    </div>
  );
}

function RecordRow({
  rec,
  domain,
  onSave,
  onDelete,
}: {
  rec: Rec;
  domain: string;
  onSave: (r: Rec, value: string) => Promise<void>;
  onDelete: (r: Rec) => void;
}) {
  const [value, setValue] = useState(rec.value);
  const [busy, setBusy] = useState(false);
  const sub = rec.subdomain && rec.subdomain !== domain ? rec.subdomain : '@ (корень)';

  async function handleSave() {
    setBusy(true);
    await onSave(rec, value);
    setBusy(false);
  }

  return (
    <div className="rec">
      <span className="tag">A</span>
      <span className="sub">{sub}</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="IP адрес"
      />
      <button className="save" disabled={busy} onClick={handleSave}>
        {busy ? '…' : 'Сохранить'}
      </button>
      <button className="del" onClick={() => onDelete(rec)}>
        Удалить
      </button>
    </div>
  );
}
