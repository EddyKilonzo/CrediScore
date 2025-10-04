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

  // Wildcard route - must be last
  {
    path: '**',
    redirectTo: ''
  }
];
