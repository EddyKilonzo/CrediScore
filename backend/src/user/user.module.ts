import { Module } from '@nestjs/common';
import { UserController, BusinessController, UserPublicController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../shared/ai/ai.module';
import { FraudDetectionModule } from '../shared/fraud-detection/fraud-detection.module';
import { CloudinaryModule } from '../shared/cloudinary/cloudinary.module';
import { QueueModule, QueueModuleDisabled } from '../shared/queue/queue.module';
import { NotificationsModule } from '../shared/notifications/notifications.module';
import { MpesaModule } from '../shared/mpesa/mpesa.module';

const queueModule =
  process.env.DISABLE_QUEUES === 'true' ? QueueModuleDisabled : QueueModule;

@Module({
  imports: [PrismaModule, AiModule, FraudDetectionModule, CloudinaryModule, queueModule, NotificationsModule, MpesaModule],
  controllers: [UserController, UserPublicController, BusinessController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
