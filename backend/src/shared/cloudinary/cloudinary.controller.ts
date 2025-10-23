import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CloudinaryService,
  CloudinaryUploadOptions,
} from './cloudinary.service';
import { AiService } from '../ai/ai.service';

@Controller('cloudinary')
export class CloudinaryController {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Health check endpoint to verify Cloudinary configuration
   */
  @Public()
  @Get('health')
  async healthCheck() {
    try {
      // Try to get account info to verify credentials
      await this.cloudinaryService
        .getFileInfo('test', 'image')
        .catch(() => null);
      return {
        success: true,
        message: 'Cloudinary service is configured and ready',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Cloudinary service is not properly configured',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Upload a single file with real-time scanning
   */
  @Public()
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, callback) => {
        console.log('File filter check:', {
          originalname: file.originalname,
          mimetype: file.mimetype,
          fieldname: file.fieldname,
          size: file.size,
        });

        // Allow images and documents
        if (
          file.mimetype.startsWith('image/') ||
          file.mimetype === 'application/pdf' ||
          file.mimetype === 'application/msword' ||
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
          console.log('File type accepted:', file.mimetype);
          callback(null, true);
        } else {
          console.log('File type rejected:', file.mimetype);
          callback(new BadRequestException('File type not supported'), false);
        }
      },
    }),
  )
  async uploadFile(
    @UploadedFile()
    file: { buffer: Buffer; originalname: string; mimetype: string },
    @Body() body: Record<string, unknown>,
  ) {
    console.log('=== UPLOAD REQUEST START ===');
    console.log('Request body keys:', Object.keys(body || {}));
    console.log('File received:', {
      fileName: file?.originalname,
      fileSize: file?.buffer?.length,
      mimeType: file?.mimetype,
      hasBuffer: !!file?.buffer,
      bufferLength: file?.buffer?.length,
    });

    // Parse options from the request body
    let options: CloudinaryUploadOptions & { scanDocument?: boolean } = {};
    try {
      if (body && typeof body === 'object' && 'options' in body) {
        const bodyOptions = body.options;
        console.log('Raw options from body:', bodyOptions);
        if (typeof bodyOptions === 'string') {
          options = JSON.parse(bodyOptions) as CloudinaryUploadOptions & {
            scanDocument?: boolean;
          };
        } else if (bodyOptions && typeof bodyOptions === 'object') {
          options = bodyOptions as CloudinaryUploadOptions & {
            scanDocument?: boolean;
          };
        }
        console.log('Parsed options:', options);
      }
    } catch (error) {
      console.warn('Failed to parse options:', error);
      options = {};
    }

    console.log('Final upload configuration:', {
      fileName: file?.originalname,
      fileSize: file?.buffer?.length,
      mimeType: file?.mimetype,
      options,
    });

    if (!file) {
      console.error('No file provided in request');
      throw new BadRequestException('No file provided');
    }

    if (!file.buffer || file.buffer.length === 0) {
      console.error('File buffer is empty or missing');
      throw new BadRequestException('File buffer is empty');
    }

    try {
      const result = await this.cloudinaryService.uploadFile(file, options);

      let scanResult: unknown = null;

      // Perform real-time scanning if requested and file is an image
      if (options.scanDocument && file.mimetype.startsWith('image/')) {
        try {
          scanResult = await this.aiService.scanDocumentRealTime(
            result.secure_url,
          );
        } catch (scanError) {
          console.warn('Document scanning failed:', scanError);
          // Continue with upload even if scanning fails
        }
      }

      return {
        success: true,
        data: {
          publicId: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.bytes,
          createdAt: result.created_at,
          scanResult, // Include scanning results
        },
      };
    } catch (error) {
      console.error('=== CLOUDINARY UPLOAD ERROR ===');
      console.error('Error object:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        fileName: file?.originalname,
        fileSize: file?.buffer?.length,
        mimeType: file?.mimetype,
        hasBuffer: !!file?.buffer,
      });

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      console.error('Throwing BadRequestException with message:', errorMessage);
      throw new BadRequestException(`Failed to upload file: ${errorMessage}`);
    }
  }

  /**
   * Upload from URL with real-time scanning
   */
  @Post('upload-url')
  async uploadFromUrl(
    @Body()
    body: {
      url: string;
      options?: CloudinaryUploadOptions & { scanDocument?: boolean };
    },
  ) {
    if (!body.url) {
      throw new BadRequestException('URL is required');
    }

    try {
      const result = await this.cloudinaryService.uploadFromUrl(
        body.url,
        body.options || {},
      );

      let scanResult: unknown = null;

      // Perform real-time scanning if requested
      if (body.options?.scanDocument) {
        try {
          scanResult = await this.aiService.scanDocumentRealTime(
            result.secure_url,
          );
        } catch (scanError) {
          console.warn('Document scanning failed:', scanError);
          // Continue with upload even if scanning fails
        }
      }

      return {
        success: true,
        data: {
          publicId: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.bytes,
          createdAt: result.created_at,
          scanResult, // Include scanning results
        },
      };
    } catch {
      throw new BadRequestException('Failed to upload from URL');
    }
  }

  /**
   * Get file information
   */
  @Get('info/:publicId')
  async getFileInfo(
    @Param('publicId') publicId: string,
    @Body() body: { resourceType?: string },
  ) {
    try {
      const info = await this.cloudinaryService.getFileInfo(
        publicId,
        body.resourceType || 'image',
      );
      return {
        success: true,
        data: info,
      };
    } catch {
      throw new NotFoundException('File not found');
    }
  }

  /**
   * Delete a file
   */
  @Delete(':publicId')
  async deleteFile(
    @Param('publicId') publicId: string,
    @Body() body: { resourceType?: string },
  ) {
    try {
      await this.cloudinaryService.deleteFile(
        publicId,
        body.resourceType || 'image',
      );
      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch {
      throw new BadRequestException('Failed to delete file');
    }
  }

  /**
   * Generate signed upload URL for direct client uploads
   */
  @Post('signed-url')
  generateSignedUploadUrl(
    @Body()
    body: {
      folder?: string;
      resourceType?: string;
      maxFileSize?: number;
    },
  ) {
    try {
      const result = this.cloudinaryService.generateSignedUploadUrl(
        body.folder || 'crediscore',
        body.resourceType || 'image',
        body.maxFileSize || 10 * 1024 * 1024,
      );
      return {
        success: true,
        data: result,
      };
    } catch {
      throw new BadRequestException('Failed to generate signed URL');
    }
  }

  /**
   * Get transformed image URL
   */
  @Post('transform')
  getTransformedUrl(
    @Body()
    body: {
      publicId: string;
      transformations?: Record<string, any>;
      resourceType?: string;
    },
  ) {
    if (!body.publicId) {
      throw new BadRequestException('Public ID is required');
    }

    try {
      const url = this.cloudinaryService.getTransformedUrl(
        body.publicId,
        body.transformations || {},
        body.resourceType || 'image',
      );
      return {
        success: true,
        data: { url },
      };
    } catch {
      throw new BadRequestException('Failed to generate transformed URL');
    }
  }

  /**
   * Get responsive image URLs
   */
  @Post('responsive')
  getResponsiveUrls(
    @Body()
    body: {
      publicId: string;
      baseTransformations?: Record<string, any>;
    },
  ) {
    if (!body.publicId) {
      throw new BadRequestException('Public ID is required');
    }

    try {
      const urls = this.cloudinaryService.getResponsiveImageUrls(
        body.publicId,
        body.baseTransformations || {},
      );
      return {
        success: true,
        data: urls,
      };
    } catch {
      throw new BadRequestException('Failed to generate responsive URLs');
    }
  }

  /**
   * Scan an existing document in real-time
   */
  @Post('scan/:publicId')
  async scanExistingDocument(
    @Param('publicId') publicId: string,
    @Body() body: { resourceType?: string },
  ) {
    try {
      // Get the file URL from Cloudinary
      const fileInfo = await this.cloudinaryService.getFileInfo(
        publicId,
        body.resourceType || 'image',
      );

      if (!fileInfo.secure_url) {
        throw new BadRequestException('File not found or not accessible');
      }

      // Perform real-time scanning
      const scanResult = await this.aiService.scanDocumentRealTime(
        fileInfo.secure_url as string,
      );

      return {
        success: true,
        data: {
          publicId,
          url: fileInfo.secure_url as string,
          scanResult,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to scan document');
    }
  }
}
