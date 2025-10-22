import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastService } from '../../shared/components/toast/toast.service';

export interface CloudinaryUploadResponse {
  success: boolean;
  data: {
    publicId: string;
    url: string;
    width: number;
    height: number;
    format: string;
    size: number;
    createdAt: string;
  };
}

export interface CloudinaryUploadOptions {
  folder?: string;
  public_id?: string;
  overwrite?: boolean;
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
  transformation?: Record<string, any>[];
  tags?: string[];
  scanDocument?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  private readonly API_URL = 'http://localhost:3000/api';

  constructor(
    private http: HttpClient,
    private toastService: ToastService
  ) {}

  /**
   * Upload a file to Cloudinary
   */
  uploadFile(file: File, options: CloudinaryUploadOptions = {}): Observable<CloudinaryUploadResponse> {
    console.log('Frontend upload attempt:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      lastModified: file.lastModified
    });
    
    const formData = new FormData();
    formData.append('file', file);
    
    console.log('FormData file field:', file);
    console.log('Options to append:', options);
    
    if (Object.keys(options).length > 0) {
      const optionsString = JSON.stringify(options);
      console.log('Options JSON string:', optionsString);
      formData.append('options', optionsString);
    }

    console.log('FormData entries:');
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }

    console.log('Making request to:', `${this.API_URL}/cloudinary/upload`);

    return this.http.post<CloudinaryUploadResponse>(`${this.API_URL}/cloudinary/upload`, formData)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.handleError(error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Upload from URL
   */
  uploadFromUrl(url: string, options: CloudinaryUploadOptions = {}): Observable<CloudinaryUploadResponse> {
    return this.http.post<CloudinaryUploadResponse>(`${this.API_URL}/cloudinary/upload-url`, {
      url,
      options
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get file information
   */
  getFileInfo(publicId: string, resourceType: string = 'image'): Observable<any> {
    return this.http.post(`${this.API_URL}/cloudinary/info/${publicId}`, {
      resourceType
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a file
   */
  deleteFile(publicId: string, resourceType: string = 'image'): Observable<any> {
    return this.http.request('DELETE', `${this.API_URL}/cloudinary/${publicId}`, {
      body: { resourceType }
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Generate signed upload URL for direct client uploads
   */
  generateSignedUploadUrl(
    folder: string = 'crediscore',
    resourceType: string = 'image',
    maxFileSize: number = 10 * 1024 * 1024
  ): Observable<any> {
    return this.http.post(`${this.API_URL}/cloudinary/signed-url`, {
      folder,
      resourceType,
      maxFileSize
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get transformed image URL
   */
  getTransformedUrl(
    publicId: string,
    transformations: Record<string, any> = {},
    resourceType: string = 'image'
  ): Observable<any> {
    return this.http.post(`${this.API_URL}/cloudinary/transform`, {
      publicId,
      transformations,
      resourceType
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get responsive image URLs
   */
  getResponsiveUrls(
    publicId: string,
    baseTransformations: Record<string, any> = {}
  ): Observable<any> {
    return this.http.post(`${this.API_URL}/cloudinary/responsive`, {
      publicId,
      baseTransformations
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Scan an existing document
   */
  scanDocument(publicId: string, resourceType: string = 'image'): Observable<any> {
    return this.http.post(`${this.API_URL}/cloudinary/scan/${publicId}`, {
      resourceType
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): { isValid: boolean; error?: string } {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return { isValid: false, error: 'Please select a valid image file' };
    }

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return { isValid: false, error: 'Image size must be less than 10MB' };
    }

    // Check file size (minimum 1KB)
    if (file.size < 1024) {
      return { isValid: false, error: 'Image size must be at least 1KB' };
    }

    return { isValid: true };
  }

  /**
   * Create optimized upload options for profile images
   */
  createProfileImageOptions(userId?: string): CloudinaryUploadOptions {
    return {
      folder: 'crediscore/profiles',
      public_id: userId ? `profile_${userId}_${Date.now()}` : undefined,
      overwrite: true,
      resource_type: 'image',
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' }
      ],
      tags: ['profile', 'user']
    };
  }

  /**
   * Handle upload errors
   */
  private handleError(error: HttpErrorResponse): void {
    let errorMessage = 'Upload failed. Please try again.';

    console.error('Cloudinary upload error:', error);
    console.error('Error details:', {
      status: error.status,
      statusText: error.statusText,
      error: error.error,
      url: error.url,
      headers: error.headers
    });

    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.status === 400) {
      errorMessage = `Bad Request: ${error.error?.message || 'Please check your file and try again.'}`;
    } else if (error.status === 413) {
      errorMessage = 'File too large. Please select a smaller image.';
    } else if (error.status === 415) {
      errorMessage = 'Unsupported file type. Please select an image file.';
    } else if (error.status === 0) {
      errorMessage = 'Network error. Please check your connection.';
    }

    this.toastService.error(errorMessage);
  }
}