import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FraudDetectionService } from '../shared/fraud-detection/fraud-detection.service';
import { OCRService } from '../shared/ocr/ocr.service';
import { CloudinaryService } from '../shared/cloudinary/cloudinary.service';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  AddPaymentMethodDto,
  CreateBusinessCategoryDto,
  UpdateBusinessCategoryDto,
  SubmitForReviewDto,
  VerifyDocumentDto,
} from './dto/business.dto';
import { DocumentType } from '@prisma/client';

export interface BusinessSearchDto {
  query?: string;
  category?: string;
  location?: string;
  minRating?: number;
  isVerified?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fraudDetectionService: FraudDetectionService,
    private readonly ocrService: OCRService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // Business CRUD Operations
  async createBusiness(userId: string, businessData: CreateBusinessDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // If user is not a business owner, upgrade their role
      if (user.role !== 'BUSINESS_OWNER' && user.role !== 'ADMIN') {
        await this.prisma.user.update({
          where: { id: userId },
          data: { role: 'BUSINESS_OWNER' },
        });
        this.logger.log(`User role upgraded to BUSINESS_OWNER: ${userId}`);
      }

      const business = await this.prisma.business.create({
        data: {
          ...businessData,
          ownerId: userId,
          status: 'PENDING',
          onboardingStep: 1,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          businessCategory: true,
        },
      });

      this.logger.log(`Business created: ${business.id} by user: ${userId}`);
      return business;
    } catch (error) {
      this.logger.error('Error creating business:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create business');
    }
  }

  async getUserBusinesses(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const skip = (page - 1) * limit;

      const [businesses, total] = await Promise.all([
        this.prisma.business.findMany({
          where: { ownerId: userId },
          skip,
          take: limit,
          include: {
            trustScore: true,
            businessCategory: true,
            _count: {
              select: {
                reviews: true,
                documents: true,
                payments: true,
                fraudReports: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.business.count({ where: { ownerId: userId } }),
      ]);

      return {
        businesses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching user businesses:', error);
      throw new InternalServerErrorException('Failed to fetch businesses');
    }
  }

  async getBusinessById(businessId: string, userId?: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          businessCategory: true,
          trustScore: true,
          reviews: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  reputation: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          documents: {
            where: { verified: true },
            orderBy: { uploadedAt: 'desc' },
          },
          payments: {
            where: { verified: true },
            orderBy: { addedAt: 'desc' },
          },
          _count: {
            select: {
              reviews: { where: { isActive: true } },
              documents: true,
              payments: true,
              fraudReports: true,
            },
          },
        },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      // Check if user is the owner for additional data
      const isOwner = userId && business.ownerId === userId;

      if (!isOwner) {
        // Remove sensitive data for non-owners
        business.owner = null;
        business.documents = business.documents.filter((d) => d.verified);
        business.payments = business.payments.filter((p) => p.verified);
      }

      return business;
    } catch (error) {
      this.logger.error('Error fetching business:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch business');
    }
  }

  async updateBusiness(
    userId: string,
    businessId: string,
    updateData: UpdateBusinessDto,
  ) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException('You can only update your own businesses');
      }

      const updatedBusiness = await this.prisma.business.update({
        where: { id: businessId },
        data: updateData,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          businessCategory: true,
        },
      });

      this.logger.log(`Business updated: ${businessId} by user: ${userId}`);
      return updatedBusiness;
    } catch (error) {
      this.logger.error('Error updating business:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update business');
    }
  }

  async deleteBusiness(userId: string, businessId: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException('You can only delete your own businesses');
      }

      await this.prisma.business.delete({
        where: { id: businessId },
      });

      this.logger.log(`Business deleted: ${businessId} by user: ${userId}`);
      return { message: 'Business deleted successfully' };
    } catch (error) {
      this.logger.error('Error deleting business:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete business');
    }
  }

  // Business Search and Discovery
  async searchBusinesses(searchParams: BusinessSearchDto) {
    try {
      const {
        query,
        category,
        location,
        minRating,
        isVerified,
        page = 1,
        limit = 10,
      } = searchParams;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: {
        isActive: boolean;
        OR?: Array<{
          name?: { contains: string; mode: 'insensitive' };
          description?: { contains: string; mode: 'insensitive' };
          location?: { contains: string; mode: 'insensitive' };
        }>;
        businessCategoryId?: string;
        location?: { contains: string; mode: 'insensitive' };
        isVerified?: boolean;
        reviews?: {
          some: {
            rating: { gte: number };
            isActive: boolean;
          };
        };
      } = {
        isActive: true,
      };

      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { location: { contains: query, mode: 'insensitive' } },
        ];
      }

      if (category) {
        where.businessCategoryId = category;
      }

      if (location) {
        where.location = { contains: location, mode: 'insensitive' };
      }

      if (isVerified !== undefined) {
        where.isVerified = isVerified;
      }

      if (minRating) {
        where.reviews = {
          some: {
            rating: { gte: minRating },
            isActive: true,
          },
        };
      }

      const [businesses, total] = await Promise.all([
        this.prisma.business.findMany({
          where,
          skip,
          take: limit,
          include: {
            businessCategory: true,
            trustScore: true,
            _count: {
              select: {
                reviews: { where: { isActive: true } },
              },
            },
          },
          orderBy: [
            { isVerified: 'desc' },
            { trustScore: { score: 'desc' } },
            { createdAt: 'desc' },
          ],
        }),
        this.prisma.business.count({ where }),
      ]);

      // Calculate average ratings
      const businessesWithRatings = await Promise.all(
        businesses.map(async (business) => {
          const avgRating = await this.prisma.review.aggregate({
            where: {
              businessId: business.id,
              isActive: true,
            },
            _avg: { rating: true },
          });

          return {
            ...business,
            averageRating: avgRating._avg.rating || 0,
          };
        }),
      );

      return {
        businesses: businessesWithRatings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error searching businesses:', error);
      throw new InternalServerErrorException('Failed to search businesses');
    }
  }

  async getFeaturedBusinesses(limit: number = 10) {
    try {
      const businesses = await this.prisma.business.findMany({
        where: {
          isActive: true,
          isVerified: true,
        },
        take: limit,
        include: {
          businessCategory: true,
          trustScore: true,
          _count: {
            select: {
              reviews: { where: { isActive: true } },
            },
          },
        },
        orderBy: [{ trustScore: { score: 'desc' } }, { createdAt: 'desc' }],
      });

      // Calculate average ratings
      const businessesWithRatings = await Promise.all(
        businesses.map(async (business) => {
          const avgRating = await this.prisma.review.aggregate({
            where: {
              businessId: business.id,
              isActive: true,
            },
            _avg: { rating: true },
          });

          return {
            ...business,
            averageRating: avgRating._avg.rating || 0,
          };
        }),
      );

      return businessesWithRatings;
    } catch (error) {
      this.logger.error('Error fetching featured businesses:', error);
      throw new InternalServerErrorException(
        'Failed to fetch featured businesses',
      );
    }
  }

  async getBusinessesByCategory(
    categoryId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const skip = (page - 1) * limit;

      const [businesses, total] = await Promise.all([
        this.prisma.business.findMany({
          where: {
            businessCategoryId: categoryId,
            isActive: true,
          },
          skip,
          take: limit,
          include: {
            businessCategory: true,
            trustScore: true,
            _count: {
              select: {
                reviews: { where: { isActive: true } },
              },
            },
          },
          orderBy: [{ isVerified: 'desc' }, { trustScore: { score: 'desc' } }],
        }),
        this.prisma.business.count({
          where: {
            businessCategoryId: categoryId,
            isActive: true,
          },
        }),
      ]);

      // Calculate average ratings
      const businessesWithRatings = await Promise.all(
        businesses.map(async (business) => {
          const avgRating = await this.prisma.review.aggregate({
            where: {
              businessId: business.id,
              isActive: true,
            },
            _avg: { rating: true },
          });

          return {
            ...business,
            averageRating: avgRating._avg.rating || 0,
          };
        }),
      );

      return {
        businesses: businessesWithRatings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching businesses by category:', error);
      throw new InternalServerErrorException(
        'Failed to fetch businesses by category',
      );
    }
  }

  // Document Management
  async uploadDocument(
    userId: string,
    businessId: string,
    file: any,
    documentType: string,
  ) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException(
          'You can only upload documents for your own businesses',
        );
      }

      // Validate file parameter
      if (!file || typeof file !== 'object') {
        throw new BadRequestException('Invalid file provided');
      }

      const fileObj = file as {
        originalname: string;
        size: number;
        mimetype: string;
        buffer: Buffer;
      };

      if (
        !fileObj.originalname ||
        !fileObj.size ||
        !fileObj.mimetype ||
        !fileObj.buffer
      ) {
        throw new BadRequestException('Invalid file properties');
      }

      // Upload file to Cloudinary
      this.logger.log(`Uploading file to Cloudinary: ${fileObj.originalname}`);
      const cloudinaryResult = await this.cloudinaryService.uploadFile(
        fileObj,
        {
          folder: `businesses/${businessId}/documents`,
          tags: ['business-document', documentType.toLowerCase()],
          resource_type: 'auto',
        },
      );

      // Create document record in database
      const document = await this.prisma.document.create({
        data: {
          type: documentType as DocumentType,
          url: cloudinaryResult.secure_url,
          name: fileObj.originalname,
          size: fileObj.size,
          mimeType: fileObj.mimetype,
          businessId: businessId,
          uploadedAt: new Date(),
        },
      });

      // Process document with OCR and AI verification asynchronously
      this.processDocumentWithAI(
        document.id,
        cloudinaryResult.secure_url,
      ).catch((error) => {
        this.logger.error(
          `Failed to process document ${document.id} with AI:`,
          error,
        );
      });

      this.logger.log(
        `Document uploaded: ${document.id} for business: ${businessId}`,
      );
      return document;
    } catch (error) {
      this.logger.error('Error uploading document:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to upload document');
    }
  }

  /**
   * Process document with OCR and AI verification
   */
  private async processDocumentWithAI(documentId: string, documentUrl: string) {
    try {
      this.logger.log(`Processing document ${documentId} with AI`);

      // Check OCR service health first
      const healthCheck = this.ocrService.healthCheck();
      if (!healthCheck.configured) {
        this.logger.warn(
          `OCR service not properly configured: ${healthCheck.message}`,
        );
      }

      // Step 1: Extract text using OCR with fallback (Google Vision -> OCR.space)
      const ocrResult =
        await this.ocrService.extractTextWithFallback(documentUrl);

      // Step 2: Analyze document content
      const analysisResult = await this.ocrService.analyzeDocument(ocrResult);

      // Step 3: Verify document authenticity
      const authenticityResult = this.ocrService.verifyDocumentAuthenticity(
        ocrResult,
        analysisResult,
      );

      // Update document with OCR and AI results
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          ocrConfidence: ocrResult.confidence,
          aiAnalysis: {
            documentType: analysisResult.documentType,
            extractedData: analysisResult.extractedData,
            confidence: analysisResult.confidence,
            isValid: analysisResult.isValid,
            validationErrors: analysisResult.validationErrors,
            warnings: analysisResult.warnings,
            authenticityScore: analysisResult.authenticityScore,
            fraudIndicators: analysisResult.fraudIndicators,
            securityFeatures: analysisResult.securityFeatures,
            verificationChecklist: analysisResult.verificationChecklist,
            authenticity: authenticityResult,
            ocrText: ocrResult.text, // Store OCR text in aiAnalysis
          },
          aiVerified: authenticityResult.isAuthentic && analysisResult.isValid,
          aiVerifiedAt: new Date(),
          extractedData: analysisResult.extractedData,
        },
      });

      this.logger.log(`Document ${documentId} processed successfully with AI`);
    } catch (error) {
      this.logger.error(
        `Error processing document ${documentId} with AI:`,
        error,
      );

      // Update document with error status
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          aiAnalysis: {
            error: (error as Error).message,
            processedAt: new Date(),
          },
        },
      });
    }
  }

  async getDocumentProcessingStatus(
    userId: string,
    businessId: string,
    documentId: string,
  ) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException(
          'You can only view document status for your own businesses',
        );
      }

      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          aiAnalysis: true,
          aiVerified: true,
          aiVerifiedAt: true,
          ocrConfidence: true,
          extractedData: true,
        },
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      const docWithAI = document as typeof document & {
        aiAnalysis?: any;
        aiVerified?: boolean;
        aiVerifiedAt?: Date | null;
        ocrConfidence?: number | null;
        extractedData?: unknown;
      };

      // Determine processing status
      let processingStatus = 'processing';
      if (docWithAI.aiAnalysis) {
        if (docWithAI.aiAnalysis.error) {
          processingStatus = 'failed';
        } else {
          processingStatus = 'completed';
        }
      }

      return {
        documentId: docWithAI.id,
        processingStatus,
        aiVerified: docWithAI.aiVerified,
        aiVerifiedAt: docWithAI.aiVerifiedAt,
        ocrConfidence: docWithAI.ocrConfidence,
        extractedData: docWithAI.extractedData,
        aiAnalysis: docWithAI.aiAnalysis,
      };
    } catch (error) {
      this.logger.error('Error fetching document processing status:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch document processing status',
      );
    }
  }

  async getBusinessDocuments(userId: string, businessId: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException(
          'You can only view documents for your own businesses',
        );
      }

      const documents = await this.prisma.document.findMany({
        where: { businessId: businessId },
        orderBy: { uploadedAt: 'desc' },
      });

      return documents;
    } catch (error) {
      this.logger.error('Error fetching business documents:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch documents');
    }
  }

  async deleteDocument(userId: string, documentId: string) {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: {
          business: true,
        },
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      if (document.business.ownerId !== userId) {
        throw new ForbiddenException(
          'You can only delete documents for your own businesses',
        );
      }

      await this.prisma.document.delete({
        where: { id: documentId },
      });

      this.logger.log(`Document deleted: ${documentId} by user: ${userId}`);
      return { message: 'Document deleted successfully' };
    } catch (error) {
      this.logger.error('Error deleting document:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete document');
    }
  }

  // Payment Method Management
  async addPaymentMethod(
    userId: string,
    businessId: string,
    paymentData: AddPaymentMethodDto,
  ) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException(
          'You can only add payment methods for your own businesses',
        );
      }

      const payment = await this.prisma.payment.create({
        data: {
          type: paymentData.type,
          number: paymentData.number,
          businessId: businessId,
        },
      });

      this.logger.log(
        `Payment method added: ${payment.id} for business: ${businessId}`,
      );
      return payment;
    } catch (error) {
      this.logger.error('Error adding payment method:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to add payment method');
    }
  }

  async getBusinessPaymentMethods(userId: string, businessId: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException(
          'You can only view payment methods for your own businesses',
        );
      }

      const payments = await this.prisma.payment.findMany({
        where: { businessId: businessId },
        orderBy: { addedAt: 'desc' },
      });

      return payments;
    } catch (error) {
      this.logger.error('Error fetching business payment methods:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch payment methods');
    }
  }

  async deletePaymentMethod(userId: string, paymentId: string) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          business: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment method not found');
      }

      if (payment.business.ownerId !== userId) {
        throw new ForbiddenException(
          'You can only delete payment methods for your own businesses',
        );
      }

      await this.prisma.payment.delete({
        where: { id: paymentId },
      });

      this.logger.log(
        `Payment method deleted: ${paymentId} by user: ${userId}`,
      );
      return { message: 'Payment method deleted successfully' };
    } catch (error) {
      this.logger.error('Error deleting payment method:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete payment method');
    }
  }

  // Onboarding Status Management
  async getOnboardingStatus(userId: string, businessId: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: {
          documents: {
            select: {
              id: true,
              type: true,
              name: true,
              aiVerified: true,
              uploadedAt: true,
            },
          },
          payments: {
            select: {
              id: true,
              type: true,
              number: true,
              addedAt: true,
            },
          },
        },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException(
          'You can only view onboarding status for your own businesses',
        );
      }

      const businessWithRelations = business as typeof business & {
        documents: Array<{ aiVerified?: boolean }>;
        payments: Array<unknown>;
      };

      // Calculate onboarding progress
      const totalSteps = 4;
      let completedSteps = 0;

      // Step 1: Business Profile (basic info completed)
      if (business.name && business.description && business.phone) {
        completedSteps++;
      }

      // Step 2: At least one document uploaded and verified (flexible requirement)
      const verifiedDocuments = businessWithRelations.documents.filter(
        (doc) => doc.aiVerified,
      );
      if (verifiedDocuments.length > 0) {
        completedSteps++;
      }

      // Step 3: Payment methods added
      if (businessWithRelations.payments.length > 0) {
        completedSteps++;
      }

      // Step 4: Submitted for review
      if (
        business.status === 'UNDER_REVIEW' ||
        business.status === 'VERIFIED'
      ) {
        completedSteps++;
      }

      const progressPercentage = Math.round(
        (completedSteps / totalSteps) * 100,
      );

      return {
        businessId: business.id,
        currentStep: business.onboardingStep || 1,
        totalSteps,
        completedSteps,
        progressPercentage,
        status: business.status,
        submittedForReview: business.submittedForReview || false,
        documents: {
          total: businessWithRelations.documents.length,
          verified: verifiedDocuments.length,
          pending: businessWithRelations.documents.filter(
            (doc) => !doc.aiVerified,
          ).length,
        },
        paymentMethods: {
          total: businessWithRelations.payments.length,
        },
        canSubmit: completedSteps >= 3, // Can submit after 3 steps
        nextAction: this.getNextOnboardingAction(business, completedSteps),
      };
    } catch (error) {
      this.logger.error('Error fetching onboarding status:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch onboarding status',
      );
    }
  }

  private getNextOnboardingAction(
    business: any,
    completedSteps: number,
  ): string {
    if (completedSteps === 0) {
      return 'Complete your business profile information';
    } else if (completedSteps === 1) {
      return 'Upload and verify at least one business document (Business Registration Certificate or Tax Certificate)';
    } else if (completedSteps === 2) {
      return 'Add payment methods for transactions';
    } else if (completedSteps === 3) {
      return 'Submit your business for verification review';
    } else {
      return 'Onboarding completed!';
    }
  }

  // Trust Score Management
  async calculateTrustScore(businessId: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: {
          reviews: {
            where: { isActive: true },
          },
          documents: {
            where: { verified: true },
          },
          payments: {
            where: { verified: true },
          },
          fraudReports: {
            where: { status: 'RESOLVED' },
          },
        },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      let score = 0;
      const factors: Record<string, any> = {};

      // Base score from verification status
      if (business.isVerified) {
        score += 20;
        factors.verified = 20;
      }

      // Score from reviews (weighted by verification status)
      if (business.reviews.length > 0) {
        const verifiedReviews = business.reviews.filter(
          (review) => review.isVerified,
        );
        const unverifiedReviews = business.reviews.filter(
          (review) => !review.isVerified,
        );

        // Calculate weighted average rating
        let weightedRatingSum = 0;
        let totalWeight = 0;

        // Verified reviews get 2x weight
        verifiedReviews.forEach((review) => {
          weightedRatingSum += review.rating * 2;
          totalWeight += 2;
        });

        // Unverified reviews get 1x weight
        unverifiedReviews.forEach((review) => {
          weightedRatingSum += review.rating;
          totalWeight += 1;
        });

        const avgRating = totalWeight > 0 ? weightedRatingSum / totalWeight : 0;
        const reviewScore = Math.min(avgRating * 8, 40); // Max 40 points from reviews

        // Bonus points for verified reviews
        const verificationBonus = Math.min(verifiedReviews.length * 2, 10); // Max 10 bonus points
        const totalReviewScore = reviewScore + verificationBonus;

        score += totalReviewScore;
        factors.reviews = {
          averageRating: avgRating,
          totalReviews: business.reviews.length,
          verifiedReviews: verifiedReviews.length,
          unverifiedReviews: unverifiedReviews.length,
          verificationRate:
            business.reviews.length > 0
              ? (verifiedReviews.length / business.reviews.length) * 100
              : 0,
          baseScore: reviewScore,
          verificationBonus: verificationBonus,
          totalScore: totalReviewScore,
        };
      }

      // Score from verified documents
      const documentScore = Math.min(business.documents.length * 5, 20); // Max 20 points from documents
      score += documentScore;
      factors.documents = {
        count: business.documents.length,
        score: documentScore,
      };

      // Score from verified payment methods
      const paymentScore = Math.min(business.payments.length * 3, 15); // Max 15 points from payments
      score += paymentScore;
      factors.payments = {
        count: business.payments.length,
        score: paymentScore,
      };

      // Penalty for fraud reports
      const fraudPenalty = Math.min(business.fraudReports.length * 5, 25); // Max 25 point penalty
      score -= fraudPenalty;
      factors.fraudReports = {
        count: business.fraudReports.length,
        penalty: fraudPenalty,
      };

      // Ensure score is between 0 and 100
      score = Math.max(0, Math.min(100, score));

      // Determine grade
      let grade: string;
      if (score >= 90) grade = 'A+';
      else if (score >= 80) grade = 'A';
      else if (score >= 70) grade = 'B';
      else if (score >= 60) grade = 'C';
      else if (score >= 50) grade = 'D';
      else grade = 'F';

      // Update or create trust score
      const trustScore = await this.prisma.trustScore.upsert({
        where: { businessId: businessId },
        update: {
          grade,
          score: Math.round(score),
          factors,
        },
        create: {
          businessId: businessId,
          grade,
          score: Math.round(score),
          factors,
        },
      });

      this.logger.log(
        `Trust score calculated for business: ${businessId} - Grade: ${grade}, Score: ${Math.round(score)}`,
      );
      return trustScore;
    } catch (error) {
      this.logger.error('Error calculating trust score:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to calculate trust score');
    }
  }

  async getTrustScore(businessId: string) {
    try {
      const trustScore = await this.prisma.trustScore.findUnique({
        where: { businessId: businessId },
      });

      if (!trustScore) {
        // Calculate if doesn't exist
        return this.calculateTrustScore(businessId);
      }

      return trustScore;
    } catch (error) {
      this.logger.error('Error fetching trust score:', error);
      throw new InternalServerErrorException('Failed to fetch trust score');
    }
  }

  // Business Category Management
  async createBusinessCategory(categoryData: CreateBusinessCategoryDto) {
    try {
      const category = await this.prisma.businessCategory.create({
        data: categoryData,
      });

      this.logger.log(`Business category created: ${category.id}`);
      return category;
    } catch (error) {
      this.logger.error('Error creating business category:', error);
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException(
          'Business category with this name already exists',
        );
      }
      throw new InternalServerErrorException(
        'Failed to create business category',
      );
    }
  }

  async getAllBusinessCategories() {
    try {
      const categories = await this.prisma.businessCategory.findMany({
        include: {
          _count: {
            select: {
              businesses: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      return categories;
    } catch (error) {
      this.logger.error('Error fetching business categories:', error);
      throw new InternalServerErrorException(
        'Failed to fetch business categories',
      );
    }
  }

  async updateBusinessCategory(
    categoryId: string,
    updateData: UpdateBusinessCategoryDto,
  ) {
    try {
      const category = await this.prisma.businessCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        throw new NotFoundException('Business category not found');
      }

      const updatedCategory = await this.prisma.businessCategory.update({
        where: { id: categoryId },
        data: updateData,
      });

      this.logger.log(`Business category updated: ${categoryId}`);
      return updatedCategory;
    } catch (error) {
      this.logger.error('Error updating business category:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException(
          'Business category with this name already exists',
        );
      }
      throw new InternalServerErrorException(
        'Failed to update business category',
      );
    }
  }

  async deleteBusinessCategory(categoryId: string) {
    try {
      const category = await this.prisma.businessCategory.findUnique({
        where: { id: categoryId },
        include: {
          _count: {
            select: {
              businesses: true,
            },
          },
        },
      });

      if (!category) {
        throw new NotFoundException('Business category not found');
      }

      if (category._count.businesses > 0) {
        throw new BadRequestException(
          'Cannot delete category with associated businesses',
        );
      }

      await this.prisma.businessCategory.delete({
        where: { id: categoryId },
      });

      this.logger.log(`Business category deleted: ${categoryId}`);
      return { message: 'Business category deleted successfully' };
    } catch (error) {
      this.logger.error('Error deleting business category:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to delete business category',
      );
    }
  }

  // Business Analytics
  async getBusinessAnalytics(userId: string, businessId: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException(
          'You can only view analytics for your own businesses',
        );
      }

      const [
        totalReviews,
        averageRating,
        totalDocuments,
        verifiedDocuments,
        totalPayments,
        verifiedPayments,
        totalFraudReports,
        trustScore,
      ] = await Promise.all([
        this.prisma.review.count({
          where: { businessId: businessId, isActive: true },
        }),
        this.prisma.review.aggregate({
          where: { businessId: businessId, isActive: true },
          _avg: { rating: true },
        }),
        this.prisma.document.count({ where: { businessId: businessId } }),
        this.prisma.document.count({
          where: { businessId: businessId, verified: true },
        }),
        this.prisma.payment.count({ where: { businessId: businessId } }),
        this.prisma.payment.count({
          where: { businessId: businessId, verified: true },
        }),
        this.prisma.fraudReport.count({ where: { businessId: businessId } }),
        this.getTrustScore(businessId),
      ]);

      return {
        business: {
          id: business.id,
          name: business.name,
          isVerified: business.isVerified,
          isActive: business.isActive,
        },
        reviews: {
          total: totalReviews,
          averageRating: averageRating._avg.rating || 0,
        },
        documents: {
          total: totalDocuments,
          verified: verifiedDocuments,
          verificationRate:
            totalDocuments > 0 ? (verifiedDocuments / totalDocuments) * 100 : 0,
        },
        payments: {
          total: totalPayments,
          verified: verifiedPayments,
          verificationRate:
            totalPayments > 0 ? (verifiedPayments / totalPayments) * 100 : 0,
        },
        fraudReports: {
          total: totalFraudReports,
        },
        trustScore: {
          grade: trustScore.grade,
          score: trustScore.score,
          factors: trustScore.factors,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching business analytics:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch business analytics',
      );
    }
  }

  // Onboarding Workflow Methods
  async updateOnboardingStep(userId: string, businessId: string, step: number) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException('You can only update your own businesses');
      }

      // Validate step number
      if (step < 1 || step > 4) {
        throw new BadRequestException('Step must be between 1 and 4');
      }

      const updatedBusiness = await this.prisma.business.update({
        where: { id: businessId },
        data: { onboardingStep: step },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          businessCategory: true,
        },
      });

      this.logger.log(
        `Business onboarding step updated: ${businessId} -> step ${step}`,
      );
      return updatedBusiness;
    } catch (error) {
      this.logger.error('Error updating onboarding step:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update onboarding step',
      );
    }
  }

  async submitForReview(
    userId: string,
    businessId: string,
    submitData: SubmitForReviewDto,
  ) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: {
          documents: {
            select: {
              id: true,
              type: true,
              name: true,
              url: true,
              verified: true,
              aiAnalysis: true,
              aiVerified: true,
              uploadedAt: true,
            },
          },
          payments: true,
        },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      if (business.ownerId !== userId) {
        throw new ForbiddenException('You can only submit your own businesses');
      }

      const businessWithRelations = business as typeof business & {
        documents: Array<{ aiAnalysis?: unknown }>;
        payments: Array<unknown>;
      };

      // Check if business has at least one document (flexible requirement - either business registration OR tax certificate)
      if (businessWithRelations.documents.length === 0) {
        throw new BadRequestException(
          'At least one business document is required (Business Registration Certificate or Tax Certificate)',
        );
      }

      // Check if the uploaded document has been processed by AI
      const processedDocument = businessWithRelations.documents.find(
        (doc) => doc.aiAnalysis,
      );
      if (!processedDocument) {
        throw new BadRequestException(
          'Document is still being processed by AI. Please wait a moment and try again.',
        );
      }

      // Check if business has at least one payment method
      if (businessWithRelations.payments.length === 0) {
        throw new BadRequestException(
          'At least one payment method is required',
        );
      }

      const updatedBusiness = await this.prisma.business.update({
        where: { id: businessId },
        data: {
          status: 'UNDER_REVIEW',
          submittedForReview: true,
          onboardingStep: 4,
          reviewNotes: submitData.notes,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          businessCategory: true,
        },
      });

      this.logger.log(`Business submitted for review: ${businessId}`);
      return updatedBusiness;
    } catch (error) {
      this.logger.error('Error submitting business for review:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to submit business for review',
      );
    }
  }

  async verifyDocument(
    adminUserId: string,
    documentId: string,
    verifyData: VerifyDocumentDto,
  ) {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: {
          business: true,
        },
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      const updatedDocument = await this.prisma.document.update({
        where: { id: documentId },
        data: {
          verified: verifyData.verified,
          verifiedAt: verifyData.verified ? new Date() : null,
          verifiedBy: verifyData.verified ? adminUserId : null,
          verificationNotes: verifyData.notes,
        },
      });

      this.logger.log(
        `Document verification updated: ${documentId} -> ${verifyData.verified}`,
      );
      return updatedDocument;
    } catch (error) {
      this.logger.error('Error verifying document:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to verify document');
    }
  }
}
