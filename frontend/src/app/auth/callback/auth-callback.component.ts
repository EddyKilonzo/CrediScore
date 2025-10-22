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
      const sessionId = params['sessionId'];
      const error = params['error'];

      if (error) {
        console.error('OAuth error:', error);
        this.toastService.error('Google login failed. Please try again.');
        this.router.navigate(['/auth/login']);
        return;
      }

      if (sessionId) {
        // Fetch OAuth data from session endpoint
        this.fetchOAuthSessionData(sessionId);
      } else {
        console.error('Missing session ID');
        this.toastService.error('Login session missing. Please try again.');
        this.router.navigate(['/auth/login']);
      }
    });
  }

  private fetchOAuthSessionData(sessionId: string): void {
    // Fetch the OAuth data from the backend session
    fetch(`http://localhost:3000/api/auth/oauth/session/${sessionId}`, {
      method: 'GET',
      credentials: 'include', // Include cookies for session
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(loginResponse => {
      // Use auth service to store data properly (handles large avatar data)
      this.authService.setAuthData({ user: loginResponse, token: loginResponse.accessToken });
      
      // Show success toast
      this.toastService.success(`Welcome back, ${loginResponse.name.split(' ')[0]}! Google login successful.`);
      
      // Redirect based on user role
      this.redirectBasedOnRole(loginResponse.role);
    })
    .catch(error => {
      console.error('Error fetching OAuth session data:', error);
      this.toastService.error('Failed to complete login. Please try again.');
      this.router.navigate(['/auth/login']);
    });
  }

  private redirectBasedOnRole(role: string): void {
    // Redirect all authenticated users to the main dashboard
    this.router.navigate(['/dashboard']);
  }
}