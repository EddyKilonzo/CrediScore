import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AdminService, FraudReport, PaginatedResponse } from '../../core/services/admin.service';
import { ToastService } from '../../shared/components/toast/toast.service';

// Component for managing reports - Admin Reports Management
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent implements OnInit {
  // Make Math available in template
  Math = Math;
  private authService = inject(AuthService);
  private adminService = inject(AdminService);
  private toastService = inject(ToastService);
  
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;
  
  // Component state
  fraudReports = signal<FraudReport[]>([]);
  pagination = signal<any>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  
  // Filters
  statusFilter = signal('');
  businessFilter = signal('');
  searchTerm = signal('');
  
  // Pagination
  currentPage = signal(1);
  pageSize = signal(10);
  
  // Modal state
  selectedReport = signal<FraudReport | null>(null);
  showReportModal = signal(false);
  showStatusModal = signal(false);
  newStatus = signal('');
  adminNotes = signal('');

  ngOnInit() {
    // Scroll to top when component loads
    window.scrollTo(0, 0);
    
    // Check if user is admin
    if (!this.isAuthenticated() || !this.isAdmin()) {
      window.location.href = '/dashboard';
      return;
    }

    this.loadFraudReports();
  }

  private isAdmin(): boolean {
    const user = this.currentUser();
    return user?.role === 'ADMIN' || user?.role === 'admin';
  }

  private async loadFraudReports(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      const response = await this.adminService.getAllFraudReports(
        this.currentPage(),
        this.pageSize(),
        this.statusFilter() || undefined,
        this.businessFilter() || undefined
      ).toPromise();

      if (response) {
        this.fraudReports.set(response.data || []);
        this.pagination.set(response.pagination);
      }
      
      // Ensure page stays at top after loading
      setTimeout(() => window.scrollTo(0, 0), 100);
      
      this.isLoading.set(false);
    } catch (error) {
      console.error('Error loading fraud reports:', error);
      this.error.set('Failed to load fraud reports');
      this.isLoading.set(false);
      this.toastService.error('Failed to load fraud reports');
    }
  }

  async onFilterChange(): Promise<void> {
    try {
      this.currentPage.set(1);
      await this.loadFraudReports();
      // Scroll to top when filters are applied
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Error applying filters:', error);
      this.toastService.error('Failed to apply filters');
    }
  }

  async onPageChange(page: number): Promise<void> {
    try {
      this.currentPage.set(page);
      await this.loadFraudReports();
      // Scroll to top when page changes
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Error changing page:', error);
      this.toastService.error('Failed to change page');
    }
  }

  async refreshReports(): Promise<void> {
    try {
      await this.loadFraudReports();
    } catch (error) {
      console.error('Error refreshing reports:', error);
      this.toastService.error('Failed to refresh reports');
    }
  }

  openReportModal(report: FraudReport): void {
    this.selectedReport.set(report);
    this.showReportModal.set(true);
  }

  closeReportModal(): void {
    this.showReportModal.set(false);
    this.selectedReport.set(null);
  }

  openStatusModal(report: FraudReport): void {
    this.selectedReport.set(report);
    this.newStatus.set(report.status);
    this.adminNotes.set('');
    this.showStatusModal.set(true);
  }

  closeStatusModal(): void {
    this.showStatusModal.set(false);
    this.selectedReport.set(null);
    this.newStatus.set('');
    this.adminNotes.set('');
  }

  async updateReportStatus(): Promise<void> {
    const report = this.selectedReport();
    if (!report || !this.newStatus()) return;

    try {
      await this.adminService.updateFraudReportStatus(report.id, {
        status: this.newStatus(),
        adminNotes: this.adminNotes() || undefined
      }).toPromise();
      
      this.toastService.success('Report status updated successfully');
      this.closeStatusModal();
      await this.loadFraudReports();
    } catch (error) {
      console.error('Error updating report status:', error);
      this.toastService.error('Failed to update report status');
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'status-badge pending';
      case 'under_review':
        return 'status-badge under-review';
      case 'resolved':
        return 'status-badge resolved';
      case 'dismissed':
        return 'status-badge dismissed';
      default:
        return 'status-badge default';
    }
  }

  getStatusText(status: string): string {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'Pending';
      case 'under_review':
        return 'Under Review';
      case 'resolved':
        return 'Resolved';
      case 'dismissed':
        return 'Dismissed';
      default:
        return status;
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  getFraudReports(): FraudReport[] {
    return this.fraudReports();
  }

  getPagination(): any {
    return this.pagination();
  }

  getLoadingState(): boolean {
    return this.isLoading();
  }

  getErrorState(): string | null {
    return this.error();
  }

  getSelectedReport(): FraudReport | null {
    return this.selectedReport();
  }

  getShowReportModal(): boolean {
    return this.showReportModal();
  }

  getShowStatusModal(): boolean {
    return this.showStatusModal();
  }

  getNewStatus(): string {
    return this.newStatus();
  }

  setNewStatus(status: string): void {
    this.newStatus.set(status);
  }

  getAdminNotes(): string {
    return this.adminNotes();
  }

  setAdminNotes(notes: string): void {
    this.adminNotes.set(notes);
  }

  // Statistics methods
  getTotalReports(): number {
    return this.getPagination()?.total || 0;
  }

  getPendingReports(): number {
    return this.getFraudReports().filter(report => report.status === 'PENDING').length;
  }

  getResolvedReports(): number {
    return this.getFraudReports().filter(report => report.status === 'RESOLVED').length;
  }

  getThisMonthReports(): number {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    return this.getFraudReports().filter(report => 
      new Date(report.createdAt) >= thisMonth
    ).length;
  }

  // Search functionality
  async onSearch(): Promise<void> {
    try {
      this.currentPage.set(1);
      await this.loadFraudReports();
      // Scroll to top when searching
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Error searching reports:', error);
      this.toastService.error('Failed to search reports');
    }
  }

  // Clear filters
  async clearFilters(): Promise<void> {
    try {
      this.statusFilter.set('');
      this.businessFilter.set('');
      this.searchTerm.set('');
      this.currentPage.set(1);
      await this.loadFraudReports();
      // Scroll to top when clearing filters
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Error clearing filters:', error);
      this.toastService.error('Failed to clear filters');
    }
  }

  // Status indicator class
  getStatusIndicatorClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'status-indicator pending';
      case 'under_review':
        return 'status-indicator under-review';
      case 'resolved':
        return 'status-indicator resolved';
      case 'dismissed':
        return 'status-indicator dismissed';
      default:
        return 'status-indicator default';
    }
  }

  // Page numbers for pagination
  getPageNumbers(): number[] {
    const pagination = this.getPagination();
    if (!pagination) return [];
    
    const currentPage = pagination.page;
    const totalPages = pagination.totalPages;
    const pages: number[] = [];
    
    // Show up to 5 page numbers
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

}
