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
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('SMTP_HOST') || configService.get<string>('MAIL_HOST') || 'smtp-relay.brevo.com',
          port: parseInt(configService.get<string>('SMTP_PORT') || configService.get<string>('MAIL_PORT') || '587', 10),
          secure: false,
          requireTLS: true,
          auth: {
            user: configService.get<string>('SMTP_USER') || configService.get<string>('MAIL_USER') || '',
            pass: configService.get<string>('SMTP_PASS') || configService.get<string>('MAIL_PASSWORD') || '',
          },
          tls: {
            rejectUnauthorized: false,
          },
        },
        defaults: {
          from: configService.get<string>('SMTP_FROM') || `"CrediScore" <${configService.get<string>('SENDER_EMAIL') || 'noreply@crediscore.com'}>`,
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new EjsAdapter(),
          options: {
            strict: false,
          },
        },
      }),
    }),
  ],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
