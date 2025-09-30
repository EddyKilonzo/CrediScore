import { Module } from '@nestjs/common';
import {
  BusinessController,
  BusinessCategoryController,
  PublicBusinessController,
} from './business.controller';
import { BusinessService } from './business.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FraudDetectionModule } from '../shared/fraud-detection/fraud-detection.module';

@Module({
  imports: [PrismaModule, FraudDetectionModule],
  controllers: [
    BusinessController,
    BusinessCategoryController,
    PublicBusinessController,
  ],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
