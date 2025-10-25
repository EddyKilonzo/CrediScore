import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService, User } from '../../core/services/admin.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AuthService } from '../../core/services/auth.service';

// Extend the User interface to include flagged properties
interface FlaggedUserData {
  flagCount?: number;
  flagReason?: string;
  isFlagged?: boolean;
  lastFlaggedAt?: string;
  reviewPattern?: any;
  unverifiedReviewCount?: number;
  fraudScore?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  aiAnalysis?: {
    suspiciousActivities: string[];
    patternIndicators: string[];
    confidenceScore: number;
    recommendations: string[];
  };
}

type FlaggedUser = User & FlaggedUserData;

@Component({
  selector: 'app-flagged-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flagged-users.component.html',
  styleUrl: './flagged-users.component.css'
})
export class FlaggedUsersComponent implements OnInit {
  private router = inject(Router);
  private adminService = inject(AdminService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  // Component state
  flaggedUsers = signal<FlaggedUser[]>([]);
  allFlaggedUsers = signal<FlaggedUser[]>([]); // Store all users for filtering
  selectedUser = signal<FlaggedUser | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  currentPage = signal(1);
  pageSize = signal(10);
  totalPages = signal(0);
  selectedFilter = signal<string>('all'); // Track current filter

  ngOnInit() {
    // Scroll to top when component loads
    window.scrollTo(0, 0);
    
    // Check if user is admin
    if (!this.isAuthenticated() || !this.isAdmin()) {
      // Redirect non-admin users
      window.location.href = '/dashboard';
      return;
    }

    this.loadFlaggedUsers();
  }

  private isAdmin(): boolean {
    const user = this.currentUser();
    return user?.role === 'ADMIN' || user?.role === 'admin';
  }

  async loadFlaggedUsers(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      this.adminService.getAllUsers(
        this.currentPage(),
        this.pageSize(),
        undefined,
        undefined,
        undefined
      ).subscribe({
        next: (response) => {
          // Filter to only flagged users
          const flagged = response.users
            .filter((user: any) => user.isFlagged || (user.flagCount && user.flagCount > 0))
            .map(user => ({
              ...user,
              riskLevel: this.calculateRiskLevel(user),
              aiAnalysis: this.generateAIAnalysis(user)
            }));
          
          this.allFlaggedUsers.set(flagged); // Store all users
          this.applyFilter(); // Apply current filter
          this.totalPages.set(response.pagination.totalPages);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading flagged users:', error);
          this.error.set('Failed to load flagged users');
          this.isLoading.set(false);
          this.toastService.error('Failed to load flagged users');
        }
      });
    } catch (error) {
      console.error('Error in loadFlaggedUsers:', error);
      this.error.set('An unexpected error occurred');
      this.isLoading.set(false);
      this.toastService.error('An unexpected error occurred');
    }
  }

  calculateRiskLevel(user: User): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Factor in flag count
    const flagCount = user.flagCount || 0;
    if (flagCount >= 5) riskScore += 40;
    else if (flagCount >= 3) riskScore += 25;
    else if (flagCount >= 1) riskScore += 10;

    // Factor in unverified reviews
    const unverifiedCount = user.unverifiedReviewCount || 0;
    if (unverifiedCount >= 10) riskScore += 30;
    else if (unverifiedCount >= 5) riskScore += 15;

    // Factor in fraud reports
    const fraudReports = user._count?.fraudReports || 0;
    if (fraudReports >= 5) riskScore += 30;
    else if (fraudReports >= 2) riskScore += 15;

