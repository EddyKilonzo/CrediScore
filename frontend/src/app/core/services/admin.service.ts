import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';

export interface AdminDashboardStats {
  userStats: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    customers: number;
    businessOwners: number;
    admins: number;
    newUsersThisMonth: number;
    usersWithVerifiedEmail: number;
  };
  businessStats: {
    totalBusinesses: number;
    verifiedBusinesses: number;
    pendingVerification: number;
    activeBusinesses: number;
    inactiveBusinesses: number;
    newBusinessesThisMonth: number;
    businessesWithTrustScores: number;
  };
  fraudReportStats: {
    totalReports: number;
    pendingReports: number;
    underReviewReports: number;
    resolvedReports: number;
    dismissedReports: number;
    reportsThisMonth: number;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'ADMIN' | 'business' | 'user' | 'BUSINESS_OWNER' | 'CUSTOMER';
  isActive: boolean;
  isVerified: boolean;
  provider?: string;
  reputation: number;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    reviews: number;
    businesses: number;
    fraudReports: number;
  };
}

export interface Business {
  id: string;
  name: string;
  description?: string;
  category: string;
  website?: string;
  phone?: string;
  email?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  isVerified: boolean;
  isActive: boolean;
  status: string;
  onboardingStep: number;
  submittedForReview: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  trustScore?: {
    score: number;
    factors: any;
    lastUpdated: string;
  };
  _count: {
    reviews: number;
    documents: number;
    payments: number;
    fraudReports: number;
  };
}

