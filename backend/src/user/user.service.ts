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
              reviews: true,
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
        user: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          bio: string | null;
          role: string;
          avatar: string | null;
          reputation: number;
          emailVerified: boolean;
          isActive: boolean;
          createdAt: Date;
          lastLoginAt: Date | null;
        };
        stats: {
          totalReviews: number;
          totalBusinesses: number;
          totalFraudReports: number;
          reputation: number;
          isActive: boolean;
          emailVerified: boolean;
        };
        recentActivity: Array<{
          id: string;
          type: string;
          action: string;
          target: string;
          date: Date;
          verified?: boolean;
          credibility?: number;
          trustScore?: number;
          category?: string | null;
          status?: string;
        }>;
        roleSpecificData: Record<string, unknown>;
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
        status?: string;
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

        case 'ADMIN': {
          // Get comprehensive admin statistics
          const [
            totalUsers,
            activeUsers,
            totalBusinesses,
            verifiedBusinesses,
            pendingBusinesses,
            totalFraudReports,
            pendingFraudReports,
            flaggedUsers,
            recentUsers,
            recentBusinesses,
            recentFraudReports,
            systemHealth,
          ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.user.count({ where: { isActive: true } }),
            this.prisma.business.count(),
            this.prisma.business.count({ where: { isVerified: true } }),
            this.prisma.business.count({
              where: {
                status: 'UNDER_REVIEW',
                submittedForReview: true,
              },
            }),
            this.prisma.fraudReport.count(),
            this.prisma.fraudReport.count({ where: { status: 'PENDING' } }),
            this.prisma.user.count({ where: { isFlagged: true } }),
            this.prisma.user.findMany({
              take: 5,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
              },
            }),
            this.prisma.business.findMany({
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: {
                owner: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                trustScore: true,
                _count: {
                  select: {
                    reviews: true,
                    documents: true,
                  },
                },
              },
            }),
            this.prisma.fraudReport.findMany({
              take: 5,
              orderBy: { createdAt: 'desc' },
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
            }),
            this.getSystemHealthStatus(),
          ]);

          roleBasedData.roleSpecificData = {
            // Comprehensive Admin Dashboard Metrics
            adminMetrics: {
              // User Management Stats
              userManagement: {
                totalUsers,
                activeUsers,
                inactiveUsers: totalUsers - activeUsers,
                newUsersToday: await this.prisma.user.count({
                  where: {
                    createdAt: {
                      gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    },
                  },
                }),
                usersWithVerifiedEmail: await this.prisma.user.count({
                  where: { emailVerified: true },
                }),
                flaggedUsers,
                usersByRole: {
                  customers: await this.prisma.user.count({
                    where: { role: 'CUSTOMER' },
                  }),
                  businessOwners: await this.prisma.user.count({
                    where: { role: 'BUSINESS_OWNER' },
                  }),
                  admins: await this.prisma.user.count({
                    where: { role: 'ADMIN' },
                  }),
                },
              },

              // Business Management Stats
              businessManagement: {
                totalBusinesses,
                verifiedBusinesses,
                pendingVerification: pendingBusinesses,
                activeBusinesses: await this.prisma.business.count({
                  where: { isActive: true },
                }),
                inactiveBusinesses:
                  totalBusinesses -
                  (await this.prisma.business.count({
                    where: { isActive: true },
                  })),
                newBusinessesToday: await this.prisma.business.count({
                  where: {
                    createdAt: {
                      gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    },
                  },
                }),
                businessesWithTrustScores: await this.prisma.business.count({
                  where: { trustScore: { isNot: null } },
                }),
                averageTrustScore: await this.getAverageTrustScore(),
                verificationRate:
                  totalBusinesses > 0
                    ? Math.round((verifiedBusinesses / totalBusinesses) * 100)
                    : 0,
              },

              // Fraud & Security Stats
              fraudSecurity: {
                totalFraudReports,
                pendingFraudReports,
                underReviewReports: await this.prisma.fraudReport.count({
                  where: { status: 'UNDER_REVIEW' },
                }),
                resolvedReports: await this.prisma.fraudReport.count({
                  where: { status: 'RESOLVED' },
                }),
                dismissedReports: await this.prisma.fraudReport.count({
                  where: { status: 'DISMISSED' },
                }),
                reportsThisMonth: await this.prisma.fraudReport.count({
                  where: {
                    createdAt: {
                      gte: new Date(
                        new Date().getFullYear(),
                        new Date().getMonth(),
                        1,
                      ),
                    },
                  },
                }),
                flaggedUsers,
                suspiciousActivities: await this.getSuspiciousActivities(),
              },

              // System Performance Stats
              systemPerformance: {
                totalReviews: await this.prisma.review.count(),
                verifiedReviews: await this.prisma.review.count({
                  where: { isVerified: true },
                }),
                averageReviewRating: await this.getAverageReviewRating(),
                totalDocuments: await this.prisma.document.count(),
                verifiedDocuments: await this.prisma.document.count({
                  where: { verified: true },
                }),
                aiVerifiedDocuments: await this.prisma.document.count({
                  where: { aiVerified: true },
                }),
                systemHealth,
                databaseSize: await this.getDatabaseSize(),
                responseTime: await this.getSystemResponseTime(),
              },

              // Content Moderation Stats
              contentModeration: {
                totalReviews: await this.prisma.review.count(),
                unverifiedReviews: await this.prisma.review.count({
                  where: { isVerified: false },
                }),
                reviewsWithLowCredibility: await this.prisma.review.count({
                  where: { credibility: { lt: 50 } },
                }),
                reviewsFlaggedForReview: await this.prisma.review.count({
                  where: { isActive: false },
                }),
                averageCredibilityScore:
                  await this.getAverageCredibilityScore(),
                moderationQueue: await this.getModerationQueue(),
              },
            },

            // Recent Activities & Alerts
            recentActivities: {
              newUsers: recentUsers.map((user) => ({
                id: user.id,
                type: 'user_registration',
                action: 'New user registered',
                target: user.name,
                date: user.createdAt,
                details: {
                  email: user.email,
                  role: user.role,
                  isActive: user.isActive,
                },
              })),
              newBusinesses: recentBusinesses.map((business) => ({
                id: business.id,
                type: 'business_registration',
                action: 'New business registered',
                target: business.name,
                date: business.createdAt,
                details: {
                  owner: business.owner?.name,
                  isVerified: business.isVerified,
                  trustScore: business.trustScore?.score || 0,
                  reviewCount: business._count.reviews,
                  documentCount: business._count.documents,
                },
              })),
              fraudReports: recentFraudReports.map((report) => ({
                id: report.id,
                type: 'fraud_report',
                action: 'Fraud report submitted',
                target: report.business.name,
                date: report.createdAt,
                details: {
                  reporter: report.reporter.name,
                  reason: report.reason,
                  status: report.status,
                  businessVerified: report.business.isVerified,
                },
              })),
            },

            // Admin Actions & Tasks
            adminTasks: {
              pendingBusinessVerifications: pendingBusinesses,
              pendingFraudReports: pendingFraudReports,
              flaggedUsersForReview: flaggedUsers,
              documentsNeedingVerification: await this.prisma.document.count({
                where: { verified: false, aiVerified: false },
              }),
              usersNeedingEmailVerification: await this.prisma.user.count({
                where: { emailVerified: false },
              }),
              systemMaintenanceTasks: await this.getSystemMaintenanceTasks(),
            },

            // System Health & Monitoring
            systemHealth: {
              status: systemHealth,
              uptime: await this.getSystemUptime(),
              errorRate: await this.getSystemErrorRate(),
              performanceMetrics: await this.getPerformanceMetrics(),
              securityAlerts: await this.getSecurityAlerts(),
              backupStatus: this.getBackupStatus(),
            },

            // Admin Quick Actions (Platform Management Only)
            quickActions: [
              {
                action: 'review_fraud_report',
                label: 'Review Fraud Reports',
                count: pendingFraudReports,
                priority: 'high',
              },
              {
                action: 'review_flagged_users',
                label: 'Review Flagged Users',
                count: flaggedUsers,
                priority: 'high',
              },
              {
                action: 'verify_business',
                label: 'Verify Business Applications',
                count: pendingBusinesses,
                priority: 'medium',
              },
              {
                action: 'moderate_reviews',
                label: 'Moderate Reviews',
                count: await this.prisma.review.count({
                  where: {
                    OR: [
                      { isVerified: false },
                      { credibility: { lt: 30 } },
                      { isActive: false },
                    ],
                  },
                }),
                priority: 'medium',
              },
              {
                action: 'verify_documents',
                label: 'Verify Documents',
                count: await this.prisma.document.count({
                  where: { verified: false },
                }),
                priority: 'medium',
              },
              {
                action: 'manage_users',
                label: 'Manage Users',
                count: await this.prisma.user.count({
                  where: { emailVerified: false },
                }),
                priority: 'low',
              },
              {
                action: 'system_maintenance',
                label: 'System Maintenance',
                count: 0,
                priority: 'low',
              },
            ],

            // Analytics & Insights
            analytics: {
              userGrowthTrend: await this.getUserGrowthTrend(),
              businessGrowthTrend: await this.getBusinessGrowthTrend(),
              reviewTrends: await this.getReviewTrends(),
              fraudTrends: await this.getFraudTrends(),
              trustScoreDistribution: await this.getTrustScoreDistribution(),
              categoryDistribution: await this.getCategoryDistribution(),
            },
          };
          break;
        }
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

  // Admin Helper Methods
  private async getSystemHealthStatus(): Promise<string> {
    try {
      // Check database connectivity
      await this.prisma.$queryRaw`SELECT 1`;

      // Check if there are any critical errors
      const errorCount = await this.prisma.user.count({
        where: { isFlagged: true },
      });

      if (errorCount > 10) {
        return 'warning';
      } else if (errorCount > 20) {
        return 'critical';
      }

      return 'healthy';
    } catch (error) {
      this.logger.error('Error checking system health:', error);
      return 'critical';
    }
  }

  private async getAverageTrustScore(): Promise<number> {
    try {
      const result = await this.prisma.trustScore.aggregate({
        _avg: {
          score: true,
        },
      });
      return Math.round(result._avg.score || 0);
    } catch (error) {
      this.logger.error('Error calculating average trust score:', error);
      return 0;
    }
  }

  private async getSuspiciousActivities(): Promise<number> {
    try {
      const suspiciousUsers = await this.prisma.user.count({
        where: {
          OR: [
            { isFlagged: true },
            { unverifiedReviewCount: { gt: 5 } },
            { flagCount: { gt: 3 } },
          ],
        },
      });
      return suspiciousUsers;
    } catch (error) {
      this.logger.error('Error calculating suspicious activities:', error);
      return 0;
    }
  }

  private async getAverageReviewRating(): Promise<number> {
    try {
      const result = await this.prisma.review.aggregate({
        _avg: {
          rating: true,
        },
        where: { isActive: true },
      });
      return Math.round((result._avg.rating || 0) * 10) / 10;
    } catch (error) {
      this.logger.error('Error calculating average review rating:', error);
      return 0;
    }
  }

  private async getDatabaseSize(): Promise<string> {
    try {
      // This is a simplified version - in production you'd want actual DB size
      const userCount = await this.prisma.user.count();
      const businessCount = await this.prisma.business.count();
      const reviewCount = await this.prisma.review.count();

      const estimatedSize =
        userCount * 0.5 + businessCount * 2 + reviewCount * 0.3;
      return `${Math.round(estimatedSize)} MB`;
    } catch (error) {
      this.logger.error('Error calculating database size:', error);
      return 'Unknown';
    }
  }

  private async getSystemResponseTime(): Promise<number> {
    try {
      const start = Date.now();
      await this.prisma.user.count();
      const end = Date.now();
      return end - start;
    } catch (error) {
      this.logger.error('Error measuring response time:', error);
      return 0;
    }
  }

  private async getAverageCredibilityScore(): Promise<number> {
    try {
      const result = await this.prisma.review.aggregate({
        _avg: {
          credibility: true,
        },
        where: { isActive: true },
      });
      return Math.round(result._avg.credibility || 0);
    } catch (error) {
      this.logger.error('Error calculating average credibility score:', error);
      return 0;
    }
  }

  private async getModerationQueue(): Promise<number> {
    try {
      const queue = await this.prisma.review.count({
        where: {
          OR: [
            { isVerified: false },
            { credibility: { lt: 30 } },
            { isActive: false },
          ],
        },
      });
      return queue;
    } catch (error) {
      this.logger.error('Error calculating moderation queue:', error);
      return 0;
    }
  }

  private async getSystemMaintenanceTasks(): Promise<number> {
    try {
      // Count various maintenance tasks
      const tasks = await Promise.all([
        this.prisma.user.count({ where: { emailVerified: false } }),
        this.prisma.document.count({ where: { verified: false } }),
        this.prisma.business.count({ where: { status: 'PENDING' } }),
      ]);

      return tasks.reduce((sum, count) => sum + count, 0);
    } catch (error) {
      this.logger.error('Error calculating maintenance tasks:', error);
      return 0;
    }
  }

  private async getSystemUptime(): Promise<string> {
    try {
      // This would typically come from a monitoring service
      // For now, return a placeholder
      return '99.9%';
    } catch (error) {
      this.logger.error('Error getting system uptime:', error);
      return 'Unknown';
    }
  }

  private async getSystemErrorRate(): Promise<number> {
    try {
      const totalRequests = await this.prisma.user.count();
      const errorCount = await this.prisma.user.count({
        where: { isFlagged: true },
      });

      return totalRequests > 0
        ? Math.round((errorCount / totalRequests) * 100)
        : 0;
    } catch (error) {
      this.logger.error('Error calculating error rate:', error);
      return 0;
    }
  }

  private async getPerformanceMetrics(): Promise<Record<string, unknown>> {
    try {
      return {
        avgResponseTime: await this.getSystemResponseTime(),
        databaseConnections: 'Active',
        memoryUsage: 'Normal',
        cpuUsage: 'Normal',
      };
    } catch (error) {
      this.logger.error('Error getting performance metrics:', error);
      return {};
    }
  }

  private async getSecurityAlerts(): Promise<number> {
    try {
      const alerts = await this.prisma.user.count({
        where: {
          OR: [{ isFlagged: true }, { flagCount: { gt: 2 } }],
        },
      });
      return alerts;
    } catch (error) {
      this.logger.error('Error calculating security alerts:', error);
      return 0;
    }
  }

  private getBackupStatus(): string {
    try {
      // This would typically check actual backup status
      return 'Last backup: 2 hours ago';
    } catch (error) {
      this.logger.error('Error getting backup status:', error);
      return 'Unknown';
    }
  }

  private async getUserGrowthTrend(): Promise<
    Array<{ date: string; count: number }>
  > {
    try {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      });

      const trends = await Promise.all(
        last7Days.map(async (date) => {
          const count = await this.prisma.user.count({
            where: {
              createdAt: {
                gte: new Date(date),
                lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
              },
            },
          });
          return { date, count };
        }),
      );

      return trends.reverse();
    } catch (error) {
      this.logger.error('Error calculating user growth trend:', error);
      return [];
    }
  }

  private async getBusinessGrowthTrend(): Promise<
    Array<{ date: string; count: number }>
  > {
    try {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      });

      const trends = await Promise.all(
        last7Days.map(async (date) => {
          const count = await this.prisma.business.count({
            where: {
              createdAt: {
                gte: new Date(date),
                lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
              },
            },
          });
          return { date, count };
        }),
      );

      return trends.reverse();
    } catch (error) {
      this.logger.error('Error calculating business growth trend:', error);
      return [];
    }
  }

  private async getReviewTrends(): Promise<
    Array<{ date: string; count: number }>
  > {
    try {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      });

      const trends = await Promise.all(
        last7Days.map(async (date) => {
          const count = await this.prisma.review.count({
            where: {
              createdAt: {
                gte: new Date(date),
                lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
              },
            },
          });
          return { date, count };
        }),
      );

      return trends.reverse();
    } catch (error) {
      this.logger.error('Error calculating review trends:', error);
      return [];
    }
  }

  private async getFraudTrends(): Promise<
    Array<{ date: string; count: number }>
  > {
    try {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      });

      const trends = await Promise.all(
        last7Days.map(async (date) => {
          const count = await this.prisma.fraudReport.count({
            where: {
              createdAt: {
                gte: new Date(date),
                lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
              },
            },
          });
          return { date, count };
        }),
      );

      return trends.reverse();
    } catch (error) {
      this.logger.error('Error calculating fraud trends:', error);
      return [];
    }
  }

  private async getTrustScoreDistribution(): Promise<Record<string, number>> {
    try {
      const distributions = await Promise.all([
        this.prisma.trustScore.count({ where: { score: { gte: 90 } } }),
        this.prisma.trustScore.count({ where: { score: { gte: 80, lt: 90 } } }),
        this.prisma.trustScore.count({ where: { score: { gte: 70, lt: 80 } } }),
        this.prisma.trustScore.count({ where: { score: { gte: 60, lt: 70 } } }),
        this.prisma.trustScore.count({ where: { score: { gte: 50, lt: 60 } } }),
        this.prisma.trustScore.count({ where: { score: { lt: 50 } } }),
      ]);

      return {
        'A+ (90-100)': distributions[0],
        'A (80-89)': distributions[1],
        'B (70-79)': distributions[2],
        'C (60-69)': distributions[3],
        'D (50-59)': distributions[4],
        'F (0-49)': distributions[5],
      };
    } catch (error) {
      this.logger.error('Error calculating trust score distribution:', error);
      return {};
    }
  }

  private async getCategoryDistribution(): Promise<Record<string, number>> {
    try {
      const categories = await this.prisma.business.groupBy({
        by: ['category'],
        _count: {
          category: true,
        },
        where: {
          category: { not: null },
        },
      });

      const distribution: Record<string, number> = {};
      categories.forEach((cat) => {
        distribution[cat.category || 'Unknown'] = cat._count.category;
      });

      return distribution;
    } catch (error) {
      this.logger.error('Error calculating category distribution:', error);
      return {};
    }
  }
}
