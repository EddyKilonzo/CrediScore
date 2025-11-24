import { Module } from '@nestjs/common';
import { UserController, BusinessController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../shared/ai/ai.module';
import { FraudDetectionModule } from '../shared/fraud-detection/fraud-detection.module';
import { CloudinaryModule } from '../shared/cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, AiModule, FraudDetectionModule, CloudinaryModule],
  controllers: [UserController, BusinessController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
