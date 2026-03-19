import { Injectable, Logger } from '@nestjs/common';
import type {
  ReviewProcessingJobData,
  DocumentProcessingJobData,
  UserAnalysisJobData,
} from './queue.service';

/**
 * No-op QueueService when Redis/BullMQ is disabled. All enqueue methods return false
 * so callers (e.g. UserService) fall back to synchronous processing.
 */
@Injectable()
export class QueueDisabledService {
  private readonly logger = new Logger(QueueDisabledService.name);

  async enqueueReviewProcessing(
    _data: Omit<ReviewProcessingJobData, 'correlationId'>,
  ): Promise<boolean> {
    this.logger.debug('Queues disabled; review processing will run synchronously');
    return false;
  }

  async enqueueDocumentProcessing(
    _data: Omit<DocumentProcessingJobData, 'correlationId'>,
  ): Promise<boolean> {
    this.logger.debug('Queues disabled; document processing will run synchronously');
    return false;
  }

  async enqueueUserAnalysis(
    _data: Omit<UserAnalysisJobData, 'correlationId'>,
  ): Promise<boolean> {
    this.logger.debug('Queues disabled; user analysis will run synchronously');
    return false;
  }
}
