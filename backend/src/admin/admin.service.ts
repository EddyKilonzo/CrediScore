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

  constructor(private readonly prisma: PrismaService) {}

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

      this.logger.log(
        `User status toggled: ${userId} -> ${updatedUser.isActive ? 'active' : 'inactive'}`,
      );
      return updatedUser as UserWithoutPassword;
    } catch (error) {
      this.logger.error('Error toggling user status:', error);
      if (error instanceof NotFoundException) {
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
}
