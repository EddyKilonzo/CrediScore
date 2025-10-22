import { Module } from '@nestjs/common';
import {
  BusinessController,
  BusinessCategoryController,
  PublicBusinessController,
} from './business.controller';
import { BusinessService } from './business.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FraudDetectionModule } from '../shared/fraud-detection/fraud-detection.module';
import { OCRModule } from '../shared/ocr/ocr.module';

@Module({
  imports: [PrismaModule, FraudDetectionModule, OCRModule],
  controllers: [
    BusinessController,
    BusinessCategoryController,
    PublicBusinessController,
  ],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