    // Determine risk level
    if (riskScore >= 70) return 'critical';
    if (riskScore >= 50) return 'high';
    if (riskScore >= 25) return 'medium';
    return 'low';
  }

  generateAIAnalysis(user: User): {
    suspiciousActivities: string[];
    patternIndicators: string[];
    confidenceScore: number;
    recommendations: string[];
  } {
    const suspiciousActivities: string[] = [];
    const patternIndicators: string[] = [];
    const recommendations: string[] = [];
    let confidenceScore = 0;

    // Analyze based on available data
    const flagCount = user.flagCount || 0;
    if (flagCount > 0) {
      suspiciousActivities.push(`User has been flagged ${flagCount} time(s)`);
      confidenceScore += 25;
    }

    if (user.unverifiedReviewCount && user.unverifiedReviewCount > 5) {
      suspiciousActivities.push(`High number of unverified reviews (${user.unverifiedReviewCount})`);
      confidenceScore += 20;
    }

    if (user._count?.fraudReports > 2) {
      suspiciousActivities.push(`Multiple fraud reports filed against user (${user._count.fraudReports})`);
      confidenceScore += 30;
      recommendations.push('Review all reported incidents and gather evidence');
    }

    if (user.reputation < 30) {
      patternIndicators.push('Low reputation score indicates potential fraudulent activity');
      confidenceScore += 15;
    }

    if (user.flagReason) {
      patternIndicators.push(`Flag reason: ${user.flagReason}`);
      confidenceScore += 20;
    }

    // Generate recommendations
    if (confidenceScore >= 50) {
      recommendations.push('Consider temporary suspension pending investigation');
    }
    if (user._count?.reviews > 20 && user.reputation < 50) {
      recommendations.push('Review content of all user reviews for spam patterns');
    }
    if (!recommendations.length) {
      recommendations.push('Continue monitoring user activity');
    }

    return {
      suspiciousActivities,
      patternIndicators,
      confidenceScore: Math.min(confidenceScore, 100),
      recommendations
    };
  }

  async viewUserDetails(user: FlaggedUser): Promise<void> {
    try {
      this.isLoading.set(true);
      const userDetails = await this.adminService.getUserById(user.id).toPromise();
      this.selectedUser.set({ ...user, ...userDetails });
    } catch (error) {
      console.error('Error fetching user details:', error);
      this.toastService.error('Failed to load user details');
    } finally {
      this.isLoading.set(false);
    }
  }

  async suspendUser(userId: string): Promise<void> {
    if (!confirm('Are you sure you want to suspend this user?')) {
      return;
    }

    try {
      this.isLoading.set(true);
      await this.adminService.toggleUserStatus(userId).toPromise();
      this.toastService.success('User suspended successfully');
      this.loadFlaggedUsers();
    } catch (error) {
      console.error('Error suspending user:', error);
      this.toastService.error('Failed to suspend user');
    } finally {
      this.isLoading.set(false);
    }
  }

  async warnUser(user: FlaggedUser): Promise<void> {
    // TODO: Implement warning logic
    this.toastService.info('Warning sent to user');
  }

  async clearFlag(userId: string): Promise<void> {
    if (!confirm('Are you sure you want to clear the flag for this user?')) {
      return;
    }

    try {
      this.isLoading.set(true);
      await this.adminService.unflagUser(userId).toPromise();
      this.toastService.success('Flag cleared successfully');
      this.loadFlaggedUsers();
    } catch (error) {
      console.error('Error clearing flag:', error);
      this.toastService.error('Failed to clear flag');
    } finally {
      this.isLoading.set(false);
    }
  }

  navigateToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  // Filter functionality
  applyFilter(): void {
    const filter = this.selectedFilter();
    const allUsers = this.allFlaggedUsers();

    if (filter === 'all') {
      this.flaggedUsers.set(allUsers);
    } else {
      const filtered = allUsers.filter(user => user.riskLevel === filter);
      this.flaggedUsers.set(filtered);
    }
  }

  onFilterChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedFilter.set(target.value);
    this.applyFilter();
    this.toastService.success(`Showing ${this.flaggedUsers().length} users`);
  }

  // Export functionality
  exportData(): void {
    try {
      const users = this.flaggedUsers();
      
      if (users.length === 0) {
        this.toastService.error('No data to export');
        return;
      }

      // Format data for CSV export
      const headers = ['Name', 'Email', 'Risk Level', 'Flag Count', 'Reviews', 'Reports', 'Reputation', 'Flag Reason', 'Last Flagged At'];
      const rows = users.map(user => [
        user.name,
        user.email,
        user.riskLevel || 'N/A',
        user.flagCount || 0,
        user._count.reviews,
        user._count.fraudReports,
        user.reputation,
        user.flagReason || 'N/A',
        user.lastFlaggedAt || 'N/A'
      ]);

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `flagged-users-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.toastService.success(`Exported ${users.length} flagged users`);
    } catch (error) {
      console.error('Export error:', error);
      this.toastService.error('Failed to export data');
    }
  }
}
