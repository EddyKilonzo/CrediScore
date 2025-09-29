import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRoleDto } from './user-role.enum';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'User full name',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+254712345678',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Please provide a valid phone number',
  })
  phone?: string;
}

export class UserProfileDto {
  @ApiProperty({
    description: 'User ID',
    example: 'uuid-string',
  })
  id: string;

  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'User email',
    example: 'john.doe@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User phone number',
    example: '+254712345678',
  })
  phone?: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRoleDto,
    example: UserRoleDto.CUSTOMER,
  })
  role: UserRoleDto;

  @ApiProperty({
    description: 'User reputation score',
    example: 85,
  })
  reputation: number;

  @ApiProperty({
    description: 'Account status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Last login timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  lastLoginAt?: Date;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last profile update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

export class DeactivateAccountDto {
  @ApiProperty({
    description: 'Confirmation message for account deactivation',
    example: 'DEACTIVATE',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^DEACTIVATE$/, {
    message: 'Please type DEACTIVATE to confirm account deactivation',
  })
  confirmation: string;

  @ApiProperty({
    description: 'Reason for account deactivation',
    example: 'No longer using the service',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token',
    example: 'verification-token-string',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ResendVerificationDto {
  @ApiProperty({
    description: 'User email address for resending verification',
    example: 'john.doe@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;
}
