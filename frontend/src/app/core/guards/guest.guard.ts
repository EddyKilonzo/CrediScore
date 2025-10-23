import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class GuestGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (!this.authService.isAuthenticated()) {
      return true; // Allow access to guest-only routes
    }
    
    // Redirect authenticated users to their dashboard
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.redirectToUserDashboard(currentUser.role);
    } else {
      this.router.navigate(['/home']);
    }
    
    return false;
  }

  private redirectToUserDashboard(role: string): void {
    switch (role) {
      case 'admin':
        this.router.navigate(['/admin/dashboard']);
        break;
      case 'business':
      case 'BUSINESS_OWNER':
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
