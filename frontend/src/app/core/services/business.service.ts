import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

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
    
    return this.http.get<Business[]>(`${this.API_URL}/businesses`)
      .pipe(
        tap(businesses => {
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

  getBusinessById(id: string): Observable<Business> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.get<Business>(`${this.API_URL}/businesses/${id}`)
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
    
    return this.http.post<Business>(`${this.API_URL}/businesses`, businessData)
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
    
    return this.http.put<Business>(`${this.API_URL}/businesses/${businessData.id}`, businessData)
      .pipe(
        tap(business => {
          this.currentBusiness.set(business);
          this.isLoading.set(false);
        }),
        catchError(error => {
          this.error.set('Failed to update business');
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  deleteBusiness(id: string): Observable<void> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.delete<void>(`${this.API_URL}/businesses/${id}`)
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
    
    return this.http.get<Business[]>(`${this.API_URL}/businesses/search?q=${encodeURIComponent(query)}`)
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
    
    return this.http.get<Business[]>(`${this.API_URL}/businesses/category/${encodeURIComponent(category)}`)
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
}

