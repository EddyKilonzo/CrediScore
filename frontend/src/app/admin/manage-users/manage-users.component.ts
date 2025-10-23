import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AdminService, PaginatedResponse } from '../../core/services/admin.service';
import { User } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

// Component for managing users - Admin Users Management
@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './manage-users.component.html',
  styleUrls: ['./manage-users.component.css']
})
export class ManageUsersComponent implements OnInit {
  // Make Math available in template
  Math = Math;
  private authService = inject(AuthService);
  private adminService = inject(AdminService);
  private toastService = inject(ToastService);
  
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;
  
  // Component state
  users = signal<User[]>([]);
  pagination = signal<any>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  loadingUsers = signal<Set<string>>(new Set());
  
  // Filters
  searchTerm = signal('');
  roleFilter = signal('');
  statusFilter = signal('');
  
  // Pagination
  currentPage = signal(1);
  pageSize = signal(10);
  
  // Modal state
  selectedUser = signal<User | null>(null);
  showUserModal = signal(false);
  showRoleModal = signal(false);
  newRole = signal('');

  ngOnInit() {
    // Check if user is admin
    if (!this.isAuthenticated() || !this.isAdmin()) {
      window.location.href = '/dashboard';
      return;
    }

    this.loadUsers();
  }

  private isAdmin(): boolean {
    const user = this.currentUser();
    return user?.role === 'ADMIN' || user?.role === 'admin';
  }

  private async loadUsers(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      // Check if user is authenticated and has admin role
      const currentUser = this.currentUser();
      if (!currentUser) {
        this.error.set('Please log in to access this page.');
        this.isLoading.set(false);
        return;
      }
      
      if (!this.isAdmin()) {
        this.error.set('Admin access required.');
        this.isLoading.set(false);
        return;
      }
      
      const response = await this.adminService.getAllUsers(
        this.currentPage(),
        this.pageSize(),
        this.searchTerm() || undefined,
        this.roleFilter() || undefined,
        this.statusFilter() ? this.statusFilter() === 'active' : undefined
      ).toPromise();
      
      if (response && response.users) {
        this.users.set(response.users);
        this.pagination.set(response.pagination);
      } else {
        this.users.set([]);
        this.pagination.set(null);
      }
      
      this.isLoading.set(false);
    } catch (error) {
      console.error('Error loading users:', error);
      this.error.set('Failed to load users. Please try again.');
      this.users.set([]);
      this.pagination.set(null);
      this.isLoading.set(false);
    }
  }


  async onSearch(): Promise<void> {
    this.currentPage.set(1);
    await this.loadUsers();
  }

  async onFilterChange(): Promise<void> {
    this.currentPage.set(1);
    await this.loadUsers();
  }

  async onPageChange(page: number): Promise<void> {
    this.currentPage.set(page);
    await this.loadUsers();
  }

  async refreshUsers(): Promise<void> {
    await this.loadUsers();
  }

  openUserModal(user: User): void {
    this.selectedUser.set(user);
    this.showUserModal.set(true);
  }

  closeUserModal(): void {
    this.showUserModal.set(false);
    this.selectedUser.set(null);
  }

  openRoleModal(user: User): void {
    this.selectedUser.set(user);
    this.newRole.set(user.role);
    this.showRoleModal.set(true);
  }

  closeRoleModal(): void {
    this.showRoleModal.set(false);
    this.selectedUser.set(null);
    this.newRole.set('');
  }

  async updateUserRole(): Promise<void> {
    const user = this.selectedUser();
    if (!user || !this.newRole()) return;

    try {
      await this.adminService.updateUserRole(user.id, this.newRole()).toPromise();
      this.toastService.success('User role updated successfully');
      this.closeRoleModal();
      await this.loadUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      this.toastService.error('Failed to update user role');
    }
  }

  async toggleUserStatus(user: User): Promise<void> {
    // Add user to loading set
    const currentLoading = this.loadingUsers();
    currentLoading.add(user.id);
    this.loadingUsers.set(new Set(currentLoading));

    try {
      const updatedUser = await this.adminService.toggleUserStatus(user.id).toPromise();
      const newStatus = updatedUser?.isActive ? 'activated' : 'deactivated';
      this.toastService.success(`User ${newStatus} successfully`);
      await this.loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      this.toastService.error('Failed to update user status');
    } finally {
      // Remove user from loading set
      const currentLoading = this.loadingUsers();
      currentLoading.delete(user.id);
      this.loadingUsers.set(new Set(currentLoading));
    }
  }

  async deleteUser(user: User): Promise<void> {
    if (!confirm(`Are you sure you want to deactivate ${user.name}?`)) {
      return;
    }

    try {
      await this.adminService.deleteUser(user.id).toPromise();
      this.toastService.success('User deactivated successfully');
      await this.loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      this.toastService.error('Failed to deactivate user');
    }
  }

  getRoleDisplayName(role: string): string {
    switch (role) {
      case 'ADMIN':
      case 'admin':
        return 'Admin';
      case 'BUSINESS_OWNER':
      case 'business':
        return 'Business Owner';
      case 'CUSTOMER':
      case 'user':
        return 'Customer';
      default:
        return role;
    }
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'ADMIN':
      case 'admin':
        return 'role-badge admin';
      case 'BUSINESS_OWNER':
      case 'business':
        return 'role-badge business';
      case 'CUSTOMER':
      case 'user':
        return 'role-badge customer';
      default:
        return 'role-badge default';
    }
  }

  getStatusBadgeClass(isActive: boolean): string {
    return isActive ? 'status-badge active' : 'status-badge inactive';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'Active' : 'Inactive';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getUsers(): User[] {
    return this.users();
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

  isUserLoading(userId: string): boolean {
    return this.loadingUsers().has(userId);
  }

  getSelectedUser(): User | null {
    return this.selectedUser();
  }

  getShowUserModal(): boolean {
    return this.showUserModal();
  }

  getShowRoleModal(): boolean {
    return this.showRoleModal();
  }

  getNewRole(): string {
    return this.newRole();
  }

  async clearFilters(): Promise<void> {
    this.searchTerm.set('');
    this.roleFilter.set('');
    this.statusFilter.set('');
    this.currentPage.set(1);
    await this.loadUsers();
  }

  getPageNumbers(): number[] {
    const pagination = this.pagination();
    if (!pagination) return [];
    
    const currentPage = pagination.page;
    const totalPages = pagination.totalPages;
    const pages: number[] = [];
    
    // Show up to 5 page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  setNewRole(role: string): void {
    this.newRole.set(role);
  }

  onImageError(event: any): void {
    // Hide the image and show the default SVG icon
    event.target.style.display = 'none';
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const names = name.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  }
}
// End of ManageUsersComponent
