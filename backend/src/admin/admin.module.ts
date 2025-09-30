import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FraudDetectionModule } from '../shared/fraud-detection/fraud-detection.module';

@Module({
  imports: [PrismaModule, FraudDetectionModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
