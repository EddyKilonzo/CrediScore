import { Component, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, NgIf } from '@angular/common';
import { AuthService, User } from '../../../core/services/auth.service';
import { ToastService } from '../toast/toast.service';
import { ImageService } from '../../services/image.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, CommonModule, NgIf],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  private authService = inject(AuthService) as AuthService;
  private toastService = inject(ToastService) as ToastService;
  public imageService = inject(ImageService) as ImageService;
  
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  logout() {
    const userName = this.currentUser()?.name || 'User';
    this.authService.logout(true); // Redirect to home
    this.toastService.info(`Goodbye, ${userName}! You have been logged out successfully.`);
  }

  getUserInitials(user: User): string {
    return this.imageService.getUserInitials(user);
  }

  getProfileImageUrl(): string | null {
    return this.imageService.getProfileImageUrl(this.currentUser());
  }

  onImageError(event: Event): void {
    // Hide the image and show initials instead
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    
    // Show the initials span
    const span = img.parentElement?.querySelector('span');
    if (span) {
      span.style.display = 'flex';
    }
  }
}