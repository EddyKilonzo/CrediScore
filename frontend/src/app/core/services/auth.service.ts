import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, map } from 'rxjs/operators';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'ADMIN' | 'business' | 'user' | 'BUSINESS_OWNER' | 'CUSTOMER';
  isVerified: boolean;
  isActive: boolean;
  avatar?: string; // Profile image URL from database
  phone?: string; // Phone number
  bio?: string; // User bio
  reputation?: number;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    reviews: number;
    businesses: number;
    fraudReports: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: 'business' | 'user';
  phone?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  accessToken?: string; // Backend returns this field
}

// Backend signup response structure (direct user data)
export interface SignUpResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  avatar?: string;
  createdAt: Date;
  accessToken: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:3000/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // Signals for reactive state
  public isAuthenticated = signal(false);
  public currentUser = signal<User | null>(null);
  public isLoading = signal(false);

  constructor(private http: HttpClient) {
    this.initializeAuth();
  }

  private initializeAuth(): void {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      try {
        const parsedUser = JSON.parse(user);
        this.currentUserSubject.next(parsedUser);
        this.currentUser.set(parsedUser);
        this.isAuthenticated.set(true);
      } catch (error) {
        this.logout();
      }
    }
  }

  signInWithGoogle(): void {
    // Redirect to Google OAuth endpoint on backend
    try {
      const googleAuthUrl = 'http://localhost:3000/api/auth/google';
      window.location.href = googleAuthUrl;
    } catch (error) {
      console.error('Failed to redirect to Google OAuth:', error);
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    this.isLoading.set(true);
    
    return this.http.post<any>(`${this.API_URL}/auth/login`, credentials)
      .pipe(
        map(response => {
          // Transform backend LoginResponseDto to frontend AuthResponse format
          const authResponse: AuthResponse = {
            user: {
              id: response.id,
              email: response.email,
              name: response.name,
              role: response.role as 'admin' | 'ADMIN' | 'business' | 'user' | 'BUSINESS_OWNER' | 'CUSTOMER',
              isVerified: response.emailVerified || response.isVerified || false,
              isActive: response.isActive !== undefined ? response.isActive : true,
              avatar: response.avatar,
              phone: response.phone,
              reputation: response.reputation || 0,
              lastLoginAt: response.lastLoginAt,
              createdAt: response.createdAt,
              updatedAt: response.updatedAt,
              _count: response._count || { reviews: 0, businesses: 0, fraudReports: 0 }
            },
            token: response.accessToken,
            accessToken: response.accessToken
          };
          return authResponse;
        }),
        tap(response => {
          this.setAuthDataInternal(response);
          this.isLoading.set(false);
        })
      );
  }

  register(userData: RegisterRequest): Observable<AuthResponse> {
    this.isLoading.set(true);
    
    return this.http.post<SignUpResponse>(`${this.API_URL}/auth/signup`, userData)
      .pipe(
        tap(response => {
          // Transform SignUpResponse to AuthResponse format
          const authResponse: AuthResponse = {
            user: {
              id: response.id,
              email: response.email,
              name: response.name,
              role: response.role as 'admin' | 'ADMIN' | 'business' | 'user' | 'BUSINESS_OWNER' | 'CUSTOMER',
              isVerified: true, // New signups are considered verified
              isActive: true, // New signups are active by default
              avatar: response.avatar,
              phone: response.phone,
              reputation: 0, // New users start with 0 reputation
              createdAt: response.createdAt?.toString() || new Date().toISOString(),
              updatedAt: response.createdAt?.toString() || new Date().toISOString(),
              _count: { reviews: 0, businesses: 0, fraudReports: 0 }
            },
            token: response.accessToken,
            accessToken: response.accessToken
          };
          this.setAuthDataInternal(authResponse);
          this.isLoading.set(false);
        }),
        map(response => {
          // Transform SignUpResponse to AuthResponse format
          return {
            user: {
              id: response.id,
              email: response.email,
              name: response.name,
              role: response.role as 'admin' | 'ADMIN' | 'business' | 'user' | 'BUSINESS_OWNER' | 'CUSTOMER',
              isVerified: true, // New signups are considered verified
              isActive: true, // New signups are active by default
              avatar: response.avatar,
              phone: response.phone,
              reputation: 0, // New users start with 0 reputation
              createdAt: response.createdAt?.toString() || new Date().toISOString(),
              updatedAt: response.createdAt?.toString() || new Date().toISOString(),
              _count: { reviews: 0, businesses: 0, fraudReports: 0 }
            },
            token: response.accessToken,
            accessToken: response.accessToken
          } as AuthResponse;
        })
      );
  }

  logout(redirectToHome: boolean = false): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    
    // Redirect to home if requested
    if (redirectToHome) {
      window.location.href = '/';
    }
  }

  private setAuthDataInternal(response: AuthResponse): void {
    // Handle both token formats (backend returns accessToken)
    const token = response.accessToken || response.token;
    localStorage.setItem('token', token);
    
    // Store only essential user data, exclude large base64 avatar data
    const userForStorage = {
      id: response.user.id,
      email: response.user.email,
      name: response.user.name,
      role: response.user.role,
      isVerified: response.user.isVerified,
      isActive: response.user.isActive,
      phone: response.user.phone,
      bio: response.user.bio,
      reputation: response.user.reputation,
      lastLoginAt: response.user.lastLoginAt,
      createdAt: response.user.createdAt,
      updatedAt: response.user.updatedAt,
      // Only store avatar if it's a URL (not base64 data)
      avatar: response.user.avatar?.startsWith('http') ? response.user.avatar : undefined
    };
    
    localStorage.setItem('user', JSON.stringify(userForStorage));
    
    // Store the full user object in memory (including base64 avatar)
    this.currentUserSubject.next(response.user);
    this.currentUser.set(response.user);
    this.isAuthenticated.set(true);
  }

  setAuthData(response: AuthResponse): void {
    try {
      this.setAuthDataInternal(response);
    } catch (error) {
      console.error('Error setting auth data:', error);
      // Fallback: store minimal data
      const token = response.accessToken || response.token;
      if (token) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify({
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
          role: response.user.role,
          isVerified: response.user.isVerified
        }));
        this.currentUserSubject.next(response.user);
        this.currentUser.set(response.user);
        this.isAuthenticated.set(true);
      }
    }
  }

  updateUserData(user: User): void {
    // Store only essential user data, exclude large base64 avatar data
    const userForStorage = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive,
      phone: user.phone,
      bio: user.bio,
      reputation: user.reputation,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      // Only store avatar if it's a URL (not base64 data)
      avatar: user.avatar?.startsWith('http') ? user.avatar : undefined
    };
    
    localStorage.setItem('user', JSON.stringify(userForStorage));
    this.currentUserSubject.next(user);
    this.currentUser.set(user);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  hasRole(role: string): boolean {
    const user = this.currentUser();
    return user?.role === role;
  }

  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  isBusiness(): boolean {
    return this.hasRole('business') || this.hasRole('BUSINESS_OWNER');
  }

  isUser(): boolean {
    return this.hasRole('user') || this.hasRole('CUSTOMER');
  }

  updateProfile(updateData: Partial<User>): Observable<User> {
    const token = this.getToken();
    const headers = { 'Authorization': `Bearer ${token}` };
    
    return this.http.patch<User>(`${this.API_URL}/user/profile`, updateData, { headers });
  }

  // Email verification methods
  verifyEmail(code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/auth/verify-email`, {
      token: code
    });
  }

  resendVerificationCode(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/auth/resend-verification`, {
      email: email
    });
  }
}