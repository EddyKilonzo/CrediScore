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
   * Send a welcome email to a new user with verification code
   */
  async sendWelcomeEmail(
    email: string,
    name: string,
    verificationCode?: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Welcome to CrediScore! 🎉 - Verify Your Email',
        template: 'welcome',
        context: {
          name,
          email,
          verificationCode,
          appUrl,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`Welcome email with verification code sent to ${email}`);
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
   * Send an email verification code
   */
  async sendEmailVerification(
    email: string,
    name: string,
    verificationCode: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Verify Your Email - CrediScore',
        template: 'email-verification',
        context: {
          name,
          email,
          verificationCode,
          appUrl,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`Email verification code sent to ${email}`);
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
   * Send a business welcome email to new business owners
   */
  async sendBusinessWelcomeEmail(
    email: string,
    name: string,
    businessName?: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Welcome to CrediScore Business! Complete Your Setup',
        template: 'business-welcome',
        context: {
          name,
          email,
          businessName,
          appUrl,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`Business welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send business welcome email to ${email}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send business verification status email
   */
  async sendBusinessVerificationStatusEmail(
    email: string,
    name: string,
    businessName: string,
    status: 'verified' | 'under_review' | 'rejected',
    rejectionReason?: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );

    let subject: string;
    switch (status) {
      case 'verified':
        subject = 'Your Business is Now Verified!';
        break;
      case 'under_review':
        subject = 'Business Verification Under Review';
        break;
      case 'rejected':
        subject = 'Business Verification Update Required';
        break;
      default:
        subject = 'Business Verification Status Update';
    }

    try {
      await this.mailerService.sendMail({
        to: email,
        subject,
        template: 'business-verification-status',
        context: {
          name,
          email,
          businessName,
          status,
          rejectionReason,
          appUrl,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(
        `Business verification status email sent to ${email} - Status: ${status}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send business verification status email to ${email}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send account status change notification
   */
  async sendAccountStatusChangeEmail(
    email: string,
    name: string,
    status: 'activated' | 'deactivated',
    reason?: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );

    const subject = status === 'activated' 
      ? 'Your Account Has Been Activated - CrediScore'
      : 'Your Account Has Been Deactivated - CrediScore';

    try {
      await this.mailerService.sendMail({
        to: email,
        subject,
        template: 'account-status-change',
        context: {
          name,
          email,
          status,
          reason,
          appUrl,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(
        `Account status change email sent to ${email} - Status: ${status}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send account status change email to ${email}:`,
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
