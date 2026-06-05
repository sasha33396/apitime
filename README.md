# API Time — управление A-записями доменов Timeweb Cloud

Веб-приложение для смены **A-записей** у доменов, лежащих в **разных аккаунтах**
Timeweb Cloud, без постоянного переключения между личными кабинетами.

- **Frontend** — React + Vite + TypeScript
- **Backend** — NestJS: отдаёт API (прокси к Timeweb) и статику фронтенда
- Один docker-образ, один контейнер на порту **3000**
- HTTPS и вход по паролю обеспечивает **уже работающий на сервере Caddy**
  (проект reshala-web) — apitime подключается к его docker-сети.

```
браузер ─HTTPS─> Caddy (reshala-web) ──reverse_proxy──> apitime:3000
                  (basic_auth, TLS)                       ├── /api/* → NestJS
                                                          └── /     → статика React → api.timeweb.cloud
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
nano .env        # вписать TW_ACCOUNT_* (токены и домены аккаунтов)
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

Сгенерируйте хэш пароля для входа:
```bash
docker run --rm caddy caddy hash-password --plaintext 'ВАШ_ПАРОЛЬ'
```

В файл `/root/reshala-web/reshala-web/Caddyfile` добавьте новый блок
(подставьте свой поддомен, логин и хэш):

```caddy
apitime.xendroweb.com {
        basic_auth {
                admin <ВСТАВЬТЕ_ХЭШ_ПАРОЛЯ>
        }
        reverse_proxy apitime:3000
}
```

Перечитайте конфиг Caddy (из папки reshala-web):
```bash
cd /root/reshala-web/reshala-web
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Откройте `https://apitime.xendroweb.com`, введите логин/пароль — увидите оба
домена и их A-записи. Меняете значение → «Сохранить».

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

- показывает A-записи всех настроенных доменов на одной странице;
- меняет значение A-записи (`PATCH`);
- добавляет новую A-запись на корень домена (`POST`);
- удаляет A-запись (`DELETE`).

Эндпоинты Timeweb Cloud:
`GET /api/v1/domains/{fqdn}/dns-records`,
`POST|PATCH|DELETE /api/v2/domains/{fqdn}/dns-records[/{id}]`.

## Безопасность

- Токены только в `.env` на сервере и в памяти бэкенда — в браузер не попадают.
- Вход защищён basic_auth на уровне общего Caddy.
- `.env` и `config.json` в `.gitignore` — не коммитьте их.
