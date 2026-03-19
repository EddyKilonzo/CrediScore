import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, UserWithoutPassword } from '../interfaces/user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
    });
  }

  async validate(payload: JwtPayload & { iat?: number }): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        provider: true,
        providerId: true,
        avatar: true,
        emailVerified: true,
        reputation: true,
        lastLoginAt: true,
        loggedOutAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Reject tokens issued before the user's last logout
    if (user.loggedOutAt && payload.iat) {
      const tokenIssuedAt = payload.iat * 1000; // Convert seconds to ms
      if (tokenIssuedAt < user.loggedOutAt.getTime()) {
        throw new UnauthorizedException('Session expired. Please log in again.');
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { loggedOutAt: _, ...userWithoutLoggedOut } = user;
    return userWithoutLoggedOut as UserWithoutPassword;
  }
}
