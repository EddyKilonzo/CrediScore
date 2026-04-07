import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  AppNotificationsService,
  AppNotification,
  NotificationsPageResponse,
} from '../core/services/app-notifications.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notification-center.component.html',
  styleUrl: './notification-center.component.css',
})
export class NotificationCenterComponent implements OnInit {
  private notifService = inject(AppNotificationsService);
  private router = inject(Router);

  items: AppNotification[] = [];
  page = 1;
  readonly pageSize = 25;
  totalPages = 1;
  total = 0;
  loading = true;
  error: string | null = null;
  markingAll = false;

  get allRead(): boolean {
    return this.items.length > 0 && this.items.every((n) => n.isRead);
  }

  ngOnInit(): void {
    this.loadPage(1);
  }

  loadPage(p: number): void {
    this.loading = true;
    this.error = null;
    this.page = p;
    this.notifService.fetchNotificationsPage(p, this.pageSize).subscribe({
      next: (res: NotificationsPageResponse) => {
        this.items = res.notifications;
        this.total = res.pagination.total;
        this.totalPages = Math.max(1, res.pagination.totalPages);
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load notifications.';
        this.loading = false;
      },
    });
  }

  prevPage(): void {
    if (this.page > 1) this.loadPage(this.page - 1);
  }

  nextPage(): void {
    if (this.page < this.totalPages) this.loadPage(this.page + 1);
  }

  icon(type: string): string {
    return this.notifService.getNotificationIcon(type);
  }

  hasLink(notif: AppNotification): boolean {
    return this.notifService.getNotificationRouterLink(notif) != null;
  }

  timeLabel(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  onItemClick(notif: AppNotification): void {
    this.notifService.markRead(notif.id).subscribe(() => {
      const row = this.items.find((n) => n.id === notif.id);
      if (row) row.isRead = true;
    });
    this.notifService.openNotification(this.router, notif);
  }

  markAll(): void {
    this.markingAll = true;
    this.notifService.markAllRead().subscribe({
      next: () => {
        this.items = this.items.map((n) => ({ ...n, isRead: true }));
        this.markingAll = false;
      },
      error: () => {
        this.markingAll = false;
      },
    });
  }
}
