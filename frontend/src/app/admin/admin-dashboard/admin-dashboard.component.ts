import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../core/services/auth.service';
import { AdminService, AdminDashboardStats } from '../../core/services/admin.service';
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

  ngOnInit() {
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
}
