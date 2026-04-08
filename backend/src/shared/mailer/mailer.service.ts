import { Injectable, Logger } from '@nestjs/common';
import { MailerService as NestMailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import * as ejs from 'ejs';
import { join } from 'path';

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

  private getAppUrl(): string {
    return this.configService.get<string>(
      'APP_URL',
      'https://credi-score.vercel.app',
    );
  }

  /** When set, sends via Brevo REST API (HTTPS) — works where SMTP ports are blocked (e.g. Render free tier). */
  private getBrevoApiKey(): string | undefined {
    const key = this.configService.get<string>('BREVO_API_KEY');
    return key?.trim() || undefined;
  }

  private templateDir(): string {
    return join(__dirname, 'templates');
  }

  private parseSender(): { name: string; email: string } {
    const mailName = this.configService.get<string>('MAIL_FROM_NAME');
    const mailAddr = this.configService.get<string>('MAIL_FROM_ADDRESS');
    const from =
      this.configService.get<string>('SMTP_FROM') ||
      (mailName && mailAddr ? `${mailName} <${mailAddr}>` : '') ||
      `CrediScore <${this.configService.get<string>('SENDER_EMAIL') || 'noreply@crediscore.com'}>`;

    const trimmed = from.replace(/^["']|["']$/g, '').trim();
    const m = trimmed.match(/^(.+?)\s*<([^>]+)>\s*$/);
    if (m) {
      return {
        name: m[1].replace(/^["']|["']$/g, '').trim() || 'CrediScore',
        email: m[2].trim(),
      };
    }
    if (/^[^\s@]+@[^\s@]+$/.test(trimmed)) {
      return { name: 'CrediScore', email: trimmed };
    }
    return {
      name: 'CrediScore',
      email:
        this.configService.get<string>('SENDER_EMAIL') || 'noreply@crediscore.com',
    };
  }

  private async renderEjsTemplate(
    template: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    const file = join(this.templateDir(), `${template}.ejs`);
    return new Promise((resolve, reject) => {
      ejs.renderFile(file, context, (err, html) => {
        if (err) {
          reject(err);
        } else {
          resolve(typeof html === 'string' ? html : String(html ?? ''));
        }
      });
    });
  }

  private async postBrevoTransactional(params: {
    apiKey: string;
    to: string;
    toName?: string;
    subject: string;
    html: string;
  }): Promise<void> {
    const sender = this.parseSender();
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': params.apiKey,
      },
      body: JSON.stringify({
        sender: { name: sender.name, email: sender.email },
        to: [{ email: params.to, name: params.toName || params.to }],
        subject: params.subject,
        htmlContent: params.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brevo API HTTP ${res.status}: ${body}`);
    }
  }

  private async sendWithTemplate(options: {
    to: string;
    recipientName?: string;
    subject: string;
    template: string;
    context: Record<string, unknown>;
    logMessage: string;
    errorLogPrefix: string;
  }): Promise<void> {
    const appUrl = this.getAppUrl();
    const fullContext = {
      ...options.context,
      appUrl,
      year: new Date().getFullYear(),
    };
    try {
      const brevoKey = this.getBrevoApiKey();
      if (brevoKey) {
        const html = await this.renderEjsTemplate(
          options.template,
          fullContext,
        );
        await this.postBrevoTransactional({
          apiKey: brevoKey,
          to: options.to,
          toName: options.recipientName,
          subject: options.subject,
          html,
        });
      } else {
        await this.mailerService.sendMail({
          to: options.to,
          subject: options.subject,
          template: options.template,
          context: fullContext,
        });
      }
      this.logger.log(options.logMessage);
    } catch (error) {
      this.logger.error(
        `${options.errorLogPrefix} ${options.to}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send a welcome email to a new user with verification code
   */
  async sendWelcomeEmail(
    email: string,
    name: string,
    verificationCode?: string,
  ): Promise<void> {
    await this.sendWithTemplate({
      to: email,
      recipientName: name,
      subject: 'Welcome to CrediScore! 🎉 - Verify Your Email',
      template: 'welcome',
      context: { name, email, verificationCode },
      logMessage: `Welcome email with verification code sent to ${email}`,
      errorLogPrefix: 'Failed to send welcome email to',
    });
  }

  /**
   * Send a password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<void> {
    const appUrl = this.getAppUrl();
    const resetUrl = `${appUrl}/auth/reset-password?token=${resetToken}`;

    await this.sendWithTemplate({
      to: email,
      recipientName: name,
      subject: 'Reset Your Password - CrediScore',
      template: 'password-reset',
      context: { name, email, resetUrl },
      logMessage: `Password reset email sent to ${email}`,
      errorLogPrefix: 'Failed to send password reset email to',
    });
  }

  /**
   * Send an email verification code
   */
  async sendEmailVerification(
    email: string,
    name: string,
    verificationCode: string,
  ): Promise<void> {
    await this.sendWithTemplate({
      to: email,
      recipientName: name,
      subject: 'Verify Your Email - CrediScore',
      template: 'email-verification',
      context: { name, email, verificationCode },
      logMessage: `Email verification code sent to ${email}`,
      errorLogPrefix: 'Failed to send email verification to',
    });
  }

  /**
   * Send a password changed notification
   */
  async sendPasswordChangedNotification(
    email: string,
    name: string,
  ): Promise<void> {
    await this.sendWithTemplate({
      to: email,
      recipientName: name,
      subject: 'Your Password Has Been Changed - CrediScore',
      template: 'password-changed',
      context: { name, email },
      logMessage: `Password changed notification sent to ${email}`,
      errorLogPrefix: 'Failed to send password changed notification to',
    });
  }

  /**
   * Send a business welcome email to new business owners
   */
  async sendBusinessWelcomeEmail(
    email: string,
    name: string,
    businessName?: string,
  ): Promise<void> {
    await this.sendWithTemplate({
      to: email,
      recipientName: name,
      subject: 'Welcome to CrediScore Business! Complete Your Setup',
      template: 'business-welcome',
      context: { name, email, businessName },
      logMessage: `Business welcome email sent to ${email}`,
      errorLogPrefix: 'Failed to send business welcome email to',
    });
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

    await this.sendWithTemplate({
      to: email,
      recipientName: name,
      subject,
      template: 'business-verification-status',
      context: {
        name,
        email,
        businessName,
        status,
        rejectionReason,
      },
      logMessage: `Business verification status email sent to ${email} - Status: ${status}`,
      errorLogPrefix: 'Failed to send business verification status email to',
    });
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
    const subject =
      status === 'activated'
        ? 'Your Account Has Been Activated - CrediScore'
        : 'Your Account Has Been Deactivated - CrediScore';

    await this.sendWithTemplate({
      to: email,
      recipientName: name,
      subject,
      template: 'account-status-change',
      context: { name, email, status, reason },
      logMessage: `Account status change email sent to ${email} - Status: ${status}`,
      errorLogPrefix: 'Failed to send account status change email to',
    });
  }

  /**
   * Send a warning email to a flagged user
   */
  async sendUserWarningEmail(
    email: string,
    name: string,
    reason: string,
    adminNotes?: string,
  ): Promise<void> {
    await this.sendWithTemplate({
      to: email,
      recipientName: name,
      subject: 'Important Notice Regarding Your CrediScore Account',
      template: 'user-warning',
      context: { name, email, reason, adminNotes },
      logMessage: `Warning email sent to ${email}`,
      errorLogPrefix: 'Failed to send warning email to',
    });
  }

  /**
   * Send a generic email with custom template
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    await this.sendWithTemplate({
      to: options.to,
      subject: options.subject,
      template: options.template,
      context: {
        ...options.context,
      },
      logMessage: `Email sent to ${options.to} with template ${options.template}`,
      errorLogPrefix: 'Failed to send email to',
    });
  }
}
