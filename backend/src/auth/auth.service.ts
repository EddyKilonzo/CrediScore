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

      // Create user with CUSTOMER role by default
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          role: UserRole.CUSTOMER,
          phone: dto.phone,
          emailVerificationToken: emailVerificationCode, // Reusing the field for the 6-digit code
          emailVerificationTokenExpiry: emailVerificationCodeExpiry,
          emailVerificationSentAt: new Date(),
        } as any, // Type assertion to bypass Prisma client type issues
      });

      // Generate JWT
      const token: string = this.jwtService.sign({
        userId: user.id,
        email: user.email,
      });

      this.logger.log(
        `User created successfully: ${user.id} with role: ${user.role}`,
      );

      // Send welcome email with verification code
      try {
        await this.mailerService.sendWelcomeEmail(
          user.email,
          user.name,
          emailVerificationCode,
        );
        this.logger.log(
          `Welcome email with verification code sent to ${user.email}`,
        );
      } catch (emailError) {
        this.logger.error(
          `Failed to send welcome email to ${user.email}:`,
          emailError,
        );
        // Don't throw error - user creation was successful
      }

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

      // TODO: Implement email service to send reset link
      // For now, just log the request
      this.logger.log(`Password reset token would be sent to: ${email}`);

      return { message: 'If the email exists, a reset link has been sent.' };
    } catch (error) {
      this.logger.error('Forgot password error:', error);
      throw new InternalServerErrorException(
        'Failed to process password reset request',
      );
    }
  }

  resetPassword(token: string, newPassword: string): { message: string } {
    try {
      this.logger.log('Password reset attempt');

      // TODO: Implement token validation and password reset
      // For now, just log the request
      this.logger.log(
        `Password reset token: ${token}, new password length: ${newPassword.length}`,
      );

      return { message: 'Password reset successfully' };
    } catch (error) {
      this.logger.error('Reset password error:', error);
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

      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

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

  logout(userId: string): { message: string } {
    try {
      this.logger.log(`User logout: ${userId}`);

      // TODO: Implement token blacklisting or session management
      // For now, just log the logout

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
        // Update existing user with OAuth info if not already set
        if (!user.providerId) {
          user = await this.prisma.user.update({
            where: { id: (user as User).id },
            data: {
              provider: oauthUser.provider,
              providerId: oauthUser.providerId,
              avatar: oauthUser.avatar,
              emailVerified: true,
            },
          });
        } else if (oauthUser.avatar && !user.avatar) {
          // Update avatar if user doesn't have one but OAuth provides one
          user = await this.prisma.user.update({
            where: { id: (user as User).id },
            data: {
              avatar: oauthUser.avatar,
            },
          });
        }
      } else {
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

      const user = await this.prisma.user.findFirst({
        where: {
          emailVerificationToken: dto.token,
          emailVerificationTokenExpiry: {
            gt: new Date(), // Code not expired
          },
          emailVerified: false,
        } as any, // Type assertion to bypass Prisma client type issues
      });

      if (!user) {
        throw new BadRequestException('Invalid or expired verification code.');
      }

      // Mark email as verified and clear verification data
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationTokenExpiry: null,
        } as any, // Type assertion to bypass Prisma client type issues
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
      const recentAttempts = await this.prisma.user.count({
        where: {
          email: dto.email,
          emailVerificationSentAt: {
            gt: oneHourAgo,
          },
        } as any, // Type assertion to bypass Prisma client type issues
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
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: emailVerificationCode,
          emailVerificationTokenExpiry: emailVerificationCodeExpiry,
          emailVerificationSentAt: new Date(),
        } as any, // Type assertion to bypass Prisma client type issues
      });

      // Send verification email
      try {
        await this.mailerService.sendEmailVerification(
          user.email,
          user.name,
          emailVerificationCode,
        );
        this.logger.log(`Verification code resent to ${user.email}`);
      } catch (emailError) {
        this.logger.error(
          `Failed to send verification email to ${user.email}:`,
          emailError,
        );
        throw new InternalServerErrorException(
          'Failed to send verification email.',
        );
      }

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
