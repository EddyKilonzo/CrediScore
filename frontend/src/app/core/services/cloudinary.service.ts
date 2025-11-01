import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  private readonly CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1';
  private readonly CLOUD_NAME = environment.cloudinary.cloudName;
  private readonly API_KEY = environment.cloudinary.apiKey;

  // Signals for reactive state
  public uploadProgress = signal(0);
  public isUploading = signal(false);
  public uploadError = signal<string | null>(null);

  constructor(private http: HttpClient) {}

  /**
   * Get signed upload URL from backend
   */
  private getSignedUploadUrl(folder: string = 'crediscore', resourceType: string = 'image', maxFileSize: number = 10 * 1024 * 1024): Observable<{uploadUrl: string, signature: string, timestamp: number}> {
    return this.getSignedUploadUrlWithParams({
      folder,
      resourceType,
      maxFileSize: maxFileSize.toString()
    });
  }

  /**
   * Get signed upload URL from backend with custom params
   */
  private getSignedUploadUrlWithParams(params: any): Observable<{uploadUrl: string, signature: string, timestamp: number}> {
    return this.http.get<{uploadUrl: string, signature: string, timestamp: number}>(`${environment.apiUrl}/api/cloudinary/signed-upload-url`, {
      params
    });
  }

  /**
   * Upload business document to Cloudinary using signed upload
   */
  uploadBusinessDocument(file: File): Observable<any> {
    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.uploadError.set(null);

    return this.getSignedUploadUrl('business_documents').pipe(
      switchMap(({ uploadUrl, signature, timestamp }) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', this.API_KEY);
        formData.append('timestamp', timestamp.toString());
        formData.append('signature', signature);
        formData.append('folder', 'business_documents');

        return this.http.post<any>(uploadUrl, formData, {
          reportProgress: true,
          observe: 'events'
        });
      }),
      tap(event => {
        if (event.type === 1) { // HttpEventType.UploadProgress
          const progress = Math.round(100 * event.loaded / event.total!);
          this.uploadProgress.set(progress);
        } else if (event.type === 4) { // HttpEventType.Response
          this.isUploading.set(false);
          this.uploadProgress.set(100);
        }
      }),
      catchError(error => {
        this.uploadError.set('Failed to upload document');
        this.isUploading.set(false);
        throw error;
      })
    );
  }

  /**
   * Upload file with options using signed upload
   */
  uploadFile(file: File, options: any): Observable<any> {
    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.uploadError.set(null);

    const folder = options.folder || 'crediscore';
    const resourceType = options.resourceType || 'image';
    const maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default
    const tags = options.tags;
    const transformation = options.transformation;
    
    // Build query params for signed URL request
    const queryParams: any = {
      folder,
      resourceType,
      maxFileSize: maxFileSize.toString()
    };
    
    if (tags && Array.isArray(tags) && tags.length > 0) {
      queryParams.tags = tags.join(',');
    }
    
    // Note: Transformations are skipped for signed uploads
    // They should be applied on-the-fly when generating display URLs
    
    return this.getSignedUploadUrlWithParams(queryParams).pipe(
      switchMap(({ uploadUrl, signature, timestamp }) => {
        const formData = new FormData();
        
        // These parameters MUST match exactly what was signed on the backend
        // NOTE: resource_type is NOT a signed parameter - it's part of the URL path
        // Only include parameters that were in the signature
        // IMPORTANT: Convert timestamp to string explicitly to match signature format
        const timestampStr = String(timestamp);
        
        formData.append('file', file);
        formData.append('api_key', this.API_KEY);
        formData.append('timestamp', timestampStr);
        formData.append('folder', folder);
        
        // Add max_file_size - sent but NOT included in signature
        // Cloudinary uses it for validation but doesn't require it in the signature
        formData.append('max_file_size', maxFileSize.toString());
        
        // Add tags ONLY if they were provided (they should match what was in signature)
        if (tags && Array.isArray(tags) && tags.length > 0) {
          // Join tags with comma - must match exactly what backend sent
          const tagsString = tags.join(',');
          formData.append('tags', tagsString);
        }
        
        // Signature must be added LAST
        formData.append('signature', signature);
        
        // Note: Transformations are not included in signed uploads to avoid signature complexity
        // Instead, apply transformations when generating display URLs after upload

        return this.http.post<any>(uploadUrl, formData, {
          reportProgress: true,
          observe: 'events'
        });
      }),
      tap(event => {
        if (event.type === 1) { // HttpEventType.UploadProgress
          const progress = Math.round(100 * event.loaded / event.total!);
          this.uploadProgress.set(progress);
        } else if (event.type === 4) { // HttpEventType.Response
          this.isUploading.set(false);
          this.uploadProgress.set(100);
        }
      }),
      catchError(error => {
        this.uploadError.set('Failed to upload file');
        this.isUploading.set(false);
        throw error;
      })
    );
  }

  /**
   * Create profile image upload options
   */
  createProfileImageOptions(userId?: string): any {
    return {
      folder: 'crediscore/profile-images',
      tags: ['profile', userId || 'user'],
      transformation: {
        width: 300,
        height: 300,
        crop: 'fill',
        gravity: 'face'
      }
    };
  }

  /**
   * Upload profile image with proper error handling using signed upload
   */
  uploadProfileImage(file: File, userId?: string): Observable<any> {
    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.uploadError.set(null);

    return this.getSignedUploadUrl('crediscore/profile-images').pipe(
      switchMap(({ uploadUrl, signature, timestamp }) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', this.API_KEY);
        formData.append('timestamp', timestamp.toString());
        formData.append('signature', signature);
        formData.append('folder', 'crediscore/profile-images');
        
        if (userId) {
          formData.append('tags', `profile,user-${userId}`);
        } else {
          formData.append('tags', 'profile');
        }

        // Add transformation parameters
        formData.append('transformation[width]', '300');
        formData.append('transformation[height]', '300');
        formData.append('transformation[crop]', 'fill');
        formData.append('transformation[gravity]', 'face');

        return this.http.post<any>(uploadUrl, formData, {
          reportProgress: true,
          observe: 'events'
        });
      }),
      tap(event => {
        if (event.type === 1) { // HttpEventType.UploadProgress
          const progress = Math.round(100 * event.loaded / event.total!);
          this.uploadProgress.set(progress);
        } else if (event.type === 4) { // HttpEventType.Response
          this.isUploading.set(false);
          this.uploadProgress.set(100);
        }
      }),
      catchError(error => {
        this.uploadError.set('Failed to upload profile image. Please check your Cloudinary configuration.');
        this.isUploading.set(false);
        throw error;
      })
    );
  }

  /**
   * Upload with progress tracking using signed upload
   */
  uploadWithProgress(file: File): Observable<any> {
    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.uploadError.set(null);

    return this.getSignedUploadUrl('business_documents').pipe(
      switchMap(({ uploadUrl, signature, timestamp }) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', this.API_KEY);
        formData.append('timestamp', timestamp.toString());
        formData.append('signature', signature);
        formData.append('folder', 'business_documents');

        return this.http.post<any>(uploadUrl, formData, {
          reportProgress: true,
          observe: 'events'
        });
      }),
      tap(event => {
        if (event.type === 1) { // HttpEventType.UploadProgress
          const progress = Math.round(100 * event.loaded / event.total!);
          this.uploadProgress.set(progress);
        } else if (event.type === 4) { // HttpEventType.Response
          this.isUploading.set(false);
          this.uploadProgress.set(100);
        }
      }),
      catchError(error => {
        this.uploadError.set('Failed to upload document');
        this.isUploading.set(false);
        throw error;
      })
    );
  }

  /**
   * Delete uploaded image
   */
  deleteImage(publicId: string): Observable<any> {
    return this.http.post(`${this.CLOUDINARY_URL}/${this.CLOUD_NAME}/image/destroy`, {
      public_id: publicId
    });
  }

  /**
   * Get image transformation URL
   */
  getImageUrl(publicId: string, transformations?: any): string {
    let url = `${this.CLOUDINARY_URL}/${this.CLOUD_NAME}/image/upload`;
    
    if (transformations) {
      const transformString = Object.entries(transformations)
        .map(([key, value]) => `${key}_${value}`)
        .join(',');
      url += `/${transformString}`;
    }
    
    url += `/${publicId}`;
    return url;
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): { isValid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    
    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'File type not supported. Please upload JPG, PNG, or PDF files only.'
      };
    }
    
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'File size too large. Please upload files smaller than 5MB.'
      };
    }
    
    return { isValid: true };
  }

  /**
   * Validate profile image file
   */
  validateProfileImage(file: File): { isValid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024; // 5MB for profile images (increased from 2MB)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    
    // Check file type
    if (!file.type) {
      const extension = file.name.toLowerCase().split('.').pop();
      const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
      if (!extension || !validExtensions.includes(extension)) {
        return {
          isValid: false,
          error: 'Please upload a valid image file (JPG, PNG, or WebP). File type could not be determined.'
        };
      }
    } else if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `Please upload a valid image file (JPG, PNG, or WebP). Current file type: ${file.type}`
      };
    }
    
    // Check file size
    if (file.size > maxSize) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      return {
        isValid: false,
        error: `Image size too large. Please upload images smaller than 5MB. Current size: ${sizeInMB}MB`
      };
    }
    
    return { isValid: true };
  }

  /**
   * Test Cloudinary configuration
   */
  testCloudinaryConfig(): Observable<any> {
    // Create a small test image (1x1 pixel PNG)
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 1, 1);
    }
    
    return new Observable(observer => {
      canvas.toBlob((blob) => {
        if (blob) {
          const testFile = new File([blob], 'test.png', { type: 'image/png' });
          
          this.getSignedUploadUrl('test').pipe(
            switchMap(({ uploadUrl, signature, timestamp }) => {
              const formData = new FormData();
              formData.append('file', testFile);
              formData.append('api_key', this.API_KEY);
              formData.append('timestamp', timestamp.toString());
              formData.append('signature', signature);
              formData.append('folder', 'test');
              
              return this.http.post<any>(uploadUrl, formData);
            })
          ).subscribe({
            next: (response) => {
              observer.next(response);
              observer.complete();
            },
            error: (error) => {
              observer.error(error);
            }
          });
        } else {
          observer.error(new Error('Failed to create test image'));
        }
      }, 'image/png');
    });
  }

  /**
   * Get available upload presets (for debugging)
   */
  getAvailablePresets(): string[] {
    // Common Cloudinary presets that might exist
    return [
      'ml_default',
      'unsigned',
      'crediscore_upload_preset',
      'default',
      'profile_images',
      'business_documents'
    ];
  }
}