import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AdminService, Business, PaginatedResponse } from '../../core/services/admin.service';
import { ToastService } from '../../shared/components/toast/toast.service';

type BusinessDocument = NonNullable<Business['documents']>[number];

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
    // Scroll to top when component loads
    window.scrollTo(0, 0);
    
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
      
      // Ensure page stays at top after loading
      setTimeout(() => window.scrollTo(0, 0), 100);
      
      this.isLoading.set(false);
    } catch (error) {
      console.error('Error loading businesses:', error);
      this.error.set('Failed to load businesses');
      this.isLoading.set(false);
      this.toastService.error('Failed to load businesses');
    }
  }

  async onSearch(): Promise<void> {
    try {
      this.currentPage.set(1);
      await this.loadBusinesses();
      // Scroll to top when searching
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Error searching businesses:', error);
      this.toastService.error('Failed to search businesses');
    }
  }

  async onFilterChange(): Promise<void> {
    try {
      this.currentPage.set(1);
      await this.loadBusinesses();
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
      await this.loadBusinesses();
      // Scroll to top when page changes
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Error changing page:', error);
      this.toastService.error('Failed to change page');
    }
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
    try {
      this.searchTerm.set('');
      this.verificationFilter.set('');
      this.statusFilter.set('');
      this.currentPage.set(1);
      this.loadBusinesses();
      // Scroll to top when clearing filters
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Error clearing filters:', error);
      this.toastService.error('Failed to clear filters');
    }
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

  // Statistics methods
  getTotalBusinesses(): number {
    return this.getPagination()?.total || 0;
  }

  getVerifiedBusinesses(): number {
    return this.getBusinesses().filter(business => this.isBusinessVerified(business)).length;
  }

  getPendingBusinesses(): number {
    return this.getBusinesses().filter(business => !this.isBusinessVerified(business)).length;
  }

  getThisMonthBusinesses(): number {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    return this.getBusinesses().filter(business => 
      new Date(business.createdAt) >= thisMonth
    ).length;
  }

  getVerificationRate(): number {
    const total = this.getTotalBusinesses();
    if (total === 0) return 0;
    return Math.round((this.getVerifiedBusinesses() / total) * 100);
  }

  isBusinessVerified(business: Business): boolean {
    const hasVerifiedDocs = (business.summary?.verifiedDocuments ?? 0) > 0;
    const hasVerifiedPayments = (business.summary?.verifiedPayments ?? 0) > 0;
    const completedOnboarding = (business.onboardingStep ?? 0) >= 4 || business.summary?.canApprove === true;

    if (business.isVerified || (business.status || '').toLowerCase() === 'verified') {
      return true;
    }

    if (completedOnboarding) {
      return true;
    }

    return hasVerifiedDocs && hasVerifiedPayments;
  }

  openWebsite(event: Event, website?: string): void {
    event.stopPropagation();
    if (!website) {
      return;
    }

    const hasProtocol = /^(http|https):\/\//i.test(website);
    const url = hasProtocol ? website : `https://${website}`;
    window.open(url, '_blank', 'noopener');
  }

  getVerifiedDocumentCount(business: Business): number {
    if (business.summary?.verifiedDocuments !== undefined) {
      return business.summary.verifiedDocuments;
    }

    const businessWithVerifiedCount = (business as Business & { verifiedDocumentsCount?: number }).verifiedDocumentsCount;
    if (typeof businessWithVerifiedCount === 'number') {
      return businessWithVerifiedCount;
    }

    if (Array.isArray(business.documents) && business.documents.length > 0) {
      return business.documents.filter(doc => doc.verified).length;
    }

    if (business.isVerified) {
      return business._count?.documents ?? 0;
    }

    return 0;
  }

  getWebsiteLabel(business: Business): string {
    if (!business.website) {
      return '';
    }

    try {
      const hasProtocol = /^(http|https):\/\//i.test(business.website);
      const url = new URL(hasProtocol ? business.website : `https://${business.website}`);
      return url.hostname.replace(/^www\./, '');
    } catch {
      return business.website;
    }
  }

  getVerifiedDocumentsLabel(business: Business): string {
    const count = this.getVerifiedDocumentCount(business);
    const suffix = count === 1 ? 'Verified Document' : 'Verified Documents';
    return `${count} ${suffix}`;
  }

  getVerificationBadgeSrc(business: Business): { src: string; alt: string } {
    if (this.isBusinessVerified(business)) {
      return { src: '/images/verfied.png', alt: 'Verified badge' };
    }

    return { src: '/images/pending.png', alt: 'Pending verification badge' };
  }

  getFirstVerifiedDocument(business: Business): BusinessDocument | null {
    if (Array.isArray(business.documents)) {
      const verifiedDocument = business.documents.find(document => document.verified && !!document.url);
      return verifiedDocument ?? null;
    }

    return null;
  }

  openVerifiedDocument(event: Event, url?: string): void {
    event.stopPropagation();
    if (!url) {
      return;
    }

    const hasProtocol = /^(http|https):\/\//i.test(url);
    const resolvedUrl = hasProtocol ? url : `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`;
    window.open(resolvedUrl, '_blank', 'noopener');
  }
}
