import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum BusinessStatus {
  PENDING = 'PENDING',
  DOCUMENTS_REQUIRED = 'DOCUMENTS_REQUIRED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum DocumentType {
  BUSINESS_DOCUMENT = 'BUSINESS_DOCUMENT',
  BUSINESS_REGISTRATION = 'BUSINESS_REGISTRATION',
  TAX_CERTIFICATE = 'TAX_CERTIFICATE',
  TRADE_LICENSE = 'TRADE_LICENSE',
  BANK_STATEMENT = 'BANK_STATEMENT',
  UTILITY_BILL = 'UTILITY_BILL',
  ID_COPY = 'ID_COPY',
  PROOF_OF_ADDRESS = 'PROOF_OF_ADDRESS',
  OTHER = 'OTHER',
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

export class UploadDocumentDto {
  @ApiProperty({ description: 'Document type', enum: DocumentType })
  @IsEnum(DocumentType)
  type: DocumentType;

  @ApiProperty({ description: 'Document URL' })
  @IsString()
  url: string;

  @ApiProperty({ description: 'Original filename', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'File size in bytes', required: false })
  @IsOptional()
  @IsNumber()
  size?: number;

  @ApiProperty({ description: 'MIME type', required: false })
  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class AddPaymentMethodDto {
  @ApiProperty({
    description: 'Payment method type',
    enum: ['TILL', 'PAYBILL', 'BANK'],
  })
  @IsEnum(['TILL', 'PAYBILL', 'BANK'])
  type: 'TILL' | 'PAYBILL' | 'BANK';

  @ApiProperty({ description: 'Payment method number' })
  @IsString()
  number: string;
}

export class CreateBusinessCategoryDto {
  @ApiProperty({ description: 'Category name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Category description', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateBusinessCategoryDto {
  @ApiProperty({ description: 'Category name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Category description', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

// Onboarding workflow DTOs
export class SubmitForReviewDto {
  @ApiProperty({ description: 'Additional notes for review', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBusinessStatusDto {
  @ApiProperty({ description: 'New business status', enum: BusinessStatus })
  @IsEnum(BusinessStatus)
  status: BusinessStatus;

  @ApiProperty({ description: 'Review notes', required: false })
  @IsOptional()
  @IsString()
  reviewNotes?: string;

  @ApiProperty({ description: 'Rejection reason', required: false })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class UpdateOnboardingStepDto {
  @ApiProperty({ description: 'Onboarding step number (1-4)' })
  @IsNumber()
  step: number;
}

export class VerifyDocumentDto {
  @ApiProperty({ description: 'Verification status' })
  @IsBoolean()
  verified: boolean;

  @ApiProperty({ description: 'Verification notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
