import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { MailerModule } from './shared/mailer/mailer.module';
import { CloudinaryModule } from './shared/cloudinary/cloudinary.module';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { BusinessModule } from './business/business.module';
import { AiModule } from './shared/ai/ai.module';
import { MetricsModule } from './shared/metrics/metrics.module';
import { CorrelationIdModule } from './shared/correlation-id/correlation-id.module';
import { CorrelationIdMiddleware } from './shared/correlation-id/correlation-id.middleware';
import { NotificationsModule } from './shared/notifications/notifications.module';
import { MpesaModule } from './shared/mpesa/mpesa.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CorrelationIdModule,
    PrismaModule,
    AuthModule,
    MailerModule,
    CloudinaryModule,
    AdminModule,
    UserModule,
    BusinessModule,
    AiModule,
    MetricsModule,
    NotificationsModule,
    MpesaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
