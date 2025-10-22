import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { OAuthUser } from '../interfaces/user.interface';
import { AuthProvider } from '../interfaces/user.interface';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';

interface GoogleProfile {
  id: string;
  name: {
    givenName?: string;
    familyName?: string;
  };
  emails: Array<{ value: string }>;
  photos: Array<{ value: string }>;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
    private cloudinaryService: CloudinaryService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL:
        configService.get<string>('GOOGLE_CALLBACK_URL') ||
        '/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const { name, emails, photos } = profile;

      let cloudinaryAvatarUrl: string | undefined = undefined;

      // Upload Google profile image to Cloudinary if available
      if (photos && photos[0]?.value) {
        try {
          console.log('Uploading Google profile image to Cloudinary...');

          // Create upload options for Google profile images
          const uploadOptions = {
            folder: 'crediscore/google-profiles',
            public_id: `google_profile_${profile.id}_${Date.now()}`,
            overwrite: true,
            resource_type: 'image' as const,
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
            tags: ['google', 'profile', 'oauth'],
          };

          const uploadResult = await this.cloudinaryService.uploadFromUrl(
            photos[0].value,
            uploadOptions,
          );

          cloudinaryAvatarUrl = uploadResult.secure_url;
          console.log(
            'Google profile image uploaded to Cloudinary:',
            cloudinaryAvatarUrl,
          );
        } catch (uploadError) {
          console.error(
            'Failed to upload Google profile image to Cloudinary:',
            uploadError,
          );
          // Continue with original Google image URL if Cloudinary upload fails
          cloudinaryAvatarUrl = photos[0].value;
        }
      }

      const oauthUser: OAuthUser = {
        email: emails[0]?.value || '',
        name: `${name?.givenName || ''} ${name?.familyName || ''}`.trim(),
        avatar: cloudinaryAvatarUrl,
        provider: AuthProvider.GOOGLE,
        providerId: profile.id,
      };

      const validatedUser = await this.authService.validateOAuthUser(oauthUser);
      done(null, validatedUser);
    } catch (error) {
      console.error('Google OAuth validation error:', error);
      done(error, false);
    }
  }
}
