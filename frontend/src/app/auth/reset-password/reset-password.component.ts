import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent implements OnInit {
  form: FormGroup;
  isLoading = signal(false);
  success = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);
  token = signal<string | null>(null);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
  ) {
    this.form = this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator },
    );
  }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.error.set('Invalid or missing reset token. Please request a new password reset.');
    }
    this.token.set(token);
  }

  private passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const pass = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass && confirm && pass !== confirm ? { passwordMismatch: true } : null;
  }

  onSubmit(): void {
    if (this.form.invalid || !this.token()) return;

    this.isLoading.set(true);
    this.error.set(null);

    this.authService.resetPassword(this.token()!, this.form.value.newPassword).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.success.set(true);
        this.toastService.success('Password reset successfully! You can now log in.');
        setTimeout(() => this.router.navigate(['/auth/login']), 3000);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || 'Failed to reset password. The link may have expired.';
        this.error.set(msg);
        this.toastService.error(msg);
      },
    });
  }
}
