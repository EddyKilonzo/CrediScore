# Google OAuth Setup Guide

## Required Environment Variables

To enable Google SSO functionality, you need to set up the following environment variables in your `.env` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"
```

## Google Cloud Console Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google+ API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application" as the application type

4. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Fill in the required information:
     - App name: "CrediScore"
     - User support email: your email
     - Developer contact information: your email

5. **Set Authorized Redirect URIs**
   - In your OAuth 2.0 Client ID settings, add these redirect URIs:
     - `http://localhost:3000/api/auth/google/callback` (for development)
     - `https://yourdomain.com/api/auth/google/callback` (for production)

6. **Get Your Credentials**
   - Copy the Client ID and Client Secret
   - Add them to your `.env` file

## Important URLs

### Development URLs:
- **OAuth Initiation**: `http://localhost:3000/api/auth/google`
- **OAuth Callback**: `http://localhost:3000/api/auth/google/callback`

### Production URLs (replace with your domain):
- **OAuth Initiation**: `https://yourdomain.com/api/auth/google`
- **OAuth Callback**: `https://yourdomain.com/api/auth/google/callback`

## Frontend Integration

The Google SSO button is already implemented in both login and register components:

### Login Component (`/auth/login`)
- Google SSO button with proper styling
- Calls `authService.signInWithGoogle()` method
- Redirects to backend OAuth endpoint

### Register Component (`/auth/register`)
- Google SSO button integrated into multi-step form
- Same functionality as login component
- Handles OAuth flow for new user registration

## Backend Implementation

The backend already includes:

1. **Google Strategy** (`src/auth/strategies/google.strategy.ts`)
   - Handles OAuth flow
   - Validates Google profile data
   - Creates or updates user accounts

2. **Auth Controller** (`src/auth/auth.controller.ts`)
   - `/api/auth/google` - Initiates OAuth flow
   - `/api/auth/google/callback` - Handles OAuth callback

3. **Database Schema**
   - User model supports OAuth providers
   - Stores `provider`, `providerId`, and `avatar` fields

## Testing the Integration

1. **Start the Backend**
   ```bash
   cd backend
   npm run start:dev
   ```

2. **Start the Frontend**
   ```bash
   cd frontend
   npm start
   ```

3. **Test Google SSO**
   - Navigate to `/auth/login` or `/auth/register`
   - Click "Continue with Google" button
   - Complete Google OAuth flow
   - Verify user is created/logged in successfully

## Troubleshooting

### Common Issues

1. **"Invalid Client ID" Error**
   - Verify `GOOGLE_CLIENT_ID` is correct
   - Check that the OAuth consent screen is configured

2. **"Redirect URI Mismatch" Error**
   - Ensure `GOOGLE_CALLBACK_URL` matches exactly what's configured in Google Cloud Console
   - Check for trailing slashes or protocol mismatches
   - **Important**: Use `http://localhost:3000/api/auth/google/callback` (not `/auth/google/callback`)

3. **"Access Blocked" Error**
   - Verify OAuth consent screen is published
   - Add test users if in testing mode

4. **CORS Issues**
   - Ensure backend CORS is configured for frontend domain
   - Check that frontend URL is whitelisted

### Environment Variables Checklist

- [ ] `GOOGLE_CLIENT_ID` - From Google Cloud Console
- [ ] `GOOGLE_CLIENT_SECRET` - From Google Cloud Console  
- [ ] `GOOGLE_CALLBACK_URL` - Must match Google Cloud Console settings
- [ ] `JWT_SECRET` - For token generation
- [ ] `DATABASE_URL` - For user storage

## Security Considerations

1. **Environment Variables**
   - Never commit `.env` files to version control
   - Use different credentials for development/production
   - Rotate secrets regularly

2. **OAuth Scopes**
   - Current implementation requests minimal scopes: `['email', 'profile']`
   - Only request necessary permissions

3. **User Data**
   - Validate all data from Google profile
   - Implement proper error handling
   - Log OAuth events for security monitoring

## Quick Setup Checklist

1. ✅ Backend server running with `/api` prefix
2. ✅ Google OAuth routes configured (`/api/auth/google` and `/api/auth/google/callback`)
3. ✅ Frontend Google SSO buttons implemented
4. ⏳ **Next**: Configure Google Cloud Console with callback URL: `http://localhost:3000/api/auth/google/callback`
5. ⏳ **Next**: Add environment variables to `.env` file
6. ⏳ **Next**: Test complete OAuth flow
