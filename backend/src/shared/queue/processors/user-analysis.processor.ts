import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FraudDetectionService } from '../../fraud-detection/fraud-detection.service';
import { QUEUES, JOB_NAMES } from '../queue.constants';
import { UserAnalysisJobData } from '../queue.service';

@Processor(QUEUES.USER_ANALYSIS)
export class UserAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(UserAnalysisProcessor.name);

  constructor(private readonly fraudDetectionService: FraudDetectionService) {
    super();
  }

  async process(job: Job<UserAnalysisJobData>): Promise<void> {
    const { userId, trigger, correlationId } = job.data;
    const tag = `[${correlationId}][Job:${job.id}]`;

    if (job.name !== JOB_NAMES.ANALYZE_USER) return;

    this.logger.log(`${tag} Analyzing user ${userId} (trigger: ${trigger})`);

    try {
      const flaggingResult = await this.fraudDetectionService.checkUserForFlagging(userId);

      if (flaggingResult.shouldFlag) {
        await this.fraudDetectionService.flagUser(
          userId,
          flaggingResult.flagReason,
          flaggingResult.riskLevel,
        );
        this.logger.warn(
          `${tag} User ${userId} flagged via ${trigger}: ${flaggingResult.flagReason}`,
        );
      } else {
        this.logger.log(`${tag} User ${userId} analysis complete — no action needed`);
      }
    } catch (error) {
      this.logger.error(`${tag} User analysis failed: ${(error as Error).message}`);
      throw error; // let BullMQ retry
    }
  }
}
