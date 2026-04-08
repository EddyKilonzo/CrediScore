import { Logger, Module } from '@nestjs/common';
import { MailerModule as NestMailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EjsAdapter } from '@nestjs-modules/mailer/dist/adapters/ejs.adapter';
import { join } from 'path';
import { MailerService } from './mailer.service';

const BLOCKED_SMTP_PORTS = new Set([25, 465, 587]);

@Module({
  imports: [
    NestMailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('MailerModule');
        const smtpHost =
          configService.get<string>('SMTP_HOST') ||
          configService.get<string>('MAIL_HOST') ||
          'smtp-relay.brevo.com';
        const smtpPort = parseInt(
          configService.get<string>('SMTP_PORT') ||
            configService.get<string>('MAIL_PORT') ||
            '587',
          10,
        );
        const secureOverride = configService.get<string>('SMTP_SECURE') ||
          configService.get<string>('MAIL_SECURE');
        const smtpSecure = secureOverride
          ? secureOverride.toLowerCase() === 'true'
          : smtpPort === 465;
        const smtpUser =
          configService.get<string>('SMTP_USER') ||
          configService.get<string>('MAIL_USER') ||
          '';
        const smtpPass =
          configService.get<string>('SMTP_PASS') ||
          configService.get<string>('MAIL_PASSWORD') ||
          '';
        const smtpFrom = configService.get<string>('SMTP_FROM') ||
          (configService.get<string>('MAIL_FROM_NAME') &&
          configService.get<string>('MAIL_FROM_ADDRESS')
            ? `${configService.get<string>('MAIL_FROM_NAME')} <${configService.get<string>('MAIL_FROM_ADDRESS')}>`
            : undefined) ||
          `CrediScore <${configService.get<string>('SENDER_EMAIL') || 'noreply@crediscore.com'}>`;

        const brevoHttp = configService.get<string>('BREVO_API_KEY')?.trim();
        if (!brevoHttp && BLOCKED_SMTP_PORTS.has(smtpPort)) {
          logger.warn(
            `Outbound SMTP on port ${smtpPort} is often blocked (e.g. Render free web services → ETIMEDOUT). ` +
              'Set BREVO_API_KEY to send via Brevo\'s HTTPS API, or use SMTP port 2525 if your provider supports it.',
          );
        }

        return {
        transport: {
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        },
        defaults: {
          from: smtpFrom,
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new EjsAdapter(),
          options: {
            strict: false,
          },
        },
        };
      },
    }),
  ],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
