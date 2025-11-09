import {
  Controller,
  Get,
  Post,
  Put,
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
import { UserService } from './user.service';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  CreateReviewDto,
  UpdateReviewDto,
  CreateFraudReportDto,
  UpdateProfileDto,
  CreateReviewReplyDto,
  UpdateReviewReplyDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserWithoutPassword } from '../auth/interfaces/user.interface';

@ApiTags('User')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Profile Management
  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateProfile(
    @Request() req: { user: UserWithoutPassword },
    @Body(ValidationPipe) updateData: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(req.user.id, updateData);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getUserStats(@Request() req: { user: UserWithoutPassword }) {
    return this.userService.getUserStats(req.user.id);
  }

  @Get('profile-data')
  @ApiOperation({
    summary: 'Get role-based profile data with real information',
  })
  @ApiResponse({
    status: 200,
    description: 'Role-based profile data retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getRoleBasedProfileData(@Request() req: { user: UserWithoutPassword }) {
    return this.userService.getRoleBasedProfileData(req.user.id);
  }

  // Business Management
  @Post('businesses')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new business' })
  @ApiBody({ type: CreateBusinessDto })
  @ApiResponse({
    status: 201,
    description: 'Business created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only business owners can create businesses',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async createBusiness(
    @Request() req: { user: UserWithoutPassword },
    @Body(ValidationPipe) businessData: CreateBusinessDto,
  ) {
    return this.userService.createBusiness(req.user.id, businessData);
  }

  @Get('businesses')
  @ApiOperation({ summary: 'Get user businesses' })
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
    return this.userService.getUserBusinesses(req.user.id, page, limit);
  }

  @Patch('businesses/:id')
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
    return this.userService.updateBusiness(req.user.id, businessId, updateData);
  }

  @Delete('businesses/:id')
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
    return this.userService.deleteBusiness(req.user.id, businessId);
  }

  // Review Management
  @Post('reviews')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a review with optional receipt verification',
  })
  @ApiBody({ type: CreateReviewDto })
  @ApiResponse({
    status: 201,
    description:
      'Review created successfully (verified if receipt provided and valid)',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid rating or already reviewed',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async createReview(
    @Request() req: { user: UserWithoutPassword },
    @Body(ValidationPipe) reviewData: CreateReviewDto,
  ) {
    return this.userService.createReview(req.user.id, reviewData);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Get user reviews' })
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
  @ApiResponse({
    status: 200,
    description: 'User reviews retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getUserReviews(
    @Request() req: { user: UserWithoutPassword },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.userService.getUserReviews(req.user.id, page, limit);
  }

  @Patch('reviews/:id')
  @ApiOperation({ summary: 'Update review' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiBody({ type: UpdateReviewDto })
  @ApiResponse({
    status: 200,
    description: 'Review updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid rating',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only update your own reviews',
  })
  @ApiResponse({
    status: 404,
    description: 'Review not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateReview(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') reviewId: string,
    @Body(ValidationPipe) updateData: UpdateReviewDto,
  ) {
    return this.userService.updateReview(req.user.id, reviewId, updateData);
  }

  @Delete('reviews/:id')
  @ApiOperation({ summary: 'Delete review' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({
    status: 200,
    description: 'Review deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only delete your own reviews',
  })
  @ApiResponse({
    status: 404,
    description: 'Review not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async deleteReview(
    @Request() req: { user: UserWithoutPassword },
    @Param('id') reviewId: string,
  ) {
    return this.userService.deleteReview(req.user.id, reviewId);
  }

  // Fraud Report Management
  @Post('fraud-reports')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a fraud report' })
  @ApiBody({ type: CreateFraudReportDto })
  @ApiResponse({
    status: 201,
    description: 'Fraud report created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Already reported this business',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async createFraudReport(
    @Request() req: { user: UserWithoutPassword },
    @Body(ValidationPipe) reportData: CreateFraudReportDto,
  ) {
    return this.userService.createFraudReport(req.user.id, reportData);
  }

  @Get('fraud-reports')
  @ApiOperation({ summary: 'Get user fraud reports' })
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
  @ApiResponse({
    status: 200,
    description: 'User fraud reports retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getUserFraudReports(
    @Request() req: { user: UserWithoutPassword },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.userService.getUserFraudReports(req.user.id, page, limit);
  }
}

@ApiTags('Business')
@Controller('businesses')
export class BusinessController {
  constructor(private readonly userService: UserService) {}

  // Public Business Search
  @Get()
  @ApiOperation({ summary: 'Search businesses' })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Business category',
  })
  @ApiQuery({
    name: 'isVerified',
    required: false,
    type: Boolean,
    description: 'Filter by verification status',
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
  @ApiResponse({
    status: 200,
    description: 'Businesses retrieved successfully',
  })
  async searchBusinesses(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('isVerified') isVerified?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.userService.searchBusinesses(
      search,
      category,
      isVerified,
      page,
      limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get business details' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({
    status: 200,
    description: 'Business details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found or not active',
  })
  async getBusinessDetails(@Param('id') businessId: string) {
    return this.userService.getBusinessDetails(businessId);
  }

  // Review Reply Endpoints
  @Post('reviews/:reviewId/replies')
  @ApiOperation({ summary: 'Reply to a review (Business owners only)' })
  @ApiParam({ name: 'reviewId', description: 'Review ID' })
  @ApiBody({ type: CreateReviewReplyDto })
  @ApiResponse({
    status: 201,
    description: 'Review reply created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Only business owners can reply to reviews',
  })
  @ApiResponse({
    status: 404,
    description: 'Review not found',
  })
  async createReviewReply(
    @Param('reviewId') reviewId: string,
    @Body() createReplyDto: CreateReviewReplyDto,
    @Request() req: { user: UserWithoutPassword },
  ) {
    return this.userService.createReviewReply(
      req.user.id,
      reviewId,
      createReplyDto,
    );
  }

  @Put('replies/:replyId')
  @ApiOperation({ summary: 'Update a review reply' })
  @ApiParam({ name: 'replyId', description: 'Reply ID' })
  @ApiBody({ type: UpdateReviewReplyDto })
  @ApiResponse({
    status: 200,
    description: 'Review reply updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'You can only update your own replies',
  })
  @ApiResponse({
    status: 404,
    description: 'Reply not found',
  })
  async updateReviewReply(
    @Param('replyId') replyId: string,
    @Body() updateReplyDto: UpdateReviewReplyDto,
    @Request() req: { user: UserWithoutPassword },
  ) {
    return this.userService.updateReviewReply(
      req.user.id,
      replyId,
      updateReplyDto,
    );
  }

  @Delete('replies/:replyId')
  @ApiOperation({ summary: 'Delete a review reply' })
  @ApiParam({ name: 'replyId', description: 'Reply ID' })
  @ApiResponse({
    status: 200,
    description: 'Review reply deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'You can only delete your own replies',
  })
  @ApiResponse({
    status: 404,
    description: 'Reply not found',
  })
  async deleteReviewReply(
    @Param('replyId') replyId: string,
    @Request() req: { user: UserWithoutPassword },
  ) {
    return this.userService.deleteReviewReply(req.user.id, replyId);
  }

  @Get('reviews/:reviewId/replies')
  @ApiOperation({ summary: 'Get all replies for a review' })
  @ApiParam({ name: 'reviewId', description: 'Review ID' })
  @ApiResponse({
    status: 200,
    description: 'Review replies retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Review not found',
  })
  async getReviewReplies(@Param('reviewId') reviewId: string) {
    return this.userService.getReviewReplies(reviewId);
  }
}
