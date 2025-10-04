import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger/OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle('CrediScore API')
    .setDescription(
      'CrediScore - Business Trust & Credibility Platform API Documentation',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag('Businesses', 'Business management endpoints')
    .addTag('Reviews', 'Review management endpoints')
    .addTag('Fraud Reports', 'Fraud reporting endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚀 CrediScore API is running!`);
  logger.log(`📝 Swagger documentation: http://localhost:${port}/api`);
  logger.log(`🔗 API endpoint: http://localhost:${port}`);
}

void bootstrap();
