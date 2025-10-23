import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-email-verification',
  templateUrl: './email-verification.component.html',
  styleUrls: ['./email-verification.component.css']
})
export class EmailVerificationComponent implements OnInit {
  verificationForm: FormGroup;
  resendForm: FormGroup;
  isLoading = false;
  isResending = false;
  email: string = '';
  showResendForm = false;
  resendCooldown = 0;
  cooldownInterval: any;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.verificationForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });

    this.resendForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    // Get email from query params if available
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.email = params['email'];
        this.resendForm.patchValue({ email: this.email });
      }
    });
  }

  onSubmit(): void {
    if (this.verificationForm.valid) {
      this.isLoading = true;
      const code = this.verificationForm.get('code')?.value;

      this.authService.verifyEmail(code).subscribe({
        next: (response) => {
          this.notificationService.showSuccess(response.message);
          this.router.navigate(['/auth/login'], { 
            queryParams: { verified: 'true' } 
          });
        },
        error: (error) => {
          this.notificationService.showError(error.error?.message || 'Verification failed');
          this.isLoading = false;
        }
      });
    }
  }

  onResendCode(): void {
    if (this.resendForm.valid) {
      this.isResending = true;
      const email = this.resendForm.get('email')?.value;

      this.authService.resendVerificationCode(email).subscribe({
        next: (response) => {
          this.notificationService.showSuccess(response.message);
          this.email = email;
          this.showResendForm = false;
          this.startCooldown();
          this.isResending = false;
        },
        error: (error) => {
          this.notificationService.showError(error.error?.message || 'Failed to resend verification code');
          this.isResending = false;
        }
      });
    }
  }

  startCooldown(): void {
    this.resendCooldown = 60; // 60 seconds cooldown
    this.cooldownInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.cooldownInterval);
      }
    }, 1000);
  }

  toggleResendForm(): void {
    this.showResendForm = !this.showResendForm;
  }

  ngOnDestroy(): void {
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }
  }
}
