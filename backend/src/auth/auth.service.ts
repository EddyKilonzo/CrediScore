import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SignUpDto, SignUpResponseDto } from './dto/signup.dto';
import { UserRoleDto, UserRole } from './dto/user-role.enum';
import { LoginResponseDto } from './dto/login.dto';
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

      // Create user with default CUSTOMER role
      const user = await this.users.create({
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: UserRole.CUSTOMER,
      });

      // Generate JWT
      const token: string = this.jwtService.sign({
        userId: user.id,
        email: user.email,
      });

      this.logger.log(`User created successfully: ${user.id}`);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role as unknown as UserRoleDto,
        avatar: user.avatar,
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
}
