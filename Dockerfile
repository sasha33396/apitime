# ── 1) Сборка фронтенда (React/Vite) ────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── 2) Сборка бэкенда (NestJS) ──────────────────────────────────────────
FROM node:20-alpine AS backend
WORKDIR /be
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

# ── 3) Финальный образ: NestJS отдаёт API и статику фронтенда ───────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=backend /be/dist ./dist
COPY --from=frontend /fe/dist ./public
EXPOSE 3000
CMD ["node", "dist/main.js"]
