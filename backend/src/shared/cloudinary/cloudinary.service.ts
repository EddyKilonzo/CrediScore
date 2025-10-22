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
  ): { uploadUrl: string; signature: string; timestamp: number } {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params = {
      folder,
      resource_type: resourceType,
      max_file_size: maxFileSize,
      timestamp,
    };

    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    if (!apiSecret) {
      throw new Error('CLOUDINARY_API_SECRET is not configured');
    }
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);

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
