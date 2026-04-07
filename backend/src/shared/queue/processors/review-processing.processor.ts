import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { FraudDetectionService } from '../../fraud-detection/fraud-detection.service';
import { QUEUES, JOB_NAMES } from '../queue.constants';
import { ReviewProcessingJobData } from '../queue.service';

@Processor(QUEUES.REVIEW_PROCESSING)
export class ReviewProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly fraudDetectionService: FraudDetectionService,
  ) {
    super();
  }

  async process(job: Job<ReviewProcessingJobData>): Promise<void> {
    const { correlationId } = job.data;
    const tag = `[${correlationId}][Job:${job.id}]`;

    if (job.name === JOB_NAMES.PROCESS_REVIEW) {
      await this.processReview(job.data, tag);
    }
  }

  private async processReview(
    data: ReviewProcessingJobData,
    tag: string,
  ): Promise<void> {
    const {
      reviewId,
      userId,
      businessId,
      comment,
      rating,
      receiptUrl,
      amount,
      reviewDate,
      businessName,
      businessAddress,
      businessPhone,
      businessEmail,
      userReputation,
    } = data;

    this.logger.log(`${tag} Processing review ${reviewId}`);

    let isVerified = false;
    let receiptData: unknown = null;
    let validationResult: unknown = null;
    let credibility = 0;

    // Step 1: Receipt validation (OCR)
    if (receiptUrl) {
      try {
        this.logger.log(`${tag} Starting receipt OCR validation`);
        const businessDetails = {
          name: businessName,
          address: businessAddress,
          phone: businessPhone,
          email: businessEmail,
        };

        const validation = await this.aiService.validateReceiptForReview(
          receiptUrl,
          businessDetails,
          amount,
          reviewDate,
        );

        isVerified = validation.isValid;
        receiptData = validation.extractedData;
        validationResult = {
          isValid: validation.isValid,
          confidence: validation.confidence,
          matchedFields: validation.matchedFields,
          validationNotes: validation.validationNotes,
          extractedData: validation.extractedData,
        };

        this.logger.log(
          `${tag} Receipt validation complete: valid=${isVerified}, confidence=${validation.confidence}`,
        );
      } catch (error) {
        this.logger.error(
          `${tag} Receipt validation failed: ${(error as Error).message}`,
        );
        validationResult = {
          isValid: false,
          confidence: 0,
          error: (error as Error).message,
        };
      }
    }

    // Step 2: Native fraud detection (no Python dependency)
    let fraudDetectionResult: unknown = null;
    try {
      this.logger.log(`${tag} Running fraud detection`);
      const fraudDetection = await this.fraudDetectionService.detectFraudNative(
        comment || '',
        userReputation,
        receiptData,
        { name: businessName, address: businessAddress, phone: businessPhone, email: businessEmail },
      );

      fraudDetectionResult = fraudDetection;

      if (fraudDetection.isFraudulent) {
        isVerified = false;
        credibility = Math.max(0, 100 - fraudDetection.riskScore);
        this.logger.warn(
          `${tag} Fraud detected: riskScore=${fraudDetection.riskScore}, reasons=${fraudDetection.fraudReasons.join(', ')}`,
        );
      } else {
        // Step 3: AI credibility scoring
        this.logger.log(`${tag} Generating credibility score`);
        credibility = await this.aiService.generateReviewCredibilityScore(
          comment || '',
          rating,
          isVerified,
          userReputation,
        );
        this.logger.log(`${tag} Credibility score: ${credibility}`);
      }
    } catch (error) {
      this.logger.error(
        `${tag} Fraud/credibility analysis failed: ${(error as Error).message}`,
      );
      credibility = isVerified ? 80 : 50;
      fraudDetectionResult = { isFraudulent: false, confidence: 0, fraudReasons: [], riskScore: 0 };
    }

    // Step 4: Persist results
    const finalValidation = validationResult
      ? { ...(validationResult as object), fraudDetection: fraudDetectionResult, credibility, analyzedAt: new Date().toISOString(), correlationId: tag }
      : { fraudDetection: fraudDetectionResult, credibility, analyzedAt: new Date().toISOString(), correlationId: tag };

    await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        isVerified,
        credibility,
        receiptData: receiptData as any,
        validationResult: finalValidation as any,
      },
    });

    this.logger.log(`${tag} Review ${reviewId} updated: isVerified=${isVerified}, credibility=${credibility}`);

    // Step 5: Update unverified count if needed
    if (!isVerified) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { unverifiedReviewCount: { increment: 1 } },
      });

      try {
        await this.fraudDetectionService.checkAndPenalizeSpamUsers(userId);
      } catch { /* non-critical */ }
    }

    // Step 6: Check user for flagging
    try {
      const flaggingResult = await this.fraudDetectionService.checkUserForFlagging(userId);
      if (flaggingResult.shouldFlag) {
        await this.fraudDetectionService.flagUser(userId, flaggingResult.flagReason, flaggingResult.riskLevel);
        this.logger.warn(`${tag} User ${userId} flagged: ${flaggingResult.flagReason}`);
      }
    } catch { /* non-critical */ }

    // Step 7: Recalculate trust score
    try {
      const reviews = await this.prisma.review.findMany({
        where: { businessId, isActive: true },
        select: { rating: true, credibility: true, isVerified: true },
      });

      if (reviews.length > 0) {
        const totalWeight = reviews.reduce(
          (sum, r) => sum + (r.credibility || 50),
          0,
        );
        const weightedScore = reviews.reduce(
          (sum, r) => sum + r.rating * (r.credibility || 50),
          0,
        ) / totalWeight;

        const verifiedRatio = reviews.filter((r) => r.isVerified).length / reviews.length;
        const averageCredibility =
          reviews.reduce((sum, r) => sum + (r.credibility || 0), 0) /
          reviews.length;
        const highCredibilityRatio =
          reviews.filter((r) => (r.credibility || 0) >= 80).length /
          reviews.length;
        const credibilityMultiplier = Math.min(
          1.35,
          0.85 + averageCredibility * 0.003 + highCredibilityRatio * 0.15,
        );
        const score = Math.round(
          weightedScore *
            20 *
            (0.6 + 0.4 * verifiedRatio) *
            credibilityMultiplier,
        );
        const boundedScore = Math.max(0, Math.min(100, score));

        let grade = 'F';
        if (boundedScore >= 90) grade = 'A+';
        else if (boundedScore >= 80) grade = 'A';
        else if (boundedScore >= 70) grade = 'B';
        else if (boundedScore >= 60) grade = 'C';
        else if (boundedScore >= 50) grade = 'D';

        await this.prisma.trustScore.upsert({
          where: { businessId },
          create: { businessId, score: boundedScore, grade },
          update: { score: boundedScore, grade },
        });

        this.logger.log(
          `${tag} Trust score updated for business ${businessId}: ${boundedScore} (${grade})`,
        );
      }
    } catch (error) {
      this.logger.error(`${tag} Trust score update failed: ${(error as Error).message}`);
    }
  }
}
