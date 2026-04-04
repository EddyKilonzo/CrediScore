import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../shared/mailer/mailer.service';
import { TwoFactorService } from './two-factor/two-factor.service';
import { SignUpDto, SignUpResponseDto } from './dto/signup.dto';
import { UserRoleDto, UserRole } from './dto/user-role.enum';
import { LoginResponseDto } from './dto/login.dto';
import { VerifyEmailDto, ResendVerificationDto } from './dto/profile.dto';
import {
  User,
  UserWithoutPassword,
  JwtPayload,
  OAuthUser,
  CreateUserData,
} from './interfaces/user.interface';

// Typed wrappers to satisfy strict lint rules
const bcryptHash: (data: string, salt: number) => Promise<string> = (
  bcrypt as unknown as {
    hash: (d: string, s: number) => Promise<string>;
  }
).hash;
const bcryptCompare: (data: string, encrypted: string) => Promise<boolean> = (
  bcrypt as unknown as {
    compare: (d: string, e: string) => Promise<boolean>;
  }
).compare;

interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
}

class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return user as User | null;
  }

  async create(data: CreateUserData): Promise<User> {
    const user = await this.prisma.user.create({ data });
    return user as User;
  }
}

@Injectable()
export class AuthService {
  private readonly users: UserRepository;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
    private readonly twoFactorService: TwoFactorService,
  ) {
    this.users = new PrismaUserRepository(this.prisma);
  }

  async signup(dto: SignUpDto): Promise<SignUpResponseDto> {
    try {
      this.logger.log(`Signup attempt for email: ${dto.email}`);

      // Check if email already exists
      const existingUser = await this.users.findByEmail(dto.email);
      if (existingUser) {
        throw new BadRequestException('Email already registered.');
      }

      // Hash password
      const hashedPassword: string = await bcryptHash(dto.password, 10);

      // Generate 6-digit verification code
      const emailVerificationCode = Math.floor(
        100000 + Math.random() * 900000,
      ).toString();
      const emailVerificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Map frontend role to backend role
      const mappedRole =
        dto.role === 'business' ? UserRole.BUSINESS_OWNER : UserRole.CUSTOMER;

      // Create user with selected role
      const userData = {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: mappedRole,
        phone: dto.phone,
        emailVerificationToken: emailVerificationCode, // Reusing the field for the 6-digit code
        emailVerificationTokenExpiry: emailVerificationCodeExpiry,
        emailVerificationSentAt: new Date(),
      };

      const user = await this.prisma.user.create({
        data: userData,
      });

      // Generate JWT
      const token: string = this.jwtService.sign({
        userId: user.id,
        email: user.email,
      });

      this.logger.log(
        `User created successfully: ${user.id} with role: ${user.role}`,
      );

      // Send welcome email — fire-and-forget so it never delays the response
      this.mailerService.sendWelcomeEmail(
        user.email,
        user.name,
        emailVerificationCode,
      ).then(() => {
        this.logger.log(`Welcome email sent to ${user.email}`);
      }).catch((emailError) => {
        this.logger.error(`Failed to send welcome email to ${user.email}:`, emailError);
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || undefined,
        role: user.role as unknown as UserRoleDto,
        avatar: user.avatar || undefined,
        createdAt: user.createdAt,
        accessToken: token,
      };
    } catch (error) {
      this.logger.error('Signup error:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Something went wrong during signup.',
      );
    }
  }

  async login(user: UserWithoutPassword): Promise<LoginResponseDto> {
    try {
      this.logger.log(`Login successful for user: ${user.id}`);

      // If 2FA is enabled, return a pending state — no JWT yet
      if (user.twoFactorEnabled) {
        return {
          id: user.id,
          requires2FA: true,
        } as LoginResponseDto;
      }

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate JWT
      const payload: JwtPayload = {
        userId: user.id,
        email: user.email,
      };
      const token: string = this.jwtService.sign(payload);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        reputation: user.reputation,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLoginAt: new Date(),
        accessToken: token,
        expiresIn: 24 * 60 * 60, // 24 hours in seconds
      };
    } catch (error) {
      this.logger.error('Login error:', error);
      throw new InternalServerErrorException(
        'Something went wrong during login.',
      );
    }
  }

  async validateUser(
    email: string,
    inputPassword: string,
  ): Promise<UserWithoutPassword | null> {
    try {
      const user = await this.users.findByEmail(email);

      if (!user || !user.isActive || !user.password) {
        return null;
      }

      // Check if email is verified
      if (!user.emailVerified) {
        throw new UnauthorizedException(
          'Please verify your email before logging in. Check your inbox for the verification code.',
        );
      }

      const passwordValid: boolean = await bcryptCompare(
        inputPassword,
        user.password,
      );
      if (!passwordValid) {
        return null;
      }

      // Return user without password
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = user;
      return result;
    } catch (error) {
      this.logger.error('User validation error:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Verify 2FA token and issue a full JWT
   */
  async verifyTwoFactor(
    userId: string,
    token: string,
  ): Promise<LoginResponseDto> {
    try {
      const valid = await this.twoFactorService.validateToken(userId, token);
      if (!valid) {
        throw new UnauthorizedException('Invalid 2FA token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          reputation: true,
          isActive: true,
          provider: true,
          providerId: true,
          avatar: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      });

      const payload: JwtPayload = { userId: user.id, email: user.email };
      const accessToken: string = this.jwtService.sign(payload);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? undefined,
        role: user.role,
        avatar: user.avatar ?? undefined,
        reputation: user.reputation,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLoginAt: new Date(),
        accessToken,
        expiresIn: 24 * 60 * 60,
      };
    } catch (error) {
      this.logger.error('2FA verification error:', error);
      if (
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to verify 2FA token');
    }
  }

  async getProfile(userId: string): Promise<UserWithoutPassword> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          reputation: true,
          isActive: true,
          provider: true,
          providerId: true,
          avatar: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user as UserWithoutPassword;
    } catch (error) {
      this.logger.error('Get profile error:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get user profile');
    }
  }

  async forgotPassword(email: string) {
    try {
      this.logger.log(`Password reset requested for email: ${email}`);

      const user = await this.users.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not
        return { message: 'If the email exists, a reset link has been sent.' };
      }

      // Generate a secure random token
      const resetToken = [...Array(48)]
        .map(() => Math.random().toString(36)[2])
        .join('');
      const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetTokenExpiry: tokenExpiry,
          passwordResetSentAt: new Date(),
        },
      });

      try {
        await this.mailerService.sendPasswordResetEmail(
          user.email,
          user.name,
          resetToken,
        );
        this.logger.log(`Password reset email sent to: ${email}`);
      } catch (emailError) {
        this.logger.error(
          `Failed to send password reset email to ${email}:`,
          emailError,
        );
      }

      return { message: 'If the email exists, a reset link has been sent.' };
    } catch (error) {
      this.logger.error('Forgot password error:', error);
      throw new InternalServerErrorException(
        'Failed to process password reset request',
      );
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    try {
      this.logger.log('Password reset attempt');

      const user = await this.prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetTokenExpiry: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        throw new BadRequestException('Invalid or expired password reset token.');
      }

      const hashedPassword: string = await bcryptHash(newPassword, 10);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetTokenExpiry: null,
          passwordResetSentAt: null,
        },
      });

      try {
        await this.mailerService.sendPasswordChangedNotification(
          user.email,
          user.name,
        );
      } catch (emailError) {
        this.logger.error(
          `Failed to send password-changed notification to ${user.email}:`,
          emailError,
        );
      }

      this.logger.log(`Password reset successfully for user: ${user.id}`);
      return { message: 'Password reset successfully. You can now log in.' };
    } catch (error) {
      this.logger.error('Reset password error:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to reset password');
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    try {
      this.logger.log(`Password change attempt for user: ${userId}`);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.password) {
        throw new NotFoundException('User not found');
      }

      const passwordValid: boolean = await bcryptCompare(
        currentPassword,
        user.password,
      );
      if (!passwordValid) {
        throw new BadRequestException('Invalid current password');
      }

      const hashedPassword: string = await bcryptHash(newPassword, 10);

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
        select: { email: true, name: true },
      });

      try {
        await this.mailerService.sendPasswordChangedNotification(
          updatedUser.email,
          updatedUser.name,
        );
      } catch (emailError) {
        this.logger.error(
          `Failed to send password-changed notification to ${updatedUser.email}:`,
          emailError,
        );
      }

      this.logger.log(`Password changed successfully for user: ${userId}`);

      return { message: 'Password changed successfully' };
    } catch (error) {
      this.logger.error('Change password error:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to change password');
    }
  }

  async logout(userId: string): Promise<{ message: string }> {
    try {
      this.logger.log(`User logout: ${userId}`);

      // Record logout time — used to invalidate tokens issued before this moment
      await this.prisma.user.update({
        where: { id: userId },
        data: { loggedOutAt: new Date() },
      });

      return { message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error('Logout error:', error);
      throw new InternalServerErrorException('Failed to logout');
    }
  }

  async validateOAuthUser(oauthUser: OAuthUser): Promise<UserWithoutPassword> {
    try {
      this.logger.log(`OAuth login attempt for email: ${oauthUser.email}`);

      // Check if user exists
      let user = await this.prisma.user.findUnique({
        where: { email: oauthUser.email },
      });

      if (user) {
        // Build update payload for existing user
        const updateData: Record<string, unknown> = { emailVerified: true };

        // Link OAuth provider if not already set
        if (!user.providerId) {
          updateData.provider = oauthUser.provider;
          updateData.providerId = oauthUser.providerId;
          updateData.avatar = oauthUser.avatar;
        } else if (oauthUser.avatar && !user.avatar) {
          updateData.avatar = oauthUser.avatar;
        }

        // Promote to BUSINESS_OWNER when explicitly selected via the register flow
        if (oauthUser.role === 'business' && user.role !== UserRole.BUSINESS_OWNER) {
          this.logger.log(`Upgrading existing user ${(user as User).id} to BUSINESS_OWNER via OAuth`);
          updateData.role = UserRole.BUSINESS_OWNER;
        }

        user = await this.prisma.user.update({
          where: { id: (user as User).id },
          data: updateData,
        });
      } else {
        // Map frontend role string to UserRole enum
        let userRole: UserRole = UserRole.CUSTOMER;
        if (oauthUser.role === 'business') {
          userRole = UserRole.BUSINESS_OWNER;
        }

        // Create new user
        user = await this.prisma.user.create({
          data: {
            name: oauthUser.name,
            email: oauthUser.email,
            provider: oauthUser.provider,
            providerId: oauthUser.providerId,
            avatar: oauthUser.avatar,
            emailVerified: true,
            isActive: true,
            role: userRole,
          },
        });
      }

      // Update last login
      await this.prisma.user.update({
        where: { id: (user as User).id },
        data: { lastLoginAt: new Date() },
      });

      this.logger.log(`OAuth user validated: ${(user as User).id}`);

      // Return user without password

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = user as User;
      return result as UserWithoutPassword;
    } catch (error) {
      this.logger.error('OAuth validation error:', error);
      throw new InternalServerErrorException('OAuth validation failed');
    }
  }

  /**
   * Verify email with 6-digit code
   */
  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    try {
      this.logger.log(`Email verification attempt with code: ${dto.token}`);

      const whereClause = {
        emailVerificationToken: dto.token,
        emailVerificationTokenExpiry: {
          gt: new Date(), // Code not expired
        },
        emailVerified: false,
      };

      const user = await this.prisma.user.findFirst({
        where: whereClause,
      });

      if (!user) {
        throw new BadRequestException('Invalid or expired verification code.');
      }

      // Mark email as verified and clear verification data
      const updateData = {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
      };

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      this.logger.log(`Email verified successfully for user: ${user.id}`);

      return {
        message: 'Email verified successfully! You can now log in.',
      };
    } catch (error) {
      this.logger.error('Email verification error:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Something went wrong during email verification.',
      );
    }
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    try {
      this.logger.log(
        `Resend verification code request for email: ${dto.email}`,
      );

      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      if (user.emailVerified) {
        throw new BadRequestException('Email is already verified.');
      }

      // Check if we can resend (rate limiting - max 3 attempts per hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const countWhereClause = {
        email: dto.email,
        emailVerificationSentAt: {
          gt: oneHourAgo,
        },
      };

      const recentAttempts = await this.prisma.user.count({
        where: countWhereClause,
      });

      if (recentAttempts >= 3) {
        throw new BadRequestException(
          'Too many verification attempts. Please wait 1 hour before trying again.',
        );
      }

      // Generate new 6-digit verification code
      const emailVerificationCode = Math.floor(
        100000 + Math.random() * 900000,
      ).toString();
      const emailVerificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Update user with new verification code
      const updateVerificationData = {
        emailVerificationToken: emailVerificationCode,
        emailVerificationTokenExpiry: emailVerificationCodeExpiry,
        emailVerificationSentAt: new Date(),
      };

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateVerificationData,
      });

      // Send verification email — fire-and-forget so it never delays the response
      this.mailerService.sendEmailVerification(
        user.email,
        user.name,
        emailVerificationCode,
      ).then(() => {
        this.logger.log(`Verification code resent to ${user.email}`);
      }).catch((emailError) => {
        this.logger.error(`Failed to send verification email to ${user.email}:`, emailError);
      });

      return {
        message: 'Verification code sent to your email.',
      };
    } catch (error) {
      this.logger.error('Resend verification code error:', error);

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Something went wrong while resending verification code.',
      );
    }
  }

  /**
   * Check if user email is verified before login
   */
  async validateEmailVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { emailVerified: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in. Check your inbox for the verification code.',
      );
    }
  }
}
