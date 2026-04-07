import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { firstValueFrom } from 'rxjs';
import { TPipe } from '../../shared/pipes/t.pipe';
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
  credibility?: number;
  helpfulCount?: number;
  notHelpfulCount?: number;
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

interface ReviewerTier {
  name: string;
  min: number;
  max: number;
  colorClass: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TPipe],
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
  readonly reviewerTiers: ReviewerTier[] = [
    { name: 'Elite', min: 90, max: 100, colorClass: 'text-[#2C5270]' },
    { name: 'Trusted', min: 75, max: 89, colorClass: 'text-[#3E6A8A]' },
    { name: 'Reliable', min: 60, max: 74, colorClass: 'text-[#5C8BA5]' },
    { name: 'Growing', min: 40, max: 59, colorClass: 'text-[#7EA5BD]' },
    { name: 'New Reviewer', min: 0, max: 39, colorClass: 'text-[#94a3b8]' }
  ];

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
          route: '/report-business',
          color: 'bg-red-500'
        },
        {
          title: 'Business Map',
          description: 'Browse nearby businesses',
          icon: 'uil uil-map-marker',
          route: '/map',
          color: 'bg-blue-500'
        },
        {
          title: 'Bookmarks',
          description: 'Open saved businesses',
          icon: 'uil uil-bookmark',
          route: '/bookmarks',
          color: 'bg-yellow-500'
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
      credibility: activity.credibility ?? undefined,
      helpfulCount: activity.helpfulCount ?? 0,
      notHelpfulCount: activity.notHelpfulCount ?? 0,
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
    const reviewActivities = this.recentActivities.filter(
      (activity) => activity.type === 'review'
    );

    if (this.selectedTimeframe === 'week') {
      const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const counts: Record<string, number> = {
        Mon: 0,
        Tue: 0,
        Wed: 0,
        Thu: 0,
        Fri: 0,
        Sat: 0,
        Sun: 0,
      };

      const now = new Date();
      const startOfWeek = new Date(now);
      const day = now.getDay(); // Sun=0, Mon=1 ... Sat=6
      const daysSinceMonday = day === 0 ? 6 : day - 1;
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(now.getDate() - daysSinceMonday);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      for (const activity of reviewActivities) {
        const ts = new Date(activity.timestamp);
        if (ts >= startOfWeek && ts < endOfWeek) {
          const idx = ts.getDay(); // Sun=0..Sat=6
          const label = idx === 0 ? 'Sun' : dayLabels[idx - 1];
          counts[label] = (counts[label] ?? 0) + 1;
        }
      }

      this.reviewTrendData = dayLabels.map((label) => ({
        day: label,
        reviews: counts[label] ?? 0,
      }));
      return;
    }

    if (this.selectedTimeframe === 'month') {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
      const counts: Record<string, number> = {
        W1: 0,
        W2: 0,
        W3: 0,
        W4: 0,
        W5: 0,
        W6: 0,
      };

      for (const activity of reviewActivities) {
        const ts = new Date(activity.timestamp);
        if (ts.getFullYear() !== year || ts.getMonth() !== month) continue;

        const weekIndex = Math.min(5, Math.floor((ts.getDate() - 1) / 7));
        const key = weeks[weekIndex];
        counts[key] = (counts[key] ?? 0) + 1;
      }

      this.reviewTrendData = weeks.map((label) => ({
        day: label,
        reviews: counts[label] ?? 0,
      }));
      return;
    }

    // year
    const now = new Date();
    const year = now.getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const counts: Record<string, number> = {
      Jan: 0,
      Feb: 0,
      Mar: 0,
      Apr: 0,
      May: 0,
      Jun: 0,
      Jul: 0,
      Aug: 0,
      Sep: 0,
      Oct: 0,
      Nov: 0,
      Dec: 0,
    };

    for (const activity of reviewActivities) {
      const ts = new Date(activity.timestamp);
      if (ts.getFullYear() !== year) continue;
      const key = months[ts.getMonth()];
      counts[key] = (counts[key] ?? 0) + 1;
    }

    this.reviewTrendData = months.map((label) => ({
      day: label,
      reviews: counts[label] ?? 0,
    }));
  }

  onTimeframeChange() {
    this.buildReviewTrendData();
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
    const role = (user?.role ?? '').toString().trim().toUpperCase();
    if (!user || (role !== 'USER' && role !== 'CUSTOMER')) return 'New Reviewer';
    return this.getCurrentReviewerTier().name;
  }

  getReviewedBusinessesCount(): number {
    const reviewed = new Set(
      this.recentActivities
        .filter(activity => activity.type === 'review' && !!activity.businessName)
        .map(activity => activity.businessName as string)
    );
    return reviewed.size;
  }

  getVerifiedActivityCount(): number {
    return this.recentActivities.filter(activity => activity.status === 'verified').length;
  }

  getPendingActivityCount(): number {
    return this.recentActivities.filter(activity => activity.status === 'pending').length;
  }

  getReputationColor(): string {
    const user = this.currentUser();
    const role = (user?.role ?? '').toString().trim().toUpperCase();
    if (!user || (role !== 'USER' && role !== 'CUSTOMER')) return 'text-gray-600';
    return this.getCurrentReviewerTier().colorClass;
  }

  getCurrentReviewerScore(): number {
    const user = this.currentUser();
    const score = Number(user?.reputation ?? 0);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  getCurrentReviewerTier(): ReviewerTier {
    const score = this.getCurrentReviewerScore();
    return (
      this.reviewerTiers.find((tier) => score >= tier.min && score <= tier.max) ??
      this.reviewerTiers[this.reviewerTiers.length - 1]
    );
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
