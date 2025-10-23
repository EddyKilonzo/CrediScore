import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
  Patch,
  ValidationPipe,
  Res,
  Param,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignUpDto, SignUpResponseDto } from './dto/signup.dto';
import {
  LoginDto,
  LoginResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/login.dto';
import { VerifyEmailDto, ResendVerificationDto } from './dto/profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { UserWithoutPassword } from './interfaces/user.interface';
import { Public } from './decorators/public.decorator';

interface SessionData {
  data: any;
  timestamp: number;
  expires: number;
}

interface RequestWithSession {
  user?: UserWithoutPassword;
  session: Record<string, SessionData>;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: SignUpResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or email already exists',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async signup(@Body() signUpDto: SignUpDto): Promise<SignUpResponseDto> {
    return this.authService.signup(signUpDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid credentials',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async login(
    @Request() req: { user: UserWithoutPassword },
  ): Promise<LoginResponseDto> {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token',
  })
  async getProfile(
    @Request() req: { user: UserWithoutPassword },
  ): Promise<UserWithoutPassword> {
    return this.authService.getProfile(req.user.id);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async forgotPassword(
    @Body(ValidationPipe) forgotPasswordDto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token',
  })
  resetPassword(@Body(ValidationPipe) resetPasswordDto: ResetPasswordDto): {
    message: string;
  } {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid current password',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token',
  })
  async changePassword(
    @Request() req: { user: UserWithoutPassword },
    @Body(ValidationPipe) changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(
      req.user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully',
  })
  logout(@Request() req: { user: UserWithoutPassword }): { message: string } {
    return this.authService.logout(req.user.id);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Google OAuth',
  })
  async googleAuth() {
    // This endpoint will redirect to Google OAuth
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with authentication token',
  })
  @ApiResponse({
    status: 401,
    description: 'OAuth authentication failed',
  })
  async googleAuthRedirect(
    @Request() req: RequestWithSession,
    @Res() res: Response,
  ) {
    try {
      const loginResponse = await this.authService.login(req.user!);

      // Generate a unique session ID for this OAuth flow
      const sessionId = `oauth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store the full login response in session (server-side storage)
      req.session[sessionId] = {
        data: loginResponse,
        timestamp: Date.now(),
        expires: Date.now() + 5 * 60 * 1000, // 5 minutes expiration
      };

      // Redirect to frontend with only the session ID
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const redirectUrl = `${frontendUrl}/auth/callback?sessionId=${sessionId}`;

      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      res.redirect(`${frontendUrl}/auth/login?error=oauth_failed`);
    }
  }

  @Public()
  @Get('oauth/session/:sessionId')
  @ApiOperation({ summary: 'Retrieve OAuth session data' })
  @ApiResponse({
    status: 200,
    description: 'OAuth session data retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found or expired',
  })
  getOAuthSession(
    @Request() req: RequestWithSession,
    @Res() res: Response,
    @Param('sessionId') sessionId: string,
  ) {
    try {
      const sessionData = req.session[sessionId];

      if (!sessionData) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Check if session has expired
      if (Date.now() > sessionData.expires) {
        delete req.session[sessionId]; // Clean up expired session
        return res.status(404).json({ error: 'Session expired' });
      }

      // Clean up the session after retrieving data
      delete req.session[sessionId];

      return res.json(sessionData.data);
    } catch (error) {
      console.error('OAuth session retrieval error:', error);
      return res.status(500).json({ error: 'Failed to retrieve session data' });
    }
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with 6-digit code' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Email verified successfully! You can now log in.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired verification code',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification code' })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Verification code sent to your email.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Email already verified or too many attempts',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async resendVerificationCode(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationCode(dto);
  }
}
