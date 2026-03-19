import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval, Subscription } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from './auth.service';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  refId?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AppNotificationsService {
  private readonly API_URL = 'http://localhost:3000/api';
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private unreadCount$ = new BehaviorSubject<number>(0);
  private notifications$ = new BehaviorSubject<AppNotification[]>([]);
  private pollSub: Subscription | null = null;

  readonly unreadCount = this.unreadCount$.asObservable();
  readonly notifications = this.notifications$.asObservable();

  startPolling(intervalMs = 30000) {
    this.stopPolling();
    this.fetchUnreadCount();
    this.pollSub = interval(intervalMs).pipe(
      switchMap(() => this.authService.isAuthenticated() ? this.fetchUnreadCountObs() : of({ unread: 0 }))
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
      catchError(() => of({ unread: 0 }))
    );
  }

  loadNotifications(page = 1, limit = 20): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/notifications?page=${page}&limit=${limit}`).pipe(
      tap(res => this.notifications$.next(res.notifications || []))
    );
  }

  markRead(id: string): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/notifications/${id}/read`, {}).pipe(
      tap(() => {
        const current = this.notifications$.value;
        const updated = current.map(n => n.id === id ? { ...n, isRead: true } : n);
        this.notifications$.next(updated);
        const unread = updated.filter(n => !n.isRead).length;
        this.unreadCount$.next(unread);
      })
    );
  }

  markAllRead(): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/notifications/read-all`, {}).pipe(
      tap(() => {
        const updated = this.notifications$.value.map(n => ({ ...n, isRead: true }));
        this.notifications$.next(updated);
        this.unreadCount$.next(0);
      })
    );
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
    };
    return icons[type] || 'uil-bell';
  }
}
