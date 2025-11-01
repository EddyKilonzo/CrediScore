import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

export interface CloudinaryUploadOptions {
  folder?: string;
  public_id?: string;
  overwrite?: boolean;
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
  transformation?: Record<string, any>[];
  tags?: string[];
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    this.logger.log('Cloudinary configuration check:', {
      cloudName: cloudName ? 'Set' : 'Missing',
      apiKey: apiKey ? 'Set' : 'Missing',
      apiSecret: apiSecret ? 'Set' : 'Missing',
    });

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.error('Cloudinary credentials not configured properly');
      this.logger.error('Missing:', {
        cloudName: !cloudName,
        apiKey: !apiKey,
        apiSecret: !apiSecret,
      });
      throw new Error('Cloudinary credentials are missing');
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    this.logger.log('Cloudinary configured successfully');
  }

  /**
   * Upload a file to Cloudinary
   */
  async uploadFile(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    options: CloudinaryUploadOptions = {},
  ): Promise<UploadApiResponse> {
    try {
      this.logger.log(
        `Uploading file: ${file.originalname} (${file.buffer.length} bytes)`,
      );

      const uploadOptions = {
        folder: options.folder || 'crediscore',
        resource_type: options.resource_type || 'auto',
        overwrite: options.overwrite || false,
        transformation: options.transformation || [],
        tags: options.tags || [],
        ...(options.public_id && { public_id: options.public_id }),
      };

      this.logger.log('Upload options:', uploadOptions);

      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            uploadOptions,
            (
              error: UploadApiErrorResponse | undefined,
              result: UploadApiResponse | undefined,
            ) => {
              if (error) {
                reject(
                  new Error(
                    `Upload failed: ${error.message || 'Unknown error'}`,
                  ),
                );
              } else if (result) {
                resolve(result);
              } else {
                reject(new Error('Upload failed: No result returned'));
              }
            },
          )
          .end(file.buffer);
      });

      this.logger.log(`File uploaded successfully: ${result.public_id}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to upload file to Cloudinary:', error);
      this.logger.error('Upload details:', {
        fileName: file.originalname,
        fileSize: file.buffer.length,
        mimeType: file.mimetype,
        options,
      });
      throw error;
    }
  }

  /**
   * Upload a file from URL
   */
  async uploadFromUrl(
    url: string,
    options: CloudinaryUploadOptions = {},
  ): Promise<UploadApiResponse> {
    try {
      const uploadOptions = {
        folder: options.folder || 'crediscore',
        resource_type: options.resource_type || 'auto',
        overwrite: options.overwrite || false,
        transformation: options.transformation || [],
        tags: options.tags || [],
        ...(options.public_id && { public_id: options.public_id }),
      };

      const result = await cloudinary.uploader.upload(url, uploadOptions);
      this.logger.log(
        `File uploaded from URL successfully: ${result.public_id}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to upload file from URL to Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Cloudinary
   */
  async deleteFile(
    publicId: string,
    resourceType: string = 'image',
  ): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      this.logger.log(`File deleted successfully: ${publicId}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${publicId}:`, error);
      throw error;
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(
    publicId: string,
    resourceType: string = 'image',
  ): Promise<Record<string, any>> {
    try {
      const result = (await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      })) as Record<string, any>;
      return result;
    } catch (error) {
      this.logger.error(`Failed to get file info for ${publicId}:`, error);
      throw error;
    }
  }

  /**
   * Generate a signed upload URL for direct client uploads
   */
  generateSignedUploadUrl(
    folder: string = 'crediscore',
    resourceType: string = 'image',
    maxFileSize: number = 10 * 1024 * 1024, // 10MB
    tags?: string[],
    transformation?: Record<string, any>,
  ): { uploadUrl: string; signature: string; timestamp: number } {
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Build parameters object for signature
    // NOTE: resource_type is NOT included in signature - it's part of the URL path
    // NOTE: max_file_size is NOT included in signature - Cloudinary doesn't validate it for signed uploads
    // Only include parameters that Cloudinary will validate in the signature
    // IMPORTANT: All values must be strings for Cloudinary signature generation
    const params: Record<string, any> = {
      timestamp: timestamp.toString(),
      folder: folder,
    };

    // max_file_size is sent in the upload but NOT included in signature
    // Cloudinary validates uploads based on the signature, but max_file_size is not part of the validation

    // Add tags if provided (must be comma-separated string for signature)
    // IMPORTANT: Only include tags in signature if they are provided
    if (tags && tags.length > 0) {
      // Join tags with comma - must match exactly what we send in FormData
      params.tags = tags.join(',');
    }

    // Note: Transformations are not included in signed uploads
    // They should be applied on-the-fly when generating display URLs
    // This avoids signature complexity and allows flexibility in transformations

    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    if (!apiSecret) {
      throw new Error('CLOUDINARY_API_SECRET is not configured');
    }
    
    // Log parameters that will be signed (important for debugging)
    this.logger.debug('Generating signature with params:', JSON.stringify(params, null, 2));
    
    // Important: Cloudinary requires parameters to be sorted alphabetically for signature
    // But cloudinary.utils.api_sign_request handles this internally, so we don't need to sort
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);
    this.logger.debug('Generated signature:', signature.substring(0, 10) + '...');
    this.logger.debug('Full signature:', signature);
    
    // Also log the API key being used (partial) for verification
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    this.logger.debug('API Key used (first 10 chars):', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');
    
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.configService.get<string>('CLOUDINARY_CLOUD_NAME') || 'your-cloud-name'}/${resourceType}/upload`,
      signature,
      timestamp,
    };
  }

  /**
   * Transform an image URL
   */
  getTransformedUrl(
    publicId: string,
    transformations: Record<string, any> = {},
    resourceType: string = 'image',
  ): string {
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      ...transformations,
    });
  }

  /**
   * Generate responsive image URLs
   */
  getResponsiveImageUrls(
    publicId: string,
    baseTransformations: Record<string, any> = {},
  ): {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    original: string;
  } {
    return {
      thumbnail: this.getTransformedUrl(publicId, {
        ...baseTransformations,
        width: 150,
        height: 150,
        crop: 'fill',
        quality: 'auto',
      }),
      small: this.getTransformedUrl(publicId, {
        ...baseTransformations,
        width: 300,
        height: 300,
        crop: 'limit',
        quality: 'auto',
      }),
      medium: this.getTransformedUrl(publicId, {
        ...baseTransformations,
        width: 600,
        height: 600,
        crop: 'limit',
        quality: 'auto',
      }),
      large: this.getTransformedUrl(publicId, {
        ...baseTransformations,
        width: 1200,
        height: 1200,
        crop: 'limit',
        quality: 'auto',
      }),
      original: this.getTransformedUrl(publicId, baseTransformations),
    };
  }
}
