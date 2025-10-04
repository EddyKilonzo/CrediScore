import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../../core/services/auth.service';
import { ToastService } from '../toast/toast.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  private authService = inject(AuthService) as AuthService;
  private toastService = inject(ToastService) as ToastService;
  
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  logout() {
    const userName = this.currentUser()?.name || 'User';
    this.authService.logout();
    this.toastService.info(`Goodbye, ${userName}! You have been logged out successfully.`);
  }

  getUserInitials(user: User): string {
    if (!user || !user.name) return '';
    const nameParts = user.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[1] || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }
}