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
} from '@nestjs/common';
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

// DTOs for admin operations
export class UpdateUserRoleDto {
  role: UserRole;
}

export class UpdateFraudReportStatusDto {
  status: string;
  adminNotes?: string;
}

export class UnflagUserDto {
  reason?: string;
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
}
