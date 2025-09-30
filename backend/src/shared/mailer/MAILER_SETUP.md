# Mailer Setup Guide

## Environment Configuration

Create or update your `.env` file with the following mailer configuration:

```env
# Application URL
APP_URL=http://localhost:3000

# Email Configuration
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-specific-password
MAIL_FROM_NAME=CrediScore
MAIL_FROM_ADDRESS=noreply@crediscore.com
```

## Gmail Configuration Steps

### 1. Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Navigate to Security
3. Enable 2-Step Verification

### 2. Generate App Password
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" as the app
3. Select "Other" as the device
4. Enter "CrediScore Backend"
5. Click "Generate"
6. Copy the 16-character password
7. Use this password in your `MAIL_PASSWORD` environment variable

## Integration with Auth Module

Here's how to integrate the mailer with your auth service:

```typescript
// auth/auth.service.ts
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService, // Add this
  ) {}

  async signup(signupDto: SignupDto): Promise<User> {
    // ... existing signup logic ...
    
    // Send welcome email
    await this.mailerService.sendWelcomeEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
    );
    
    return user;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate reset token
    const resetToken = this.generateResetToken();
    
    // Save token to database with expiration
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    // Send password reset email
    await this.mailerService.sendPasswordResetEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      resetToken,
    );
  }
}
```

## Testing Your Setup

### 1. Using Mailtrap (Recommended for Development)

Mailtrap is a fake SMTP server perfect for testing:

1. Sign up at https://mailtrap.io
2. Get your SMTP credentials
3. Update your `.env`:

```env
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USER=your-mailtrap-username
MAIL_PASSWORD=your-mailtrap-password
```

### 2. Using Ethereal Email (Free Alternative)

```typescript
// Create a test account programmatically
import * as nodemailer from 'nodemailer';

const testAccount = await nodemailer.createTestAccount();

// Use these credentials in your .env for testing
MAIL_HOST=smtp.ethereal.email
MAIL_PORT=587
MAIL_USER=${testAccount.user}
MAIL_PASSWORD=${testAccount.pass}
```

## Production Setup

### Recommended Email Services

#### 1. SendGrid
```env
MAIL_HOST=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USER=apikey
MAIL_PASSWORD=your-sendgrid-api-key
```

#### 2. Mailgun
```env
MAIL_HOST=smtp.mailgun.org
MAIL_PORT=587
MAIL_USER=postmaster@your-domain.mailgun.org
MAIL_PASSWORD=your-mailgun-smtp-password
```

#### 3. Amazon SES
```env
MAIL_HOST=email-smtp.us-east-1.amazonaws.com
MAIL_PORT=587
MAIL_USER=your-ses-smtp-username
MAIL_PASSWORD=your-ses-smtp-password
```

## Quick Start Commands

### 1. Install Dependencies (Already Done)
```bash
npm install --legacy-peer-deps
```

### 2. Build the Project
```bash
npm run build
```

### 3. Start Development Server
```bash
npm run start:dev
```

## Testing the Mailer

Create a test endpoint to verify the mailer works:

```typescript
// app.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { MailerService } from './mailer/mailer.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly mailerService: MailerService) {}

  @Public()
  @Get('test-email')
  async testEmail(@Query('email') email: string): Promise<{ message: string }> {
    await this.mailerService.sendWelcomeEmail(
      email,
      'Test User',
    );
    return { message: `Test email sent to ${email}` };
  }
}
```

Then visit: `http://localhost:3001/test-email?email=your-email@example.com`

## Common Issues & Solutions

### Issue: "Invalid login: 535-5.7.8 Username and Password not accepted"
**Solution:** 
- Enable 2FA on Gmail
- Generate and use app-specific password
- Don't use your regular Gmail password

### Issue: "Connection timeout"
**Solution:**
- Check firewall settings
- Verify MAIL_PORT is correct (587 for TLS, 465 for SSL)
- Try MAIL_SECURE=false for port 587

### Issue: "Template not found"
**Solution:**
- Verify templates are in `dist/mailer/templates/` after build
- Check template names are correct (case-sensitive)
- Run `npm run build` to copy templates

### Issue: Templates not copied to dist folder
**Solution:** Add to `nest-cli.json`:
```json
{
  "compilerOptions": {
    "assets": ["**/*.ejs"]
  }
}
```

## Environment Variables Checklist

- [ ] `APP_URL` - Your application URL
- [ ] `MAIL_HOST` - SMTP server host
- [ ] `MAIL_PORT` - SMTP port (usually 587)
- [ ] `MAIL_SECURE` - false for port 587, true for 465
- [ ] `MAIL_USER` - SMTP username/email
- [ ] `MAIL_PASSWORD` - SMTP password (app-specific for Gmail)
- [ ] `MAIL_FROM_NAME` - Sender name (e.g., "CrediScore")
- [ ] `MAIL_FROM_ADDRESS` - Sender email address

## Next Steps

1. ✅ Install mailer packages
2. ✅ Create mailer module and service
3. ✅ Create email templates
4. ✅ Configure environment variables
5. ⏭️ Update nest-cli.json to copy templates
6. ⏭️ Integrate mailer with auth service
7. ⏭️ Test email sending
8. ⏭️ Deploy to production with proper email service

## Support

If you encounter issues:
1. Check the application logs
2. Verify environment variables
3. Test with Mailtrap first
4. Review the README.md in this directory
5. Contact the development team
