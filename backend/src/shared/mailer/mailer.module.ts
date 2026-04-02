import { Module } from '@nestjs/common';
import { MailerModule as NestMailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EjsAdapter } from '@nestjs-modules/mailer/dist/adapters/ejs.adapter';
import { join } from 'path';
import { MailerService } from './mailer.service';

@Module({
  imports: [
    NestMailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const smtpHost = configService.get<string>('SMTP_HOST') || 'smtp-relay.brevo.com';
        const smtpPort = parseInt(configService.get<string>('SMTP_PORT') || '587', 10);
        const smtpUser = configService.get<string>('SMTP_USER') || '';
        const smtpPass = configService.get<string>('SMTP_PASS') || '';
        const smtpFrom = configService.get<string>('SMTP_FROM') ||
          `CrediScore <${configService.get<string>('SENDER_EMAIL') || 'noreply@crediscore.com'}>`;

        return {
        transport: {
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
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
