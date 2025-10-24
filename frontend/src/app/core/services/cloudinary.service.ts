import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  private readonly CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1';
  private readonly CLOUD_NAME = 'your_cloud_name'; // This should come from environment
  private readonly UPLOAD_PRESET = 'business_documents';

  // Signals for reactive state
  public uploadProgress = signal(0);
  public isUploading = signal(false);
  public uploadError = signal<string | null>(null);

  constructor(private http: HttpClient) {}

  /**
   * Upload business document to Cloudinary
   */
  uploadBusinessDocument(file: File): Observable<any> {
    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.uploadError.set(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.UPLOAD_PRESET);
    formData.append('folder', 'business_documents');

    return this.http.post<any>(`${this.CLOUDINARY_URL}/${this.CLOUD_NAME}/image/upload`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
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
   * Upload file with options
   */
  uploadFile(file: File, options: any): Observable<any> {
    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.uploadError.set(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.UPLOAD_PRESET);
    
    if (options.folder) {
      formData.append('folder', options.folder);
    }
    if (options.tags) {
      formData.append('tags', options.tags.join(','));
    }

    return this.http.post<any>(`${this.CLOUDINARY_URL}/${this.CLOUD_NAME}/image/upload`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
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
   * Upload with progress tracking
   */
  uploadWithProgress(file: File): Observable<any> {
    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.uploadError.set(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.UPLOAD_PRESET);
    formData.append('folder', 'business_documents');

    return this.http.post<any>(`${this.CLOUDINARY_URL}/${this.CLOUD_NAME}/image/upload`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
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
}