import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { firstValueFrom } from 'rxjs';
import {
  UserDashboardService,
  UserDashboardResponse,
} from '../../core/services/user-dashboard.service';

interface DashboardStats {
  totalReviews: number;
  totalBusinesses: number;
  averageRating: number;
  monthlyGrowth: number;
  verifiedBusinesses: number;
}

interface RecentActivity {
  id: string;
  type: 'review' | 'business_created' | 'document_uploaded' | 'payment_added';
  title: string;
  description: string;
  timestamp: Date;
  status?: 'verified' | 'pending' | 'rejected';
  businessName?: string;
  rating?: number;
}

interface BusinessCard {
  id: string;
  name: string;
  category: string;
  grade: string;
  reviewCount: number;
  averageRating: number;
  isVerified: boolean;
  lastActivity: Date | null;
}

interface QuickAction {
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Inject services
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private userDashboardService = inject(UserDashboardService);

  // Authentication state
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  // Dashboard data
  dashboardStats: DashboardStats = {
    totalReviews: 0,
    totalBusinesses: 0,
    averageRating: 0,
    monthlyGrowth: 0,
    verifiedBusinesses: 0
  };

  recentActivities: RecentActivity[] = [];
  userBusinesses: BusinessCard[] = [];
  isLoading = true;
  selectedTimeframe = 'week';

  // Quick actions based on user role
  quickActions: QuickAction[] = [];

  // Chart data — computed from real activity after load
  reviewTrendData: { day: string; reviews: number }[] = [];

  ngOnInit() {
    // Check if user is a business owner and redirect to business dashboard
    const user = this.currentUser();
    if (user?.role === 'business' || user?.role === 'BUSINESS_OWNER') {
      // Redirect to business dashboard
      window.location.href = '/business/dashboard';
      return;
    }
    
    this.loadDashboardData();
    this.setupQuickActions();
  }

  ngOnDestroy() {
    // Clean up any subscriptions
  }

  private setupQuickActions() {
    const user = this.currentUser();
    if (user?.role === 'business' || user?.role === 'BUSINESS_OWNER') {
      this.quickActions = [
        {
          title: 'My Business',
          description: 'Manage your business profile',
          icon: 'uil uil-plus-circle',
          route: '/business/my-business',
          color: 'bg-blue-500'
        },
        {
          title: 'Upload Documents',
          description: 'Verify your business',
          icon: 'uil uil-file-upload-alt',
          route: '/business/my-business',
          color: 'bg-green-500'
        },
        {
          title: 'View Analytics',
          description: 'Business performance',
          icon: 'uil uil-chart-line',
          route: '/business/analytics',
          color: 'bg-blue-500'
        },
        {
          title: 'Manage Reviews',
          description: 'Respond to feedback',
          icon: 'uil uil-comment-dots',
          route: '/business/dashboard',
          color: 'bg-orange-500'
        }
      ];
    } else {
      this.quickActions = [
        {
          title: 'My Reviews',
          description: 'View all your reviews',
          icon: 'uil uil-star',
          route: '/my-reviews',
          color: 'bg-purple-500'
        },
        {
          title: 'Search Businesses',
          description: 'Find trusted businesses',
          icon: 'uil uil-search',
          route: '/search',
          color: 'bg-green-500'
        },
        {
          title: 'Report Fraud',
          description: 'Flag suspicious activity',
          icon: 'uil uil-shield-exclamation',
          route: '/search',
          color: 'bg-red-500'
        },
        {
          title: 'View Profile',
          description: 'Manage your account',
          icon: 'uil uil-user-circle',
          route: '/profile',
          color: 'bg-blue-500'
        }
      ];
    }
  }

  private async loadDashboardData() {
    try {
      this.isLoading = true;
      
      // Load real data based on user role
      const user = this.currentUser();
      if (!user) {
        this.isLoading = false;
        return;
      }

      const dashboard = await firstValueFrom(
        this.userDashboardService.getDashboard()
      );

      this.setDashboardStats(dashboard);
      this.setRecentActivities(dashboard);
      this.setUserBusinesses(dashboard);
      this.buildReviewTrendData();

      this.isLoading = false;
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.toastService.error('Failed to load dashboard data');
      this.isLoading = false;
    }
  }

  private setDashboardStats(dashboard: UserDashboardResponse) {
    this.dashboardStats = {
      totalReviews: dashboard.stats?.totalReviews ?? 0,
      totalBusinesses: dashboard.stats?.totalBusinesses ?? 0,
      averageRating: Number(dashboard.stats?.averageRating ?? 0),
      monthlyGrowth: dashboard.stats?.monthlyGrowth ?? 0,
      verifiedBusinesses: dashboard.stats?.verifiedBusinesses ?? 0,
    };
  }

  private setRecentActivities(dashboard: UserDashboardResponse) {
    this.recentActivities = (dashboard.recentActivity ?? []).map((activity) => ({
      id: activity.id,
      type: this.mapActivityType(activity.type),
      title: activity.title,
      description: activity.description ?? '',
      timestamp: new Date(activity.timestamp),
      status: this.mapActivityStatus(activity.status ?? undefined),
      businessName: activity.businessName ?? undefined,
      rating: activity.rating ?? undefined,
    }));
  }

