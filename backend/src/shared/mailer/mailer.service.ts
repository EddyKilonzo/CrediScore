import { Injectable, Logger } from '@nestjs/common';
import { MailerService as NestMailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(
    private readonly mailerService: NestMailerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Send a welcome email to a new user
   */
  async sendWelcomeEmail(
    email: string,
    name: string,
    verificationToken?: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const verificationUrl = verificationToken
      ? `${appUrl}/verify-email?token=${verificationToken}`
      : null;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Welcome to CrediScore! 🎉',
        template: 'welcome',
        context: {
          name,
          email,
          verificationUrl,
          appUrl,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Send a password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Reset Your Password - CrediScore',
        template: 'password-reset',
        context: {
          name,
          email,
          resetUrl,
          appUrl,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send an email verification email
   */
  async sendEmailVerification(
    email: string,
    name: string,
    verificationToken: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Verify Your Email - CrediScore',
        template: 'email-verification',
        context: {
          name,
          email,
          verificationUrl,
          appUrl,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`Email verification sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email verification to ${email}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send a password changed notification
   */
  async sendPasswordChangedNotification(
    email: string,
    name: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Your Password Has Been Changed - CrediScore',
        template: 'password-changed',
        context: {
          name,
          email,
          appUrl,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`Password changed notification sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password changed notification to ${email}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send a generic email with custom template
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: options.to,
        subject: options.subject,
        template: options.template,
        context: {
          ...options.context,
          year: new Date().getFullYear(),
          appUrl: this.configService.get<string>(
            'APP_URL',
            'http://localhost:3000',
          ),
        },
      });
      this.logger.log(
        `Email sent to ${options.to} with template ${options.template}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      throw error;
    }
  }
}
