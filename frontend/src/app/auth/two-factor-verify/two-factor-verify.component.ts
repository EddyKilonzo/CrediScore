import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-two-factor-verify',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './two-factor-verify.component.html',
})
export class TwoFactorVerifyComponent implements OnInit {
  form: FormGroup;
  isLoading = signal(false);
  error = signal<string | null>(null);
  userId = signal<string | null>(null);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
  ) {
    this.form = this.fb.group({
      token: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  ngOnInit(): void {
    const userId = this.route.snapshot.queryParamMap.get('userId');
    if (!userId) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.userId.set(userId);
  }

  onSubmit(): void {
    if (this.form.invalid || !this.userId()) return;

    this.isLoading.set(true);
    this.error.set(null);

    this.authService.verify2FA(this.userId()!, this.form.value.token).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.toastService.success(`Welcome back, ${response.user.name.split(' ')[0]}!`);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.status === 401 ? 'Invalid code. Please try again.' : (err.error?.message || 'Verification failed.');
        this.error.set(msg);
        this.toastService.error(msg);
      },
    });
  }
}
