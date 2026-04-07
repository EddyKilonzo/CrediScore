import { Component, signal, inject, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../../core/services/auth.service';
import { ToastService } from '../toast/toast.service';
import { ImageService } from '../../services/image.service';
import { AppNotificationsService, AppNotification } from '../../../core/services/app-notifications.service';
import { Subscription } from 'rxjs';
import { TPipe } from '../../pipes/t.pipe';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, CommonModule, TPipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar implements OnInit, OnDestroy {
  private authService = inject(AuthService) as AuthService;
  private toastService = inject(ToastService) as ToastService;
  public imageService = inject(ImageService) as ImageService;
  public notifService = inject(AppNotificationsService);

  @ViewChild('notifContainer') notifContainer?: ElementRef<HTMLElement>;

  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;
  showNotifPanel = false;
  notifications: AppNotification[] = [];
  notifLoading = false;
  isDark = false;
  private notifSub?: Subscription;

  ngOnInit() {
    if (this.isAuthenticated()) {
      this.notifService.startPolling();
      this.notifSub = this.notifService.notifications.subscribe(
        n => this.notifications = n
      );
    }
    // Sync with saved theme
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      this.isDark = true;
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    const theme = this.isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  ngOnDestroy() {
    this.notifService.stopPolling();
    this.notifSub?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.showNotifPanel || !this.notifContainer?.nativeElement) return;
    const el = this.notifContainer.nativeElement;
    if (!el.contains(event.target as Node)) {
      this.showNotifPanel = false;
    }
  }

  toggleNotifPanel() {
    this.showNotifPanel = !this.showNotifPanel;
    if (this.showNotifPanel) {
      this.notifLoading = true;
      this.notifService.loadNotifications().subscribe({
        next: () => { this.notifLoading = false; },
        error: () => { this.notifLoading = false; }
      });
    }
  }

  markAllRead() {
    this.notifService.markAllRead().subscribe();
  }

  markRead(id: string) {
    this.notifService.markRead(id).subscribe();
  }

  getNotifIcon(type: string): string {
    return this.notifService.getNotificationIcon(type);
  }

  formatNotifDate(dateStr: string): string {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

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