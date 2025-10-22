import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

interface DashboardStats {
  totalReviews: number;
  totalBusinesses: number;
  averageRating: number;
  trustScore: number;
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
  trustScore: number;
  grade: string;
  reviewCount: number;
  averageRating: number;
  isVerified: boolean;
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

  // Authentication state
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  // Dashboard data
  dashboardStats: DashboardStats = {
    totalReviews: 0,
    totalBusinesses: 0,
    averageRating: 0,
    trustScore: 0,
    monthlyGrowth: 0,
    verifiedBusinesses: 0
  };

  recentActivities: RecentActivity[] = [];
  userBusinesses: BusinessCard[] = [];
  isLoading = true;
  selectedTimeframe = 'week';

  // Quick actions based on user role
  quickActions: QuickAction[] = [];

  // Chart data
  reviewTrendData = [
    { day: 'Mon', reviews: 4 },
    { day: 'Tue', reviews: 8 },
    { day: 'Wed', reviews: 6 },
    { day: 'Thu', reviews: 12 },
    { day: 'Fri', reviews: 10 },
    { day: 'Sat', reviews: 7 },
    { day: 'Sun', reviews: 5 }
  ];

  businessCategories = [
    { name: 'Retail', count: 12, color: 'bg-blue-500' },
    { name: 'Restaurant', count: 8, color: 'bg-green-500' },
    { name: 'Services', count: 15, color: 'bg-purple-500' },
    { name: 'Technology', count: 6, color: 'bg-orange-500' }
  ];

  ngOnInit() {
    // Check if user is a business owner and redirect to business dashboard
    const user = this.currentUser();
    if (user?.role === 'business') {
      // Redirect to business dashboard
      window.location.href = '/business/dashboard';
      return;
    }
    
    this.loadDashboardData();
    this.setupQuickActions();
    this.loadRecentActivities();
    this.loadUserBusinesses();
  }

  ngOnDestroy() {
    // Clean up any subscriptions
  }

  private setupQuickActions() {
    const user = this.currentUser();
    if (user?.role === 'business') {
      this.quickActions = [
        {
          title: 'Add Business',
          description: 'Register a new business',
          icon: 'uil uil-plus-circle',
          route: '/business/create',
          color: 'bg-blue-500'
        },
        {
          title: 'Upload Documents',
          description: 'Verify your business',
          icon: 'uil uil-file-upload-alt',
          route: '/business/documents',
          color: 'bg-green-500'
        },
        {
          title: 'View Analytics',
          description: 'Business performance',
          icon: 'uil uil-chart-line',
          route: '/business/analytics',
          color: 'bg-purple-500'
        },
        {
          title: 'Manage Reviews',
          description: 'Respond to feedback',
          icon: 'uil uil-comment-dots',
          route: '/business/reviews',
          color: 'bg-orange-500'
        }
      ];
    } else {
      this.quickActions = [
        {
          title: 'Write Review',
          description: 'Share your experience',
          icon: 'uil uil-star',
          route: '/reviews/write',
          color: 'bg-blue-500'
        },
        {
          title: 'Search Businesses',
          description: 'Find trusted businesses',
          icon: 'uil uil-search',
          route: '/business/search',
          color: 'bg-green-500'
        },
        {
          title: 'Report Fraud',
          description: 'Flag suspicious activity',
          icon: 'uil uil-shield-exclamation',
          route: '/fraud/report',
          color: 'bg-red-500'
        },
        {
          title: 'View Profile',
          description: 'Manage your account',
          icon: 'uil uil-user-circle',
          route: '/profile',
          color: 'bg-purple-500'
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

      // TODO: Replace with actual API calls when backend services are ready
      // For now, we'll use the user's actual data from the auth service
      this.dashboardStats = {
        totalReviews: 0, // Will be loaded from reviews service
        totalBusinesses: 0, // Will be loaded from business service
        averageRating: 4.5, // Will be calculated from reviews
        trustScore: Math.min(95, Math.max(60, 75)), // Default trust score
        monthlyGrowth: 12,
        verifiedBusinesses: user.isVerified ? 1 : 0
      };

      this.isLoading = false;
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.toastService.error('Failed to load dashboard data');
      this.isLoading = false;
    }
  }

  private async loadRecentActivities() {
    // Mock data - replace with actual API calls
    this.recentActivities = [
      {
        id: '1',
        type: 'review',
        title: 'Reviewed Mama Mboga Shop',
        description: 'Left a 5-star review for excellent service',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        status: 'verified',
        businessName: 'Mama Mboga Shop',
        rating: 5
      },
      {
        id: '2',
        type: 'business_created',
        title: 'Created Business Profile',
        description: 'Successfully registered "Tech Solutions Ltd"',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        status: 'pending'
      },
      {
        id: '3',
        type: 'document_uploaded',
        title: 'Uploaded Business Certificate',
        description: 'Business registration document uploaded',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        status: 'verified'
      },
      {
        id: '4',
        type: 'review',
        title: 'Reviewed Jua Kali Garage',
        description: 'Left a 4-star review for good work',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        status: 'verified',
        businessName: 'Jua Kali Garage',
        rating: 4
      }
    ];
  }

  private async loadUserBusinesses() {
    // Mock data - replace with actual API calls
    this.userBusinesses = [
      {
        id: '1',
        name: 'Tech Solutions Ltd',
        category: 'Technology',
        trustScore: 92,
        grade: 'A+',
        reviewCount: 15,
        averageRating: 4.8,
        isVerified: true,
        lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        id: '2',
        name: 'Mama Mboga Shop',
        category: 'Retail',
        trustScore: 78,
        grade: 'B+',
        reviewCount: 8,
        averageRating: 4.2,
        isVerified: true,
        lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        id: '3',
        name: 'Quick Fix Services',
        category: 'Services',
        trustScore: 65,
        grade: 'C+',
        reviewCount: 3,
        averageRating: 3.8,
        isVerified: false,
        lastActivity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    ];
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
      case 'payment_added': return 'text-purple-500';
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

  formatTimeAgo(date: Date): string {
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
    
    // Mock reputation calculation - in real app, this would come from backend
    const mockReputation = Math.floor(Math.random() * 100) + 1;
    
    if (mockReputation >= 90) return 'Elite Reviewer';
    if (mockReputation >= 75) return 'Trusted Member';
    if (mockReputation >= 60) return 'Active User';
    if (mockReputation >= 40) return 'Regular User';
    return 'New Member';
  }

  getReputationColor(): string {
    const user = this.currentUser();
    if (!user || user.role !== 'user') return '';
    
    const mockReputation = Math.floor(Math.random() * 100) + 1;
    
    if (mockReputation >= 90) return 'text-purple-600';
    if (mockReputation >= 75) return 'text-blue-600';
    if (mockReputation >= 60) return 'text-green-600';
    if (mockReputation >= 40) return 'text-yellow-600';
    return 'text-gray-600';
  }

  logout() {
    const userName = this.currentUser()?.name || 'User';
    this.authService.logout(true); // Redirect to home
    this.toastService.info(`Goodbye, ${userName}! You have been logged out successfully.`);
  }
}
