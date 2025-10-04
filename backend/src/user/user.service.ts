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
} from './dto/user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

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

  // Business Management (for business owners)
  async createBusiness(userId: string, businessData: CreateBusinessDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
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
}
