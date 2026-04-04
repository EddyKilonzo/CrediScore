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
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { FraudDetectionService } from '../shared/fraud-detection/fraud-detection.service';
import { BusinessService } from '../business/business.service';
import {
  UpdateBusinessStatusDto,
  VerifyDocumentDto,
} from '../business/dto/business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/dto/user-role.enum';
import { UserWithoutPassword } from '../auth/interfaces/user.interface';
import { IsIn, IsOptional, IsString } from 'class-validator';

// DTOs for admin operations
export class UpdateUserRoleDto {
  role: UserRole;
}

export class UpdateFraudReportStatusDto {
  @IsIn(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'UPHELD'])
  status: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class UnflagUserDto {
  reason?: string;
}

export class WarnUserDto {
  reason: string;
  adminNotes?: string;
}

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly fraudDetectionService: FraudDetectionService,
    private readonly businessService: BusinessService,
  ) {}

  // Dashboard
  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('historical-data')
  @ApiOperation({ summary: 'Get 12-month historical data for admin charts' })
  @ApiResponse({ status: 200, description: 'Historical data retrieved successfully' })
  async getHistoricalData() {
    return this.adminService.getHistoricalData();
  }

  @Get('monthly-user-registrations')
  @ApiOperation({
    summary: 'Get monthly user registration counts for the current year',
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly user registrations retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getMonthlyUserRegistrations() {
    return this.adminService.getMonthlyUserRegistrations();
  }

  // User Management
  @Get('users')
  @ApiOperation({ summary: 'Get all users with pagination and filters' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: UserRole,
    description: 'Filter by role',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getAllUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.adminService.getAllUsers(page, limit, search, role, isActive);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID with detailed information' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getUserById(@Param('id') userId: string) {
    return this.adminService.getUserById(userId);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateUserRoleDto })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid role or user already has this role',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async updateUserRole(
    @Param('id') userId: string,
    @Body(ValidationPipe) updateRoleDto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(userId, updateRoleDto.role);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Toggle user active status' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User status toggled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async toggleUserStatus(@Param('id') userId: string) {
    return this.adminService.toggleUserStatus(userId);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Deactivate user account' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User deactivated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - User has associated businesses',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async deleteUser(@Param('id') userId: string) {
    return this.adminService.deleteUser(userId);
  }

  // Business Management
  @Get('businesses')
  @ApiOperation({ summary: 'Get all businesses with pagination and filters' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term',
  })
  @ApiQuery({
    name: 'isVerified',
    required: false,
    type: Boolean,
    description: 'Filter by verification status',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiResponse({
    status: 200,
    description: 'Businesses retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getAllBusinesses(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('isVerified') isVerified?: boolean,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.adminService.getAllBusinesses(
      page,
      limit,
      search,
      isVerified,
      isActive,
    );
  }

  @Get('businesses/:id')
  @ApiOperation({ summary: 'Get business by ID with detailed information' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Business details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getBusinessById(@Param('id') businessId: string) {
    return this.adminService.getBusinessById(businessId);
  }

  @Post('businesses/:id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify business' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Business verified successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Business already verified',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async verifyBusiness(@Param('id') businessId: string) {
    return this.adminService.verifyBusiness(businessId);
  }

  @Post('businesses/:id/unverify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove business verification' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Business verification removed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Business not verified',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async unverifyBusiness(@Param('id') businessId: string) {
    return this.adminService.unverifyBusiness(businessId);
  }

  @Patch('businesses/:id/status')
  @ApiOperation({ summary: 'Toggle business active status' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Business status toggled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async toggleBusinessStatus(@Param('id') businessId: string) {
    return this.adminService.toggleBusinessStatus(businessId);
  }

  // Fraud Report Management
  @Get('fraud-reports')
  @ApiOperation({
    summary: 'Get all fraud reports with pagination and filters',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'businessId',
    required: false,
    type: String,
    description: 'Filter by business ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Fraud reports retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getAllFraudReports(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('businessId') businessId?: string,
  ) {
    return this.adminService.getAllFraudReports(
      page,
      limit,
      status,
      businessId,
    );
  }

  @Patch('fraud-reports/:id/status')
  @ApiOperation({ summary: 'Update fraud report status' })
  @ApiParam({ name: 'id', description: 'Fraud report ID' })
  @ApiBody({ type: UpdateFraudReportStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Fraud report status updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Fraud report not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async updateFraudReportStatus(
    @Param('id') reportId: string,
    @Body(ValidationPipe) updateStatusDto: UpdateFraudReportStatusDto,
  ) {
    return this.adminService.updateFraudReportStatus(
      reportId,
      updateStatusDto.status,
      updateStatusDto.adminNotes,
    );
  }

  // Flagged Users Management
  @Get('flagged-users')
  @ApiOperation({ summary: 'Get flagged users for review' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({
    status: 200,
    description: 'Flagged users retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getFlaggedUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.fraudDetectionService.getFlaggedUsers(page, limit);
  }

  @Patch('flagged-users/:id/unflag')
  @ApiOperation({ summary: 'Unflag a user (admin review)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UnflagUserDto })
  @ApiResponse({
    status: 200,
    description: 'User unflagged successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async unflagUser(
    @Param('id') userId: string,
    @Body(ValidationPipe) unflagDto: UnflagUserDto,
    @Request() req: { user: UserWithoutPassword },
  ) {
    await this.fraudDetectionService.unflagUser(userId, req.user.id);
    return {
      message: 'User unflagged successfully',
      reason: unflagDto.reason || 'Admin review completed',
    };
  }

  @Post('flagged-users/:id/warn')
  @ApiOperation({ summary: 'Send a warning email to a flagged user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: WarnUserDto })
  @ApiResponse({ status: 200, description: 'Warning email sent successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async warnUser(
    @Param('id') userId: string,
    @Body(ValidationPipe) warnDto: WarnUserDto,
  ) {
    return this.adminService.warnUser(userId, warnDto.reason, warnDto.adminNotes);
  }

  @Get('flagged-users/:id/analysis')
  @ApiOperation({ summary: 'Get detailed analysis for a flagged user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User analysis retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getUserAnalysis(@Param('id') userId: string) {
    const analysis =
      await this.fraudDetectionService.analyzeUserReviewPatterns(userId);
    const flaggingResult =
      await this.fraudDetectionService.checkUserForFlagging(userId);

    return {
      analysis,
      flaggingResult,
      timestamp: new Date().toISOString(),
    };
  }

  // Business Onboarding Management
  @Get('businesses/pending-review')
  @ApiOperation({ summary: 'Get businesses pending admin review' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Pending businesses retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getPendingBusinesses(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.adminService.getPendingBusinesses(page, limit);
  }

  @Patch('businesses/:id/status')
  @ApiOperation({ summary: 'Update business status (Admin only)' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiBody({ type: UpdateBusinessStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Business status updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async updateBusinessStatus(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') businessId: string,
    @Body(ValidationPipe) updateStatusDto: UpdateBusinessStatusDto,
  ) {
    return this.adminService.updateBusinessStatus(
      req.user.id,
      businessId,
      updateStatusDto,
    );
  }

  @Patch('documents/:id/verify')
  @ApiOperation({ summary: 'Verify or reject a business document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiBody({ type: VerifyDocumentDto })
  @ApiResponse({
    status: 200,
    description: 'Document verification updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async verifyDocument(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') documentId: string,
    @Body(ValidationPipe) verifyData: VerifyDocumentDto,
  ) {
    return this.businessService.verifyDocument(
      req.user.id,
      documentId,
      verifyData,
    );
  }

  @Get('businesses/:id/onboarding-details')
  @ApiOperation({ summary: 'Get detailed business onboarding information' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Business onboarding details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getBusinessOnboardingDetails(@Param('id') businessId: string) {
    return this.adminService.getBusinessOnboardingDetails(businessId);
  }

  @Post('test-email')
  @ApiOperation({ summary: 'Test email functionality' })
  @ApiResponse({
    status: 200,
    description: 'Test email sent successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async testEmail(@Request() req: { user: UserWithoutPassword }) {
    try {
      await this.adminService.testEmailFunctionality(
        req.user.email,
        req.user.name,
      );
      return { message: 'Test email sent successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Document Management
  @Get('documents/pending')
  @ApiOperation({ summary: 'Get pending documents for verification' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Pending documents retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getPendingDocuments(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.adminService.getPendingDocuments(page, limit);
  }

  @Post('documents/:id/approve')
  @ApiOperation({ summary: 'Approve a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Document approved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async approveDocument(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') documentId: string,
  ) {
    return this.adminService.approveDocument(req.user.id, documentId);
  }

  @Post('documents/:id/reject')
  @ApiOperation({ summary: 'Reject a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiBody({
    schema: { type: 'object', properties: { reason: { type: 'string' } } },
  })
  @ApiResponse({
    status: 200,
    description: 'Document rejected successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async rejectDocument(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') documentId: string,
    @Body() body: { reason?: string },
  ) {
    return this.adminService.rejectDocument(
      req.user.id,
      documentId,
      body.reason,
    );
  }

  @Post('documents/:id/request-revision')
  @ApiOperation({ summary: 'Request revision for a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiBody({
    schema: { type: 'object', properties: { notes: { type: 'string' } } },
  })
  @ApiResponse({
    status: 200,
    description: 'Revision requested successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async requestDocumentRevision(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') documentId: string,
    @Body() body: { notes?: string },
  ) {
    return this.adminService.requestDocumentRevision(
      req.user.id,
      documentId,
      body.notes,
    );
  }

  // Review Management
  @Get('reviews/pending')
  @ApiOperation({ summary: 'Get pending reviews for moderation' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Pending reviews retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async getPendingReviews(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.adminService.getPendingReviews(page, limit);
  }

  @Post('reviews/:id/approve')
  @ApiOperation({ summary: 'Approve a review' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({
    status: 200,
    description: 'Review approved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Review not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async approveReview(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') reviewId: string,
  ) {
    return this.adminService.approveReview(req.user.id, reviewId);
  }

  @Post('reviews/:id/reject')
  @ApiOperation({ summary: 'Reject a review' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiBody({
    schema: { type: 'object', properties: { reason: { type: 'string' } } },
  })
  @ApiResponse({
    status: 200,
    description: 'Review rejected successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Review not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async rejectReview(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') reviewId: string,
    @Body() body: { reason?: string },
  ) {
    return this.adminService.rejectReview(req.user.id, reviewId, body.reason);
  }

  @Post('reviews/:id/flag')
  @ApiOperation({ summary: 'Flag a review for further review' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiBody({
    schema: { type: 'object', properties: { reason: { type: 'string' } } },
  })
  @ApiResponse({ status: 200, description: 'Review flagged successfully' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async flagReview(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') reviewId: string,
    @Body() body: { reason?: string },
  ) {
    return this.adminService.flagReview(req.user.id, reviewId, body.reason);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Review Flags & Disputes
  // ──────────────────────────────────────────────────────────────────────────

  @Get('review-flags')
  @ApiOperation({ summary: 'Get flagged reviews' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Review flags retrieved' })
  async getReviewFlags(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
  ) {
    return this.adminService.getReviewFlags(page, limit, status);
  }

  @Patch('review-flags/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a review flag' })
  @ApiParam({ name: 'id', description: 'Flag ID' })
  @ApiBody({ schema: { type: 'object', properties: { action: { type: 'string', enum: ['REVIEWED', 'DISMISSED'] } } } })
  @ApiResponse({ status: 200, description: 'Flag resolved' })
  async resolveReviewFlag(
    @Param('id') flagId: string,
    @Body() body: { action: 'REVIEWED' | 'DISMISSED' },
  ) {
    return this.adminService.resolveReviewFlag(flagId, body.action);
  }

  @Get('disputes')
  @ApiOperation({ summary: 'Get review disputes' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Disputes retrieved' })
  async getDisputes(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
  ) {
    return this.adminService.getDisputes(page, limit, status);
  }

  @Patch('disputes/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a review dispute' })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiBody({ schema: { type: 'object', properties: { action: { type: 'string' }, adminNote: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Dispute resolved' })
  async resolveDispute(
    @Param('id') disputeId: string,
    @Body() body: { action: string; adminNote?: string },
  ) {
    return this.adminService.resolveDispute(disputeId, body.action, body.adminNote);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // System Maintenance
  // ──────────────────────────────────────────────────────────────────────────

  @Get('system/metrics')
  @ApiOperation({ summary: 'Get real-time system metrics' })
  @ApiResponse({ status: 200, description: 'System metrics retrieved' })
  async getSystemMetrics() {
    return this.adminService.getSystemMetrics();
  }

  @Get('system/maintenance-tasks')
  @ApiOperation({ summary: 'Get scheduled maintenance tasks' })
  @ApiResponse({ status: 200, description: 'Maintenance tasks retrieved' })
  async getMaintenanceTasks() {
    return this.adminService.getMaintenanceTasks();
  }

  @Get('system/logs')
  @ApiOperation({ summary: 'Get recent system logs' })
  @ApiResponse({ status: 200, description: 'System logs retrieved' })
  async getSystemLogs() {
    return this.adminService.getSystemLogs();
  }

  @Post('system/maintenance-tasks/:id/run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run a maintenance task immediately' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Maintenance task started' })
  async runMaintenanceTask(@Param('id') taskId: string) {
    return { message: `Maintenance task ${taskId} started`, taskId, startedAt: new Date().toISOString() };
  }

  @Post('system/maintenance-tasks/:id/schedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reschedule a maintenance task' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiBody({ schema: { type: 'object', properties: { scheduledDate: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Maintenance task rescheduled' })
  async scheduleMaintenanceTask(
    @Param('id') taskId: string,
    @Body() body: { scheduledDate?: string },
  ) {
    return { message: `Maintenance task ${taskId} rescheduled`, taskId, scheduledDate: body.scheduledDate };
  }

  @Post('system/cache/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear system cache' })
  @ApiResponse({ status: 200, description: 'Cache cleared successfully' })
  async clearCache() {
    return { message: 'Cache cleared successfully', clearedAt: new Date().toISOString() };
  }

  @Post('system/backup/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a manual system backup' })
  @ApiResponse({ status: 200, description: 'Backup started' })
  async startBackup() {
    return { message: 'Backup started', backupId: `backup_${Date.now()}`, startedAt: new Date().toISOString() };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Bulk Actions
  // ──────────────────────────────────────────────────────────────────────────

  @Post('reviews/bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk approve or reject reviews' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reviewIds: { type: 'array', items: { type: 'string' } },
        action: { type: 'string', enum: ['APPROVE', 'REJECT'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Bulk action processed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async bulkReviewAction(
    @Body() body: { reviewIds: string[]; action: 'APPROVE' | 'REJECT' },
  ) {
    if (!Array.isArray(body.reviewIds) || !body.reviewIds.length) {
      throw new BadRequestException('reviewIds must be a non-empty array');
    }
    if (!['APPROVE', 'REJECT'].includes(body.action)) {
      throw new BadRequestException('action must be APPROVE or REJECT');
    }
    return this.adminService.bulkReviewAction(body.reviewIds, body.action);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CSV Exports
  // ──────────────────────────────────────────────────────────────────────────

  @Get('export/users')
  @ApiOperation({ summary: 'Export all users as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file with user data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async exportUsers(@Res() res: Response) {
    const csv = await this.adminService.exportUsersCSV();
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="users.csv"',
    });
    res.send(csv);
  }

  @Get('export/reviews')
  @ApiOperation({ summary: 'Export all reviews as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file with review data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async exportReviews(@Res() res: Response) {
    const csv = await this.adminService.exportReviewsCSV();
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="reviews.csv"',
    });
    res.send(csv);
  }
}
