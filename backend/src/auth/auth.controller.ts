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
} from '@nestjs/common';
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
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { UserWithoutPassword } from './interfaces/user.interface';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async signup(
    @Body(ValidationPipe) signUpDto: SignUpDto,
  ): Promise<SignUpResponseDto> {
    return this.authService.signup(signUpDto);
  }

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
  async resetPassword(
    @Body(ValidationPipe) resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
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
  async logout(
    @Request() req: { user: UserWithoutPassword },
  ): Promise<{ message: string }> {
    return this.authService.logout(req.user.id);
  }

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

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({
    status: 200,
    description: 'OAuth login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'OAuth authentication failed',
  })
  async googleAuthRedirect(
    @Request() req: { user: UserWithoutPassword },
  ): Promise<LoginResponseDto> {
    return this.authService.login(req.user);
  }
}
