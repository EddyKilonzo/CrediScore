import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';

export interface Business {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  category: string;
  trustScore: number;
  isVerified: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  images?: string[];
  businessHours?: BusinessHours[];
  status?: BusinessStatus;
  onboardingStep?: number;
  submittedForReview?: boolean;
  documents?: Document[];
  payments?: PaymentMethod[];
}

export enum DocumentType {
  BUSINESS_DOCUMENT = 'BUSINESS_DOCUMENT',
  BUSINESS_REGISTRATION = 'BUSINESS_REGISTRATION',
  TAX_CERTIFICATE = 'TAX_CERTIFICATE',
  TRADE_LICENSE = 'TRADE_LICENSE',
  BANK_STATEMENT = 'BANK_STATEMENT',
  UTILITY_BILL = 'UTILITY_BILL',
  ID_COPY = 'ID_COPY',
  PROOF_OF_ADDRESS = 'PROOF_OF_ADDRESS',
  OTHER = 'OTHER',
}

export enum BusinessStatus {
  PENDING = 'PENDING',
  DOCUMENTS_REQUIRED = 'DOCUMENTS_REQUIRED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export interface Document {
  id: string;
  type: DocumentType;
  url: string;
  name?: string;
  verified: boolean;
  aiVerified?: boolean;
  aiAnalysis?: any;
  ocrConfidence?: number;
  uploadedAt: Date;
}

export interface PaymentMethod {
  id: string;
  type: 'TILL' | 'PAYBILL' | 'BANK';
  number: string;
  verified: boolean;
}

export interface OnboardingProgress {
  currentStep: number;
  status: BusinessStatus;
  submittedForReview: boolean;
  documents: {
    uploaded: number;
    verified: number;
    aiVerified: number;
    required: number;
    missing: string[];
  };
  payments: {
    uploaded: number;
    verified: number;
  };
  canSubmit: boolean;
}

export interface OnboardingStatusResponse {
  business: Business;
  progress: OnboardingProgress;
}

export interface BusinessHours {
  day: string;
  open: string;
  close: string;
  isClosed: boolean;
}

export interface CreateBusinessRequest {
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  category: string;
  businessHours?: BusinessHours[];
}

export interface UpdateBusinessRequest extends Partial<CreateBusinessRequest> {
  id: string;
}

export interface OCRHealthStatus {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  configured: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BusinessService {
  private readonly API_URL = 'http://localhost:3000/api';
  
  // Signals for reactive state
  public businesses = signal<Business[]>([]);
  public currentBusiness = signal<Business | null>(null);
  public isLoading = signal(false);
  public error = signal<string | null>(null);

  constructor(private http: HttpClient) {}

  getAllBusinesses(): Observable<Business[]> {
    this.isLoading.set(true);
    this.error.set(null);
    
    // Use the authenticated endpoint to get current user's businesses
    return this.http.get<any>(`${this.API_URL}/business/my-businesses`)
      .pipe(
        map((response: any): Business[] => {
          // Handle paginated response format from backend: { businesses: Business[], pagination: {...} }
          // Or handle direct array response (for backward compatibility)
          if (Array.isArray(response)) {
            return response;
          } else if (response?.businesses && Array.isArray(response.businesses)) {
            return response.businesses;
          } else {
            return [];
          }
        }),
        tap(businessList => {
          this.businesses.set(businessList);
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to load businesses');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  getBusinessById(id: string): Observable<Business> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.get<Business>(`${this.API_URL}/business/${id}`)
      .pipe(
        tap(business => {
          this.currentBusiness.set(business);
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to load business details');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  createBusiness(businessData: CreateBusinessRequest): Observable<Business> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.post<Business>(`${this.API_URL}/business`, businessData)
      .pipe(
        tap(business => {
          this.currentBusiness.set(business);
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to create business');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  updateBusiness(businessData: UpdateBusinessRequest): Observable<Business> {
    this.isLoading.set(true);
    this.error.set(null);
    
    // Extract id from businessData and remove it from the body
    const { id, ...updateData } = businessData;
    
    // Use PATCH method to match backend endpoint
    return this.http.patch<Business>(`${this.API_URL}/business/${id}`, updateData)
      .pipe(
        tap(business => {
          this.currentBusiness.set(business);
          this.isLoading.set(false);
        }),
        catchError(error => {
          console.error('Business update error:', error);
          this.error.set('Failed to update business');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  deleteBusiness(id: string): Observable<void> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.delete<void>(`${this.API_URL}/business/${id}`)
      .pipe(
        tap(() => {
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to delete business');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  searchBusinesses(query: string): Observable<Business[]> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.get<Business[]>(`${this.API_URL}/business/search?q=${encodeURIComponent(query)}`)
      .pipe(
        tap(businesses => {
          this.businesses.set(businesses);
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to search businesses');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  getBusinessesByCategory(category: string): Observable<Business[]> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.get<Business[]>(`${this.API_URL}/business/category/${encodeURIComponent(category)}`)
      .pipe(
        tap(businesses => {
          this.businesses.set(businesses);
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to load businesses by category');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  // Onboarding methods
  getOnboardingStatus(businessId: string): Observable<OnboardingStatusResponse> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.get<OnboardingStatusResponse>(`${this.API_URL}/business/${businessId}/onboarding-status`)
      .pipe(
        tap(response => {
          this.currentBusiness.set(response.business);
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to load onboarding status');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  uploadDocument(businessId: string, file: File, type: DocumentType): Observable<Document> {
    this.isLoading.set(true);
    this.error.set(null);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    return this.http.post<Document>(`${this.API_URL}/business/${businessId}/documents`, formData)
      .pipe(
        tap(document => {
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to upload document');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  getDocumentProcessingStatus(businessId: string, documentId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/business/${businessId}/documents/${documentId}/processing-status`)
      .pipe(
        catchError(error => {
          this.error.set('Failed to get document processing status');
          throw error;
        })
      );
  }

  addPaymentMethod(businessId: string, payment: { type: string; number: string }): Observable<PaymentMethod> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.post<PaymentMethod>(`${this.API_URL}/business/${businessId}/payment-methods`, payment)
      .pipe(
        tap(() => {
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to add payment method');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  submitForReview(businessId: string, notes?: string): Observable<Business> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.post<Business>(`${this.API_URL}/business/${businessId}/submit-for-review`, { notes })
      .pipe(
        tap(business => {
          this.currentBusiness.set(business);
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to submit for review');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  // OCR/AI Service Health Check
  checkOCRHealth(): Observable<OCRHealthStatus> {
    return this.http.get<OCRHealthStatus>(`${this.API_URL}/business/health/ocr`)
      .pipe(
        catchError(error => {
          // Return error status if health check fails
          return of({ 
            status: 'error' as const, 
            message: 'Unable to check OCR service status', 
            configured: false 
          });
        })
      );
  }

  checkGoogleVisionHealth(): Observable<OCRHealthStatus> {
    return this.http.get<OCRHealthStatus>(`${this.API_URL}/business/health/google-vision`)
      .pipe(
        catchError(error => {
          return of({ 
            status: 'error' as const, 
            message: 'Unable to check Google Vision service status', 
            configured: false 
          });
        })
      );
  }
}

