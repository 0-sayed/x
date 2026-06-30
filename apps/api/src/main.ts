import 'reflect-metadata';

import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getApiRuntimeConfig, getSessionRuntimeConfig } from '@materiabill/config';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';

export function configureApiDocumentation(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Materiabill API')
      .setDescription('Bootstrap runtime shell endpoints only.')
      .setVersion(getApiRuntimeConfig(process.env).version)
      .build(),
  );

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });
}

export async function bootstrapApi() {
  const config = getApiRuntimeConfig(process.env);
  const sessionConfig = getSessionRuntimeConfig(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(cookieParser(sessionConfig.sessionSecret));
  app.enableCors({
    credentials: true,
    origin: sessionConfig.adminUrl,
  });
  app.enableShutdownHooks();
  configureApiDocumentation(app);
  await app.listen(config.port);

  return app;
}

const isDirectExecution = import.meta.url === new URL(process.argv[1] ?? '', 'file:').href;

if (isDirectExecution) {
  void bootstrapApi();
}
