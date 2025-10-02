import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, RegisterRequest } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';

// Interfaces for multi-step signup
interface SignupStep {
  id: number;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
}

interface DiscoveryFormData {
  userType: 'customer' | 'business';
  interests: string[];
  businessNeeds: string;
}

interface AccountFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  acceptTerms: boolean;
  role: 'customer' | 'business';
}

interface VerificationFormData {
  businessName?: string;
  businessCategory?: string;
  businessLocation?: string;
  verificationMethod: 'email' | 'document';
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  // Multi-step registration state
  currentStep = 1;
  totalSteps = 3;
  
  // Steps configuration
  steps: SignupStep[] = [
    {
      id: 1,
      title: 'Search & Discover',
      description: 'Find businesses by name, registration number, or till number. Browse verified profiles and trust scores.',
      icon: 'search',
      completed: false
    },
    {
      id: 2,
      title: 'Account Setup',
      description: 'Create your account with basic information and choose your role in the platform.',
      icon: 'person',
      completed: false
    },
    {
      id: 3,
      title: 'Verification',
      description: 'Complete your profile verification for enhanced trust and credibility.',
      icon: 'verified',
      completed: false
    }
  ];

  // Forms for each step
  discoveryForm: FormGroup;
  accountForm: FormGroup;
  verificationForm: FormGroup;

  // State management
  isLoading = signal(false);
  error = signal<string | null>(null);
  isGoogleLoading = signal(false);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {
    // Step 1: Discovery/Interest Form
    this.discoveryForm = this.fb.group({
      userType: ['customer', [Validators.required]],
      interests: this.fb.array([]),
      businessNeeds: ['', [Validators.minLength(10)]]
    });

    // Step 2: Account Creation Form
    this.accountForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      phone: ['', [Validators.pattern(/^\+?[1-9]\d{1,14}$/)]],
      acceptTerms: [false, [Validators.requiredTrue]],
      role: ['customer', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    // Step 3: Verification Form
    this.verificationForm = this.fb.group({
      businessName: [''],
      businessCategory: [''],
      businessLocation: [''],
      verificationMethod: ['email', [Validators.required]]
    });
  }

  ngOnInit() {
    // Initialize when component loads
  }

  // Step navigation methods
  nextStep(): void {
    if (this.validateCurrentStep()) {
      if (this.currentStep < this.totalSteps) {
        this.steps[this.currentStep - 1].completed = true;
        this.currentStep++;
      } else {
        this.completeSignup();
      }
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.error.set(null);
    }
  }

  goToStep(stepNumber: number): void {
    if (stepNumber <= this.currentStep || this.steps[stepNumber - 1].completed) {
      this.currentStep = stepNumber;
      this.error.set(null);
    }
  }

  validateCurrentStep(): boolean {
    switch (this.currentStep) {
      case 1:
        return this.discoveryForm.valid;
      case 2:
        return this.accountForm.valid;
      case 3:
        return this.verificationForm.valid;
      default:
        return false;
    }
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
    if (this.accountForm.valid) {
      this.isLoading.set(true);
      this.error.set(null);

      const registerData: RegisterRequest = {
        name: this.accountForm.value.name,
        email: this.accountForm.value.email,
        password: this.accountForm.value.password,
        role: this.accountForm.value.role === 'business' ? 'business' : 'user',
        phone: this.accountForm.value.phone || undefined
      };

      this.authService.register(registerData).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          // Complete the final step
          this.steps[this.currentStep - 1].completed = true;
          // Redirect based on user role
          this.redirectBasedOnRole(response.user.role);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.error.set(error.error?.message || 'Registration failed. Please try again.');
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
    switch (role) {
      case 'admin':
        this.router.navigate(['/admin/dashboard']);
        break;
      case 'business':
        this.router.navigate(['/business/dashboard']);
        break;
      case 'user':
        this.router.navigate(['/user/dashboard']);
        break;
      default:
        this.router.navigate(['/home']);
    }
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  private markFormGroupTouched(): void {
    const currentForm = this.getCurrentForm();
    Object.keys(currentForm.controls).forEach(key => {
      const control = currentForm.get(key);
      control?.markAsTouched();
    });
  }

  getCurrentForm(): FormGroup {
    switch (this.currentStep) {
      case 1: return this.discoveryForm;
      case 2: return this.accountForm;
      case 3: return this.verificationForm;
      default: return this.accountForm;
    }
  }

  getFieldError(fieldName: string): string {
    const form = this.getCurrentForm();
    const field = form.get(fieldName);
    
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        if (fieldName === 'name') {
          return 'Name must be at least 2 characters long';
        }
        if (fieldName === 'businessNeeds') {
          return 'Please provide more details (at least 10 characters)';
        }
        return 'Password must be at least 8 characters long';
      }
      if (field.errors['passwordMismatch']) {
        return 'Passwords do not match';
      }
      if (field.errors['pattern']) {
        return 'Please enter a valid phone number';
      }
      if (field.errors['requiredTrue']) {
        return 'You must accept the terms and conditions';
      }
    }
    return '';
  }

  // Step-specific getters
  get progressPercentage(): number {
    return (this.currentStep / this.totalSteps) * 100;
  }

  get isFirstStep(): boolean {
    return this.currentStep === 1;
  }

  get isLastStep(): boolean {
    return this.currentStep === this.totalSteps;
  }

  get stepTitle(): string {
    return this.steps[this.currentStep - 1]?.title || '';
  }

  get stepDescription(): string {
    return this.steps[this.currentStep - 1]?.description || '';
  }
}

