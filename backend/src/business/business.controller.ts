import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { BusinessService, BusinessSearchDto } from './business.service';
import { OCRService } from '../shared/ocr/ocr.service';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  AddPaymentMethodDto,
  CreateBusinessCategoryDto,
  UpdateBusinessCategoryDto,
  SubmitForReviewDto,
  UpdateOnboardingStepDto,
} from './dto/business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../auth/dto/user-role.enum';
import { UserWithoutPassword } from '../auth/interfaces/user.interface';
import { Response } from 'express';

@ApiTags('Business Management')
@Controller('business')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BusinessController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly ocrService: OCRService,
  ) {}

  // Health Check Endpoints (Public - no authentication required)
  @Public()
  @Get('health/ocr')
  @ApiOperation({ summary: 'Check OCR service health' })
  @ApiResponse({ status: 200, description: 'OCR service health status' })
  checkOcrHealth() {
    return this.ocrService.healthCheck();
  }

  @Public()
  @Get('health/google-vision')
  @ApiOperation({ summary: 'Check Google Vision service health' })
  @ApiResponse({
    status: 200,
    description: 'Google Vision service health status',
  })
  checkGoogleVisionHealth() {
    return this.ocrService.healthCheck();
  }

  @Post('test/document-processing')
  @ApiOperation({ summary: 'Test document processing with sample URL' })
  @ApiResponse({ status: 200, description: 'Document processing test result' })
  async testDocumentProcessing(@Body() body: { imageUrl: string }) {
    try {
      const { imageUrl } = body;

      // Test OCR extraction
      const ocrResult = await this.ocrService.extractText(imageUrl);

      // Test AI analysis
      const analysisResult = await this.ocrService.analyzeDocument(ocrResult);

      // Test authenticity verification
      const authenticityResult = this.ocrService.verifyDocumentAuthenticity(
        ocrResult,
        analysisResult,
      );

      return {
        success: true,
        ocrResult: {
          text: ocrResult.text.substring(0, 200) + '...', // Truncate for response
          confidence: ocrResult.confidence,
        },
        analysisResult: {
          documentType: analysisResult.documentType,
          isValid: analysisResult.isValid,
          authenticityScore: analysisResult.authenticityScore,
          validationErrors: analysisResult.validationErrors,
        },
        authenticityResult: {
          isAuthentic: authenticityResult.isAuthentic,
          confidence: authenticityResult.confidence,
          reasons: authenticityResult.reasons,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Business CRUD Operations
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new business' })
  @ApiBody({ type: CreateBusinessDto })
  @ApiResponse({
    status: 201,
    description: 'Business created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid business data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async createBusiness(
    @Request() req: { user: UserWithoutPassword },
    @Body(ValidationPipe) businessData: CreateBusinessDto,
  ) {
    return this.businessService.createBusiness(req.user.id, businessData);
  }

  @Get('my-businesses')
  @ApiOperation({ summary: 'Get current user businesses' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'User businesses retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getUserBusinesses(
    @Request() req: { user: UserWithoutPassword },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.businessService.getUserBusinesses(req.user.id, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get business by ID' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Business retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  async getBusinessById(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
  ) {
    return this.businessService.getBusinessById(businessId, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update business' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiBody({ type: UpdateBusinessDto })
  @ApiResponse({
    status: 200,
    description: 'Business updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only update your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateBusiness(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
    @Body(ValidationPipe) updateData: UpdateBusinessDto,
  ) {
    return this.businessService.updateBusiness(
      req.user.id,
      businessId,
      updateData,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete business' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Business deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only delete your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async deleteBusiness(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
  ) {
    return this.businessService.deleteBusiness(req.user.id, businessId);
  }

  // Business Search and Discovery
  @Get('search')
  @ApiOperation({ summary: 'Search businesses' })
  @ApiQuery({ name: 'query', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'location', required: false, type: String })
  @ApiQuery({ name: 'minRating', required: false, type: Number })
  @ApiQuery({ name: 'isVerified', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Businesses retrieved successfully',
  })
  async searchBusinesses(@Query() searchParams: BusinessSearchDto) {
    return this.businessService.searchBusinesses(searchParams);
  }

  @Get('featured/list')
  @ApiOperation({ summary: 'Get featured businesses' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Featured businesses retrieved successfully',
  })
  async getFeaturedBusinesses(@Query('limit') limit?: number) {
    return this.businessService.getFeaturedBusinesses(limit);
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get businesses by category' })
  @ApiParam({ name: 'categoryId', description: 'Category ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Businesses by category retrieved successfully',
  })
  async getBusinessesByCategory(
    @Param('categoryId') categoryId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.businessService.getBusinessesByCategory(
      categoryId,
      page,
      limit,
    );
  }

  // Document Management
  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload business document with AI processing' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 201,
    description: 'Document uploaded successfully and AI processing started',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - You can only upload documents for your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async uploadDocument(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
    @UploadedFile() file: any,
    @Body('type') documentType: string,
  ) {
    return this.businessService.uploadDocument(
      req.user.id,
      businessId,
      file,
      documentType,
    );
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Get business documents' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Business documents retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - You can only view documents for your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getBusinessDocuments(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
  ) {
    return this.businessService.getBusinessDocuments(req.user.id, businessId);
  }

  @Get(':id/documents/:documentId/processing-status')
  @ApiOperation({ summary: 'Get document AI processing status' })
  @ApiResponse({
    status: 200,
    description: 'Processing status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getDocumentProcessingStatus(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.businessService.getDocumentProcessingStatus(
      req.user.id,
      businessId,
      documentId,
    );
  }

  @Delete('documents/:documentId')
  @ApiOperation({ summary: 'Delete business document' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Document deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - You can only delete documents for your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async deleteDocument(
    @Request() req: { user: UserWithoutPassword },
    @Param('documentId') documentId: string,
  ) {
    return this.businessService.deleteDocument(req.user.id, documentId);
  }

  @Get('documents/:documentId/download')
  @ApiOperation({ summary: 'Download business document' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Document downloaded successfully',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - You can only download documents for your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async downloadDocument(
    @Request() req: { user: UserWithoutPassword },
    @Param('documentId') documentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.businessService.downloadDocument(
      req.user.id,
      documentId,
    );

    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(
        file.filename,
      )}"`,
      'Content-Length': file.buffer.length.toString(),
    });

    return new StreamableFile(file.buffer);
  }

  @Get('documents/:documentId/access-url')
  @ApiOperation({ summary: 'Get secure access URL for a business document' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Document access URL generated successfully',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - You can only access documents for your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getDocumentAccessUrl(
    @Request() req: { user: UserWithoutPassword },
    @Param('documentId') documentId: string,
  ) {
    return this.businessService.getDocumentAccessUrl(
      req.user.id,
      documentId,
    );
  }

  // Payment Method Management
  @Post(':id/payment-methods')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add payment method to business' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiBody({ type: AddPaymentMethodDto })
  @ApiResponse({
    status: 201,
    description: 'Payment method added successfully',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - You can only add payment methods for your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async addPaymentMethod(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
    @Body(ValidationPipe) paymentData: AddPaymentMethodDto,
  ) {
    return this.businessService.addPaymentMethod(
      req.user.id,
      businessId,
      paymentData,
    );
  }

  @Get(':id/payment-methods')
  @ApiOperation({ summary: 'Get business payment methods' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Business payment methods retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - You can only view payment methods for your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getBusinessPaymentMethods(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
  ) {
    return this.businessService.getBusinessPaymentMethods(
      req.user.id,
      businessId,
    );
  }

  @Delete('payment-methods/:paymentId')
  @ApiOperation({ summary: 'Delete business payment method' })
  @ApiParam({ name: 'paymentId', description: 'Payment method ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment method deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - You can only delete payment methods for your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment method not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async deletePaymentMethod(
    @Request() req: { user: UserWithoutPassword },
    @Param('paymentId') paymentId: string,
  ) {
    return this.businessService.deletePaymentMethod(req.user.id, paymentId);
  }

  // Trust Score Management
  @Get(':id/trust-score')
  @ApiOperation({ summary: 'Get business trust score' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Trust score retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  async getTrustScore(@Param('id') businessId: string) {
    return this.businessService.getTrustScore(businessId);
  }

  @Post(':id/trust-score/calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate business trust score' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Trust score calculated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  async calculateTrustScore(@Param('id') businessId: string) {
    return this.businessService.calculateTrustScore(businessId);
  }

  // Business Analytics
  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get business analytics' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Business analytics retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - You can only view analytics for your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getBusinessAnalytics(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
  ) {
    return this.businessService.getBusinessAnalytics(req.user.id, businessId);
  }

  // Onboarding Workflow Endpoints
  @Get(':id/onboarding-status')
  @ApiOperation({ summary: 'Get business onboarding status and progress' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Onboarding status retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only view your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getOnboardingStatus(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
  ) {
    return this.businessService.getOnboardingStatus(req.user.id, businessId);
  }

  @Patch(':id/onboarding-step')
  @ApiOperation({ summary: 'Update business onboarding step' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiBody({ type: UpdateOnboardingStepDto })
  @ApiResponse({
    status: 200,
    description: 'Onboarding step updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid step number',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only update your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateOnboardingStep(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
    @Body(ValidationPipe) updateStepDto: UpdateOnboardingStepDto,
  ) {
    return this.businessService.updateOnboardingStep(
      req.user.id,
      businessId,
      updateStepDto.step,
    );
  }

  @Post(':id/submit-for-review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit business for admin review' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiBody({ type: SubmitForReviewDto })
  @ApiResponse({
    status: 200,
    description: 'Business submitted for review successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Missing required documents or payment methods',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only submit your own businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async submitForReview(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
    @Body(ValidationPipe) submitData: SubmitForReviewDto,
  ) {
    return this.businessService.submitForReview(
      req.user.id,
      businessId,
      submitData,
    );
  }
}

@ApiTags('Public Business')
@Controller('public/business')
export class PublicBusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search businesses (Public)' })
  @ApiQuery({ name: 'query', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'location', required: false, type: String })
  @ApiQuery({ name: 'minRating', required: false, type: Number })
  @ApiQuery({ name: 'isVerified', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Businesses retrieved successfully',
  })
  async searchBusinesses(@Query() searchParams: BusinessSearchDto) {
    return this.businessService.searchBusinesses(searchParams);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured businesses (Public)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Featured businesses retrieved successfully',
  })
  async getFeaturedBusinesses(@Query('limit') limit?: number) {
    return this.businessService.getFeaturedBusinesses(limit);
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get businesses by category (Public)' })
  @ApiParam({ name: 'categoryId', description: 'Category ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Businesses by category retrieved successfully',
  })
  async getBusinessesByCategory(
    @Param('categoryId') categoryId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.businessService.getBusinessesByCategory(
      categoryId,
      page,
      limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get business by ID (Public)' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Business retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  async getBusinessById(@Param('id') businessId: string) {
    return this.businessService.getBusinessById(businessId);
  }
}

@ApiTags('Business Categories')
@Controller('business-categories')
export class BusinessCategoryController {
  constructor(private readonly businessService: BusinessService) {}

  // Public endpoints for business categories
  @Get()
  @ApiOperation({ summary: 'Get all business categories' })
  @ApiResponse({
    status: 200,
    description: 'Business categories retrieved successfully',
  })
  async getAllBusinessCategories() {
    return this.businessService.getAllBusinessCategories();
  }

  // Admin-only endpoints for business category management
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create business category (Admin only)' })
  @ApiBody({ type: CreateBusinessCategoryDto })
  @ApiResponse({
    status: 201,
    description: 'Business category created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Category name already exists',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async createBusinessCategory(
    @Body(ValidationPipe) categoryData: CreateBusinessCategoryDto,
  ) {
    return this.businessService.createBusinessCategory(categoryData);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update business category (Admin only)' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiBody({ type: UpdateBusinessCategoryDto })
  @ApiResponse({
    status: 200,
    description: 'Business category updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Category name already exists',
  })
  @ApiResponse({
    status: 404,
    description: 'Business category not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async updateBusinessCategory(
    @Param('id') categoryId: string,
    @Body(ValidationPipe) updateData: UpdateBusinessCategoryDto,
  ) {
    return this.businessService.updateBusinessCategory(categoryId, updateData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete business category (Admin only)' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Business category deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Category has associated businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'Business category not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async deleteBusinessCategory(@Param('id') categoryId: string) {
    return this.businessService.deleteBusinessCategory(categoryId);
  }
}
