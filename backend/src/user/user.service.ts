import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserWithoutPassword } from '../auth/interfaces/user.interface';
import { UserRole } from '../auth/dto/user-role.enum';
import { AiService } from '../shared/ai/ai.service';
import { FraudDetectionService } from '../shared/fraud-detection/fraud-detection.service';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  CreateReviewDto,
  UpdateReviewDto,
  CreateFraudReportDto,
  UpdateProfileDto,
  CreateReviewReplyDto,
  UpdateReviewReplyDto,
} from './dto/user.dto';

// Type definitions for ReviewReply
interface ReviewReplyUser {
  id: string;
  name: string;
  avatar: string | null;
  role?: string;
}

interface ReviewReplyReview {
  id: string;
  rating: number;
  comment: string | null;
}

interface ReviewReply {
  id: string;
  content: string;
  reviewId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user?: ReviewReplyUser;
  review?: ReviewReplyReview;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  // Helper method to access reviewReply with proper typing
  private get reviewReply() {
    return this.prisma.reviewReply;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly fraudDetectionService: FraudDetectionService,
  ) {}

  // Profile Management
  async updateProfile(
    userId: string,
    updateData: UpdateProfileDto,
  ): Promise<UserWithoutPassword> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          bio: true,
          role: true,
          isActive: true,
          provider: true,
          providerId: true,
          avatar: true,
          emailVerified: true,
          reputation: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      this.logger.log(`User profile updated: ${userId}`);
      return updatedUser as UserWithoutPassword;
    } catch (error) {
      this.logger.error('Error updating user profile:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update profile');
    }
  }

  async getUserStats(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: {
              reviews: true,
              businesses: true,
              fraudReports: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        totalReviews: user._count.reviews,
        totalBusinesses: user._count.businesses,
        totalFraudReports: user._count.fraudReports,
        reputation: user.reputation,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
      };
    } catch (error) {
      this.logger.error('Error fetching user stats:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch user statistics');
    }
  }

  async getRoleBasedProfileData(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          businesses: {
            include: {
              trustScore: true,
              businessCategory: true,
              _count: {
                select: {
                  reviews: true,
                  documents: true,
                  payments: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          reviews: {
            include: {
              business: {
                select: {
                  id: true,
                  name: true,
                  isVerified: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          fraudReports: {
            include: {
              business: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          _count: {
            select: {
              reviews: true,
              businesses: true,
              fraudReports: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Calculate role-specific metrics
      const roleBasedData: {
        user: any;
        stats: any;
        recentActivity: Array<{
          type: string;
          action: string;
          target: string;
          date: Date;
          verified?: boolean;
          credibility?: number;
          trustScore?: number;
          category?: string | null;
          status?: any;
        }>;
        roleSpecificData: any;
      } = {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          bio: user.bio,
          role: user.role,
          avatar: user.avatar,
          reputation: user.reputation,
          emailVerified: user.emailVerified,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        },
        stats: {
          totalReviews: user._count.reviews,
          totalBusinesses: user._count.businesses,
          totalFraudReports: user._count.fraudReports,
          reputation: user.reputation,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
        },
        recentActivity: [],
        roleSpecificData: {},
      };

      // Generate recent activity from reviews and business updates
      const activities: Array<{
        id: string;
        type: string;
        action: string;
        target: string;
        date: Date;
        verified?: boolean;
        credibility?: number;
        trustScore?: number;
        category?: string | null;
        status?: any;
      }> = [];

      // Add review activities
      user.reviews.forEach((review) => {
        activities.push({
          id: review.id,
          type: 'review',
          action: `Posted a ${review.rating}-star review`,
          target: review.business.name,
          date: review.createdAt,
          verified: review.isVerified,
          credibility: review.credibility,
        });
      });

      // Add business activities
      user.businesses.forEach((business) => {
        activities.push({
          id: business.id,
          type: 'business',
          action: business.isVerified
            ? 'Business verified'
            : 'Business created',
          target: business.name,
          date: business.createdAt,
          trustScore: business.trustScore?.score || 0,
          category: business.category,
        });
      });

      // Add fraud report activities
      user.fraudReports.forEach((report) => {
        activities.push({
          id: report.id,
          type: 'fraud_report',
          action: 'Reported fraud',
          target: report.business.name,
          date: report.createdAt,
          status: report.status,
        });
      });

      // Sort activities by date and take the most recent 10
      roleBasedData.recentActivity = activities
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      // Role-specific data
      switch (user.role) {
        case 'CUSTOMER':
          roleBasedData.roleSpecificData = {
            averageRating:
              user.reviews.length > 0
                ? user.reviews.reduce((sum, review) => sum + review.rating, 0) /
                  user.reviews.length
                : 0,
            verifiedReviews: user.reviews.filter((r) => r.isVerified).length,
            credibilityScore: user.reputation,
            reviewPattern: user.reviewPattern,
            unverifiedReviewCount: user.unverifiedReviewCount,
          };
          break;

        case 'BUSINESS_OWNER': {
          const totalReviews = user.businesses.reduce(
            (sum, b) => sum + b._count.reviews,
            0,
          );
          const verifiedBusinesses = user.businesses.filter(
            (b) => b.isVerified,
          ).length;
          const averageTrustScore =
            user.businesses.length > 0
              ? user.businesses.reduce(
                  (sum, b) => sum + (b.trustScore?.score || 0),
                  0,
                ) / user.businesses.length
              : 0;

          roleBasedData.roleSpecificData = {
            // Business Dashboard Metrics
            dashboardMetrics: {
              averageBusinessTrustScore: Math.round(averageTrustScore),
              totalBusinesses: user.businesses.length,
              verifiedBusinesses: verifiedBusinesses,
              totalReviews: totalReviews,
              verificationRate:
                user.businesses.length > 0
                  ? Math.round(
                      (verifiedBusinesses / user.businesses.length) * 100,
                    )
                  : 0,
              // Additional relevant metrics
              averageRating:
                totalReviews > 0
                  ? user.businesses.reduce((sum, b) => {
                      const businessReviews = b.reviews || [];
                      return (
                        sum +
                        businessReviews.reduce(
                          (reviewSum, review) => reviewSum + review.rating,
                          0,
                        )
                      );
                    }, 0) / totalReviews
                  : 0,
              pendingReviews: user.businesses.reduce(
                (sum, b) =>
                  sum + (b.reviews?.filter((r) => !r.isVerified).length || 0),
                0,
              ),
              activeBusinesses: user.businesses.filter((b) => b.isActive)
                .length,
              documentsUploaded: user.businesses.reduce(
                (sum, b) => sum + b._count.documents,
                0,
              ),
              onboardingProgress:
                user.businesses.length > 0
                  ? Math.round(
                      (user.businesses.reduce(
                        (sum, b) => sum + b.onboardingStep,
                        0,
                      ) /
                        user.businesses.length) *
                        20,
                    ) // Assuming 5 steps max
                  : 0,
              responseRate: 0, // Placeholder for review response tracking
              trustScoreTrend: 'stable', // Placeholder for trend analysis
            },

            // Business Details
            businesses: user.businesses.map((business) => ({
              id: business.id,
              name: business.name,
              category: business.category,
              status: business.status,
              isVerified: business.isVerified,
              isActive: business.isActive,
              trustScore: business.trustScore?.score || 0,
              trustGrade: business.trustScore?.grade || 'N/A',
              totalReviews: business._count.reviews,
              totalDocuments: business._count.documents,
              totalPayments: business._count.payments,
              fraudReports: 0, // Would need separate query for fraud reports count
              createdAt: business.createdAt,
              onboardingStep: business.onboardingStep,
              submittedForReview: business.submittedForReview,
            })),

            // Business Performance
            performance: {
              averageTrustScore: Math.round(averageTrustScore),
              totalRevenue: 0, // Would need payment integration
              reviewResponseRate: 0, // Would need review reply tracking
              documentCompletionRate:
                user.businesses.length > 0
                  ? Math.round(
                      (user.businesses.reduce(
                        (sum, b) => sum + (b._count.documents > 0 ? 1 : 0),
                        0,
                      ) /
                        user.businesses.length) *
                        100,
                    )
                  : 0,
            },

            // Verification Status
            verificationStatus: {
              overall: user.businesses.some((b) => b.isVerified)
                ? 'verified'
                : 'pending',
              pendingBusinesses: user.businesses.filter((b) => !b.isVerified)
                .length,
              rejectedBusinesses: user.businesses.filter(
                (b) => b.status === 'REJECTED',
              ).length,
              underReview: user.businesses.filter(
                (b) => b.status === 'UNDER_REVIEW',
              ).length,
            },
          };
          break;
        }

        case 'ADMIN':
          roleBasedData.roleSpecificData = {
            adminMetrics: {
              totalUsersManaged: 0, // Would need admin-specific queries
              totalBusinessesManaged: 0,
              totalReportsResolved: 0,
              systemHealth: 'healthy',
            },
            adminActions: [
              {
                action: 'System maintenance',
                date: new Date(),
                status: 'completed',
              },
              {
                action: 'User verification',
                date: new Date(),
                status: 'pending',
              },
            ],
            systemStats: {
              totalUsers: 0,
              totalBusinesses: 0,
              totalReviews: 0,
              totalFraudReports: 0,
            },
          };
          break;
      }

      return roleBasedData;
    } catch (error) {
      this.logger.error('Error fetching role-based profile data:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch role-based profile data',
      );
    }
  }

  // Business Management (for business owners)
  async createBusiness(userId: string, businessData: CreateBusinessDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: {
              businesses: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user already has a business (limit to 1 business per user)
      if (user._count.businesses >= 1) {
        throw new ForbiddenException(
          'You can only register one business per account',
        );
      }

      // If user is not a business owner, upgrade their role
      if (
        user.role !== (UserRole.BUSINESS_OWNER as any) &&
        user.role !== (UserRole.ADMIN as any)
      ) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { role: UserRole.BUSINESS_OWNER },
        });
        this.logger.log(`User role upgraded to BUSINESS_OWNER: ${userId}`);
      }

      const business = await this.prisma.business.create({
        data: {
          ...businessData,
          ownerId: userId,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          businessCategory: true,
        },
      });

      this.logger.log(`Business created: ${business.id} by user: ${userId}`);
      return business;
    } catch (error) {
      this.logger.error('Error creating business:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create business');
    }
  }

  async getUserBusinesses(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const skip = (page - 1) * limit;

      const [businesses, total] = await Promise.all([
        this.prisma.business.findMany({
          where: { ownerId: userId },
          skip,
          take: limit,
          include: {
            trustScore: true,
            businessCategory: true,
            _count: {
              select: {
                reviews: true,
                documents: true,
                payments: true,
                fraudReports: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.business.count({ where: { ownerId: userId } }),
      ]);

      return {
        businesses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching user businesses:', error);
      throw new InternalServerErrorException('Failed to fetch businesses');
    }
  }

  async updateBusiness(
    userId: string,
    businessId: string,
    updateData: UpdateBusinessDto,
  ) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException('You can only update your own businesses');
      }

      const updatedBusiness = await this.prisma.business.update({
        where: { id: businessId },
        data: updateData,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          businessCategory: true,
        },
      });

      this.logger.log(`Business updated: ${businessId} by user: ${userId}`);
      return updatedBusiness;
    } catch (error) {
      this.logger.error('Error updating business:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update business');
    }
  }

  async deleteBusiness(userId: string, businessId: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: {
          _count: {
            select: {
              reviews: true,
              documents: true,
              payments: true,
            },
          },
        },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException('You can only delete your own businesses');
      }

      // Check if business has reviews or other data
      if (
        business._count.reviews > 0 ||
        business._count.documents > 0 ||
        business._count.payments > 0
      ) {
        // Soft delete by deactivating
        await this.prisma.business.update({
          where: { id: businessId },
          data: { isActive: false },
        });
        this.logger.log(
          `Business deactivated: ${businessId} by user: ${userId}`,
        );
        return { message: 'Business deactivated successfully' };
      } else {
        // Hard delete if no associated data
        await this.prisma.business.delete({
          where: { id: businessId },
        });
        this.logger.log(`Business deleted: ${businessId} by user: ${userId}`);
        return { message: 'Business deleted successfully' };
      }
    } catch (error) {
      this.logger.error('Error deleting business:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete business');
    }
  }

  // Review Management
  async createReview(userId: string, reviewData: CreateReviewDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const business = await this.prisma.business.findUnique({
        where: { id: reviewData.businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      // Check if user already reviewed this business
      const existingReview = await this.prisma.review.findFirst({
        where: {
          userId: userId,
          businessId: reviewData.businessId,
        },
      });

      if (existingReview) {
        throw new BadRequestException(
          'You have already reviewed this business',
        );
      }

      // Validate rating
      if (reviewData.rating < 1 || reviewData.rating > 5) {
        throw new BadRequestException('Rating must be between 1 and 5');
      }

      let isVerified = false;
      let receiptData: unknown = null;
      let credibility = 0;

      // If receipt is provided, validate it with AI
      if (reviewData.receiptUrl) {
        try {
          this.logger.log(
            `Validating receipt for review: ${reviewData.receiptUrl}`,
          );

          const businessDetails = {
            name: business.name,
            address: business.location || undefined,
            phone: business.phone || undefined,
            email: business.email || undefined,
          };

          const validation = await this.aiService.validateReceiptForReview(
            reviewData.receiptUrl,
            businessDetails,
            reviewData.amount,
            reviewData.reviewDate,
          );

          isVerified = validation.isValid;
          receiptData = validation.extractedData;

          this.logger.log(
            `Receipt validation result: ${isVerified ? 'VERIFIED' : 'NOT VERIFIED'}`,
          );
        } catch (error) {
          this.logger.error('Error validating receipt:', error);
          // Continue with unverified review if validation fails
        }
      }

      // Generate AI credibility score and fraud detection
      try {
        // First, check for fraud using dedicated fraud detection service
        const fraudDetection = await this.fraudDetectionService.analyzeReview(
          reviewData.comment || '',
          user.reputation,
          receiptData,
          {
            name: business.name,
            address: business.location || undefined,
            phone: business.phone || undefined,
            email: business.email || undefined,
          },
        );

        if (fraudDetection.isFraudulent) {
          this.logger.warn(
            `Fraudulent review detected: ${fraudDetection.fraudReasons.join(', ')}`,
          );
          // Mark as unverified if fraud is detected
          isVerified = false;
          credibility = Math.max(0, 100 - fraudDetection.riskScore);
        } else {
          // Generate normal credibility score
          credibility = await this.aiService.generateReviewCredibilityScore(
            reviewData.comment || '',
            reviewData.rating,
            isVerified,
            user.reputation,
          );
        }
      } catch (error) {
        this.logger.error(
          'Error in fraud detection or credibility scoring:',
          error,
        );
        // Use basic credibility calculation as fallback
        credibility = isVerified ? 80 : 50;
      }

      const review = await this.prisma.review.create({
        data: {
          businessId: reviewData.businessId,
          rating: reviewData.rating,
          comment: reviewData.comment,
          userId: userId,
          // receiptUrl: reviewData.receiptUrl || null, // Field not in schema

          // receiptData: receiptData, // Field not in schema
          // validationResult: validationResult, // Field not in schema
          // amount: reviewData.amount, // Field not in schema
          // reviewDate: reviewData.reviewDate
          //   ? new Date(reviewData.reviewDate)
          //   : null, // Field not in schema
          isVerified: isVerified,
          credibility: credibility,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              reputation: true,
            },
          },
          business: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Update user's unverified review count
      if (!isVerified) {
        // TODO: Uncomment after Prisma client regeneration with new fields
        // await this.prisma.user.update({
        //   where: { id: userId },
        //   data: {
        //     unverifiedReviewCount: {
        //       increment: 1,
        //     },
        //   },
        // });
        this.logger.log(
          `User ${userId} unverified review count would be incremented`,
        );

        // Check and penalize for spam behavior
        try {
          await this.fraudDetectionService.checkAndPenalizeSpamUsers(userId);
        } catch (error) {
          this.logger.error('Error checking spam penalties:', error);
          // Don't fail the review creation if spam check fails
        }
      }

      // Check if user should be flagged for suspicious behavior
      try {
        const flaggingResult =
          await this.fraudDetectionService.checkUserForFlagging(userId);

        if (flaggingResult.shouldFlag) {
          this.logger.warn(
            `User ${userId} flagged for suspicious behavior: ${flaggingResult.flagReason}`,
          );

          await this.fraudDetectionService.flagUser(
            userId,
            flaggingResult.flagReason,
            flaggingResult.riskLevel,
          );
        }
      } catch (error) {
        this.logger.error('Error checking user for flagging:', error);
        // Don't fail the review creation if flagging check fails
      }

      this.logger.log(`Review created: ${review.id} by user: ${userId}`);
      return review;
    } catch (error) {
      this.logger.error('Error creating review:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create review');
    }
  }

  async getUserReviews(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [reviews, total] = await Promise.all([
        this.prisma.review.findMany({
          where: { userId: userId },
          skip,
          take: limit,
          include: {
            business: {
              select: {
                id: true,
                name: true,
                isVerified: true,
                isActive: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.review.count({ where: { userId: userId } }),
      ]);

      return {
        reviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching user reviews:', error);
      throw new InternalServerErrorException('Failed to fetch reviews');
    }
  }

  async updateReview(
    userId: string,
    reviewId: string,
    updateData: UpdateReviewDto,
  ) {
    try {
      const review = await this.prisma.review.findUnique({
        where: { id: reviewId },
      });

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      if (review.userId !== userId) {
        throw new ForbiddenException('You can only update your own reviews');
      }

      // Validate rating if provided
      if (
        updateData.rating &&
        (updateData.rating < 1 || updateData.rating > 5)
      ) {
        throw new BadRequestException('Rating must be between 1 and 5');
      }

      const updatedReview = await this.prisma.review.update({
        where: { id: reviewId },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              reputation: true,
            },
          },
          business: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      this.logger.log(`Review updated: ${reviewId} by user: ${userId}`);
      return updatedReview;
    } catch (error) {
      this.logger.error('Error updating review:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update review');
    }
  }

  async deleteReview(userId: string, reviewId: string) {
    try {
      const review = await this.prisma.review.findUnique({
        where: { id: reviewId },
      });

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      if (review.userId !== userId) {
        throw new ForbiddenException('You can only delete your own reviews');
      }

      await this.prisma.review.delete({
        where: { id: reviewId },
      });

      this.logger.log(`Review deleted: ${reviewId} by user: ${userId}`);
      return { message: 'Review deleted successfully' };
    } catch (error) {
      this.logger.error('Error deleting review:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete review');
    }
  }

  // Fraud Report Management
  async createFraudReport(userId: string, reportData: CreateFraudReportDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const business = await this.prisma.business.findUnique({
        where: { id: reportData.businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      // Check if user already reported this business
      const existingReport = await this.prisma.fraudReport.findFirst({
        where: {
          reporterId: userId,
          businessId: reportData.businessId,
        },
      });

      if (existingReport) {
        throw new BadRequestException(
          'You have already reported this business',
        );
      }

      const report = await this.prisma.fraudReport.create({
        data: {
          ...reportData,
          reporterId: userId,
        },
        include: {
          reporter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          business: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
        },
      });

      this.logger.log(`Fraud report created: ${report.id} by user: ${userId}`);
      return report;
    } catch (error) {
      this.logger.error('Error creating fraud report:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create fraud report');
    }
  }

  async getUserFraudReports(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const skip = (page - 1) * limit;

      const [reports, total] = await Promise.all([
        this.prisma.fraudReport.findMany({
          where: { reporterId: userId },
          skip,
          take: limit,
          include: {
            business: {
              select: {
                id: true,
                name: true,
                isVerified: true,
                isActive: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.fraudReport.count({ where: { reporterId: userId } }),
      ]);

      return {
        reports,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching user fraud reports:', error);
      throw new InternalServerErrorException('Failed to fetch fraud reports');
    }
  }

  // Public Business Search
  async searchBusinesses(
    search?: string,
    category?: string,
    isVerified?: boolean,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const skip = (page - 1) * limit;

      const where: {
        isActive?: boolean;
        isVerified?: boolean;
        category?: string;
        OR?: Array<{
          name?: { contains: string; mode: 'insensitive' };
          description?: { contains: string; mode: 'insensitive' };
          location?: { contains: string; mode: 'insensitive' };
        }>;
      } = {
        isActive: true,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (category) {
        where.category = category;
      }

      if (isVerified !== undefined) {
        where.isVerified = isVerified;
      }

      const [businesses, total] = await Promise.all([
        this.prisma.business.findMany({
          where,
          skip,
          take: limit,
          include: {
            owner: {
              select: {
                id: true,
                name: true,
              },
            },
            trustScore: true,
            businessCategory: true,
            _count: {
              select: {
                reviews: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.business.count({ where }),
      ]);

      return {
        businesses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error searching businesses:', error);
      throw new InternalServerErrorException('Failed to search businesses');
    }
  }

  async getBusinessDetails(businessId: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
            },
          },
          trustScore: true,
          businessCategory: true,
          reviews: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  reputation: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          _count: {
            select: {
              reviews: true,
              documents: true,
              payments: true,
            },
          },
        },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (!business.isActive) {
        throw new NotFoundException('Business is not active');
      }

      return business;
    } catch (error) {
      this.logger.error('Error fetching business details:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch business details',
      );
    }
  }

  // Review Reply Methods
  async createReviewReply(
    userId: string,
    reviewId: string,
    createReplyDto: CreateReviewReplyDto,
  ) {
    try {
      // Check if user is a business owner
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          businesses: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role !== 'BUSINESS_OWNER' && user.role !== 'ADMIN') {
        throw new ForbiddenException(
          'Only business owners can reply to reviews',
        );
      }

      // Check if the review exists and get the business
      const review = await this.prisma.review.findUnique({
        where: { id: reviewId },
        include: {
          business: true,
        },
      });

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      // Check if the user owns the business that received the review
      const userOwnsBusiness = user.businesses.some(
        (business) => business.id === review.businessId,
      );

      if (!userOwnsBusiness && user.role !== 'ADMIN') {
        throw new ForbiddenException(
          'You can only reply to reviews for your own business',
        );
      }

      // Create the reply
      let reply: ReviewReply;
      try {
        reply = await this.reviewReply.create({
          data: {
            content: createReplyDto.content,
            reviewId: reviewId,
            userId: userId,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            review: {
              select: {
                id: true,
                rating: true,
                comment: true,
              },
            },
          },
        });
      } catch (prismaError) {
        this.logger.error('Prisma error creating review reply:', prismaError);
        throw new InternalServerErrorException('Failed to create review reply');
      }

      this.logger.log(`Review reply created: ${reply?.id} by user: ${userId}`);
      return reply;
    } catch (error) {
      this.logger.error('Error creating review reply:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create review reply');
    }
  }

  async updateReviewReply(
    userId: string,
    replyId: string,
    updateReplyDto: UpdateReviewReplyDto,
  ) {
    try {
      // Check if the reply exists and belongs to the user
      let existingReply: ReviewReply | null;
      try {
        existingReply = await this.reviewReply.findUnique({
          where: { id: replyId },
          include: {
            user: true,
          },
        });
      } catch (prismaError) {
        this.logger.error('Prisma error finding review reply:', prismaError);
        throw new InternalServerErrorException('Failed to find review reply');
      }

      if (!existingReply) {
        throw new NotFoundException('Reply not found');
      }

      if (existingReply && existingReply.userId !== userId) {
        throw new ForbiddenException('You can only update your own replies');
      }

      // Update the reply
      let updatedReply: ReviewReply;
      try {
        updatedReply = await this.reviewReply.update({
          where: { id: replyId },
          data: {
            content: updateReplyDto.content,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            review: {
              select: {
                id: true,
                rating: true,
                comment: true,
              },
            },
          },
        });
      } catch (prismaError) {
        this.logger.error('Prisma error updating review reply:', prismaError);
        throw new InternalServerErrorException('Failed to update review reply');
      }

      this.logger.log(`Review reply updated: ${replyId} by user: ${userId}`);
      return updatedReply;
    } catch (error) {
      this.logger.error('Error updating review reply:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update review reply');
    }
  }

  async deleteReviewReply(userId: string, replyId: string) {
    try {
      // Check if the reply exists and belongs to the user
      let existingReply: ReviewReply | null;
      try {
        existingReply = await this.reviewReply.findUnique({
          where: { id: replyId },
          include: {
            user: true,
          },
        });
      } catch (prismaError) {
        this.logger.error('Prisma error finding review reply:', prismaError);
        throw new InternalServerErrorException('Failed to find review reply');
      }

      if (!existingReply) {
        throw new NotFoundException('Reply not found');
      }

      if (existingReply && existingReply.userId !== userId) {
        throw new ForbiddenException('You can only delete your own replies');
      }

      // Delete the reply
      try {
        await this.reviewReply.delete({
          where: { id: replyId },
        });
      } catch (prismaError) {
        this.logger.error('Prisma error deleting review reply:', prismaError);
        throw new InternalServerErrorException('Failed to delete review reply');
      }

      this.logger.log(`Review reply deleted: ${replyId} by user: ${userId}`);
      return { message: 'Reply deleted successfully' };
    } catch (error) {
      this.logger.error('Error deleting review reply:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete review reply');
    }
  }

  async getReviewReplies(reviewId: string) {
    try {
      // Check if the review exists
      const review = await this.prisma.review.findUnique({
        where: { id: reviewId },
      });

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      // Get all replies for the review
      let replies: ReviewReply[];
      try {
        replies = await this.reviewReply.findMany({
          where: { reviewId: reviewId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        });
      } catch (prismaError) {
        this.logger.error('Prisma error fetching review replies:', prismaError);
        throw new InternalServerErrorException(
          'Failed to fetch review replies',
        );
      }

      return replies;
    } catch (error) {
      this.logger.error('Error fetching review replies:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch review replies');
    }
  }
}
