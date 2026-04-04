import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Business {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  logo?: string;
  catchphrase?: string;
  /** Flat category label when API denormalizes it */
  category: string;
  /** Prisma relation from list/detail endpoints — use for display when `category` is empty */
  businessCategory?: { id?: string; name: string };
  latitude?: number;
  longitude?: number;
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
  location?: string;
  socialLinks?: SocialLinks;
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
  type: 'TILL' | 'PAYBILL' | 'SEND_MONEY' | 'BANK';
  number: string;
  verified: boolean;
}

export interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
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
  location?: string;
  latitude?: number;
  longitude?: number;
  logo?: string;
  catchphrase?: string;
}

export type UpdateBusinessRequest = Partial<Omit<CreateBusinessRequest, 'logo'>> & {
  id: string;
  /** Pass `null` to clear logo in the API */
  logo?: string | null;
};

export interface OCRHealthStatus {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  configured: boolean;
}

export interface ResponseTemplate {
  id: string;
  businessId: string;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class BusinessService {
  private readonly API_URL = `${environment.apiUrl}/api`;
  
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
    
    // Use public endpoint for viewing business details (no authentication required)
    // If you need authenticated access, use: `${this.API_URL}/business/${id}`
    return this.http.get<Business>(`${this.API_URL}/public/business/${id}`)
      .pipe(
        tap(business => {
          this.currentBusiness.set(business);
          this.isLoading.set(false);
        }),
        catchError(error => {
          console.error('Error loading business:', error);
          this.error.set(error.status === 404 
            ? 'Business not found' 
            : 'Failed to load business details. Please try again.');
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

  /**
   * Public search without toggling global loading signals (typeaheads, report picker, etc.).
   */
  searchPublicBusinessesLite(query: string, limit = 40): Observable<Business[]> {
    const q = (query || '').trim();
    const url = q
      ? `${this.API_URL}/public/business/search?query=${encodeURIComponent(q)}&limit=${limit}`
      : `${this.API_URL}/public/business/search?limit=${limit}`;
    return this.http.get<any>(url).pipe(
      map((response: any): Business[] => {
        if (Array.isArray(response)) return response;
        if (response?.businesses && Array.isArray(response.businesses)) {
          return response.businesses;
        }
        return [];
      }),
    );
  }

  searchBusinesses(query: string): Observable<Business[]> {
    this.isLoading.set(true);
    this.error.set(null);
    
    // Use the public endpoint for searching businesses (no authentication required)
    const searchQuery = query && query.trim() ? query.trim() : '';
    const url = searchQuery 
      ? `${this.API_URL}/public/business/search?query=${encodeURIComponent(searchQuery)}`
      : `${this.API_URL}/public/business/search`;
    
    return this.http.get<any>(url)
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

  getAllPublicBusinesses(): Observable<any> {
    this.isLoading.set(true);
    this.error.set(null);
    
    // Use the public endpoint to get all businesses for map view
    return this.http.get<any>(`${this.API_URL}/public/business/search?limit=500`)
      .pipe(
        tap(response => {
          const businesses = Array.isArray(response) ? response : (response?.businesses || []);
          this.businesses.set(businesses);
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to load businesses');
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

  downloadDocument(documentId: string): Observable<Blob> {
    return this.http.get(`${this.API_URL}/business/documents/${documentId}/download`, {
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        this.error.set('Failed to download document');
        throw error;
      })
    );
  }

  getDocumentAccessUrl(documentId: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.API_URL}/business/documents/${documentId}/access-url`)
      .pipe(
        catchError(error => {
          this.error.set('Failed to get document access URL');
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

  deletePaymentMethod(paymentId: string): Observable<{ message: string }> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http
      .delete<{ message: string }>(
        `${this.API_URL}/business/payment-methods/${paymentId}`,
      )
      .pipe(
        tap(() => {
          this.isLoading.set(false);
        }),
        catchError((error) => {
          this.error.set('Failed to remove payment method');
          this.isLoading.set(false);
          throw error;
        }),
      );
  }

  updateBusinessSocialLinks(businessId: string, socialLinks: SocialLinks): Observable<Business> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.patch<Business>(`${this.API_URL}/business/${businessId}`, { socialLinks })
      .pipe(
        tap(business => {
          this.currentBusiness.set(business);
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to update social links');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  updateOnboardingStep(businessId: string, step: number): Observable<Business> {
    return this.http.patch<Business>(`${this.API_URL}/business/${businessId}/onboarding-step`, { step })
      .pipe(
        tap(business => {
          this.currentBusiness.set(business);
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

  getResponseTemplates(businessId: string): Observable<ResponseTemplate[]> {
    return this.http.get<ResponseTemplate[]>(
      `${this.API_URL}/business/${businessId}/response-templates`,
    );
  }

  createResponseTemplate(
    businessId: string,
    body: { name: string; content: string; isDefault?: boolean },
  ): Observable<ResponseTemplate> {
    return this.http.post<ResponseTemplate>(
      `${this.API_URL}/business/${businessId}/response-templates`,
      body,
    );
  }

  updateResponseTemplate(
    templateId: string,
    body: Partial<{ name: string; content: string; isDefault: boolean }>,
  ): Observable<ResponseTemplate> {
    return this.http.patch<ResponseTemplate>(
      `${this.API_URL}/business/response-templates/${templateId}`,
      body,
    );
  }

  deleteResponseTemplate(
    templateId: string,
  ): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.API_URL}/business/response-templates/${templateId}`,
    );
  }
}