  private setUserBusinesses(dashboard: UserDashboardResponse) {
    this.userBusinesses = (dashboard.businesses ?? []).map((business) => ({
      id: business.id,
      name: business.name,
      category: business.category,
      grade: business.grade,
      reviewCount: business.reviewCount ?? 0,
      averageRating: Number(business.averageRating ?? 0),
      isVerified: business.isVerified ?? false,
      lastActivity: business.lastActivity ? new Date(business.lastActivity) : null,
    }));
  }

  private buildReviewTrendData() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    for (const activity of this.recentActivities) {
      if (activity.type === 'review') {
        const dayName = days[activity.timestamp.getDay()];
        counts[dayName] = (counts[dayName] ?? 0) + 1;
      }
    }
    // Order Mon–Sun
    const ordered = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    this.reviewTrendData = ordered.map(day => ({ day, reviews: counts[day] ?? 0 }));
  }

  getMaxReviews(): number {
    return Math.max(...this.reviewTrendData.map(d => d.reviews), 1);
  }

  getBarHeight(reviews: number): number {
    return reviews > 0 ? Math.max(6, Math.round((reviews / this.getMaxReviews()) * 160)) : 4;
  }

  getTimeframeLabel(): string {
    switch (this.selectedTimeframe) {
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'year': return 'This Year';
      default: return 'This Week';
    }
  }

  getTotalReviews(): number {
    return this.reviewTrendData.reduce((sum, d) => sum + d.reviews, 0);
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'review': return 'uil uil-star';
      case 'business_created': return 'uil uil-building';
      case 'document_uploaded': return 'uil uil-file-upload-alt';
      case 'payment_added': return 'uil uil-credit-card';
      default: return 'uil uil-bell';
    }
  }

  getActivityColor(type: string): string {
    switch (type) {
      case 'review': return 'text-yellow-500';
      case 'business_created': return 'text-green-500';
      case 'document_uploaded': return 'text-blue-500';
      case 'payment_added': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  }

  getStatusColor(status?: string): string {
    switch (status) {
      case 'verified': return 'text-green-500 bg-green-100';
      case 'pending': return 'text-yellow-500 bg-yellow-100';
      case 'rejected': return 'text-red-500 bg-red-100';
      default: return 'text-gray-500 bg-gray-100';
    }
  }

  getTrustGradeColor(grade: string): string {
    switch (grade) {
      case 'A+': return 'bg-green-500';
      case 'A': return 'bg-blue-500';
      case 'B+': case 'B': return 'bg-yellow-500';
      case 'C+': case 'C': return 'bg-orange-500';
      case 'D+': case 'D': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  }

  formatTimeAgo(date: Date | null | undefined): string {
    if (!date) {
      return 'No recent activity';
    }
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  }

  getUserInitials(user: User): string {
    if (!user || !user.name) return '';
    const nameParts = user.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[1] || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }

  getProfileImageUrl(): string | null {
    const user = this.currentUser();
    if (user?.avatar) {
      return user.avatar;
    }
    return localStorage.getItem('profileImage');
  }

  getCustomerReputationLevel(): string {
    const user = this.currentUser();
    if (!user || user.role !== 'user') return '';
    const rep = user.reputation ?? 0;
    if (rep >= 90) return 'Elite Reviewer';
    if (rep >= 75) return 'Trusted Member';
    if (rep >= 60) return 'Active User';
    if (rep >= 40) return 'Regular User';
    return 'New Member';
  }

  getReputationColor(): string {
    const user = this.currentUser();
    if (!user || user.role !== 'user') return '';
    const rep = user.reputation ?? 0;
    if (rep >= 90) return 'text-blue-600';
    if (rep >= 75) return 'text-blue-600';
    if (rep >= 60) return 'text-green-600';
    if (rep >= 40) return 'text-yellow-600';
    return 'text-gray-600';
  }

  private mapActivityType(type: string): RecentActivity['type'] {
    switch (type) {
      case 'business':
      case 'business_created':
        return 'business_created';
      case 'document':
      case 'document_uploaded':
        return 'document_uploaded';
      case 'payment':
      case 'payment_added':
        return 'payment_added';
      default:
        return 'review';
    }
  }

  private mapActivityStatus(
    status?: string,
  ): RecentActivity['status'] | undefined {
    if (!status) {
      return undefined;
    }

    switch (status.toLowerCase()) {
      case 'verified':
        return 'verified';
      case 'pending':
      case 'under_review':
        return 'pending';
      case 'rejected':
        return 'rejected';
      default:
        return undefined;
    }
  }

  logout() {
    const userName = this.currentUser()?.name || 'User';
    this.authService.logout(true); // Redirect to home
    this.toastService.info(`Goodbye, ${userName}! You have been logged out successfully.`);
  }
}
