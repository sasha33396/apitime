import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Доверяем заголовкам прокси (X-Forwarded-Proto от Caddy) — нужно, чтобы
  // cookie сессии корректно помечалась Secure при работе по HTTPS.
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');

  // Статика собранного фронтенда (React) лежит рядом, в ../public.
  // Запросы /api/* обрабатывают контроллеры, остальное отдаётся как файлы,
  // а корень "/" — это index.html.
  app.useStaticAssets(join(__dirname, '..', 'public'));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`Приложение слушает на порту ${port}`, 'Bootstrap');
}

bootstrap();
