# Сборка статики React
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Финальный образ: Caddy со встроенной статикой.
# Сам Caddyfile монтируется через volume в docker-compose, чтобы его
# можно было править без пересборки образа.
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
