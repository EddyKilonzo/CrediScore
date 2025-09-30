import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AiService } from './ai.service';

export class ProcessImageDto {
  imageUrl: string;
}

export class BatchProcessDto {
  imageUrls: string[];
  maxConcurrency?: number;
  operation?: 'ocr' | 'scan' | 'parse';
}

export class ParseReceiptDto {
  extractedText: string;
}

export class ValidateReceiptDto {
  receiptData: any;
  businessDetails: any;
  reviewInfo: any;
}

export class CredibilityScoreDto {
  reviewText: string;
  rating: number;
  isVerified: boolean;
  userReputation: number;
}

@ApiTags('AI Services')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('extract-text')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extract text from image using OCR' })
  @ApiBody({ type: ProcessImageDto })
  @ApiResponse({
    status: 200,
    description: 'Text extracted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid image URL',
  })
  async extractTextFromImage(@Body() body: ProcessImageDto) {
    if (!body.imageUrl) {
      throw new BadRequestException('Image URL is required');
    }

    const text = await this.aiService.extractTextFromImage(body.imageUrl);
    return {
      success: true,
      data: {
        extractedText: text,
      },
    };
  }

  @Post('parse-receipt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Parse receipt data from extracted text' })
  @ApiBody({ type: ParseReceiptDto })
  @ApiResponse({
    status: 200,
    description: 'Receipt data parsed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid text',
  })
  async parseReceiptData(@Body() body: ParseReceiptDto) {
    if (!body.extractedText) {
      throw new BadRequestException('Extracted text is required');
    }

    const receiptData = await this.aiService.parseReceiptData(
      body.extractedText,
    );
    return {
      success: true,
      data: receiptData,
    };
  }

  @Post('scan-document')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Scan document in real-time' })
  @ApiBody({ type: ProcessImageDto })
  @ApiResponse({
    status: 200,
    description: 'Document scanned successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid image URL',
  })
  async scanDocumentRealTime(@Body() body: ProcessImageDto) {
    if (!body.imageUrl) {
      throw new BadRequestException('Image URL is required');
    }

    const result = await this.aiService.scanDocumentRealTime(body.imageUrl);
    return {
      success: true,
      data: result,
    };
  }

  @Post('validate-receipt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate receipt against business details' })
  @ApiBody({ type: ValidateReceiptDto })
  @ApiResponse({
    status: 200,
    description: 'Receipt validated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data',
  })
  async validateReceiptAgainstReview(@Body() body: ValidateReceiptDto) {
    if (!body.receiptData || !body.businessDetails || !body.reviewInfo) {
      throw new BadRequestException('All validation data is required');
    }

    const validation = await this.aiService.validateReceiptAgainstReview(
      body.receiptData,
      body.businessDetails,
      body.reviewInfo,
    );
    return {
      success: true,
      data: validation,
    };
  }

  @Post('credibility-score')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate AI-powered review credibility score' })
  @ApiBody({ type: CredibilityScoreDto })
  @ApiResponse({
    status: 200,
    description: 'Credibility score generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data',
  })
  async generateReviewCredibilityScore(@Body() body: CredibilityScoreDto) {
    if (!body.reviewText || body.rating === undefined) {
      throw new BadRequestException('Review text and rating are required');
    }

    const score = await this.aiService.generateReviewCredibilityScore(
      body.reviewText,
      body.rating,
      body.isVerified,
      body.userReputation,
    );
    return {
      success: true,
      data: {
        credibilityScore: score,
      },
    };
  }

  @Post('batch-process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch process multiple documents' })
  @ApiBody({ type: BatchProcessDto })
  @ApiResponse({
    status: 200,
    description: 'Batch processing completed',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data',
  })
  async batchProcessDocuments(@Body() body: BatchProcessDto) {
    if (!body.imageUrls || body.imageUrls.length === 0) {
      throw new BadRequestException('Image URLs are required');
    }

    if (body.imageUrls.length > 100) {
      throw new BadRequestException('Maximum 100 documents per batch');
    }

    const results = await this.aiService.batchProcessDocuments(body.imageUrls, {
      maxConcurrency: body.maxConcurrency || 5,
      operation: body.operation || 'scan',
    });

    return {
      success: true,
      data: {
        results,
        totalProcessed: results.length,
        successful: results.filter((r) => !r.error).length,
        failed: results.filter((r) => r.error).length,
      },
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get AI service health status' })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved successfully',
  })
  async getHealthStatus() {
    const health = await this.aiService.getHealthStatus();
    return {
      success: true,
      data: health,
    };
  }
}
