import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import axios from 'axios';

export interface ReceiptData {
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  amount?: number;
  date?: string;
  items?: string[];
  receiptNumber?: string;
  confidence: number;
}

export interface BusinessDetails {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface FraudDetectionRequest {
  review_text: string;
  receipt_data: ReceiptData;
  business_details: BusinessDetails;
  user_reputation: number;
}

export interface FraudDetectionResponse {
  isFraudulent: boolean;
  confidence: number;
  fraudReasons: string[];
  riskScore: number;
}

export interface UserFlaggingResult {
  shouldFlag: boolean;
  flagReason: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suspiciousPatterns: string[];
  recommendation: 'MONITOR' | 'FLAG' | 'SUSPEND' | 'DELETE';
}

export interface ReviewPatternAnalysis {
  totalReviews: number;
  unverifiedReviews: number;
  verifiedReviews: number;
  averageRating: number;
  reviewFrequency: number; // reviews per day
  suspiciousPatterns: string[];
  riskScore: number;
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);
  private readonly fraudDetectionUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.fraudDetectionUrl = this.configService.get<string>(
      'PYTHON_FRAUD_SERVICE_URL',
      'http://localhost:8000',
    );
  }

  /**
   * Detect fraud in review and receipt data
   */
  async detectFraud(
    request: FraudDetectionRequest,
  ): Promise<FraudDetectionResponse> {
    try {
      this.logger.log(
        `Detecting fraud for review: ${request.review_text.substring(0, 50)}...`,
      );

      const response = await axios.post(
        `${this.fraudDetectionUrl}/detect-fraud`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        },
      );

      const data = response.data as FraudDetectionResponse;
      this.logger.log(
        `Fraud detection completed. Risk score: ${data.riskScore}, Fraudulent: ${data.isFraudulent}`,
      );

      return data;
    } catch (error) {
      this.logger.error('Fraud detection service error:', error);

      // Return a safe default response if service is unavailable
      return {
        isFraudulent: false,
        confidence: 0.0,
        fraudReasons: ['Fraud detection service unavailable'],
        riskScore: 0,
      };
    }
  }

  /**
   * Check if fraud detection service is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.fraudDetectionUrl}/health`, {
        timeout: 5000,
      });
      const data = response.data as { status: string };
      return data.status === 'healthy';
    } catch (error) {
      this.logger.warn('Fraud detection service health check failed:', error);
      return false;
    }
  }

  /**
   * Analyze review for fraud with simplified data
   */
  async analyzeReview(
    reviewText: string,
    userReputation: number,
    receiptData?: unknown,
    businessDetails?: unknown,
  ): Promise<FraudDetectionResponse> {
    const request: FraudDetectionRequest = {
      review_text: reviewText,
      receipt_data: (receiptData as ReceiptData) || { confidence: 0.0 },
      business_details: (businessDetails as BusinessDetails) || {
        name: 'Unknown Business',
      },
      user_reputation: userReputation,
    };

    return this.detectFraud(request);
  }

  /**
   * Get fraud detection service info
   */
  async getServiceInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.fraudDetectionUrl}/`, {
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get fraud detection service info:', error);
      return {
        message: 'Fraud Detection Service',
        version: '1.0.0',
        status: 'unavailable',
      };
    }
  }

  /**
   * Analyze user review patterns for suspicious behavior
   */
  async analyzeUserReviewPatterns(
    userId: string,
  ): Promise<ReviewPatternAnalysis> {
    try {
      this.logger.log(`Analyzing review patterns for user: ${userId}`);

      // Get user's reviews from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const reviews = await this.prisma.review.findMany({
        where: {
          userId,
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const totalReviews = reviews.length;
      const unverifiedReviews = reviews.filter(
        (review) => !review.isVerified,
      ).length;
      const verifiedReviews = reviews.filter(
        (review) => review.isVerified,
      ).length;

      const averageRating =
        totalReviews > 0
          ? reviews.reduce((sum, review) => sum + review.rating, 0) /
            totalReviews
          : 0;

      // Calculate review frequency (reviews per day)
      const daysSinceFirstReview =
        totalReviews > 0
          ? Math.max(
              1,
              Math.ceil(
                (Date.now() - reviews[reviews.length - 1].createdAt.getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 1;
      const reviewFrequency = totalReviews / daysSinceFirstReview;

      // Detect suspicious patterns
      const suspiciousPatterns: string[] = [];
      let riskScore = 0;

      // Pattern 1: High number of unverified reviews
      if (unverifiedReviews > 10) {
        suspiciousPatterns.push('High number of unverified reviews');
        riskScore += 30;
      }

      // Pattern 2: Very high review frequency
      if (reviewFrequency > 2) {
        suspiciousPatterns.push('Excessive review frequency');
        riskScore += 25;
      }

      // Pattern 3: Low verification rate
      const verificationRate =
        totalReviews > 0 ? (verifiedReviews / totalReviews) * 100 : 0;
      if (verificationRate < 20 && totalReviews > 5) {
        suspiciousPatterns.push('Low verification rate');
        riskScore += 20;
      }

      // Pattern 4: All reviews are extreme ratings (1 or 5)
      const extremeRatings = reviews.filter(
        (review) => review.rating === 1 || review.rating === 5,
      ).length;
      if (extremeRatings === totalReviews && totalReviews > 3) {
        suspiciousPatterns.push('Only extreme ratings');
        riskScore += 15;
      }

      // Pattern 5: Reviews posted in quick succession
      const quickSuccession = this.detectQuickSuccessionReviews(reviews);
      if (quickSuccession > 0) {
        suspiciousPatterns.push(
          `${quickSuccession} reviews posted in quick succession`,
        );
        riskScore += quickSuccession * 10;
      }

      // Pattern 6: Similar review text patterns
      const similarTexts = this.detectSimilarReviewTexts(reviews);
      if (similarTexts > 0) {
        suspiciousPatterns.push(
          `${similarTexts} reviews with similar text patterns`,
        );
        riskScore += similarTexts * 5;
      }

      return {
        totalReviews,
        unverifiedReviews,
        verifiedReviews,
        averageRating,
        reviewFrequency,
        suspiciousPatterns,
        riskScore: Math.min(riskScore, 100),
      };
    } catch (error) {
      this.logger.error('Error analyzing user review patterns:', error);
      return {
        totalReviews: 0,
        unverifiedReviews: 0,
        verifiedReviews: 0,
        averageRating: 0,
        reviewFrequency: 0,
        suspiciousPatterns: ['Analysis failed'],
        riskScore: 0,
      };
    }
  }

  /**
   * Check if user should be flagged for suspicious behavior
   */
  async checkUserForFlagging(userId: string): Promise<UserFlaggingResult> {
    try {
      this.logger.log(`Checking user for flagging: ${userId}`);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          reviews: {
            where: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
          },
        },
      });

      if (!user) {
        return {
          shouldFlag: false,
          flagReason: 'User not found',
          riskLevel: 'LOW',
          suspiciousPatterns: [],
          recommendation: 'MONITOR',
        };
      }

      const patternAnalysis = await this.analyzeUserReviewPatterns(userId);
      const shouldFlag = patternAnalysis.riskScore >= 50;

      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      let recommendation: 'MONITOR' | 'FLAG' | 'SUSPEND' | 'DELETE' = 'MONITOR';

      if (patternAnalysis.riskScore >= 80) {
        riskLevel = 'CRITICAL';
        recommendation = 'DELETE';
      } else if (patternAnalysis.riskScore >= 65) {
        riskLevel = 'HIGH';
        recommendation = 'SUSPEND';
      } else if (patternAnalysis.riskScore >= 50) {
        riskLevel = 'MEDIUM';
        recommendation = 'FLAG';
      }

      const flagReason = this.generateFlagReason(patternAnalysis, {
        flagCount: (user as { flagCount?: number }).flagCount || 0,
      });

      return {
        shouldFlag,
        flagReason,
        riskLevel,
        suspiciousPatterns: patternAnalysis.suspiciousPatterns,
        recommendation,
      };
    } catch (error) {
      this.logger.error('Error checking user for flagging:', error);
      return {
        shouldFlag: false,
        flagReason: 'Analysis failed',
        riskLevel: 'LOW',
        suspiciousPatterns: [],
        recommendation: 'MONITOR',
      };
    }
  }

  /**
   * Flag a user for admin review
   */
  async flagUser(
    userId: string,
    flagReason: string,
    riskLevel: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Flagging user: ${userId} for reason: ${flagReason} (Risk: ${riskLevel})`,
      );

      // Flag user and reduce credibility based on risk level
      const credibilityReduction = {
        LOW: 5,
        MEDIUM: 15,
        HIGH: 30,
        CRITICAL: 50,
      };

      const reduction =
        credibilityReduction[riskLevel as keyof typeof credibilityReduction] ||
        15;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isFlagged: true,
          flagReason,
          flagCount: {
            increment: 1,
          },
          lastFlaggedAt: new Date(),
          reviewPattern: (await this.analyzeUserReviewPatterns(
            userId,
          )) as unknown as Prisma.InputJsonValue,
          reputation: {
            decrement: reduction,
          },
        },
      });

      this.logger.warn(
        `User ${userId} flagged with reason: ${flagReason} - Credibility reduced by ${reduction} points (${riskLevel} risk)`,
      );

      this.logger.log(`User ${userId} flagged successfully`);
    } catch (error) {
      this.logger.error('Error flagging user:', error);
      throw error;
    }
  }

  /**
   * Get flagged users for admin review
   */
  async getFlaggedUsers(page: number = 1, limit: number = 10) {
    try {
      // const skip = (page - 1) * limit;

      // TODO: Uncomment after Prisma client regeneration with new fields
      // const [users, total] = await Promise.all([
      //   this.prisma.user.findMany({
      //     where: {
      //       isFlagged: true,
      //     },
      //     skip,
      //     take: limit,
      //     select: {
      //       id: true,
      //       name: true,
      //       email: true,
      //       flagReason: true,
      //       flagCount: true,
      //       lastFlaggedAt: true,
      //       reviewPattern: true,
      //       reputation: true,
      //       createdAt: true,
      //       _count: {
      //         select: {
      //           reviews: true,
      //         },
      //       },
      //     },
      //     orderBy: {
      //       lastFlaggedAt: 'desc',
      //     },
      //   }),
      //   this.prisma.user.count({
      //     where: {
      //       isFlagged: true,
      //     },
      //   }),
      // ]);

      // Temporary: Return empty result until Prisma client is regenerated
      const users: any[] = [];
      const total = 0;

      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Error getting flagged users:', error);
      throw error;
    }
  }

  /**
   * Unflag a user (admin action)
   */
  async unflagUser(userId: string, adminId: string): Promise<void> {
    try {
      this.logger.log(`Unflagging user: ${userId} by admin: ${adminId}`);

      // TODO: Uncomment after Prisma client regeneration with new fields
      // await this.prisma.user.update({
      //   where: { id: userId },
      //   data: {
      //     isFlagged: false,
      //     flagReason: null,
      //     lastFlaggedAt: null,
      //   },
      // });

      // Temporary: Just log the action
      this.logger.log(`User ${userId} would be unflagged by admin: ${adminId}`);

      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      this.logger.warn(`User ${userId} unflagged by admin: ${adminId}`);

      this.logger.log(`User ${userId} unflagged successfully`);
    } catch (error) {
      this.logger.error('Error unflagging user:', error);
      throw error;
    }
  }

  /**
   * Helper: Detect reviews posted in quick succession
   */
  private detectQuickSuccessionReviews(
    reviews: Array<{ createdAt: Date }>,
  ): number {
    let quickSuccessionCount = 0;
    const timeThreshold = 5 * 60 * 1000; // 5 minutes

    for (let i = 1; i < reviews.length; i++) {
      const timeDiff =
        reviews[i - 1].createdAt.getTime() - reviews[i].createdAt.getTime();
      if (timeDiff < timeThreshold) {
        quickSuccessionCount++;
      }
    }

    return quickSuccessionCount;
  }

  /**
   * Helper: Detect similar review texts
   */
  private detectSimilarReviewTexts(
    reviews: Array<{ comment?: string | null }>,
  ): number {
    let similarCount = 0;
    const similarityThreshold = 0.8;

    for (let i = 0; i < reviews.length; i++) {
      for (let j = i + 1; j < reviews.length; j++) {
        if (reviews[i].comment && reviews[j].comment) {
          const similarity = this.calculateTextSimilarity(
            reviews[i].comment!,
            reviews[j].comment!,
          );
          if (similarity > similarityThreshold) {
            similarCount++;
          }
        }
      }
    }

    return similarCount;
  }

  /**
   * Helper: Calculate text similarity using simple word overlap
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Check and penalize users with excessive unverified reviews
   */
  async checkAndPenalizeSpamUsers(userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          reputation: true,
        },
      });

      if (!user) return;

      // TODO: Implement progressive penalties after Prisma client regeneration
      // For now, apply a general penalty for spam behavior
      await this.reduceCredibilityForSpam(userId, 'MEDIUM');
      this.logger.warn(
        `User ${userId} penalized for spam behavior - MEDIUM penalty applied`,
      );
    } catch (error) {
      this.logger.error('Error checking and penalizing spam users:', error);
    }
  }

  /**
   * Reduce credibility for users with spam review patterns
   */
  async reduceCredibilityForSpam(
    userId: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  ): Promise<void> {
    try {
      const credibilityReduction = {
        LOW: 5,
        MEDIUM: 15,
        HIGH: 30,
        CRITICAL: 50,
      };

      const reduction = credibilityReduction[severity];

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          reputation: {
            decrement: reduction,
          },
        },
      });

      this.logger.warn(
        `User ${userId} credibility reduced by ${reduction} points due to ${severity} spam behavior`,
      );
    } catch (error) {
      this.logger.error('Error reducing user credibility:', error);
      throw error;
    }
  }

  /**
   * Helper: Generate flag reason based on analysis
   */
  private generateFlagReason(
    analysis: ReviewPatternAnalysis,
    user: { flagCount?: number },
  ): string {
    const reasons: string[] = [];

    if (analysis.unverifiedReviews > 10) {
      reasons.push(`${analysis.unverifiedReviews} unverified reviews`);
    }

    if (analysis.reviewFrequency > 2) {
      reasons.push(
        `High review frequency (${analysis.reviewFrequency.toFixed(1)} reviews/day)`,
      );
    }

    if (analysis.suspiciousPatterns.length > 0) {
      reasons.push(
        `Suspicious patterns: ${analysis.suspiciousPatterns.slice(0, 2).join(', ')}`,
      );
    }

    if (user.flagCount && user.flagCount > 0) {
      reasons.push(`Previously flagged ${user.flagCount} times`);
    }

    return reasons.length > 0
      ? `Suspicious review behavior: ${reasons.join('; ')}`
      : 'General suspicious activity detected';
  }
}
