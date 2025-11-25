import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserDashboardStatsResponse {
  totalReviews: number;
  totalBusinesses: number;
  averageRating: number;
  verifiedBusinesses: number;
  monthlyGrowth: number;
}

export interface UserDashboardActivityResponse {
  id: string;
  type: string;
  title: string;
  description: string | null;
  timestamp: string;
  status?: string | null;
  businessName?: string | null;
  rating?: number | null;
}

export interface UserDashboardBusinessResponse {
  id: string;
  name: string;
  category: string;
  grade: string;
  reviewCount: number;
  averageRating: number;
  isVerified: boolean;
  lastActivity: string | null;
}

export interface UserDashboardResponse {
  stats: UserDashboardStatsResponse;
  recentActivity: UserDashboardActivityResponse[];
  businesses: UserDashboardBusinessResponse[];
}

@Injectable({
  providedIn: 'root',
})
export class UserDashboardService {
  private readonly API_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<UserDashboardResponse> {
    return this.http.get<UserDashboardResponse>(`${this.API_URL}/user/dashboard`);
  }
}



