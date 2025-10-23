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
    const config = {
      MAIL_HOST: process.env.MAIL_HOST,
      MAIL_PORT: process.env.MAIL_PORT,
      MAIL_SECURE: process.env.MAIL_SECURE,
      MAIL_USER: process.env.MAIL_USER,
      MAIL_PASSWORD: process.env.MAIL_PASSWORD ? '***hidden***' : 'NOT_SET',
      MAIL_FROM_NAME: process.env.MAIL_FROM_NAME,
      MAIL_FROM_ADDRESS: process.env.MAIL_FROM_ADDRESS,
      APP_URL: process.env.APP_URL,
    };

    // Check for missing configuration
    if (!process.env.MAIL_HOST) issues.push('MAIL_HOST is not set');
    if (!process.env.MAIL_PORT) issues.push('MAIL_PORT is not set');
    if (!process.env.MAIL_USER) issues.push('MAIL_USER is not set');
    if (!process.env.MAIL_PASSWORD) issues.push('MAIL_PASSWORD is not set');
    if (!process.env.MAIL_FROM_NAME) issues.push('MAIL_FROM_NAME is not set');
    if (!process.env.MAIL_FROM_ADDRESS)
      issues.push('MAIL_FROM_ADDRESS is not set');
    if (!process.env.APP_URL) issues.push('APP_URL is not set');

    // Check for common configuration issues
    if (process.env.MAIL_SECURE === 'true' && process.env.MAIL_PORT !== '465') {
      issues.push('MAIL_SECURE is true but MAIL_PORT is not 465');
    }
    if (
      process.env.MAIL_SECURE === 'false' &&
      process.env.MAIL_PORT !== '587'
    ) {
      issues.push('MAIL_SECURE is false but MAIL_PORT is not 587');
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
