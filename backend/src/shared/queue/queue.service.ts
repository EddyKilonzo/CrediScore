import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, JOB_NAMES } from './queue.constants';
import { CorrelationIdService } from '../correlation-id/correlation-id.service';

export interface ReviewProcessingJobData {
  reviewId: string;
  userId: string;
  businessId: string;
  comment: string;
  rating: number;
  receiptUrl?: string;
  amount?: number;
  reviewDate?: string;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  userReputation: number;
  correlationId: string;
}

export interface DocumentProcessingJobData {
  documentId: string;
  businessId: string;
  documentUrl: string;
  documentType: string;
  correlationId: string;
}

export interface UserAnalysisJobData {
  userId: string;
  trigger: 'review_created' | 'report_filed' | 'scheduled';
  correlationId: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUES.REVIEW_PROCESSING)
    private readonly reviewQueue: Queue,
    @InjectQueue(QUEUES.DOCUMENT_PROCESSING)
    private readonly documentQueue: Queue,
    @InjectQueue(QUEUES.USER_ANALYSIS)
    private readonly userAnalysisQueue: Queue,
    private readonly correlationIdService: CorrelationIdService,
  ) {}

  async enqueueReviewProcessing(
    data: Omit<ReviewProcessingJobData, 'correlationId'>,
  ): Promise<boolean> {
    try {
      const correlationId = this.correlationIdService.correlationId;
      await this.reviewQueue.add(JOB_NAMES.PROCESS_REVIEW, {
        ...data,
        correlationId,
      });
      this.logger.log(
        `[${correlationId}] Enqueued review processing job for review ${data.reviewId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue review processing job: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async enqueueDocumentProcessing(
    data: Omit<DocumentProcessingJobData, 'correlationId'>,
  ): Promise<boolean> {
    try {
      const correlationId = this.correlationIdService.correlationId;
      await this.documentQueue.add(JOB_NAMES.PROCESS_DOCUMENT, {
        ...data,
        correlationId,
      });
      this.logger.log(
        `[${correlationId}] Enqueued document processing job for document ${data.documentId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue document processing job: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async enqueueUserAnalysis(
    data: Omit<UserAnalysisJobData, 'correlationId'>,
  ): Promise<boolean> {
    try {
      const correlationId = this.correlationIdService.correlationId;
      await this.userAnalysisQueue.add(JOB_NAMES.ANALYZE_USER, {
        ...data,
        correlationId,
      });
      this.logger.log(
        `[${correlationId}] Enqueued user analysis job for user ${data.userId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue user analysis job: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
