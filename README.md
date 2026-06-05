# API Time — управление A-записями доменов Timeweb Cloud

Веб-приложение для смены **A-записей** у доменов, лежащих в **разных аккаунтах**
Timeweb Cloud, без постоянного переключения между личными кабинетами.

- **Frontend** — React + Vite + TypeScript (есть страница входа)
- **Backend** — NestJS: страница входа + API (прокси к Timeweb) + статика фронтенда
- Вход по логину/паролю — своя форма авторизации (сессия в httpOnly-cookie)
- Один docker-образ, один контейнер на порту **3000**
- HTTPS даёт **уже работающий на сервере Caddy** (проект reshala-web) —
  apitime подключается к его docker-сети.

```
браузер ─HTTPS─> Caddy (reshala-web) ──reverse_proxy──> apitime:3000
                  (только TLS)                            ├── /api/auth/* → вход (cookie-сессия)
                                                          ├── /api/*      → NestJS → api.timeweb.cloud
                                                          └── /           → статика React (форма входа / приложение)
```

## Структура

```
Dockerfile          сборка фронтенда + бэкенда в один образ
docker-compose.yml  один сервис apitime, подключённый к сети Caddy
backend/            NestJS
frontend/           React
.env.example        шаблон (скопировать в .env)
```

## Деплой за общим Caddy (текущая конфигурация сервера)

На сервере уже крутится проект **reshala-web** со своим Caddy на портах 80/443.
apitime НЕ поднимает свой Caddy, а встраивается в существующий.

### 1. DNS

Заведите поддомен для приложения, например `apitime.xendroweb.com`,
и направьте его **A-записью на IP сервера**.

### 2. Конфиг apitime

```bash
git clone https://github.com/sasha33396/apitime.git
cd apitime
cp .env.example .env
nano .env        # вписать APP_USER / APP_PASSWORD и TW_ACCOUNT_* (токены и домены)
```

Проверьте имя docker-сети существующего Caddy:
```bash
docker network ls          # ищите что-то вроде reshala-web_default
```
Если оно отличается от `reshala-web_default` — задайте `CADDY_NETWORK=...` в `.env`.

### 3. Запуск контейнера

```bash
docker compose up -d --build
```
Контейнер `apitime` поднимется в сети Caddy и будет доступен внутри неё как
`apitime:3000` (наружу порты не публикуются).

### 4. Добавить поддомен в Caddyfile reshala-web

Вход защищён самим приложением (форма логина), поэтому в Caddy basic_auth
не нужен — только проксирование. В файл `/root/reshala-web/reshala-web/Caddyfile`
добавьте блок (подставьте свой поддомен):

```caddy
apitime.xendroweb.com {
        reverse_proxy apitime:3000
}
```

Перечитайте конфиг Caddy (из папки reshala-web):
```bash
cd /root/reshala-web/reshala-web
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Откройте `https://apitime.xendroweb.com` — откроется страница входа.
Логин/пароль — те, что задали в `.env` (`APP_USER` / `APP_PASSWORD`).
После входа увидите оба домена и их A-записи. Меняете значение → «Сохранить».

### Обновление кода

```bash
cd apitime
git pull
docker compose up -d --build
```

## Локальная разработка (без Docker)

```bash
# терминал 1 — бэкенд
cd backend && npm install
#   задать токены в окружении, напр. (PowerShell):
#   $env:TW_ACCOUNT_1_TOKEN="..."; $env:TW_ACCOUNT_1_DOMAIN="dom.ru"; $env:TW_ACCOUNT_1_NAME="Acc1"
npm run start:dev          # http://localhost:3000

# терминал 2 — фронтенд (Vite проксирует /api на :3000)
cd frontend && npm install
npm run dev                # http://localhost:5173
```

## Что приложение умеет

- показывает A-записи всех настроенных доменов и поддоменов на одной странице;
- меняет значение и TTL A-записи (`PATCH`);
- добавляет новую A-запись (корень или поддомен, `POST`);
- удаляет A-запись (`DELETE`);
- ведёт **историю изменений** (кто/что/было→стало) — кнопка «история» в шапке.
  Лог пишется на хост в `./data/history.jsonl` (переживает пересборку контейнера).

Эндпоинты Timeweb Cloud:
`GET /api/v1/domains/{fqdn}/dns-records`,
`POST|PATCH|DELETE /api/v2/domains/{fqdn}/dns-records[/{id}]`.

## Безопасность

- Токены только в `.env` на сервере и в памяти бэкенда — в браузер не попадают.
- Вход защищён формой логина; сессия хранится в подписанной httpOnly-cookie
  (флаг Secure выставляется автоматически при работе по HTTPS).
- API-эндпоинты закрыты guard'ом — без активной сессии возвращают 401.
- `.env` и `config.json` в `.gitignore` — не коммитьте их.
