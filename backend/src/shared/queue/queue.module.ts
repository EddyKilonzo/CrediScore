import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUES } from './queue.constants';
import { QueueService } from './queue.service';
import { QueueDisabledService } from './queue-disabled.service';
import { ReviewProcessingProcessor } from './processors/review-processing.processor';
import { UserAnalysisProcessor } from './processors/user-analysis.processor';
import { DocumentProcessingProcessor } from './processors/document-processing.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { FraudDetectionModule } from '../fraud-detection/fraud-detection.module';

/** Full queue module: Redis/BullMQ required. Use when Redis is running. */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          db: config.get<number>('REDIS_DB', 0),
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          lazyConnect: true,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.REVIEW_PROCESSING },
      { name: QUEUES.DOCUMENT_PROCESSING },
      { name: QUEUES.USER_ANALYSIS },
    ),
    PrismaModule,
    AiModule,
    FraudDetectionModule,
  ],
  providers: [
    QueueService,
    ReviewProcessingProcessor,
    UserAnalysisProcessor,
    DocumentProcessingProcessor,
  ],
  exports: [QueueService, BullModule],
})
export class QueueModule {}

/** No Redis: provides a stub QueueService; callers use sync fallback. */
@Module({
  imports: [PrismaModule, AiModule, FraudDetectionModule],
  providers: [{ provide: QueueService, useClass: QueueDisabledService }],
  exports: [QueueService],
})
export class QueueModuleDisabled {}
