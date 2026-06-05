# API Time — управление A-записями доменов Timeweb Cloud

Веб-приложение для смены **A-записей** у доменов, лежащих в **разных аккаунтах**
Timeweb Cloud, без постоянного переключения между личными кабинетами.

- **Frontend** — React + Vite + TypeScript
- **Backend** — NestJS (прокси к Timeweb API, хранит токены на сервере)
- **Caddy** — обратный прокси, автоматический HTTPS (Let's Encrypt), basic_auth
- **docker compose** — запуск всего одной командой

```
браузер ──HTTPS──> Caddy ──┬── /api/* ──> backend (NestJS) ──> api.timeweb.cloud
                           └── остальное ─> статика React
```

## Структура

```
backend/      NestJS API
frontend/     React + сборка статики в образ Caddy
Caddyfile     конфиг обратного прокси (домен, TLS, basic_auth)
docker-compose.yml
.env.example  шаблон настроек (скопировать в .env)
```

## Настройка и запуск (на сервере)

1. **DNS.** Заведите поддомен для самого приложения (например `dns.example.com`)
   и направьте его A-записью на IP сервера. Откройте порты **80** и **443**.

2. **Конфиг.** Скопируйте шаблон и заполните:
   ```bash
   cp .env.example .env
   nano .env
   ```
   - `APP_DOMAIN` — домен приложения из шага 1.
   - `BASIC_AUTH_USER` — логин для входа.
   - `BASIC_AUTH_HASH` — хэш пароля, получить командой:
     ```bash
     docker run --rm caddy caddy hash-password --plaintext 'ваш-пароль'
     ```
   - `TW_ACCOUNT_N_*` — имя, токен и домен для каждого аккаунта Timeweb.
     Токен: панель Timeweb Cloud → «API и Terraform» → создать токен.

3. **Запуск:**
   ```bash
   docker compose up -d --build
   ```
   Откройте `https://APP_DOMAIN`, введите логин/пароль — увидите оба домена
   и их A-записи. Меняете значение → «Сохранить».

4. **Остановить / обновить:**
   ```bash
   docker compose down          # остановить
   docker compose up -d --build # пересобрать и поднять заново
   ```

## Локальная разработка (без Docker)

Два терминала:

```bash
# 1) бэкенд
cd backend
npm install
# токены берутся из окружения; на Windows PowerShell, например:
#   $env:TW_ACCOUNT_1_TOKEN="..."; $env:TW_ACCOUNT_1_DOMAIN="dom.ru"; $env:TW_ACCOUNT_1_NAME="Acc1"
npm run start:dev

# 2) фронтенд (Vite проксирует /api на http://localhost:3000)
cd frontend
npm install
npm run dev
```

## Что приложение умеет

- показывает A-записи всех настроенных доменов на одной странице;
- меняет значение A-записи (`PATCH`);
- добавляет новую A-запись на корень домена (`POST`);
- удаляет A-запись (`DELETE`).

Под капотом — эндпоинты Timeweb Cloud:
`GET /api/v1/domains/{fqdn}/dns-records`,
`POST|PATCH|DELETE /api/v2/domains/{fqdn}/dns-records[/{id}]`.

## Безопасность

- Токены хранятся только в `.env` на сервере и в память бэкенда — в браузер не попадают.
- Вход защищён basic_auth на уровне Caddy.
- `.env` и `config.json` добавлены в `.gitignore` — не коммитьте их.

> Прежняя однофайловая версия на Python (`server.py`, `config.example.json`)
> больше не нужна — её можно удалить.
