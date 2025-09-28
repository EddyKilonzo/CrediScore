// Authentication DTOs
export * from './signup.dto';
export * from './login.dto';
export * from './profile.dto';
export * from './error.dto';

// Re-export commonly used DTOs for convenience
export { SignUpDto, SignUpResponseDto } from './signup.dto';
export {
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './login.dto';
export {
  UpdateProfileDto,
  UserProfileDto,
  DeactivateAccountDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from './profile.dto';
export {
  ErrorResponseDto,
  ValidationErrorDto,
  AuthErrorDto,
} from './error.dto';
