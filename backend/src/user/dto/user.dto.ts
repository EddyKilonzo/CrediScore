import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, Matches, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ description: 'User name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'User phone', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'User bio/description', required: false })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ description: 'User avatar URL', required: false })
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class CreateBusinessDto {
  @ApiProperty({ description: 'Business name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Business description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Business category', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Business website', required: false })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ description: 'Business phone', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Business email', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: 'Business location', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ description: 'Business latitude', required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ description: 'Business longitude', required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ description: 'Business category ID', required: false })
  @IsOptional()
  @IsString()
  businessCategoryId?: string;
}

export class UpdateBusinessDto {
  @ApiProperty({ description: 'Business name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Business description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Business category', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Business website', required: false })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ description: 'Business phone', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Business email', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: 'Business location', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ description: 'Business latitude', required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ description: 'Business longitude', required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ description: 'Business category ID', required: false })
  @IsOptional()
  @IsString()
  businessCategoryId?: string;
}

export class CreateReviewDto {
  @ApiProperty({ description: 'Business ID' })
  @IsString()
  businessId: string;

  @ApiProperty({ description: 'Review rating' })
  @IsNumber()
  rating: number;

  @ApiProperty({ description: 'Review comment', required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ description: 'Receipt URL', required: false })
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiProperty({ description: 'Transaction amount', required: false })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiProperty({ description: 'Review date', required: false })
  @IsOptional()
  @IsDateString()
  reviewDate?: string;

  @ApiProperty({ description: 'M-Pesa transaction code (10 chars, uppercase alphanumeric)', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{10}$/i, { message: 'M-Pesa code must be 10 alphanumeric characters' })
  mpesaCode?: string;
}

export class UpdateReviewDto {
  @ApiProperty({ description: 'Review rating', required: false })
  @IsOptional()
  @IsNumber()
  rating?: number;

  @ApiProperty({ description: 'Review comment', required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class CreateFraudReportDto {
  @ApiProperty({ description: 'Business ID' })
  @IsString()
  businessId: string;

  @ApiProperty({ description: 'Fraud reason' })
  @IsString()
  reason: string;

  @ApiProperty({ description: 'Fraud description', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateReviewReplyDto {
  @ApiProperty({ description: 'Review ID' })
  @IsString()
  reviewId: string;

  @ApiProperty({ description: 'Reply content' })
  @IsString()
  content: string;
}

export class UpdateReviewReplyDto {
  @ApiProperty({ description: 'Reply content' })
  @IsString()
  content: string;
}

export class VoteReviewDto {
  @ApiProperty({ description: 'Vote type', enum: ['HELPFUL', 'NOT_HELPFUL'] })
  @IsEnum(['HELPFUL', 'NOT_HELPFUL'])
  vote: 'HELPFUL' | 'NOT_HELPFUL';
}

export class FlagReviewDto {
  @ApiProperty({ description: 'Reason for flagging the review' })
  @IsString()
  reason: string;
}

export class DisputeReviewDto {
  @ApiProperty({ description: 'Reason for disputing the review' })
  @IsString()
  reason: string;
}

export class UpdateNotificationPrefsDto {
  @ApiProperty({ description: 'Notify on review reply', required: false })
  @IsOptional()
  @IsBoolean()
  reviewReply?: boolean;

  @ApiProperty({ description: 'Notify on review vote', required: false })
  @IsOptional()
  @IsBoolean()
  reviewVote?: boolean;

  @ApiProperty({ description: 'Notify when business is verified', required: false })
  @IsOptional()
  @IsBoolean()
  businessVerified?: boolean;

  @ApiProperty({ description: 'Notify on dispute update', required: false })
  @IsOptional()
  @IsBoolean()
  disputeUpdate?: boolean;

  @ApiProperty({ description: 'Marketing notifications', required: false })
  @IsOptional()
  @IsBoolean()
  marketing?: boolean;
}
