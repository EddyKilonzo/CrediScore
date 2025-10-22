import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import session from 'express-session';

// Increase Node.js header size limits to prevent 431 errors
process.env.NODE_OPTIONS = '--max-http-header-size=32768';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Increase header size limits to prevent 431 errors
    bodyParser: false, // We'll configure this manually
  });
  const logger = new Logger('Bootstrap');

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable CORS
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:4200',
      'http://localhost:4200', // Angular dev server
      'http://localhost:5173', // Vite dev server (if used)
    ],
    credentials: true,
  });

  // Configure session middleware
  app.use(
    session({
      secret:
        process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 5 * 60 * 1000, // 5 minutes
      },
    }),
  );

  // Configure body parser limits for file uploads with increased header limits
  app.use(
    json({
      limit: '10mb',
      // Increase header size limits
      inflate: true,
      type: 'application/json',
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      limit: '10mb',
      // Increase header size limits
      inflate: true,
      type: 'application/x-www-form-urlencoded',
    }),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Temporarily disabled to debug
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
