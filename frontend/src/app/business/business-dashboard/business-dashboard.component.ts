import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../core/services/auth.service';
import { BusinessService, Business, BusinessAnalytics, BusinessStatus } from '../../shared/services/business.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Subject, takeUntil } from 'rxjs';

interface BusinessDashboardStats {
  totalReviews: number;
  totalCustomers: number;
  averageRating: number;
  trustScore: number;
  monthlyGrowth: number;
  verificationStatus: 'verified' | 'pending' | 'not_verified';
  responseRate: number;
  pendingReviews: number;
  revenueGrowth: number;
  customerSatisfaction: number;
  businessGrade: string;
}

interface RecentActivity {
  id: string;
  type: 'review' | 'customer_registration' | 'document_verified' | 'payment_received' | 'review_response' | 'business_update' | 'verification_status';
  title: string;
  description: string;
  timestamp: Date;
  status?: string;
  customerName?: string;
  rating?: number;
  amount?: number;
  priority?: string;
}

interface CustomerCard {
  id: string;
  name: string;
  email: string;
  trustScore?: number;
  grade: string;
  reviewCount: number;
  averageRating: number;
  isVerified?: boolean;
  lastActivity: Date;
}

interface QuickAction {
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
}

@Component({
  selector: 'app-business-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './business-dashboard.component.html',
  styleUrl: './business-dashboard.component.css'
})
export class BusinessDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Inject services
  private authService = inject(AuthService);
  private businessService = inject(BusinessService);
  private toastService = inject(ToastService);

  // Authentication state
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  // Business data
  currentBusiness: Business | null = null;
  businessAnalytics: BusinessAnalytics | null = null;
  isLoading = true;
  selectedTimeframe = 'week';
  cachedReputationLevel: string = '';

  // Dashboard data - will be populated from real API
  dashboardStats: BusinessDashboardStats = {
    totalReviews: 0,
    totalCustomers: 0,
    averageRating: 0,
    trustScore: 0,
    monthlyGrowth: 0,
    verificationStatus: 'not_verified',
    responseRate: 0,
    pendingReviews: 0,
    revenueGrowth: 0,
    customerSatisfaction: 0,
    businessGrade: 'N/A'
  };

  recentActivities: RecentActivity[] = [];
  businessCustomers: CustomerCard[] = [];

  // Quick actions for business owners
  quickActions: QuickAction[] = [
    {
      title: 'My Business',
      description: 'Manage business profile',
      icon: 'uil uil-building',
      route: '/business/my-business',
      color: 'bg-blue-600'
    },
    {
      title: 'Respond to Reviews',
      description: 'Manage customer feedback',
      icon: 'uil uil-comment-dots',
      route: '/business/reviews',
      color: 'bg-blue-600'
    },
    {
      title: 'Business Analytics',
      description: 'Performance insights',
      icon: 'uil uil-chart-line',
      route: '/business/analytics',
      color: 'bg-blue-600'
    },
    {
      title: 'Upload Documents',
      description: 'Verify your business',
      icon: 'uil uil-file-upload-alt',
      route: '/business/my-business',
      color: 'bg-blue-600'
    }
  ];

  // Chart data - will be populated from real analytics
  reviewTrendData: Array<{ day: string; reviews: number; height: number }> = [
    { day: 'Mon', reviews: 0, height: 8 },
    { day: 'Tue', reviews: 0, height: 8 },
    { day: 'Wed', reviews: 0, height: 8 },
    { day: 'Thu', reviews: 0, height: 8 },
    { day: 'Fri', reviews: 0, height: 8 },
    { day: 'Sat', reviews: 0, height: 8 },
    { day: 'Sun', reviews: 0, height: 8 }
  ];

  businessCategories = [
    { name: 'Retail', count: 0, color: 'bg-blue-600' },
    { name: 'Restaurant', count: 0, color: 'bg-blue-600' },
    { name: 'Services', count: 0, color: 'bg-blue-600' },
    { name: 'Technology', count: 0, color: 'bg-blue-600' }
  ];

  ngOnInit() {
    // Check if user is not a business owner and redirect to customer dashboard
    const user = this.currentUser();
    if (user?.role !== 'business' && user?.role !== 'BUSINESS_OWNER') {
      // Redirect to customer dashboard
      window.location.href = '/dashboard';
      return;
    }
    
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData() {
    const user = this.currentUser();
    if (!user) {
      this.isLoading = false;
      return;
    }

    // Load user's businesses first
    this.businessService.getUserBusinesses(1, 1)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.businesses.length > 0) {
            const business = response.businesses[0]; // Get first business
            this.currentBusiness = business;
            this.loadBusinessAnalytics(business.id);
            this.updateDashboardStats(business);
          } else {
            this.isLoading = false;
            this.toastService.warning('No business found. Please create a business first.');
          }
        },
        error: (error) => {
          console.error('Error loading businesses:', error);
          this.toastService.error('Failed to load business data');
          this.isLoading = false;
        }
      });
  }

  private loadBusinessAnalytics(businessId: string) {
    this.businessService.getBusinessAnalytics(businessId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (analytics) => {
          this.businessAnalytics = analytics;
          this.updateDashboardStatsFromAnalytics(analytics);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading business analytics:', error);
          this.toastService.error('Failed to load business analytics');
          this.isLoading = false;
        }
      });
  }

  private updateDashboardStats(business: Business) {
    this.dashboardStats.verificationStatus = this.businessService.getVerificationStatus(business);
    
    if (business.trustScore) {
      const trustScoreValue = this.businessService.getTrustScoreValue(business.trustScore);
      this.dashboardStats.trustScore = trustScoreValue;
      this.dashboardStats.businessGrade = trustScoreValue > 0
        ? this.businessService.getBusinessGrade(business.trustScore)
        : 'N/A';
      this.cachedReputationLevel = '';
    } else {
      this.dashboardStats.trustScore = 0;
      this.dashboardStats.businessGrade = 'N/A';
    }
  }

  private updateDashboardStatsFromAnalytics(analytics: BusinessAnalytics) {
    this.dashboardStats.totalReviews = analytics.totalReviews;
    this.dashboardStats.totalCustomers = analytics.totalCustomers;
    this.dashboardStats.averageRating = Number(analytics.averageRating.toFixed(2));
    this.dashboardStats.monthlyGrowth = Math.round(analytics.monthlyGrowth);
    this.dashboardStats.responseRate = analytics.responseRate;
    this.dashboardStats.pendingReviews = analytics.pendingReviews;
    this.dashboardStats.revenueGrowth = Math.round(analytics.revenueGrowth);
    this.dashboardStats.customerSatisfaction = analytics.customerSatisfaction;
    this.dashboardStats.verificationStatus = analytics.verificationStatus;

    if (analytics.trustScore) {
      const trustScoreValue = analytics.trustScore.score ?? 0;
      this.dashboardStats.trustScore = trustScoreValue;
      this.dashboardStats.businessGrade = trustScoreValue > 0
        ? (analytics.trustScore.grade || this.businessService.getBusinessGrade(analytics.trustScore))
        : 'N/A';
      this.cachedReputationLevel = '';
    } else {
      this.dashboardStats.trustScore = 0;
      this.dashboardStats.businessGrade = 'N/A';
    }

    if (analytics.reviewTrends && analytics.reviewTrends.length > 0) {
      const maxReviews = Math.max(...analytics.reviewTrends.map(trend => trend.reviews), 1);
      this.reviewTrendData = analytics.reviewTrends.map(trend => ({
        day: new Date(trend.date).toLocaleDateString('en-US', { weekday: 'short' }),
        reviews: trend.reviews,
        height: Math.max(8, Math.round((trend.reviews / maxReviews) * 80)),
      }));
    } else {
      this.reviewTrendData = [
        { day: 'Mon', reviews: 0, height: 8 },
        { day: 'Tue', reviews: 0, height: 8 },
        { day: 'Wed', reviews: 0, height: 8 },
        { day: 'Thu', reviews: 0, height: 8 },
        { day: 'Fri', reviews: 0, height: 8 },
        { day: 'Sat', reviews: 0, height: 8 },
        { day: 'Sun', reviews: 0, height: 8 },
      ];
    }

    this.recentActivities = analytics.recentActivities || [];
    this.businessCustomers = (analytics.topCustomers || []).map(customer => ({
      ...customer,
      lastActivity: new Date(customer.lastActivity),
    }));
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
      case 'customer_registration': return 'uil uil-user-plus';
      case 'document_verified': return 'uil uil-file-check-alt';
      case 'payment_received': return 'uil uil-credit-card';
      case 'review_response': return 'uil uil-comment-dots';
      case 'business_update': return 'uil uil-edit';
      case 'verification_status': return 'uil uil-shield-check';
      default: return 'uil uil-bell';
    }
  }

  getActivityColor(type: string): string {
    switch (type) {
      case 'review': return 'text-yellow-500';
      case 'customer_registration': return 'text-green-500';
      case 'document_verified': return 'text-blue-500';
      case 'payment_received': return 'text-blue-500';
      case 'review_response': return 'text-indigo-500';
      case 'business_update': return 'text-orange-500';
      case 'verification_status': return 'text-green-500';
      default: return 'text-gray-500';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }

  getStatusLabel(activity: RecentActivity): string | undefined {
    if (!activity.status) {
      return undefined;
    }

    const title = activity.title?.toLowerCase() ?? '';
    const description = activity.description?.toLowerCase() ?? '';
    const status = activity.status.toLowerCase();

    const isPaymentMethodActivity =
      (activity.type === 'business_update' || activity.type === 'payment_received') &&
      (title.includes('payment method') ||
        description.includes('payment method') ||
        description.includes('payment reference'));

    if (isPaymentMethodActivity) {
      const isSendMoney =
        title.includes('send money') ||
        title.includes('send_money') ||
        description.includes('send money') ||
        description.includes('send_money');

      if (isSendMoney) {
        return 'verified';
      }

      if (status === 'pending') {
        return 'added';
      }

      return status;
    }

    return status;
  }

  getStatusColor(status?: string): string {
    const normalized = status?.toLowerCase();
    switch (normalized) {
      case 'verified': return 'text-green-500 bg-green-100';
      case 'added': return 'text-green-500 bg-green-100';
      case 'pending': return 'text-yellow-500 bg-yellow-100';
      case 'rejected': return 'text-red-500 bg-red-100';
      case 'responded': return 'text-blue-500 bg-blue-100';
      default: return 'text-gray-500 bg-gray-100';
    }
  }

  getTrustScoreColor(score: number): string {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
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

  formatTimeAgo(date: Date | string): string {
    const targetDate = new Date(date);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);
    
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

  getBusinessReputationLevel(): string {
    const user = this.currentUser();
    if (!user || (user.role !== 'business' && user.role !== 'BUSINESS_OWNER')) {
      return '';
    }

    if (this.cachedReputationLevel) {
      return this.cachedReputationLevel;
    }

    const grade = this.dashboardStats.businessGrade;
    let reputation: string;
    switch (grade) {
      case 'A+':
      case 'A':
        reputation = 'Elite Business';
        break;
      case 'B+':
      case 'B':
        reputation = 'Trusted Partner';
        break;
      case 'C+':
      case 'C':
        reputation = 'Verified Business';
        break;
      case 'D+':
      case 'D':
        reputation = 'Active Business';
        break;
      case 'N/A':
        reputation = 'New Business';
        break;
      case 'E':
      case 'F':
      default:
        reputation = 'Developing Business';
        break;
    }

    this.cachedReputationLevel = reputation;
    return reputation;
  }

  getReputationColor(): string {
    const grade = this.dashboardStats.businessGrade;
    switch (grade) {
      case 'A+':
      case 'A':
        return 'text-green-600';
      case 'B+':
      case 'B':
        return 'text-blue-600';
      case 'C+':
      case 'C':
        return 'text-yellow-600';
      case 'D+':
      case 'D':
        return 'text-orange-600';
      case 'E':
      case 'F':
      default:
        return 'text-gray-600';
    }
  }

  getVerificationStatusImage(): string {
    switch (this.dashboardStats.verificationStatus) {
      case 'verified': return '/images/verfied.png';
      case 'pending': return '/images/pending.png';
      case 'not_verified': return '/images/not.png';
      default: return '/images/not.png';
    }
  }

  getVerificationStatusText(): { title: string; description: string; color: string } {
    switch (this.dashboardStats.verificationStatus) {
      case 'verified':
        return {
          title: 'Verified',
          description: 'Business is verified',
          color: 'text-green-600'
        };
      case 'pending':
        return {
          title: 'Verification Pending',
          description: 'Awaiting verification',
          color: 'text-orange-600'
        };
      case 'not_verified':
      default:
        return {
          title: 'Not Verified',
          description: 'Complete verification process',
          color: 'text-red-600'
        };
    }
  }

  getVerificationStatusIcon(): string {
    switch (this.dashboardStats.verificationStatus) {
      case 'verified': return 'fas fa-check-circle';
      case 'pending': return 'fas fa-clock';
      case 'not_verified': return 'fas fa-exclamation-triangle';
      default: return 'fas fa-exclamation-triangle';
    }
  }
}
