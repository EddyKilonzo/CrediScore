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
        path: 'forgot-password',
        loadComponent: () => import('./auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
      },
      {
        path: '2fa-verify',
        loadComponent: () => import('./auth/two-factor-verify/two-factor-verify.component').then(m => m.TwoFactorVerifyComponent)
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      }
    ]
  },

  // Search Route
  {
    path: 'search',
    loadComponent: () => import('./search/search.component').then(m => m.SearchComponent)
  },
  {
    path: 'compare',
    loadComponent: () => import('./business/compare/compare.component').then(m => m.CompareComponent)
  },

  // Map Route - accessible to all authenticated users
  {
    path: 'map',
    loadComponent: () => import('./shared/components/business-map-view/business-map-view.component').then(m => m.BusinessMapViewComponent),
    canActivate: [AuthGuard]
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

  // My Reviews Route
  {
    path: 'my-reviews',
    loadComponent: () => import('./user/my-reviews/my-reviews.component').then(m => m.MyReviewsComponent),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['CUSTOMER', 'user'] }
  },

  // Bookmarks Route
  {
    path: 'bookmarks',
    loadComponent: () => import('./user/bookmarks/bookmarks.component').then(m => m.BookmarksComponent),
    canActivate: [AuthGuard]
  },

  // Report a business (trust & safety → admin fraud queue)
  {
    path: 'report-business',
    loadComponent: () =>
      import('./user/report-business/report-business.component').then(
        (m) => m.ReportBusinessComponent,
      ),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['CUSTOMER', 'user'] },
  },

  // Leaderboard (public)
  {
    path: 'leaderboard',
    loadComponent: () => import('./leaderboard/leaderboard.component').then(m => m.LeaderboardComponent)
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
        path: 'analytics',
        loadComponent: () => import('./business/analytics/analytics.component').then(m => m.AnalyticsComponent),
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

  // Public Business View Route
  {
    path: 'business/:id',
    loadComponent: () => import('./business/business-view/business-view.component').then(m => m.BusinessViewComponent)
  },

  // Category Browse Route
  {
    path: 'category/:name',
    loadComponent: () => import('./business/category-browse/category-browse.component').then(m => m.CategoryBrowseComponent)
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
        path: 'fraud-reports',
        loadComponent: () => import('./admin/fraud-reports/fraud-reports.component').then(m => m.FraudReportsComponent),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['ADMIN', 'admin'] }
      },
      {
        path: 'flagged-users',
        loadComponent: () => import('./admin/flagged-users/flagged-users.component').then(m => m.FlaggedUsersComponent),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['ADMIN', 'admin'] }
      },
      {
        path: 'reviews',
        loadComponent: () => import('./admin/moderate-reviews/moderate-reviews.component').then(m => m.ModerateReviewsComponent),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['ADMIN', 'admin'] }
      },
      {
        path: 'documents',
        loadComponent: () => import('./admin/verify-documents/verify-documents.component').then(m => m.VerifyDocumentsComponent),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['ADMIN', 'admin'] }
      },
      {
        path: 'system',
        loadComponent: () => import('./admin/system-maintenance/system-maintenance.component').then(m => m.SystemMaintenanceComponent),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['ADMIN', 'admin'] }
      },
      {
        path: 'disputes',
        loadComponent: () => import('./admin/disputes/disputes.component').then(m => m.DisputesComponent),
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
