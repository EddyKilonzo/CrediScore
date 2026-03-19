import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as otplib from 'otplib';
const authenticator = (otplib as any).authenticator ?? (otplib as any).default?.authenticator ?? otplib;
import * as QRCode from 'qrcode';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateSecret(userId: string): Promise<{ otpauthUrl: string; secret: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const secret = authenticator.generateSecret();
      const otpauthUrl = authenticator.keyuri(user.email, 'CrediScore', secret);

      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret },
      });

      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

      this.logger.log(`2FA secret generated for user: ${userId}`);
      return { otpauthUrl: qrCodeDataUrl, secret };
    } catch (error) {
      this.logger.error('Error generating 2FA secret:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to generate 2FA secret');
    }
  }

  async enable2FA(userId: string, token: string): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true, twoFactorEnabled: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.twoFactorSecret) {
        throw new BadRequestException('2FA setup not initiated. Call /auth/2fa/setup first.');
      }

      if (user.twoFactorEnabled) {
        throw new BadRequestException('2FA is already enabled');
      }

      const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
      if (!isValid) {
        throw new BadRequestException('Invalid 2FA token');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true },
      });

      this.logger.log(`2FA enabled for user: ${userId}`);
      return { message: '2FA enabled successfully' };
    } catch (error) {
      this.logger.error('Error enabling 2FA:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to enable 2FA');
    }
  }

  async disable2FA(userId: string, token: string): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true, twoFactorEnabled: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new BadRequestException('2FA is not enabled');
      }

      const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
      if (!isValid) {
        throw new BadRequestException('Invalid 2FA token');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      });

      this.logger.log(`2FA disabled for user: ${userId}`);
      return { message: '2FA disabled successfully' };
    } catch (error) {
      this.logger.error('Error disabling 2FA:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to disable 2FA');
    }
  }

  async validateToken(userId: string, token: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true, twoFactorEnabled: true },
      });

      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return false;
      }

      return authenticator.verify({ token, secret: user.twoFactorSecret });
    } catch (error) {
      this.logger.error('Error validating 2FA token:', error);
      return false;
    }
  }
}
