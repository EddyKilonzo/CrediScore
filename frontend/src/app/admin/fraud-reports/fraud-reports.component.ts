import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AuthService } from '../../core/services/auth.service';

interface FraudReport {
  id: string;
  reason: string;
  description: string;
  status: string;
  createdAt: string;
  reporter: {
    id: string;
    name: string;
    email: string;
    reputation: number;
  };
  business: {
    id: string;
    name: string;
    isVerified: boolean;
    isActive: boolean;
  };
}

@Component({
  selector: 'app-fraud-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fraud-reports.component.html',
  styleUrl: './fraud-reports.component.css'
})
export class FraudReportsComponent implements OnInit {
  private router = inject(Router);
  private adminService = inject(AdminService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  // Component state
  reports = signal<FraudReport[]>([]);
  allReports = signal<FraudReport[]>([]); // Store all reports for filtering
  selectedReport = signal<FraudReport | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  currentPage = signal(1);
  pageSize = signal(10);
  totalPages = signal(0);
  selectedFilter = signal<string>('all'); // Track current filter

  ngOnInit() {
    window.scrollTo(0, 0);
    
    // Check if user is admin
    if (!this.isAuthenticated() || !this.isAdmin()) {
      window.location.href = '/dashboard';
      return;
    }

    this.loadReports();
  }

  private isAdmin(): boolean {
    const user = this.currentUser();
    return user?.role === 'ADMIN' || user?.role === 'admin';
  }

  async loadReports(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      this.adminService.getAllFraudReports(
        this.currentPage(),
        this.pageSize()
      ).subscribe({
        next: (response) => {
          const reportsData = response.data || [];
          this.allReports.set(reportsData);
          this.applyFilter();
          this.totalPages.set(response.pagination?.totalPages || 1);
          this.isLoading.set(false);
          
          // Show message if no reports found
          if (reportsData.length === 0) {
            this.toastService.info('No fraud reports found');
          }
        },
        error: (error) => {
          console.error('Error loading fraud reports:', error);
          this.error.set('Failed to load fraud reports');
          this.isLoading.set(false);
          this.toastService.error('Failed to load fraud reports');
        }
      });
    } catch (error) {
      console.error('Error in loadReports:', error);
      this.error.set('An unexpected error occurred');
      this.isLoading.set(false);
      this.toastService.error('An unexpected error occurred');
    }
  }

  // Filter functionality
  applyFilter(): void {
    const filter = this.selectedFilter();
    const allReportsData = this.allReports();

    if (filter === 'all') {
      this.reports.set(allReportsData);
    } else {
      const filtered = allReportsData.filter(report => report.status === filter);
      this.reports.set(filtered);
    }
  }

  onFilterChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedFilter.set(target.value);
    this.applyFilter();
    this.toastService.success(`Showing ${this.reports().length} reports`);
  }

  async reviewReport(reportId: string): Promise<void> {
    try {
      // Update report status to UNDER_REVIEW
      await this.adminService.updateFraudReportStatus(reportId, {
        status: 'UNDER_REVIEW',
        adminNotes: 'Report under review'
      }).toPromise();
      
      this.toastService.success('Report moved to under review');
      this.loadReports();
    } catch (error) {
      console.error('Error reviewing report:', error);
      this.toastService.error('Failed to update report status');
    }
  }

  async dismissReport(reportId: string): Promise<void> {
    if (!confirm('Are you sure you want to dismiss this report?')) {
      return;
    }

    try {
      await this.adminService.updateFraudReportStatus(reportId, {
        status: 'DISMISSED',
        adminNotes: 'Report dismissed by admin'
      }).toPromise();
      
      this.toastService.success('Report dismissed');
      this.loadReports();
    } catch (error) {
      console.error('Error dismissing report:', error);
      this.toastService.error('Failed to dismiss report');
    }
  }

  async refreshReports(): Promise<void> {
    await this.loadReports();
  }

  navigateToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  // Export functionality
  exportData(): void {
    try {
      const reportsData = this.reports();
      
      if (reportsData.length === 0) {
        this.toastService.error('No data to export');
        return;
      }

      // Format data for CSV export
      const headers = ['ID', 'Reason', 'Description', 'Status', 'Reporter Name', 'Reporter Email', 'Business Name', 'Created At'];
      const rows = reportsData.map(report => [
        report.id,
        report.reason,
        report.description,
        report.status,
        report.reporter.name,
        report.reporter.email,
        report.business.name,
        report.createdAt
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
      link.setAttribute('download', `fraud-reports-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.toastService.success(`Exported ${reportsData.length} fraud reports`);
    } catch (error) {
      console.error('Export error:', error);
      this.toastService.error('Failed to export data');
    }
  }
}
