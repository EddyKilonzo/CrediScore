import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent {
  form: FormGroup;
  isLoading = signal(false);
  submitted = signal(false);
  error = signal<string | null>(null);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastService: ToastService,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.isLoading.set(true);
    this.error.set(null);

    this.authService.forgotPassword(this.form.value.email).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.submitted.set(true);
        this.toastService.success('Password reset instructions sent to your email.');
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || 'Something went wrong. Please try again.';
        this.error.set(msg);
        this.toastService.error(msg);
      },
    });
  }
}
