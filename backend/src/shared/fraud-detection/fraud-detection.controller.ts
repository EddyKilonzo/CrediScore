import {
  Controller,
  Post,
  Get,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import {
  FraudDetectionService,
  FraudDetectionRequest,
} from './fraud-detection.service';

@ApiTags('Fraud Detection')
@Controller('fraud-detection')
export class FraudDetectionController {
  private readonly logger = new Logger(FraudDetectionController.name);

  constructor(private readonly fraudDetectionService: FraudDetectionService) {}

  /**
   * Detect fraud in review and receipt data
   */
  @Post('detect')
  @ApiOperation({ summary: 'Detect fraud in review and receipt data' })
  @ApiBody({
    description: 'Fraud detection request data',
    schema: {
      type: 'object',
      properties: {
        review_text: { type: 'string', description: 'Review text to analyze' },
        receipt_data: {
          type: 'object',
          properties: {
            businessName: { type: 'string' },
            businessAddress: { type: 'string' },
            businessPhone: { type: 'string' },
            amount: { type: 'number' },
            date: { type: 'string' },
            items: { type: 'array', items: { type: 'string' } },
            receiptNumber: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
        business_details: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            address: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
          },
        },
        user_reputation: {
          type: 'number',
          description: 'User reputation score',
        },
      },
      required: ['review_text', 'business_details', 'user_reputation'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Fraud detection completed successfully',
    schema: {
      type: 'object',
      properties: {
        isFraudulent: { type: 'boolean' },
        confidence: { type: 'number' },
        fraudReasons: { type: 'array', items: { type: 'string' } },
        riskScore: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async detectFraud(@Body() request: FraudDetectionRequest) {
    try {
      this.logger.log(
        `Processing fraud detection request for review: ${request.review_text.substring(0, 50)}...`,
      );

      const result = await this.fraudDetectionService.detectFraud(request);

      this.logger.log(
        `Fraud detection completed. Risk score: ${result.riskScore}, Fraudulent: ${result.isFraudulent}`,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Fraud detection failed:', error);
      throw new BadRequestException('Fraud detection failed');
    }
  }

  /**
   * Analyze review for fraud with simplified data
   */
  @Post('analyze-review')
  @ApiOperation({ summary: 'Analyze review for fraud with simplified data' })
  @ApiBody({
    description: 'Review analysis request',
    schema: {
      type: 'object',
      properties: {
        reviewText: { type: 'string', description: 'Review text to analyze' },
        userReputation: {
          type: 'number',
          description: 'User reputation score',
        },
        receiptData: {
          type: 'object',
          description: 'Optional receipt data',
        },
        businessDetails: {
          type: 'object',
          description: 'Optional business details',
        },
      },
      required: ['reviewText', 'userReputation'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Review analysis completed successfully',
  })
  async analyzeReview(
    @Body()
    body: {
      reviewText: string;
      userReputation: number;
      receiptData?: any;
      businessDetails?: any;
    },
  ) {
    try {
      const result = await this.fraudDetectionService.analyzeReview(
        body.reviewText,
        body.userReputation,
        body.receiptData,
        body.businessDetails,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Review analysis failed:', error);
      throw new BadRequestException('Review analysis failed');
    }
  }

  /**
   * Check fraud detection service health
   */
  @Get('health')
  @ApiOperation({ summary: 'Check fraud detection service health' })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
    schema: {
      type: 'object',
      properties: {
        healthy: { type: 'boolean' },
        timestamp: { type: 'string' },
      },
    },
  })
  async checkHealth() {
    try {
      const isHealthy = await this.fraudDetectionService.isHealthy();
      return {
        success: true,
        data: {
          healthy: isHealthy,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        success: false,
        data: {
          healthy: false,
          timestamp: new Date().toISOString(),
          error: 'Health check failed',
        },
      };
    }
  }

  /**
   * Get fraud detection service information
   */
  @Get('info')
  @ApiOperation({ summary: 'Get fraud detection service information' })
  @ApiResponse({
    status: 200,
    description: 'Service information',
  })
  async getServiceInfo() {
    try {
      const info = await this.fraudDetectionService.getServiceInfo();
      return {
        success: true,
        data: info,
      };
    } catch (error) {
      this.logger.error('Failed to get service info:', error);
      throw new BadRequestException('Failed to get service information');
    }
  }
}
