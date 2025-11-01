import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../auth/dto/user-role.enum';
import { UserWithoutPassword } from '../auth/interfaces/user.interface';
import { UpdateBusinessStatusDto } from '../business/dto/business.dto';
import { MailerService } from '../shared/mailer/mailer.service';

export interface AdminUserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  customers: number;
  businessOwners: number;
  admins: number;
  newUsersThisMonth: number;
  usersWithVerifiedEmail: number;
}

export interface AdminBusinessStats {
  totalBusinesses: number;
  verifiedBusinesses: number;
  pendingVerification: number;
  activeBusinesses: number;
  inactiveBusinesses: number;
  newBusinessesThisMonth: number;
  businessesWithTrustScores: number;
}

export interface AdminFraudReportStats {
  totalReports: number;
  pendingReports: number;
  underReviewReports: number;
  resolvedReports: number;
  dismissedReports: number;
  reportsThisMonth: number;
}

export interface AdminDashboardStats {
  userStats: AdminUserStats;
  businessStats: AdminBusinessStats;
  fraudReportStats: AdminFraudReportStats;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
  ) {}

  // User Management
  async getAllUsers(
    page: number = 1,
    limit: number = 10,
    search?: string,
    role?: UserRole,
    isActive?: boolean,
  ) {
    try {
      const skip = (page - 1) * limit;

      const where: {
        OR?: Array<{
          name?: { contains: string; mode: 'insensitive' };
          email?: { contains: string; mode: 'insensitive' };
          phone?: { contains: string; mode: 'insensitive' };
        }>;
        role?: UserRole;
        isActive?: boolean;
      } = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (role) {
        where.role = role;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
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
            _count: {
              select: {
                reviews: true,
                businesses: true,
                fraudReports: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where }),
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching users:', error);
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  async getUserById(userId: string): Promise<UserWithoutPassword> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
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
          reviews: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
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
          businesses: {
            select: {
              id: true,
              name: true,
              isVerified: true,
              isActive: true,
              createdAt: true,
            },
          },
          fraudReports: {
            select: {
              id: true,
              reason: true,
              status: true,
              createdAt: true,
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
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user as UserWithoutPassword;
    } catch (error) {
      this.logger.error('Error fetching user:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  async updateUserRole(
    userId: string,
    newRole: UserRole,
  ): Promise<UserWithoutPassword> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role === (newRole as any)) {
        throw new BadRequestException('User already has this role');
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { role: newRole },
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

      this.logger.log(`User role updated: ${userId} -> ${newRole}`);
      return updatedUser as UserWithoutPassword;
    } catch (error) {
      this.logger.error('Error updating user role:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update user role');
    }
  }

  async toggleUserStatus(userId: string): Promise<UserWithoutPassword> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Prevent deactivating admin accounts
      if (user.role === 'ADMIN' && user.isActive) {
        throw new BadRequestException('Cannot deactivate admin accounts');
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: !user.isActive },
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

      // Send account status change email
      try {
        const status = updatedUser.isActive ? 'activated' : 'deactivated';
        this.logger.log(
          `Attempting to send account status change email to ${updatedUser.email} - Status: ${status}`,
        );

        await this.mailerService.sendAccountStatusChangeEmail(
          updatedUser.email,
          updatedUser.name,
          status,
        );

        this.logger.log(
          `✅ Account status change email sent successfully to ${updatedUser.email}`,
        );
      } catch (emailError) {
        this.logger.error(
          `❌ Failed to send account status change email to ${updatedUser.email}:`,
          emailError,
        );
        // Log more details about the error
        if (emailError instanceof Error) {
          this.logger.error(`Email error details: ${emailError.message}`);
          this.logger.error(`Email error stack: ${emailError.stack}`);
        }
        // Don't throw error - email failure shouldn't break the status change
      }

      this.logger.log(
        `User status toggled: ${userId} -> ${updatedUser.isActive ? 'active' : 'inactive'}`,
      );
      return updatedUser as UserWithoutPassword;
    } catch (error) {
      this.logger.error('Error toggling user status:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to toggle user status');
    }
  }

  async deleteUser(userId: string): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          businesses: true,
          reviews: true,
          fraudReports: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user has businesses
      if (user.businesses.length > 0) {
        throw new BadRequestException(
          'Cannot delete user with associated businesses. Please transfer or delete businesses first.',
        );
      }

      // Soft delete by deactivating
      await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      this.logger.log(`User deactivated: ${userId}`);
      return { message: 'User deactivated successfully' };
    } catch (error) {
      this.logger.error('Error deleting user:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete user');
    }
  }

  // Business Management
  async getAllBusinesses(
    page: number = 1,
    limit: number = 10,
    search?: string,
    isVerified?: boolean,
    isActive?: boolean,
  ) {
    try {
      const skip = (page - 1) * limit;

      const where: {
        OR?: Array<{
          name?: { contains: string; mode: 'insensitive' };
          description?: { contains: string; mode: 'insensitive' };
          category?: { contains: string; mode: 'insensitive' };
          location?: { contains: string; mode: 'insensitive' };
        }>;
        isVerified?: boolean;
        isActive?: boolean;
      } = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (isVerified !== undefined) {
        where.isVerified = isVerified;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
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
                email: true,
              },
            },
            trustScore: true,
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
      this.logger.error('Error fetching businesses:', error);
      throw new InternalServerErrorException('Failed to fetch businesses');
    }
  }

  async getBusinessById(businessId: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          trustScore: true,
          documents: {
            orderBy: { uploadedAt: 'desc' },
          },
          payments: {
            orderBy: { addedAt: 'desc' },
          },
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
          fraudReports: {
            include: {
              reporter: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          businessCategory: true,
        },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      return business;
    } catch (error) {
      this.logger.error('Error fetching business:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch business');
    }
  }

  async verifyBusiness(businessId: string): Promise<{ message: string }> {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.isVerified) {
        throw new BadRequestException('Business is already verified');
      }

      await this.prisma.business.update({
        where: { id: businessId },
        data: { isVerified: true },
      });

      this.logger.log(`Business verified: ${businessId}`);
      return { message: 'Business verified successfully' };
    } catch (error) {
      this.logger.error('Error verifying business:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to verify business');
    }
  }

  async unverifyBusiness(businessId: string): Promise<{ message: string }> {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (!business.isVerified) {
        throw new BadRequestException('Business is not verified');
      }

      await this.prisma.business.update({
        where: { id: businessId },
        data: { isVerified: false },
      });

      this.logger.log(`Business unverified: ${businessId}`);
      return { message: 'Business verification removed successfully' };
    } catch (error) {
      this.logger.error('Error unverifying business:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to remove business verification',
      );
    }
  }

  async toggleBusinessStatus(businessId: string): Promise<{ message: string }> {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      await this.prisma.business.update({
        where: { id: businessId },
        data: { isActive: !business.isActive },
      });

      this.logger.log(
        `Business status toggled: ${businessId} -> ${!business.isActive ? 'active' : 'inactive'}`,
      );
      return {
        message: `Business ${!business.isActive ? 'activated' : 'deactivated'} successfully`,
      };
    } catch (error) {
      this.logger.error('Error toggling business status:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to toggle business status',
      );
    }
  }

  // Fraud Report Management
  async getAllFraudReports(
    page: number = 1,
    limit: number = 10,
    status?: string,
    businessId?: string,
  ) {
    try {
      const skip = (page - 1) * limit;

      const where: {
        status?: any;
        businessId?: string;
      } = {};

      if (status) {
        where.status = status;
      }

      if (businessId) {
        where.businessId = businessId;
      }

      const [reports, total] = await Promise.all([
        this.prisma.fraudReport.findMany({
          where,
          skip,
          take: limit,
          include: {
            reporter: {
              select: {
                id: true,
                name: true,
                email: true,
                reputation: true,
              },
            },
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
        this.prisma.fraudReport.count({ where }),
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
      this.logger.error('Error fetching fraud reports:', error);
      throw new InternalServerErrorException('Failed to fetch fraud reports');
    }
  }

  async updateFraudReportStatus(
    reportId: string,
    status: string,
    adminNotes?: string,
  ): Promise<{ message: string }> {
    try {
      const report = await this.prisma.fraudReport.findUnique({
        where: { id: reportId },
      });

      if (!report) {
        throw new NotFoundException('Fraud report not found');
      }

      await this.prisma.fraudReport.update({
        where: { id: reportId },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          status: status as any,
          ...(adminNotes && {
            description: `${report.description}\n\nAdmin Notes: ${adminNotes}`,
          }),
        },
      });

      this.logger.log(`Fraud report status updated: ${reportId} -> ${status}`);
      return { message: 'Fraud report status updated successfully' };
    } catch (error) {
      this.logger.error('Error updating fraud report status:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update fraud report status',
      );
    }
  }

  // Dashboard Statistics
  async getDashboardStats(): Promise<AdminDashboardStats> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [userStats, businessStats, fraudReportStats] = await Promise.all([
        this.getUserStats(startOfMonth),
        this.getBusinessStats(startOfMonth),
        this.getFraudReportStats(startOfMonth),
      ]);

      return {
        userStats,
        businessStats,
        fraudReportStats,
      };
    } catch (error) {
      this.logger.error('Error fetching dashboard stats:', error);
      throw new InternalServerErrorException(
        'Failed to fetch dashboard statistics',
      );
    }
  }

  private async getUserStats(startOfMonth: Date): Promise<AdminUserStats> {
    const [
      totalUsers,
      activeUsers,
      customers,
      businessOwners,
      admins,
      newUsersThisMonth,
      usersWithVerifiedEmail,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.user.count({ where: { role: 'BUSINESS_OWNER' } }),
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.user.count({ where: { emailVerified: true } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      customers,
      businessOwners,
      admins,
      newUsersThisMonth,
      usersWithVerifiedEmail,
    };
  }

  private async getBusinessStats(
    startOfMonth: Date,
  ): Promise<AdminBusinessStats> {
    const [
      totalBusinesses,
      verifiedBusinesses,
      activeBusinesses,
      newBusinessesThisMonth,
      businessesWithTrustScores,
    ] = await Promise.all([
      this.prisma.business.count(),
      this.prisma.business.count({ where: { isVerified: true } }),
      this.prisma.business.count({ where: { isActive: true } }),
      this.prisma.business.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.business.count({ where: { trustScore: { isNot: null } } }),
    ]);

    return {
      totalBusinesses,
      verifiedBusinesses,
      pendingVerification: totalBusinesses - verifiedBusinesses,
      activeBusinesses,
      inactiveBusinesses: totalBusinesses - activeBusinesses,
      newBusinessesThisMonth,
      businessesWithTrustScores,
    };
  }

  private async getFraudReportStats(
    startOfMonth: Date,
  ): Promise<AdminFraudReportStats> {
    const [
      totalReports,
      pendingReports,
      underReviewReports,
      resolvedReports,
      dismissedReports,
      reportsThisMonth,
    ] = await Promise.all([
      this.prisma.fraudReport.count(),
      this.prisma.fraudReport.count({ where: { status: 'PENDING' } }),
      this.prisma.fraudReport.count({ where: { status: 'UNDER_REVIEW' } }),
      this.prisma.fraudReport.count({ where: { status: 'RESOLVED' } }),
      this.prisma.fraudReport.count({ where: { status: 'DISMISSED' } }),
      this.prisma.fraudReport.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
    ]);

    return {
      totalReports,
      pendingReports,
      underReviewReports,
      resolvedReports,
      dismissedReports,
      reportsThisMonth,
    };
  }

  async getMonthlyUserRegistrations(): Promise<{ month: string; count: number }[]> {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-11
      
      // Get users from previous years (before current year) for base count
      const usersBeforeYear = await this.prisma.user.count({
        where: {
          createdAt: {
            lt: new Date(currentYear, 0, 1), // Before start of current year
          },
        },
      });

      // Get all users from the current year
      const usersThisYear = await this.prisma.user.findMany({
        where: {
          createdAt: {
            gte: new Date(currentYear, 0, 1), // Start of year
          },
        },
        select: {
          createdAt: true,
        },
      });

      // Initialize months array
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyNewRegistrations: { [key: string]: number } = {};
      months.forEach(month => {
        monthlyNewRegistrations[month] = 0;
      });

      // Count new users by month in current year
      usersThisYear.forEach(user => {
        const userMonth = user.createdAt.getMonth(); // 0-11
        monthlyNewRegistrations[months[userMonth]]++;
      });

      // Log for debugging
      this.logger.log(`Monthly user registrations - Before year: ${usersBeforeYear}, This year total: ${usersThisYear.length}`);
      this.logger.log(`Monthly breakdown: ${JSON.stringify(monthlyNewRegistrations)}`);

      // Return new registrations per month (not cumulative)
      // This shows how many NEW users registered in each month
      const result = months.map((month, index) => {
        if (index <= currentMonth) {
          return {
            month,
            count: monthlyNewRegistrations[month], // New registrations this month
          };
        } else {
          // Future months return 0 (no data yet)
          return {
            month,
            count: 0,
          };
        }
      });

      this.logger.log(`Monthly new registrations: ${JSON.stringify(result.filter(r => r.count > 0))}`);
      
      return result;
    } catch (error) {
      this.logger.error('Error fetching monthly user registrations:', error);
      throw new InternalServerErrorException(
        'Failed to fetch monthly user registrations',
      );
    }
  }

  // Business Onboarding Management
  async getPendingBusinesses(page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [businesses, total] = await Promise.all([
        this.prisma.business.findMany({
          where: {
            status: 'UNDER_REVIEW',
            submittedForReview: true,
          },
          skip,
          take: limit,
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            documents: {
              orderBy: { uploadedAt: 'desc' },
            },
            payments: {
              orderBy: { addedAt: 'desc' },
            },
            businessCategory: true,
          },
          orderBy: { createdAt: 'asc' }, // Oldest first
        }),
        this.prisma.business.count({
          where: {
            status: 'UNDER_REVIEW',
            submittedForReview: true,
          },
        }),
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
      this.logger.error('Error fetching pending businesses:', error);
      throw new InternalServerErrorException(
        'Failed to fetch pending businesses',
      );
    }
  }

  async getBusinessOnboardingDetails(businessId: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          businessCategory: true,
          documents: {
            orderBy: { uploadedAt: 'desc' },
            select: {
              id: true,
              url: true,
              type: true,
              name: true,
              size: true,
              mimeType: true,
              verified: true,
              verifiedAt: true,
              verifiedBy: true,
              verificationNotes: true,
              ocrText: true,
              ocrConfidence: true,
              aiAnalysis: true,
              aiVerified: true,
              aiVerifiedAt: true,
              extractedData: true,
              uploadedAt: true,
            },
          },
          payments: {
            orderBy: { addedAt: 'desc' },
          },
          trustScore: true,
        },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      // Analyze AI verification results
      const aiAnalysis = business.documents.map((doc) => ({
        documentId: doc.id,
        type: doc.type,
        name: doc.name,
        uploadedAt: doc.uploadedAt,
        verified: doc.verified,
        verifiedAt: doc.verifiedAt,
        verifiedBy: doc.verifiedBy,
        verificationNotes: doc.verificationNotes,
        // AI Analysis
        aiVerified: doc.aiVerified,
        aiVerifiedAt: doc.aiVerifiedAt,
        ocrConfidence: doc.ocrConfidence,
        extractedData: doc.extractedData,
        aiAnalysis: doc.aiAnalysis,
      }));

      return {
        business: {
          id: business.id,
          name: business.name,
          description: business.description,
          category: business.category,
          website: business.website,
          phone: business.phone,
          email: business.email,
          location: business.location,
          latitude: business.latitude,
          longitude: business.longitude,
          isVerified: business.isVerified,
          isActive: business.isActive,
          status: business.status,
          onboardingStep: business.onboardingStep,
          submittedForReview: business.submittedForReview,
          reviewedAt: business.reviewedAt,
          reviewedBy: business.reviewedBy,
          reviewNotes: business.reviewNotes,
          rejectionReason: business.rejectionReason,
          createdAt: business.createdAt,
          updatedAt: business.updatedAt,
        },
        owner: business.owner,
        businessCategory: business.businessCategory,
        documents: aiAnalysis,
        payments: business.payments,
        trustScore: business.trustScore,
        // Summary for admin review
        summary: {
          totalDocuments: business.documents.length,
          verifiedDocuments: business.documents.filter((doc) => doc.verified)
            .length,
          aiVerifiedDocuments: business.documents.filter(
            (doc) => doc.aiVerified,
          ).length,
          totalPayments: business.payments.length,
          verifiedPayments: business.payments.filter(
            (payment) => payment.verified,
          ).length,
          hasValidDocument: business.documents.some((doc) => doc.aiVerified),
          canApprove:
            business.documents.length > 0 && business.payments.length > 0,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching business onboarding details:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch business onboarding details',
      );
    }
  }

  async updateBusinessStatus(
    adminUserId: string,
    businessId: string,
    updateStatusDto: UpdateBusinessStatusDto,
  ): Promise<{ message: string }> {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      const updateData: any = {
        status: updateStatusDto.status,
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
      };

      if (updateStatusDto.reviewNotes) {
        updateData.reviewNotes = updateStatusDto.reviewNotes;
      }

      if (updateStatusDto.rejectionReason) {
        updateData.rejectionReason = updateStatusDto.rejectionReason;
      }

      // If verifying, also set isVerified to true
      if (updateStatusDto.status === 'VERIFIED') {
        updateData.isVerified = true;
      }

      await this.prisma.business.update({
        where: { id: businessId },
        data: updateData,
      });

      this.logger.log(
        `Business status updated: ${businessId} -> ${updateStatusDto.status} by admin: ${adminUserId}`,
      );
      return { message: 'Business status updated successfully' };
    } catch (error) {
      this.logger.error('Error updating business status:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update business status',
      );
    }
  }

  // Test email functionality
  async testEmailFunctionality(email: string, name: string): Promise<void> {
    try {
      this.logger.log(`Testing email functionality for ${email}`);
      await this.mailerService.sendAccountStatusChangeEmail(
        email,
        name,
        'activated', // Test with activated status
      );
      this.logger.log(`✅ Test email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`❌ Test email failed for ${email}:`, error);
      throw error;
    }
  }

  // Document Management
  async getPendingDocuments(page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [documents, total] = await Promise.all([
        this.prisma.document.findMany({
          where: {
            verified: false,
            business: {
              isActive: true,
            },
          },
          skip,
          take: limit,
          include: {
            business: {
              select: {
                id: true,
                name: true,
                category: true,
                owner: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { uploadedAt: 'asc' }, // Oldest first
        }),
        this.prisma.document.count({
          where: {
            verified: false,
            business: {
              isActive: true,
            },
          },
        }),
      ]);

      return {
        documents: documents.map(doc => ({
          id: doc.id,
          businessName: doc.business.name,
          businessType: doc.business.category,
          documentType: doc.type,
          fileName: doc.name,
          fileSize: doc.size,
          uploadDate: doc.uploadedAt,
          status: 'pending',
          businessOwner: doc.business.owner,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching pending documents:', error);
      throw new InternalServerErrorException('Failed to fetch pending documents');
    }
  }

  async approveDocument(adminUserId: string, documentId: string): Promise<{ message: string }> {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: { business: true },
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      if (document.verified) {
        throw new BadRequestException('Document is already verified');
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          verified: true,
          verifiedAt: new Date(),
          verifiedBy: adminUserId,
          verificationNotes: 'Approved by admin',
        },
      });

      this.logger.log(`Document approved: ${documentId} by admin: ${adminUserId}`);
      return { message: 'Document approved successfully' };
    } catch (error) {
      this.logger.error('Error approving document:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to approve document');
    }
  }

  async rejectDocument(adminUserId: string, documentId: string, reason?: string): Promise<{ message: string }> {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          verified: false,
          verifiedAt: new Date(),
          verifiedBy: adminUserId,
          verificationNotes: reason || 'Rejected by admin',
        },
      });

      this.logger.log(`Document rejected: ${documentId} by admin: ${adminUserId}`);
      return { message: 'Document rejected successfully' };
    } catch (error) {
      this.logger.error('Error rejecting document:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to reject document');
    }
  }

  async requestDocumentRevision(adminUserId: string, documentId: string, notes?: string): Promise<{ message: string }> {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          verificationNotes: notes || 'Revision requested by admin',
          verifiedAt: new Date(),
          verifiedBy: adminUserId,
        },
      });

      this.logger.log(`Document revision requested: ${documentId} by admin: ${adminUserId}`);
      return { message: 'Revision requested successfully' };
    } catch (error) {
      this.logger.error('Error requesting document revision:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to request document revision');
    }
  }

  // Review Management
  async getPendingReviews(page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [reviews, total] = await Promise.all([
        this.prisma.review.findMany({
          where: {
            isVerified: false,
            isActive: true,
          },
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                reputation: true,
              },
            },
            business: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' }, // Oldest first
        }),
        this.prisma.review.count({
          where: {
            isVerified: false,
            isActive: true,
          },
        }),
      ]);

      return {
        reviews: reviews.map(review => ({
          id: review.id,
          reviewer: review.user.name,
          business: review.business.name,
          rating: review.rating,
          content: review.comment,
          date: review.createdAt,
          status: review.isVerified ? 'approved' : 'pending',
          user: review.user,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching pending reviews:', error);
      throw new InternalServerErrorException('Failed to fetch pending reviews');
    }
  }

  async approveReview(adminUserId: string, reviewId: string): Promise<{ message: string }> {
    try {
      const review = await this.prisma.review.findUnique({
        where: { id: reviewId },
      });

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      await this.prisma.review.update({
        where: { id: reviewId },
        data: {
          isVerified: true,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Review approved: ${reviewId} by admin: ${adminUserId}`);
      return { message: 'Review approved successfully' };
    } catch (error) {
      this.logger.error('Error approving review:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to approve review');
    }
  }

  async rejectReview(adminUserId: string, reviewId: string, reason?: string): Promise<{ message: string }> {
    try {
      const review = await this.prisma.review.findUnique({
        where: { id: reviewId },
      });

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      await this.prisma.review.update({
        where: { id: reviewId },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Review rejected: ${reviewId} by admin: ${adminUserId}`);
      return { message: 'Review rejected successfully' };
    } catch (error) {
      this.logger.error('Error rejecting review:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to reject review');
    }
  }

  async flagReview(adminUserId: string, reviewId: string, reason?: string): Promise<{ message: string }> {
    try {
      const review = await this.prisma.review.findUnique({
        where: { id: reviewId },
      });

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      // For flagging, we'll keep the review active but mark it as needing attention
      // We could add a flagged field to the Review model in the future
      await this.prisma.review.update({
        where: { id: reviewId },
        data: {
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Review flagged: ${reviewId} by admin: ${adminUserId}`);
      return { message: 'Review flagged successfully' };
    } catch (error) {
      this.logger.error('Error flagging review:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to flag review');
    }
  }
}
