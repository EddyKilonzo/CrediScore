import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Error status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Validation failed',
  })
  message: string | string[];

  @ApiProperty({
    description: 'Error type',
    example: 'Bad Request',
  })
  error: string;

  @ApiProperty({
    description: 'Timestamp of the error',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Request path that caused the error',
    example: '/auth/signup',
  })
  path: string;
}

export class ValidationErrorDto {
  @ApiProperty({
    description: 'Field that failed validation',
    example: 'email',
  })
  field: string;

  @ApiProperty({
    description: 'Validation error message',
    example: 'Please provide a valid email address',
  })
  message: string;

  @ApiProperty({
    description: 'Value that failed validation',
    example: 'invalid-email',
  })
  value: string | number | boolean | null;
}

export class AuthErrorDto {
  @ApiProperty({
    description: 'Error code',
    example: 'INVALID_CREDENTIALS',
  })
  code: string;

  @ApiProperty({
    description: 'Error message',
    example: 'Invalid email or password',
  })
  message: string;

  @ApiProperty({
    description: 'Additional error details',
    example: 'Account may be deactivated',
  })
  details?: string;
}
