import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, RegisterRequest } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  // Single form for registration
  signupForm: FormGroup;

  // State management
  isLoading = signal(false);
  error = signal<string | null>(null);
  isGoogleLoading = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private toastService: ToastService
  ) {
    // Single signup form
    this.signupForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required, 
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      ]],
      confirmPassword: ['', [Validators.required]],
      phone: ['', [Validators.pattern(/^\+?[1-9]\d{1,14}$/)]],
      acceptTerms: [false, [Validators.requiredTrue]],
      role: ['user', [Validators.required, Validators.pattern(/^(user|business)$/)]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    // Scroll to top when component loads
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Google SSO Integration
  async signInWithGoogle(): Promise<void> {
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

  // Traditional form submission
  completeSignup(): void {
    if (this.signupForm.valid) {
      this.isLoading.set(true);
      this.error.set(null);

      const registerData = {
        name: `${this.signupForm.value.firstName} ${this.signupForm.value.lastName}`,
        email: this.signupForm.value.email,
        password: this.signupForm.value.password,
        role: this.signupForm.value.role,
        ...(this.signupForm.value.phone && this.signupForm.value.phone.trim() !== '' && { phone: this.signupForm.value.phone })
      };

      // Debug logging
      console.log('Form values:', this.signupForm.value);
      console.log('Register data being sent:', registerData);

      this.authService.register(registerData).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          
          // Show success message
          this.toastService.success(`Welcome to CrediScore, ${response.user.name.split(' ')[0]}! Please check your email for verification code.`);
          
          // Redirect to email verification page
          this.router.navigate(['/auth/verify-email'], { 
            queryParams: { email: response.user.email } 
          });
        },
        error: (error) => {
          this.isLoading.set(false);
          
          // Detailed error logging
          console.error('Registration error:', error);
          console.error('Error status:', error?.status);
          console.error('Error message:', error?.error);
          
          const errorMessage = error?.error?.message || error?.message || 'Registration failed. Please try again.';
          this.error.set(errorMessage);
          
          // Check if user already exists
          if (typeof errorMessage === 'string' && (errorMessage.toLowerCase().includes('already exists') || 
              errorMessage.toLowerCase().includes('email already') ||
              errorMessage.toLowerCase().includes('user already'))) {
            this.toastService.warning('An account with this email already exists. Please sign in instead.');
          } else {
            this.toastService.error(errorMessage);
          }
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  private redirectBasedOnRole(role: string): void {
    // Redirect based on user role
    if (role === 'business' || role === 'BUSINESS_OWNER') {
      this.router.navigate(['/business/dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.signupForm.controls).forEach(key => {
      const control = this.signupForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.signupForm.get(fieldName);
    
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        if (fieldName === 'firstName' || fieldName === 'lastName') {
          return 'Name must be at least 2 characters long';
        }
        if (fieldName === 'password') {
          return 'Password must be at least 8 characters long';
        }
        return 'Field must be at least 8 characters long';
      }
      if (field.errors['passwordMismatch']) {
        return 'Passwords do not match';
      }
      if (field.errors['pattern']) {
        if (fieldName === 'phone') {
          return 'Please enter a valid phone number (e.g., +254712345678)';
        }
        if (fieldName === 'password') {
          return 'Password does not meet security requirements';
        }
        return 'Please enter a valid format';
      }
      if (field.errors['requiredTrue']) {
        return 'You must accept the terms and conditions';
      }
      if (field.errors['pattern'] && fieldName === 'role') {
        return 'Please select a valid account type';
      }
    }
    return '';
  }

  // Password visibility toggle methods
  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }

  // Password strength validation
  getPasswordStrength(): { strength: string; message: string; color: string; progress: number } {
    const password = this.signupForm.get('password')?.value || '';
    
    if (!password) {
      return { strength: '', message: '', color: '', progress: 0 };
    }
    
    if (password.length < 8) {
      return { strength: 'Poor', message: 'At least 8 characters required', color: 'bg-red-500', progress: 20 };
    }
    
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[@$!%*?&]/.test(password);
    
    const requirements = [hasLower, hasUpper, hasNumber, hasSpecial];
    const metRequirements = requirements.filter(Boolean).length;
    
    if (metRequirements === 4) {
      return { strength: 'Strong', message: 'Excellent password security', color: 'bg-green-500', progress: 100 };
    } else if (metRequirements >= 3) {
      return { strength: 'Medium', message: 'Good password security', color: 'bg-yellow-500', progress: 75 };
    } else if (metRequirements >= 2) {
      return { strength: 'Poor', message: 'Weak password security', color: 'bg-orange-500', progress: 50 };
    } else {
      return { strength: 'Poor', message: 'Very weak password', color: 'bg-red-500', progress: 25 };
    }
  }

  // Check if password meets all requirements
  isPasswordValid(): boolean {
    const password = this.signupForm.get('password')?.value || '';
    return password.length >= 8 && 
           /[a-z]/.test(password) && 
           /[A-Z]/.test(password) && 
           /\d/.test(password) && 
           /[@$!%*?&]/.test(password);
  }

  // Password requirement checkers for template
  hasMinLength(): boolean {
    const password = this.signupForm.get('password')?.value || '';
    return password.length >= 8;
  }

  hasLowerCase(): boolean {
    const password = this.signupForm.get('password')?.value || '';
    return /[a-z]/.test(password);
  }

  hasUpperCase(): boolean {
    const password = this.signupForm.get('password')?.value || '';
    return /[A-Z]/.test(password);
  }

  hasNumber(): boolean {
    const password = this.signupForm.get('password')?.value || '';
    return /\d/.test(password);
  }

  hasSpecialChar(): boolean {
    const password = this.signupForm.get('password')?.value || '';
    return /[@$!%*?&]/.test(password);
  }

  // Debug method to check role selection
  getSelectedRole(): string {
    return this.signupForm.get('role')?.value || 'none';
  }

  // Method to log role changes
  onRoleChange(): void {
    const selectedRole = this.getSelectedRole();
    console.log('Role changed to:', selectedRole);
    
    // Mark the role field as touched to trigger validation
    this.signupForm.get('role')?.markAsTouched();
    
    // Optional: Show a toast notification
    if (selectedRole === 'business') {
      this.toastService.info('Business account selected - you\'ll have access to business features');
    } else if (selectedRole === 'user') {
      this.toastService.info('Customer account selected - you can review and verify businesses');
    }
  }
}

