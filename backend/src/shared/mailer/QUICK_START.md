# Mailer Quick Start Guide

## ✅ What's Been Set Up

Your mailer functionality is now fully configured with:

1. **NestJS Mailer Module** with EJS templates
2. **Professional Email Templates** styled like CoinEx
3. **Inline CSS** for maximum email client compatibility
4. **4 Pre-built Templates**:
   - Welcome email
   - Email verification
   - Password reset
   - Password change notification

## 📧 Email Template Features

- ✨ Beautiful gradient header with CrediScore branding
- 📱 Fully responsive design
- 🎨 Inline CSS for email client compatibility
- 🔗 Social media links
- 📲 App store links
- 🔒 Security notices and tips
- ⏰ Expiration timestamps

## 🚀 Next Steps

### 1. Configure Environment Variables

Create a `.env` file in your backend folder:

```env
# Application
APP_URL=http://localhost:3000

# Email Configuration (Gmail Example)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-specific-password
MAIL_FROM_NAME=CrediScore
MAIL_FROM_ADDRESS=noreply@crediscore.com
```

### 2. Gmail Setup (Recommended for Testing)

1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Go to https://myaccount.google.com/apppasswords
4. Generate an app password for "Mail"
5. Use that password in `MAIL_PASSWORD`

### 3. Test the Mailer

Build and run your project:

```bash
npm run build
npm run start:dev
```

### 4. Send a Test Email

Use the mailer service in your code:

```typescript
import { MailerService } from './mailer/mailer.service';

// In your service
await this.mailerService.sendWelcomeEmail(
  'user@example.com',
  'John Doe'
);
```

## 📁 File Structure

```
backend/src/mailer/
├── templates/
│   ├── _layout.ejs              # Main email layout with header/footer
│   ├── welcome.ejs              # Welcome email content
│   ├── email-verification.ejs   # Email verification content
│   ├── password-reset.ejs       # Password reset content
│   └── password-changed.ejs     # Password change notification
├── mailer.module.ts             # Module configuration
├── mailer.service.ts            # Email service with methods
└── MAILER_SETUP.md             # Detailed setup guide
```

## 🎯 Available Email Methods

```typescript
// Welcome email
await mailerService.sendWelcomeEmail(email, name, verificationToken?);

// Email verification
await mailerService.sendEmailVerification(email, name, token);

// Password reset
await mailerService.sendPasswordResetEmail(email, name, resetToken);

// Password changed notification
await mailerService.sendPasswordChangedNotification(email, name);

// Custom email
await mailerService.sendEmail({
  to: 'user@example.com',
  subject: 'Subject',
  template: 'template-name',
  context: { key: 'value' }
});
```

## 🎨 Email Design Highlights

- **Header**: Cyan gradient (#4facfe to #00f2fe) with white logo
- **Typography**: System fonts for best compatibility
- **Colors**: 
  - Primary: #4facfe (Cyan)
  - Text: #333 (Dark gray)
  - Muted: #666, #999 (Gray shades)
  - Warning: #ffa726 (Orange)
- **Layout**: 600px max width, centered, with padding
- **Responsive**: Mobile-friendly with media queries

## 🔧 Email Client Compatibility

✅ Gmail
✅ Outlook
✅ Apple Mail
✅ Yahoo Mail
✅ Thunderbird
✅ Mobile clients (iOS Mail, Android Gmail)

## 📝 Customization

To customize the templates:

1. **Edit `_layout.ejs`** for global changes (header, footer, colors)
2. **Edit individual templates** for content changes
3. **Use inline styles** for any new elements
4. **Test in multiple email clients**

## ⚠️ Important Notes

- All templates use **table-based layout** for email compatibility
- All styles are **inline** (not in `<style>` tags)
- Templates are copied to `dist/` folder during build
- The `.env` file should **never** be committed to git

## 🔒 Security Best Practices

✅ Use app-specific passwords (not your main password)
✅ Enable 2FA on your email account
✅ Never commit `.env` files
✅ Use environment variables for all sensitive data
✅ Implement rate limiting for email sending
✅ Validate email addresses before sending

## 📚 Additional Resources

- See `MAILER_SETUP.md` for detailed configuration
- See `mailer.service.ts` for all available methods
- NestJS Mailer Docs: https://nest-modules.github.io/mailer/

## 🐛 Troubleshooting

**Emails not sending?**
- Check your SMTP credentials
- Verify environment variables are loaded
- Check firewall/network settings
- Look at application logs

**Templates not found?**
- Run `npm run build` to copy templates to dist/
- Verify `nest-cli.json` has assets configuration
- Check template file names match exactly

**Styling not working?**
- Use inline styles (not CSS classes)
- Test in multiple email clients
- Check for supported CSS properties

## ✉️ Ready to Send!

Your mailer is now fully configured and ready to use. Just configure your environment variables and start sending beautiful emails!

For production, consider using services like:
- SendGrid
- Mailgun
- Amazon SES
- Postmark

Happy emailing! 📨
