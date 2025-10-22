import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <div class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="py-6">
            <h1 class="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p class="mt-2 text-gray-600">Manage users, businesses, and platform settings</p>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- Users Management -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <svg class="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-medium text-gray-900">Users</h3>
                <p class="text-sm text-gray-500">Manage user accounts</p>
              </div>
            </div>
            <div class="mt-4">
              <a routerLink="/admin/users" class="text-blue-600 hover:text-blue-500 text-sm font-medium">
                View Users →
              </a>
            </div>
          </div>

          <!-- Businesses Management -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-medium text-gray-900">Businesses</h3>
                <p class="text-sm text-gray-500">Verify and manage businesses</p>
              </div>
            </div>
            <div class="mt-4">
              <a routerLink="/admin/businesses" class="text-green-600 hover:text-green-500 text-sm font-medium">
                View Businesses →
              </a>
            </div>
          </div>

          <!-- Reports -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <svg class="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-medium text-gray-900">Reports</h3>
                <p class="text-sm text-gray-500">View platform analytics</p>
              </div>
            </div>
            <div class="mt-4">
              <a routerLink="/admin/reports" class="text-purple-600 hover:text-purple-500 text-sm font-medium">
                View Reports →
              </a>
            </div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="mt-8 bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Quick Stats</h2>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-600">0</div>
              <div class="text-sm text-gray-500">Total Users</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-green-600">0</div>
              <div class="text-sm text-gray-500">Verified Businesses</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-yellow-600">0</div>
              <div class="text-sm text-gray-500">Pending Reviews</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-red-600">0</div>
              <div class="text-sm text-gray-500">Fraud Reports</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  ngOnInit() {
    // Check if user is admin
    if (!this.isAuthenticated() || this.currentUser()?.role !== 'admin') {
      // Redirect non-admin users
      window.location.href = '/dashboard';
    }
  }
}
