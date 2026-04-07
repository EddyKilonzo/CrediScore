import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FraudDetectionModule } from '../shared/fraud-detection/fraud-detection.module';
import { BusinessModule } from '../business/business.module';
import { MailerModule } from '../shared/mailer/mailer.module';
import { NotificationsModule } from '../shared/notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    FraudDetectionModule,
    BusinessModule,
    MailerModule,
    NotificationsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
