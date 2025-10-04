import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-container">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Completing authentication...</p>
      </div>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background-color: #f5f5f5;
    }
    
    .loading-spinner {
      text-align: center;
    }
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    p {
      color: #666;
      font-size: 1.1rem;
    }
  `]
})
export class AuthCallbackComponent implements OnInit {
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.handleOAuthCallback();
  }

  private handleOAuthCallback(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const userData = params['user'];
      const error = params['error'];

      if (error) {
        console.error('OAuth error:', error);
        this.router.navigate(['/auth/login'], { 
          queryParams: { error: 'oauth_failed' } 
        });
        return;
      }

      if (token && userData) {
        try {
          const loginResponse = JSON.parse(decodeURIComponent(userData));
          
          // Store authentication data
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(loginResponse));
          
          // Update auth service state
          this.authService.setAuthData({ user: loginResponse, token });
          
          // Show success toast
          this.toastService.success(`Welcome back, ${loginResponse.name.split(' ')[0]}! Google login successful.`);
          
          // Redirect based on user role
          this.redirectBasedOnRole(loginResponse.role);
          
        } catch (error) {
          console.error('Error parsing user data:', error);
          this.router.navigate(['/auth/login'], { 
            queryParams: { error: 'parsing_failed' } 
          });
        }
      } else {
        console.error('Missing token or user data');
        this.router.navigate(['/auth/login'], { 
          queryParams: { error: 'missing_data' } 
        });
      }
    });
  }

  private redirectBasedOnRole(role: string): void {
    switch (role) {
      case 'admin':
        this.router.navigate(['/admin/dashboard']);
        break;
      case 'business':
        this.router.navigate(['/business/dashboard']);
        break;
      case 'user':
      case 'CUSTOMER':
        this.router.navigate(['/user/dashboard']);
        break;
      default:
        this.router.navigate(['/home']);
    }
  }
}
