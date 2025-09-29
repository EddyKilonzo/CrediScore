import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRoleDto } from './user-role.enum';

export class SignUpDto {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @ApiPropertyOptional({
    description: 'User phone number (optional)',
    example: '+254712345678',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Please provide a valid phone number',
  })
  phone?: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRoleDto,
    example: UserRoleDto.CUSTOMER,
    default: UserRoleDto.CUSTOMER,
  })
  @IsEnum(UserRoleDto, {
    message: 'Role must be either CUSTOMER, BUSINESS_OWNER, or ADMIN',
  })
  @IsOptional()
  role?: UserRoleDto = UserRoleDto.CUSTOMER;
}

export class SignUpResponseDto {
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
    description: 'Account creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;
}
