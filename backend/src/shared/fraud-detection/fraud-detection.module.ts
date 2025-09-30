import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { FraudDetectionService } from './fraud-detection.service';
import { FraudDetectionController } from './fraud-detection.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [FraudDetectionController],
  providers: [FraudDetectionService],
  exports: [FraudDetectionService],
})
export class FraudDetectionModule {}