export interface FraudReport {
  id: string;
  reason: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  reporter: {
    id: string;
    name: string;
    email: string;
    reputation: number;
  };
  business: {
    id: string;
    name: string;
    isVerified: boolean;
    isActive: boolean;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BackendPaginatedResponse<T> {
  users: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UpdateUserRoleDto {
  role: string;
}

export interface UpdateFraudReportStatusDto {
  status: string;
  adminNotes?: string;
}

export interface UnflagUserDto {
  reason?: string;
}

export interface UpdateBusinessStatusDto {
  status: string;
  reviewNotes?: string;
  rejectionReason?: string;
}

export interface VerifyDocumentDto {
  verified: boolean;
  verificationNotes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly API_URL = 'http://localhost:3000/api';
  
  // Signals for reactive state
  public isLoading = signal(false);
  public dashboardStats = signal<AdminDashboardStats | null>(null);
  public error = signal<string | null>(null);

  constructor(private http: HttpClient) {}

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = error.error?.message || `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    
    this.error.set(errorMessage);
    console.error('Admin Service Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  private clearError(): void {
    this.error.set(null);
  }

  // Dashboard
  getDashboardStats(): Observable<AdminDashboardStats> {
    this.isLoading.set(true);
    this.clearError();
    
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return this.http.get<AdminDashboardStats>(`${this.API_URL}/admin/dashboard`, { headers })
      .pipe(
        tap(stats => {
          this.dashboardStats.set(stats);
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.isLoading.set(false);
          return this.handleError(error);
        })
      );
  }

  // User Management
  getAllUsers(
    page: number = 1,
    limit: number = 10,
    search?: string,
    role?: string,
    isActive?: boolean
  ): Observable<BackendPaginatedResponse<User>> {
    this.clearError();
    
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (search) params = params.set('search', search);
    if (role) params = params.set('role', role);
    if (isActive !== undefined) params = params.set('isActive', isActive.toString());

    // Get token from localStorage
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.get<BackendPaginatedResponse<User>>(`${this.API_URL}/admin/users`, { 
      params,
      headers
    })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  getUserById(userId: string): Observable<User> {
    this.clearError();
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return this.http.get<User>(`${this.API_URL}/admin/users/${userId}`, { headers })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  updateUserRole(userId: string, role: string): Observable<User> {
    this.clearError();
    
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return this.http.patch<User>(`${this.API_URL}/admin/users/${userId}/role`, { role }, { headers })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  toggleUserStatus(userId: string): Observable<User> {
    this.clearError();
    
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return this.http.patch<User>(`${this.API_URL}/admin/users/${userId}/status`, {}, { headers })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  deleteUser(userId: string): Observable<{ message: string }> {
    this.clearError();
    
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return this.http.delete<{ message: string }>(`${this.API_URL}/admin/users/${userId}`, { headers })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  // Business Management
  getAllBusinesses(
    page: number = 1,
    limit: number = 10,
    search?: string,
    isVerified?: boolean,
    isActive?: boolean
  ): Observable<PaginatedResponse<Business>> {
    this.clearError();
    
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (search) params = params.set('search', search);
    if (isVerified !== undefined) params = params.set('isVerified', isVerified.toString());
    if (isActive !== undefined) params = params.set('isActive', isActive.toString());

    return this.http.get<PaginatedResponse<Business>>(`${this.API_URL}/admin/businesses`, { params })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  getBusinessById(businessId: string): Observable<Business> {
    this.clearError();
    return this.http.get<Business>(`${this.API_URL}/admin/businesses/${businessId}`)
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  verifyBusiness(businessId: string): Observable<{ message: string }> {
    this.clearError();
    return this.http.post<{ message: string }>(`${this.API_URL}/admin/businesses/${businessId}/verify`, {})
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  unverifyBusiness(businessId: string): Observable<{ message: string }> {
    this.clearError();
    return this.http.post<{ message: string }>(`${this.API_URL}/admin/businesses/${businessId}/unverify`, {})
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  toggleBusinessStatus(businessId: string): Observable<{ message: string }> {
    this.clearError();
    return this.http.patch<{ message: string }>(`${this.API_URL}/admin/businesses/${businessId}/status`, {})
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  updateBusinessStatus(businessId: string, updateData: UpdateBusinessStatusDto): Observable<{ message: string }> {
    this.clearError();
    return this.http.patch<{ message: string }>(`${this.API_URL}/admin/businesses/${businessId}/status`, updateData)
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  getPendingBusinesses(page: number = 1, limit: number = 10): Observable<PaginatedResponse<Business>> {
    this.clearError();
    
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<PaginatedResponse<Business>>(`${this.API_URL}/admin/businesses/pending-review`, { params })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  getBusinessOnboardingDetails(businessId: string): Observable<any> {
    this.clearError();
    return this.http.get<any>(`${this.API_URL}/admin/businesses/${businessId}/onboarding-details`)
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  verifyDocument(documentId: string, verifyData: VerifyDocumentDto): Observable<{ message: string }> {
    this.clearError();
    return this.http.patch<{ message: string }>(`${this.API_URL}/admin/documents/${documentId}/verify`, verifyData)
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  // Fraud Report Management
  getAllFraudReports(
    page: number = 1,
    limit: number = 10,
    status?: string,
    businessId?: string
  ): Observable<PaginatedResponse<FraudReport>> {
    this.clearError();
    
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (status) params = params.set('status', status);
    if (businessId) params = params.set('businessId', businessId);

    return this.http.get<PaginatedResponse<FraudReport>>(`${this.API_URL}/admin/fraud-reports`, { params })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  updateFraudReportStatus(reportId: string, updateData: UpdateFraudReportStatusDto): Observable<{ message: string }> {
    this.clearError();
    return this.http.patch<{ message: string }>(`${this.API_URL}/admin/fraud-reports/${reportId}/status`, updateData)
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  // Flagged Users Management
  getFlaggedUsers(page: number = 1, limit: number = 10): Observable<PaginatedResponse<User>> {
    this.clearError();
    
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<PaginatedResponse<User>>(`${this.API_URL}/admin/flagged-users`, { params })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  unflagUser(userId: string, reason?: string): Observable<{ message: string }> {
    this.clearError();
    return this.http.patch<{ message: string }>(`${this.API_URL}/admin/flagged-users/${userId}/unflag`, { reason })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  getUserAnalysis(userId: string): Observable<any> {
    this.clearError();
    return this.http.get<any>(`${this.API_URL}/admin/flagged-users/${userId}/analysis`)
      .pipe(
        catchError(error => this.handleError(error))
      );
  }
}
