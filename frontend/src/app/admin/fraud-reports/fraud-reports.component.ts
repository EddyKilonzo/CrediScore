import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AuthService } from '../../core/services/auth.service';
import {
  parseEvidenceLinks,
  evidenceAssetKind,
  isImageEvidenceUrl,
  type EvidenceAssetKind,
} from '../utils/fraud-report-evidence';

interface FraudReport {
  id: string;
  reason: string;
  description: string | null;
  evidenceSummary?: string | null;
  evidenceLinks?: unknown;
  adminNotes?: string | null;
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
  imports: [CommonModule, RouterModule],
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

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Pending',
      UNDER_REVIEW: 'Under review',
      RESOLVED: 'Resolved',
      DISMISSED: 'Dismissed',
      UPHELD: 'Substantiated',
    };
    return map[status] || status;
  }

  statusTagIcon(status: string): string {
    const icons: Record<string, string> = {
      PENDING: 'fas fa-clock',
      UNDER_REVIEW: 'fas fa-search',
      RESOLVED: 'fas fa-check-circle',
      DISMISSED: 'fas fa-ban',
      UPHELD: 'fas fa-gavel',
    };
    return icons[status] || 'fas fa-flag';
  }

  statusTagClass(status: string): string {
    const s = (status || '').toLowerCase().replace(/-/g, '_');
    return `status-tag status-tag--${s}`;
  }

  evidenceLinkList(report: FraudReport): string[] {
    return parseEvidenceLinks(report.evidenceLinks);
  }

  evidenceKind(url: string): EvidenceAssetKind {
    return evidenceAssetKind(url);
  }

  isImageUrl(url: string): boolean {
    return isImageEvidenceUrl(url);
  }

  docKindLabel(kind: EvidenceAssetKind): string {
    switch (kind) {
      case 'pdf':
        return 'PDF';
      case 'word':
        return 'Word';
      case 'raw':
        return 'File';
      default:
        return 'Link';
    }
  }

  onEvidenceImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.visibility = 'hidden';
    const wrap = img.closest('.evidence-thumb-wrap');
    wrap?.classList.add('evidence-thumb-wrap--failed');
  }

  async reviewReport(reportId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.adminService.updateFraudReportStatus(reportId, {
          status: 'UNDER_REVIEW',
          adminNotes: 'Marked under review',
        }),
      );
      this.toastService.success('Report moved to under review');
      this.loadReports();
    } catch (error) {
      console.error('Error reviewing report:', error);
      this.toastService.error('Failed to update report status');
    }
  }

  async substantiateReport(reportId: string): Promise<void> {
    if (
      !confirm(
        'Substantiate this report? The business trust score will be penalized (admin-confirmed concern).',
      )
    ) {
      return;
    }
    try {
      await firstValueFrom(
        this.adminService.updateFraudReportStatus(reportId, {
          status: 'UPHELD',
          adminNotes: 'Substantiated — trust score adjusted',
        }),
      );
      this.toastService.success('Report substantiated; trust score recalculated');
      this.loadReports();
    } catch (error) {
      console.error('Error substantiating report:', error);
      this.toastService.error('Failed to substantiate report');
    }
  }

  async dismissReport(reportId: string): Promise<void> {
    if (!confirm('Are you sure you want to dismiss this report?')) {
      return;
    }

    try {
      await firstValueFrom(
        this.adminService.updateFraudReportStatus(reportId, {
          status: 'DISMISSED',
          adminNotes: 'Dismissed — no action',
        }),
      );
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
      const headers = ['ID', 'Reason', 'Description', 'Evidence', 'Links', 'Status', 'Reporter Name', 'Reporter Email', 'Business Name', 'Created At'];
      const rows = reportsData.map(report => [
        report.id,
        report.reason,
        report.description ?? '',
        report.evidenceSummary ?? '',
        this.evidenceLinkList(report).join(' | '),
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
