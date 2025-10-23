import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AdminService, Business, PaginatedResponse } from '../../core/services/admin.service';
import { ToastService } from '../../shared/components/toast/toast.service';

// Component for managing businesses - Admin Business Management
@Component({
  selector: 'app-manage-businesses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './manage-businesses.component.html',
  styleUrls: ['./manage-businesses.component.css']
})
export class ManageBusinessesComponent implements OnInit {
  // Make Math available in template
  Math = Math;
  private authService = inject(AuthService);
  private adminService = inject(AdminService);
  private toastService = inject(ToastService);
  
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;
  
  // Component state
  businesses = signal<Business[]>([]);
  pagination = signal<any>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  
  // Filters
  searchTerm = signal('');
  verificationFilter = signal('');
  statusFilter = signal('');
  
  // Pagination
  currentPage = signal(1);
  pageSize = signal(10);
  
  // Modal state
  selectedBusiness = signal<Business | null>(null);
  showBusinessModal = signal(false);
  showVerificationModal = signal(false);
  verificationAction = signal('');

  ngOnInit() {
    // Check if user is admin
    if (!this.isAuthenticated() || !this.isAdmin()) {
      window.location.href = '/dashboard';
      return;
    }

    this.loadBusinesses();
  }

  private isAdmin(): boolean {
    const user = this.currentUser();
    return user?.role === 'ADMIN' || user?.role === 'admin';
  }

  private async loadBusinesses(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      const response = await this.adminService.getAllBusinesses(
        this.currentPage(),
        this.pageSize(),
        this.searchTerm() || undefined,
        this.verificationFilter() ? this.verificationFilter() === 'verified' : undefined,
        this.statusFilter() ? this.statusFilter() === 'active' : undefined
      ).toPromise();

      if (response) {
        this.businesses.set(response.data || []);
        this.pagination.set(response.pagination);
      }
      
      this.isLoading.set(false);
    } catch (error) {
      console.error('Error loading businesses:', error);
      this.error.set('Failed to load businesses');
      this.isLoading.set(false);
      this.toastService.error('Failed to load businesses');
    }
  }

  async onSearch(): Promise<void> {
    this.currentPage.set(1);
    await this.loadBusinesses();
  }

  async onFilterChange(): Promise<void> {
    this.currentPage.set(1);
    await this.loadBusinesses();
  }

  async onPageChange(page: number): Promise<void> {
    this.currentPage.set(page);
    await this.loadBusinesses();
  }

  async refreshBusinesses(): Promise<void> {
    await this.loadBusinesses();
  }

  openBusinessModal(business: Business): void {
    this.selectedBusiness.set(business);
    this.showBusinessModal.set(true);
  }

  closeBusinessModal(): void {
    this.showBusinessModal.set(false);
    this.selectedBusiness.set(null);
  }

  openVerificationModal(business: Business, action: string): void {
    this.selectedBusiness.set(business);
    this.verificationAction.set(action);
    this.showVerificationModal.set(true);
  }

  closeVerificationModal(): void {
    this.showVerificationModal.set(false);
    this.selectedBusiness.set(null);
    this.verificationAction.set('');
  }

  async verifyBusiness(): Promise<void> {
    const business = this.selectedBusiness();
    if (!business) return;

    try {
      await this.adminService.verifyBusiness(business.id).toPromise();
      this.toastService.success('Business verified successfully');
      this.closeVerificationModal();
      await this.loadBusinesses();
    } catch (error) {
      console.error('Error verifying business:', error);
      this.toastService.error('Failed to verify business');
    }
  }

  async unverifyBusiness(): Promise<void> {
    const business = this.selectedBusiness();
    if (!business) return;

    try {
      await this.adminService.unverifyBusiness(business.id).toPromise();
      this.toastService.success('Business verification removed successfully');
      this.closeVerificationModal();
      await this.loadBusinesses();
    } catch (error) {
      console.error('Error unverifying business:', error);
      this.toastService.error('Failed to remove business verification');
    }
  }

  async toggleBusinessStatus(business: Business): Promise<void> {
    try {
      await this.adminService.toggleBusinessStatus(business.id).toPromise();
      this.toastService.success(`Business ${business.isActive ? 'deactivated' : 'activated'} successfully`);
      await this.loadBusinesses();
    } catch (error) {
      console.error('Error toggling business status:', error);
      this.toastService.error('Failed to update business status');
    }
  }

  getVerificationBadgeClass(isVerified: boolean): string {
    return isVerified ? 'verification-badge verified' : 'verification-badge pending';
  }

  getVerificationText(isVerified: boolean): string {
    return isVerified ? 'Verified' : 'Pending';
  }

  getStatusBadgeClass(isActive: boolean): string {
    return isActive ? 'status-badge active' : 'status-badge inactive';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'Active' : 'Inactive';
  }

  getStatusBadgeClassFromStatus(status: string): string {
    switch (status.toLowerCase()) {
      case 'verified':
        return 'status-badge verified';
      case 'under_review':
        return 'status-badge pending';
      case 'rejected':
        return 'status-badge rejected';
      default:
        return 'status-badge default';
    }
  }

  getStatusTextFromStatus(status: string): string {
    switch (status.toLowerCase()) {
      case 'verified':
        return 'Verified';
      case 'under_review':
        return 'Under Review';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getBusinesses(): Business[] {
    return this.businesses();
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

  getSelectedBusiness(): Business | null {
    return this.selectedBusiness();
  }

  getShowBusinessModal(): boolean {
    return this.showBusinessModal();
  }

  getShowVerificationModal(): boolean {
    return this.showVerificationModal();
  }

  getVerificationAction(): string {
    return this.verificationAction();
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.verificationFilter.set('');
    this.statusFilter.set('');
    this.currentPage.set(1);
    this.loadBusinesses();
  }

  getPageNumbers(): number[] {
    const pagination = this.pagination();
    if (!pagination) return [];
    
    const currentPage = pagination.page;
    const totalPages = pagination.totalPages;
    const pages: number[] = [];
    
    // Show up to 5 page numbers around current page
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }
}
