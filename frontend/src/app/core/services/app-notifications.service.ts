import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationExtras } from '@angular/router';
import { Observable, BehaviorSubject, interval, Subscription } from 'rxjs';
import { switchMap, tap, catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  refId?: string;
  createdAt: string;
}

export interface NotificationsPageResponse {
  notifications: AppNotification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AppNotificationsService {
  private readonly API_URL = `${environment.apiUrl}/api`;
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private unreadCount$ = new BehaviorSubject<number>(0);
  private notifications$ = new BehaviorSubject<AppNotification[]>([]);
  private pollSub: Subscription | null = null;
  private failureCount = 0;
  private pausedUntil = 0;

  readonly unreadCount = this.unreadCount$.asObservable();
  readonly notifications = this.notifications$.asObservable();

  startPolling(intervalMs = 30000) {
    this.stopPolling();
    this.fetchUnreadCount();
    this.pollSub = interval(intervalMs).pipe(
      switchMap(() => {
        if (!this.authService.isAuthenticated()) {
          return of({ unread: 0 });
        }

        // Back off polling briefly when backend is unavailable.
        if (Date.now() < this.pausedUntil) {
          return of({ unread: this.unreadCount$.value });
        }

        return this.fetchUnreadCountObs();
      })
    ).subscribe(res => this.unreadCount$.next(res.unread));
  }

  stopPolling() {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  fetchUnreadCount() {
    if (!this.authService.isAuthenticated()) return;
    this.fetchUnreadCountObs().subscribe(res => this.unreadCount$.next(res.unread));
  }

  private fetchUnreadCountObs(): Observable<{ unread: number }> {
    return this.http.get<{ unread: number }>(`${this.API_URL}/notifications/count`).pipe(
      tap(() => {
        this.failureCount = 0;
        this.pausedUntil = 0;
      }),
      catchError(() => this.fetchUnreadFromNotifications())
    );
  }

  private fetchUnreadFromNotifications(limit = 50): Observable<{ unread: number }> {
    return this.http
      .get<any>(`${this.API_URL}/notifications?page=1&limit=${limit}`)
      .pipe(
        tap(res => this.notifications$.next(res.notifications || [])),
        switchMap((res) => {
          this.failureCount = 0;
          this.pausedUntil = 0;
          const notifications = res?.notifications || [];
          const unread = notifications.filter((n: AppNotification) => !n.isRead).length;
          return of({ unread });
        }),
        catchError(() => {
          this.failureCount += 1;
          if (this.failureCount >= 3) {
            this.pausedUntil = Date.now() + 5 * 60 * 1000; // 5 minutes
          }
          return of({ unread: this.unreadCount$.value });
        })
      );
  }

  /**
   * Loads the first page into the shared cache (navbar bell preview).
   * Unread badge uses the dedicated count endpoint so it stays accurate.
   */
  loadNotifications(page = 1, limit = 20): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/notifications?page=${page}&limit=${limit}`).pipe(
      tap((res) => {
        const notifications: AppNotification[] = res.notifications || [];
        this.notifications$.next(notifications);
        this.fetchUnreadCount();
      })
    );
  }

  /** Paginated fetch without replacing the navbar preview cache (full Notification Center). */
  fetchNotificationsPage(page = 1, limit = 20): Observable<NotificationsPageResponse> {
    return this.http.get<any>(`${this.API_URL}/notifications?page=${page}&limit=${limit}`).pipe(
      map((res) => ({
        notifications: (res.notifications || []) as AppNotification[],
        pagination: res.pagination || {
          page,
          limit,
          total: (res.notifications || []).length,
          totalPages: 1,
        },
      }))
    );
  }

  markRead(id: string): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/notifications/${id}/read`, {}).pipe(
      tap(() => {
        const current = this.notifications$.value;
        const ix = current.findIndex((n) => n.id === id);
        if (ix >= 0) {
          const updated = [...current];
          updated[ix] = { ...updated[ix], isRead: true };
          this.notifications$.next(updated);
        }
        this.fetchUnreadCount();
      })
    );
  }

  markAllRead(): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/notifications/read-all`, {}).pipe(
      tap(() => {
        this.notifications$.next(this.notifications$.value.map((n) => ({ ...n, isRead: true })));
        this.fetchUnreadCount();
      })
    );
  }

  /**
   * Router target for in-app notifications (refId semantics vary slightly by type).
   */
  getNotificationRouterLink(notif: AppNotification): { commands: any[]; extras?: NavigationExtras } | null {
    const ref = notif.refId?.trim();
    if (!ref) return null;
    const t = notif.type;

    if (t === 'REVIEW_REPLY') {
      return { commands: ['/my-reviews'], extras: { queryParams: { review: ref } } };
    }

    if (t === 'REVIEW_VOTE') {
      const isConversion =
        notif.title?.toLowerCase().includes('conversion') ||
        notif.body?.toLowerCase().includes('triggered');
      if (isConversion) {
        return { commands: ['/business', ref] };
      }
      return { commands: ['/my-reviews'], extras: { queryParams: { review: ref } } };
    }

    if (
      t === 'CLAIM_APPROVED' ||
      t === 'CLAIM_REJECTED' ||
      t === 'ALERT_TRIGGERED' ||
      t === 'BUSINESS_VERIFIED' ||
      t === 'BUSINESS_REJECTED'
    ) {
      return { commands: ['/business', ref] };
    }

    return null;
  }

  openNotification(router: Router, notif: AppNotification): boolean {
    const spec = this.getNotificationRouterLink(notif);
    if (!spec) return false;
    router.navigate(spec.commands, spec.extras || {});
    return true;
  }

  getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
      REVIEW_REPLY: 'uil-comment-alt',
      REVIEW_VOTE: 'uil-thumbs-up',
      BUSINESS_VERIFIED: 'uil-check-circle',
      BUSINESS_REJECTED: 'uil-times-circle',
      CLAIM_APPROVED: 'uil-building',
      CLAIM_REJECTED: 'uil-building',
      REVIEW_FLAGGED: 'uil-flag',
      DISPUTE_UPDATE: 'uil-shield',
      ALERT_TRIGGERED: 'uil-chart-line',
      WEEKLY_DIGEST: 'uil-envelope-alt',
      RECOMMENDATION: 'uil-star',
    };
    return icons[type] || 'uil-bell';
  }
}
