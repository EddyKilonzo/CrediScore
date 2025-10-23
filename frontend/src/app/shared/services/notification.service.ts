import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  constructor() {}

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private addNotification(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date()
    };

    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([...currentNotifications, newNotification]);

    // Auto-remove notification after duration
    const duration = notification.duration || 5000; // Default 5 seconds
    setTimeout(() => {
      this.removeNotification(newNotification.id);
    }, duration);
  }

  showSuccess(message: string, title: string = 'Success', duration?: number): void {
    this.addNotification({
      type: 'success',
      title,
      message,
      duration
    });
  }

  showError(message: string, title: string = 'Error', duration?: number): void {
    this.addNotification({
      type: 'error',
      title,
      message,
      duration: duration || 8000 // Errors stay longer
    });
  }

  showWarning(message: string, title: string = 'Warning', duration?: number): void {
    this.addNotification({
      type: 'warning',
      title,
      message,
      duration
    });
  }

  showInfo(message: string, title: string = 'Info', duration?: number): void {
    this.addNotification({
      type: 'info',
      title,
      message,
      duration
    });
  }

  removeNotification(id: string): void {
    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next(
      currentNotifications.filter(notification => notification.id !== id)
    );
  }

  clearAll(): void {
    this.notificationsSubject.next([]);
  }

  getNotifications(): Notification[] {
    return this.notificationsSubject.value;
  }
}
