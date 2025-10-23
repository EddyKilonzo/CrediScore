import { Routes } from '@angular/router';

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
    loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent)
  },

  // User Dashboard Route
  {
    path: 'dashboard',
    loadComponent: () => import('./user/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },

  // Business Routes
  {
    path: 'business',
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./business/business-dashboard/business-dashboard.component').then(m => m.BusinessDashboardComponent)
      },
      {
        path: 'my-business',
        loadComponent: () => import('./business/my-business/my-business.component').then(m => m.MyBusinessComponent)
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
