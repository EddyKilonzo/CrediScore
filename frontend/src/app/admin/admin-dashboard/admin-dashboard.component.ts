import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../core/services/auth.service';
import { AdminService, AdminDashboardStats, HistoricalData, MonthlyData } from '../../core/services/admin.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private adminService = inject(AdminService);
  private toastService = inject(ToastService);
  
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;
  
  // Component state
  dashboardStats = signal<AdminDashboardStats | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  monthlyUserRegistrations = signal<{ month: string; count: number }[]>([]);

  ngOnInit() {
    // Scroll to top when component loads
    window.scrollTo(0, 0);
    
    // Check if user is admin
    if (!this.isAuthenticated() || !this.isAdmin()) {
      // Redirect non-admin users
      window.location.href = '/dashboard';
      return;
    }

    this.loadDashboardStats();
  }

  private isAdmin(): boolean {
    const user = this.currentUser();
    return user?.role === 'ADMIN' || user?.role === 'admin';
  }

  private async loadDashboardStats(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      // Load dashboard stats and monthly registrations in parallel
      this.adminService.getDashboardStats().subscribe({
        next: (stats) => {
          this.dashboardStats.set(stats);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading dashboard stats:', error);
          this.error.set('Failed to load dashboard statistics');
          this.isLoading.set(false);
          this.toastService.error('Failed to load dashboard statistics');
        }
      });

      // Load monthly user registrations
      this.adminService.getMonthlyUserRegistrations().subscribe({
        next: (monthlyData) => {
          console.log('Monthly user registrations received:', monthlyData);
          this.monthlyUserRegistrations.set(monthlyData);
        },
        error: (error) => {
          console.error('Error loading monthly registrations:', error);
          // Don't show error toast for this as it's not critical
        }
      });
    } catch (error) {
      console.error('Error in loadDashboardStats:', error);
      this.error.set('An unexpected error occurred');
      this.isLoading.set(false);
      this.toastService.error('An unexpected error occurred');
    }
  }

  async refreshStats(): Promise<void> {
    await this.loadDashboardStats();
  }


  getStats(): AdminDashboardStats | null {
    return this.dashboardStats();
  }

  getLoadingState(): boolean {
    return this.isLoading();
  }

  getErrorState(): string | null {
    return this.error();
  }

  // Chart data generation based on real stats
  getUserGrowthData(): { month: string; value: number; height: string }[] {
    const monthlyData = this.monthlyUserRegistrations();
    
    // If we have monthly data, use it (counts are NEW registrations per month from backend)
    if (monthlyData && monthlyData.length > 0) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const data: { month: string; value: number; height: string }[] = [];
      
      // Get current month (0-11, where 0 = January)
      const currentDate = new Date();
      const currentMonthIndex = currentDate.getMonth();
      
      // Create a map for quick lookup (counts are new registrations per month)
      const monthlyMap = new Map<string, number>();
      monthlyData.forEach(item => {
        if (item && item.month && typeof item.count === 'number') {
          monthlyMap.set(item.month, item.count);
        }
      });
      
      console.log('Chart data - Monthly map (new registrations per month):', Array.from(monthlyMap.entries()));
      console.log('Chart data - Raw monthly data:', monthlyData);
      
      // Find the maximum value for scaling
      let maxValue = 0;
      for (let i = 0; i <= currentMonthIndex; i++) {
        const month = months[i];
        const count = monthlyMap.get(month) || 0;
        maxValue = Math.max(maxValue, count);
      }
      
      // Ensure maxValue is at least 1 to avoid division by zero
      if (maxValue === 0) {
        maxValue = 1;
      }
      
      console.log('Chart data - Max value:', maxValue, 'Current month index:', currentMonthIndex);
      
      // Build chart data (showing new registrations per month, not cumulative)
      for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const newRegistrations = monthlyMap.get(month) || 0;
        
        // Only show data up to current month
        if (i <= currentMonthIndex) {
          // Calculate height based on new registrations (scale to max value)
          const height = maxValue > 0 ? Math.min(95, Math.max(5, (newRegistrations / maxValue) * 100)) : 0;
          
          console.log(`Month ${month} (index ${i}): newRegistrations=${newRegistrations}, height=${height}%`);
          
          data.push({
            month,
            value: newRegistrations,
            height: `${height}%`
          });
        } else {
          // Future months show no data
          data.push({
            month,
            value: 0,
            height: '0%'
          });
        }
      }
      
      console.log('Final chart data:', data.filter(d => d.value > 0));
      return data;
    }
    
    console.log('No monthly data available, using fallback');
    // Fallback to default if no monthly data available
    return this.getDefaultUserGrowthData();
  }

  getBusinessVerificationData(): { verified: number; pending: number; percentage: number } {
    const stats = this.getStats();
    if (!stats) {
      return { verified: 245, pending: 105, percentage: 70 };
    }

    const verified = stats.businessStats.verifiedBusinesses;
    const pending = stats.businessStats.pendingVerification;
    const total = verified + pending;
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;

    return { verified, pending, percentage };
  }

  private getDefaultUserGrowthData(): { month: string; value: number; height: string }[] {
    // Get current month (0-11, where 0 = January)
    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth();
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data: { month: string; value: number; height: string }[] = [];
    
    // Use actual total users from stats if available, otherwise 0
    const stats = this.getStats();
    const totalUsers = stats?.userStats?.totalUsers || 0;
    
    // Distribute total users evenly across months up to current month
    // Or show 0 for months with no data
    let cumulativeUsers = 0;
    
    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      
      // Only show data up to current month
      if (i <= currentMonthIndex) {
        // If we have total users but no monthly breakdown, 
        // show them all in the last month that has data
        if (i === currentMonthIndex && totalUsers > 0) {
          cumulativeUsers = totalUsers;
        }
        
        const height = cumulativeUsers > 0 ? '100%' : '0%';
        
        data.push({
          month,
          value: cumulativeUsers,
          height
        });
      } else {
        // Future months show no data
        data.push({
          month,
          value: 0,
          height: '0%'
        });
      }
    }
    
    return data;
  }
}
