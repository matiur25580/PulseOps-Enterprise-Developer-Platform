import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpObservabilityInterceptor } from './observability/http-observability.interceptor';
import { securityHeadersMiddleware } from './security/security-headers.middleware';

async function bootstrap(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.METRICS_TOKEN) {
    throw new Error('METRICS_TOKEN is required in production to protect the metrics endpoint');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.WEB_ORIGIN) {
    throw new Error('WEB_ORIGIN is required in production; configure the deployed frontend origin');
  }
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(securityHeadersMiddleware);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(app.get(HttpObservabilityInterceptor));
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`PulseOps API listening on http://localhost:${port}`);
}
void bootstrap();
