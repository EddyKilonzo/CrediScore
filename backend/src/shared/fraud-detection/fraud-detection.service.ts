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
   * NestJS-native fraud detection — no Python service dependency.
   * Runs text analysis, behavioral scoring, and receipt correlation.
   */
  async detectFraudNative(
    reviewText: string,
    userReputation: number,
    receiptData?: unknown,
    businessDetails?: unknown,
  ): Promise<FraudDetectionResponse> {
    const fraudReasons: string[] = [];
    let riskScore = 0;

    // ── 1. Text analysis ─────────────────────────────────────────────────
    const text = (reviewText || '').trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Too short / gibberish
    if (wordCount < 3) {
      fraudReasons.push('Review text too short or empty');
      riskScore += 20;
    }

    // All-caps (shouting / bot)
    if (text.length > 10 && text === text.toUpperCase()) {
      fraudReasons.push('Review text is all caps');
      riskScore += 15;
    }

    // Repetitive characters (e.g. "gooood", "baaad")
    if (/(.)\1{4,}/i.test(text)) {
      fraudReasons.push('Repetitive character sequences detected');
      riskScore += 10;
    }

    // Spam / marketing patterns
    const spamPatterns = [
      /\b(buy now|click here|free money|earn \$|make money fast|100% guarantee|limited offer|act now)\b/i,
      /\b(casino|lottery|winner|prize|jackpot)\b/i,
      /https?:\/\/\S+/g, // URLs in reviews
    ];
    for (const pattern of spamPatterns) {
      if (pattern.test(text)) {
        fraudReasons.push('Spam or promotional content detected');
        riskScore += 25;
        break;
      }
    }

    // Copy-paste indicators: very long exact phrases repeated
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    const uniqueSentences = new Set(sentences.map((s) => s.toLowerCase().trim()));
    if (sentences.length > 2 && uniqueSentences.size < sentences.length) {
      fraudReasons.push('Duplicate sentences detected in review');
      riskScore += 20;
    }

    // ── 2. User reputation scoring ───────────────────────────────────────
    if (userReputation < 0) {
      fraudReasons.push('Negative user reputation');
      riskScore += 20;
    } else if (userReputation < 10) {
      riskScore += 10;
    }

    // ── 3. Receipt correlation ───────────────────────────────────────────
    const receipt = receiptData as ReceiptData | undefined;
    const business = businessDetails as BusinessDetails | undefined;

    if (receipt && business) {
      // Receipt confidence too low
      if (receipt.confidence < 0.3) {
        fraudReasons.push('Receipt OCR confidence too low');
        riskScore += 15;
      }

      // Business name mismatch
      if (
        receipt.businessName &&
        business.name &&
        !this.fuzzyMatch(receipt.businessName, business.name)
      ) {
        fraudReasons.push('Receipt business name does not match reviewed business');
        riskScore += 30;
      }

      // Suspicious amount (negative or implausibly large)
      if (receipt.amount !== undefined && (receipt.amount < 0 || receipt.amount > 1_000_000)) {
        fraudReasons.push('Receipt amount is suspicious');
        riskScore += 20;
      }
    }

    const finalScore = Math.min(riskScore, 100);
    const isFraudulent = finalScore >= 50;

    return {
      isFraudulent,
      confidence: Math.min(finalScore / 100 + 0.1, 1.0),
      fraudReasons,
      riskScore: finalScore,
    };
  }

  /**
   * Detect fraud in review and receipt data — tries Python service first,
   * falls back to native detection.
   */
  async detectFraud(
    request: FraudDetectionRequest,
  ): Promise<FraudDetectionResponse> {
    try {
      const response = await axios.post(
        `${this.fraudDetectionUrl}/detect-fraud`,
        request,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        },
      );
      return response.data as FraudDetectionResponse;
    } catch {
      // Python service unavailable — use native detection
      return this.detectFraudNative(
        request.review_text,
        request.user_reputation,
        request.receipt_data,
        request.business_details,
      );
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
   * Analyze review for fraud — uses native detection directly.
   */
  async analyzeReview(
    reviewText: string,
    userReputation: number,
    receiptData?: unknown,
    businessDetails?: unknown,
  ): Promise<FraudDetectionResponse> {
    return this.detectFraudNative(
      reviewText,
      userReputation,
      receiptData,
      businessDetails,
    );
  }

  /**
   * Fuzzy match two strings — case-insensitive, ignores punctuation.
   */
  private fuzzyMatch(a: string, b: string): boolean {
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return true;
    // Check if either contains the other
    return na.includes(nb) || nb.includes(na);
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
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where: {
            isFlagged: true,
          },
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            email: true,
            flagReason: true,
            flagCount: true,
            lastFlaggedAt: true,
            reviewPattern: true,
            unverifiedReviewCount: true,
            reputation: true,
            createdAt: true,
            _count: {
              select: {
                reviews: true,
                fraudReports: true,
              },
            },
          },
          orderBy: {
            lastFlaggedAt: 'desc',
          },
        }),
        this.prisma.user.count({
          where: {
            isFlagged: true,
          },
        }),
      ]);

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
      this.logger.log(`Admin ${adminId} unflagging user: ${userId}`);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isFlagged: false,
          flagReason: null,
          lastFlaggedAt: null,
        },
      });
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
   * Check and penalize users with excessive unverified reviews (progressive penalties)
   */
  async checkAndPenalizeSpamUsers(userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          reputation: true,
          unverifiedReviewCount: true,
          flagCount: true,
        },
      });

      if (!user) return;

      const unverified = user.unverifiedReviewCount ?? 0;
      const flags = user.flagCount ?? 0;

      // Progressive penalty scale based on cumulative unverified reviews and flag count
      let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

      if (unverified >= 20 || flags >= 5) {
        severity = 'CRITICAL';
      } else if (unverified >= 10 || flags >= 3) {
        severity = 'HIGH';
      } else if (unverified >= 5 || flags >= 1) {
        severity = 'MEDIUM';
      }

      await this.reduceCredibilityForSpam(userId, severity);
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
