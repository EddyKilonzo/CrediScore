import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { MailerService } from './shared/mailer/mailer.service';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly mailerService: MailerService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get application status' })
  @ApiResponse({ status: 200, description: 'Application is running' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test-email')
  @Public()
  @ApiOperation({ summary: 'Test email sending functionality' })
  @ApiResponse({ status: 200, description: 'Test email sent successfully' })
  @ApiResponse({ status: 500, description: 'Email sending failed' })
  async testEmail(
    @Query('email') email: string,
  ): Promise<{ message: string; error?: string }> {
    try {
      if (!email) {
        return {
          message: 'Please provide an email address',
          error: 'Missing email parameter',
        };
      }

      await this.mailerService.sendWelcomeEmail(email, 'Test User');

      return { message: `Test email sent successfully to ${email}` };
    } catch (error) {
      console.error('Email sending error:', error);
      return {
        message: 'Failed to send email',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  @Post('test-email')
  @Public()
  @ApiOperation({ summary: 'Test email sending with POST' })
  @ApiResponse({ status: 200, description: 'Test email sent successfully' })
  @ApiResponse({ status: 500, description: 'Email sending failed' })
  async testEmailPost(
    @Body() body: { email: string; name?: string },
  ): Promise<{ message: string; error?: string }> {
    try {
      if (!body.email) {
        return {
          message: 'Please provide an email address',
          error: 'Missing email in request body',
        };
      }

      await this.mailerService.sendWelcomeEmail(
        body.email,
        body.name || 'Test User',
      );

      return { message: `Test email sent successfully to ${body.email}` };
    } catch (error) {
      console.error('Email sending error:', error);
      return {
        message: 'Failed to send email',
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  @Get('mailer-config')
  @Public()
  @ApiOperation({ summary: 'Check mailer configuration' })
  @ApiResponse({ status: 200, description: 'Mailer configuration status' })
  checkMailerConfig(): {
    message: string;
    config: Record<string, string | undefined>;
    issues: string[];
  } {
    const issues: string[] = [];
    const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST;
    const smtpPort = process.env.SMTP_PORT || process.env.MAIL_PORT;
    const smtpSecure = process.env.SMTP_SECURE || process.env.MAIL_SECURE;
    const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASSWORD;
    const smtpFrom =
      process.env.SMTP_FROM ||
      (process.env.MAIL_FROM_NAME && process.env.MAIL_FROM_ADDRESS
        ? `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`
        : undefined);

    const config = {
      SMTP_HOST: smtpHost,
      SMTP_PORT: smtpPort,
      SMTP_SECURE: smtpSecure,
      SMTP_USER: smtpUser,
      SMTP_PASS: smtpPass ? '***hidden***' : 'NOT_SET',
      SMTP_FROM: smtpFrom,
      APP_URL: process.env.APP_URL,
    };

    // Check for missing configuration
    if (!smtpHost) issues.push('SMTP_HOST (or MAIL_HOST) is not set');
    if (!smtpPort) issues.push('SMTP_PORT (or MAIL_PORT) is not set');
    if (!smtpUser) issues.push('SMTP_USER (or MAIL_USER) is not set');
    if (!smtpPass) issues.push('SMTP_PASS (or MAIL_PASSWORD) is not set');
    if (!smtpFrom)
      issues.push(
        'SMTP_FROM is not set (or MAIL_FROM_NAME + MAIL_FROM_ADDRESS)',
      );
    if (!process.env.APP_URL) issues.push('APP_URL is not set');

    // Check for common configuration issues
    if (smtpSecure === 'true' && smtpPort !== '465') {
      issues.push('SMTP_SECURE is true but SMTP_PORT is not 465');
    }
    if (smtpSecure === 'false' && smtpPort !== '587' && smtpPort !== '2525') {
      issues.push('SMTP_SECURE is false and SMTP_PORT is unusual (expected 587 or 2525)');
    }

    return {
      message:
        issues.length === 0
          ? 'Configuration looks good'
          : 'Configuration issues found',
      config,
      issues,
    };
  }
}
