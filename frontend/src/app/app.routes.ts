import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

// Application routes configuration
export const routes: Routes = [
  // Home/Landing Page
  {
    path: '',
    loadComponent: () => import('./home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.component').then(m => m.HomeComponent)
  },

  // Authentication Routes
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'register',
        loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent)
      },
      {
        path: 'verify-email',
        loadComponent: () => import('./auth/email-verification/email-verification.component').then(m => m.EmailVerificationComponent)
      },
      {
        path: 'callback',
        loadComponent: () => import('./auth/callback/auth-callback.component').then(m => m.AuthCallbackComponent)
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      }
    ]
  },

  // Profile Route
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [AuthGuard]
  },

  // User Dashboard Route
  {
    path: 'dashboard',
    loadComponent: () => import('./user/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['CUSTOMER', 'user'] }
  },

  // Business Routes
  {
    path: 'business',
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./business/business-dashboard/business-dashboard.component').then(m => m.BusinessDashboardComponent),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['BUSINESS_OWNER', 'business'] }
      },
      {
        path: 'my-business',
        loadComponent: () => import('./business/my-business/my-business.component').then(m => m.MyBusinessComponent),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['BUSINESS_OWNER', 'business'] }
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },

  // Admin Routes
  {
    path: 'admin',
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['ADMIN', 'admin'] }
      },
      {
        path: 'users',
        loadComponent: () => import('./admin/manage-users/manage-users.component').then(m => m.ManageUsersComponent),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['ADMIN', 'admin'] }
      },
      {
        path: 'businesses',
        loadComponent: () => import('./admin/manage-businesses/manage-businesses.component').then(m => m.ManageBusinessesComponent),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['ADMIN', 'admin'] }
      },
      {
        path: 'reports',
        loadComponent: () => import('./admin/reports/reports.component').then(m => m.ReportsComponent),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['ADMIN', 'admin'] }
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },

  // Wildcard route - must be last
  {
    path: '**',
    redirectTo: ''
  }
];
