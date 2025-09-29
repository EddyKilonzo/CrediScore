import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { OAuthUser } from '../interfaces/user.interface';
import { AuthProvider } from '../interfaces/user.interface';

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
    const { name, emails, photos } = profile;

    const oauthUser: OAuthUser = {
      email: emails[0]?.value || '',
      name: `${name?.givenName || ''} ${name?.familyName || ''}`.trim(),
      avatar: photos[0]?.value,
      provider: AuthProvider.GOOGLE,
      providerId: profile.id,
    };

    const validatedUser = await this.authService.validateOAuthUser(oauthUser);
    done(null, validatedUser);
  }
}
