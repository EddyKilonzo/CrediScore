import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { OAuthUser } from '../interfaces/user.interface';
import { AuthProvider } from '../interfaces/user.interface';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { Request } from 'express';

interface GoogleProfile {
  id: string;
  name: {
    givenName?: string;
    familyName?: string;
  };
  emails: Array<{ value: string }>;
  photos: Array<{ value: string }>;
}

// Server-side store to pass role through the OAuth round-trip reliably.
// Keyed by a nonce (passed as state); expires after 5 minutes.
const roleStore = new Map<string, { role: string; expires: number }>();

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
      passReqToCallback: true,
    });
  }

  // Called for both the initiation (/auth/google?role=business) and the callback.
  // On initiation: store the role server-side and pass a nonce as the OAuth state.
  // On callback: state is the nonce we sent — passport reads req.query.code to detect callback.
  override authenticate(req: Request, options?: any): void {
    if (req.query?.role) {
      // Initiation phase — user clicked "Continue with Google"
      const role = (req.query.role as string) || 'user';
      const nonce = `role_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      roleStore.set(nonce, { role, expires: Date.now() + 5 * 60 * 1000 });
      super.authenticate(req, { ...options, state: nonce });
    } else {
      // Callback phase — no role query param, just proceed
      super.authenticate(req, options);
    }
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const { name, emails, photos } = profile;

      // Recover role from the server-side store using the nonce in state
      let role = 'user';
      const nonce = req.query?.state as string;
      if (nonce) {
        const entry = roleStore.get(nonce);
        if (entry && entry.expires > Date.now()) {
          role = entry.role;
          roleStore.delete(nonce);
        }
      }

      console.log(`Google OAuth validate — state nonce: ${nonce}, resolved role: ${role}`);

      let cloudinaryAvatarUrl: string | undefined = undefined;

      // Upload Google profile image to Cloudinary if available
      if (photos && photos[0]?.value) {
        try {
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
        } catch (uploadError) {
          console.error(
            'Failed to upload Google profile image to Cloudinary:',
            uploadError,
          );
          cloudinaryAvatarUrl = photos[0].value;
        }
      }

      const oauthUser: OAuthUser = {
        email: emails[0]?.value || '',
        name: `${name?.givenName || ''} ${name?.familyName || ''}`.trim(),
        avatar: cloudinaryAvatarUrl,
        provider: AuthProvider.GOOGLE,
        providerId: profile.id,
        role,
      };

      const validatedUser = await this.authService.validateOAuthUser(oauthUser);
      done(null, validatedUser);
    } catch (error) {
      console.error('Google OAuth validation error:', error);
      done(error, false);
    }
  }
}
