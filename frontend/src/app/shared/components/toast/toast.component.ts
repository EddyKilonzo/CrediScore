import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  progress?: number;
  isVisible?: boolean;
}

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css',
  animations: [
    trigger('slideInOut', [
      state('in', style({
        transform: 'translateX(0)',
        opacity: 1
      })),
      state('out', style({
        transform: 'translateX(100%)',
        opacity: 0
      })),
      transition('in => out', animate('300ms ease-in')),
      transition('void => in', animate('300ms ease-out'))
    ]),
    trigger('progressBar', [
      state('start', style({
        width: '100%'
      })),
      state('end', style({
        width: '0%'
      })),
      transition('start => end', animate('3000ms linear'))
    ])
  ]
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts = signal<Toast[]>([]);
  private timers = new Map<string, any>();
  private progressTimers = new Map<string, any>();

  ngOnInit(): void {
    // Component initialization
  }

  ngOnDestroy(): void {
    // Clean up all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.progressTimers.forEach(timer => clearInterval(timer));
    this.timers.clear();
    this.progressTimers.clear();
  }

  show(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 3000): void {
    const id = this.generateId();
    const toast: Toast = { 
      id, 
      message, 
      type, 
      duration, 
      progress: 100, 
      isVisible: true 
    };
    
    this.toasts.update(toasts => [...toasts, toast]);

    if (duration > 0) {
      // Start progress animation
      this.startProgressAnimation(id, duration);
      
      // Set removal timer
      const timer = setTimeout(() => {
        this.remove(id);
      }, duration);
      
      this.timers.set(id, timer);
    }
  }

  success(message: string, duration: number = 3000): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration: number = 5000): void {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration: number = 4000): void {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration: number = 3000): void {
    this.show(message, 'info', duration);
  }

  remove(id: string): void {
    // Clear timers
    const timer = this.timers.get(id);
    const progressTimer = this.progressTimers.get(id);
    
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    
    if (progressTimer) {
      clearInterval(progressTimer);
      this.progressTimers.delete(id);
    }

    // Update toast to trigger exit animation
    this.toasts.update(toasts => 
      toasts.map(t => t.id === id ? { ...t, isVisible: false } : t)
    );

    // Remove from array after animation completes
    setTimeout(() => {
      this.toasts.update(toasts => toasts.filter(t => t.id !== id));
    }, 300);
  }

  private startProgressAnimation(id: string, duration: number): void {
    const startTime = Date.now();
    const interval = 50; // Update every 50ms for smooth animation
    
    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const progress = (remaining / duration) * 100;
      
      this.toasts.update(toasts => 
        toasts.map(t => t.id === id ? { ...t, progress } : t)
      );
      
      if (progress <= 0) {
        clearInterval(progressTimer);
        this.progressTimers.delete(id);
      }
    }, interval);
    
    this.progressTimers.set(id, progressTimer);
  }

  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
