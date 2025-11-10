import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, LoginRequest } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoading = signal(false);
  isGoogleLoading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    // Scroll to top when component loads
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading.set(true);
      this.error.set(null);

      const loginData: LoginRequest = {
        email: this.loginForm.value.email,
        password: this.loginForm.value.password
      };

      this.authService.login(loginData).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          this.toastService.success(`Welcome back, ${response.user.name.split(' ')[0]}!`);
          // Redirect based on user role
          this.redirectBasedOnRole(response.user.role);
        },
        error: (error) => {
          this.isLoading.set(false);
          let errorMessage = 'Login failed. Please try again.';
          
          if (error.status === 431) {
            errorMessage = 'Request data too large. Please contact support.';
          } else if (error.status === 401) {
            errorMessage = 'Invalid email or password. Please check your credentials.';
          } else if (error.status === 429) {
            errorMessage = 'Too many login attempts. Please wait a moment and try again.';
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          }
          
          this.error.set(errorMessage);
          this.toastService.error(errorMessage);
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private redirectBasedOnRole(role: string): void {
    // Redirect all authenticated users to the main dashboard
    this.router.navigate(['/dashboard']);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        return 'Password must be at least 6 characters long';
      }
    }
    return '';
  }

  signInWithGoogle(): void {
    this.isGoogleLoading.set(true);
    this.error.set(null);

    try {
      this.authService.signInWithGoogle();
    } catch (error) {
      this.isGoogleLoading.set(false);
      this.error.set('Google sign-in failed. Please try again.');
      console.error('Google OAuth error:', error);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }
}

