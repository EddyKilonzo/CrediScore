import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface Business {
  id: string;
  name: string;
  description?: string;
  category?: string;
  website?: string;
  phone?: string;
  email?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  catchphrase?: string;
  logo?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
  };
  isVerified: boolean;
  isActive: boolean;
  status: BusinessStatus;
  onboardingStep: number;
  submittedForReview: boolean;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  ownerId?: string;
  businessCategoryId?: string;
  createdAt: Date;
  updatedAt: Date;
  trustScore?: TrustScore;
  documents?: Document[];
  reviews?: Review[];
  payments?: Payment[];
}

export interface TrustScore {
  id: string;
  grade: string;
  score: number;
  businessId: string;
  factors?: any;
  updatedAt: Date;
}

export interface Document {
  id: string;
  url: string;
  type: DocumentType;
  name?: string;
  size?: number;
  mimeType?: string;
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
  verificationNotes?: string;
  // AI and OCR fields
  ocrText?: string;
  ocrConfidence?: number;
  aiAnalysis?: any;
  aiVerified: boolean;
  aiVerifiedAt?: Date;
  extractedData?: any;
  businessId: string;
  uploadedAt: Date;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  userId: string;
  businessId: string;
  credibility: number;
  isVerified: boolean;
  isActive: boolean;
  receiptUrl?: string;
  receiptData?: any;
  validationResult?: any;
  amount?: number;
  reviewDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Payment {
  id: string;
  type: PaymentType;
  number: string;
  verified: boolean;
  businessId: string;
  addedAt: Date;
}

export interface BusinessAnalytics {
  totalReviews: number;
  averageRating: number;
  totalCustomers: number;
  monthlyGrowth: number;
  responseRate: number;
  pendingReviews: number;
  revenueGrowth: number;
  customerSatisfaction: number;
  reviewTrends: ReviewTrend[];
  recentActivities: RecentActivity[];
  topCustomers: CustomerEngagement[];
}

export interface ReviewTrend {
  date: string;
  reviews: number;
  rating: number;
}

export interface RecentActivity {
  id: string;
  type: 'review' | 'customer_registration' | 'document_verified' | 'payment_received' | 'review_response' | 'business_update' | 'verification_status';
  title: string;
  description: string;
  timestamp: Date;
  status?: string;
  priority?: string;
  rating?: number;
}

export interface CustomerEngagement {
  id: string;
  name: string;
  email: string;
  reviewCount: number;
  averageRating: number;
  lastActivity: Date;
  grade: string;
}

export enum BusinessStatus {
  PENDING = 'PENDING',
  DOCUMENTS_REQUIRED = 'DOCUMENTS_REQUIRED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
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

export enum PaymentType {
  TILL = 'TILL',
  PAYBILL = 'PAYBILL',
  BANK = 'BANK',
}

@Injectable({
  providedIn: 'root'
})
export class BusinessService {
  private apiUrl = 'http://localhost:3000/api/business'; // Use direct URL for now
  private currentBusinessSubject = new BehaviorSubject<Business | null>(null);
  public currentBusiness$ = this.currentBusinessSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Get user's businesses
  getUserBusinesses(page: number = 1, limit: number = 10): Observable<{ businesses: Business[]; total: number; page: number; limit: number }> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    
    return this.http.get<{ businesses: Business[]; total: number; page: number; limit: number }>(`${this.apiUrl}/my-businesses`, { params });
  }

  // Get business by ID
  getBusinessById(businessId: string): Observable<Business> {
    return this.http.get<Business>(`${this.apiUrl}/${businessId}`).pipe(
      tap(business => this.currentBusinessSubject.next(business))
    );
  }

  // Get business analytics
  getBusinessAnalytics(businessId: string): Observable<BusinessAnalytics> {
    return this.http.get<BusinessAnalytics>(`${this.apiUrl}/${businessId}/analytics`);
  }

  // Get business trust score
  getTrustScore(businessId: string): Observable<TrustScore> {
    return this.http.get<TrustScore>(`${this.apiUrl}/${businessId}/trust-score`);
  }

  // Get business documents
  getBusinessDocuments(businessId: string): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/${businessId}/documents`);
  }

  // Get business payment methods
  getBusinessPaymentMethods(businessId: string): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.apiUrl}/${businessId}/payment-methods`);
  }

  // Get onboarding status
  getOnboardingStatus(businessId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${businessId}/onboarding-status`);
  }

  // Submit business for review
  submitForReview(businessId: string, data: { notes?: string }): Observable<Business> {
    return this.http.post<Business>(`${this.apiUrl}/${businessId}/submit-for-review`, data);
  }

  // Update business
  updateBusiness(businessId: string, updateData: Partial<Business>): Observable<Business> {
    return this.http.patch<Business>(`${this.apiUrl}/${businessId}`, updateData).pipe(
      tap(business => this.currentBusinessSubject.next(business))
    );
  }

  // Upload document
  uploadDocument(businessId: string, documentData: { url: string; type: DocumentType; name?: string; size?: number; mimeType?: string }): Observable<Document> {
    return this.http.post<Document>(`${this.apiUrl}/${businessId}/documents`, documentData);
  }

  // Get document processing status
  getDocumentProcessingStatus(businessId: string, documentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${businessId}/documents/${documentId}/processing-status`);
  }

  // Update business location
  updateBusinessLocation(businessId: string, locationData: { location?: string; latitude?: number; longitude?: number }): Observable<Business> {
    return this.http.patch<Business>(`${this.apiUrl}/${businessId}`, locationData).pipe(
      tap(business => this.currentBusinessSubject.next(business))
    );
  }

  // Update business social media links
  updateBusinessSocialLinks(businessId: string, socialLinks: { facebook?: string; twitter?: string; instagram?: string; linkedin?: string; youtube?: string; tiktok?: string }): Observable<Business> {
    return this.http.patch<Business>(`${this.apiUrl}/${businessId}`, { socialLinks }).pipe(
      tap(business => this.currentBusinessSubject.next(business))
    );
  }

  // Add payment method
  addPaymentMethod(businessId: string, paymentData: { type: PaymentType; number: string }): Observable<Payment> {
    return this.http.post<Payment>(`${this.apiUrl}/${businessId}/payment-methods`, paymentData);
  }

  // Calculate trust score
  calculateTrustScore(businessId: string): Observable<TrustScore> {
    return this.http.post<TrustScore>(`${this.apiUrl}/${businessId}/trust-score/calculate`, {});
  }

  // Helper method to determine verification status
  getVerificationStatus(business: Business): 'verified' | 'pending' | 'not_verified' {
    if (business.isVerified) {
      return 'verified';
    }
    
    if (business.status === BusinessStatus.UNDER_REVIEW || business.submittedForReview) {
      return 'pending';
    }
    
    return 'not_verified';
  }

  // Helper method to get business grade from trust score
  getBusinessGrade(trustScore?: TrustScore): string {
    if (!trustScore) return 'N/A';
    return trustScore.grade || 'N/A';
  }

  // Helper method to get trust score value
  getTrustScoreValue(trustScore?: TrustScore): number {
    if (!trustScore) return 0;
    return trustScore.score || 0;
  }
}
