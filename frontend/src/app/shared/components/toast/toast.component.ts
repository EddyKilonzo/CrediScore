import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-20 right-4 z-50 space-y-3">
      <div 
        *ngFor="let toast of toasts()" 
        class="toast-item"
        [ngClass]="getToastClass(toast.type)">
        
        <div class="flex items-center">
          <!-- Icon -->
          <div class="flex-shrink-0 mr-3">
            <i [ngClass]="getIconClass(toast.type)" class="text-lg"></i>
          </div>
          
          <!-- Message -->
          <div class="flex-1">
            <p class="text-sm font-medium text-white">{{ toast.message }}</p>
          </div>
          
          <!-- Close Button -->
          <button 
            (click)="removeToast(toast.id)"
            class="flex-shrink-0 ml-3 text-white/70 hover:text-white transition-colors">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <!-- CSS Animated Timer Bar -->
        <div *ngIf="toast.duration && toast.duration > 0" class="timer-bar">
          <div 
            class="timer-fill"
            [ngClass]="getTimerClass(toast.type)"
            [style.animation-duration]="toast.duration + 'ms'">
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-item {
      @apply max-w-sm w-full rounded-xl shadow-xl border border-white/20 p-4 relative overflow-hidden;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      border-left: 4px solid;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    
    .toast-item.success {
      @apply border-green-400;
      box-shadow: 0 8px 32px rgba(34, 197, 94, 0.25);
    }
    
    .toast-item.error {
      @apply border-red-400;
      box-shadow: 0 8px 32px rgba(239, 68, 68, 0.25);
    }
    
    .toast-item.warning {
      @apply border-yellow-400;
      box-shadow: 0 8px 32px rgba(245, 158, 11, 0.25);
    }
    
    .toast-item.info {
      @apply border-blue-400;
      box-shadow: 0 8px 32px rgba(59, 130, 246, 0.25);
    }
    
    .timer-bar {
      @apply absolute bottom-0 left-0 right-0 h-1 bg-gray-600/30 rounded-b-xl overflow-hidden;
    }
    
    .timer-fill {
      @apply h-full;
      animation: timerCountdown linear;
      transform-origin: left;
    }
    
    .timer-fill.success {
      @apply bg-gradient-to-r from-green-400 to-green-500;
    }
    
    .timer-fill.error {
      @apply bg-gradient-to-r from-red-400 to-red-500;
    }
    
    .timer-fill.warning {
      @apply bg-gradient-to-r from-yellow-400 to-yellow-500;
    }
    
    .timer-fill.info {
      @apply bg-gradient-to-r from-blue-400 to-blue-500;
    }
    
    @keyframes slideInRight {
      from {
        transform: translateX(100%) scale(0.95);
        opacity: 0;
      }
      to {
        transform: translateX(0) scale(1);
        opacity: 1;
      }
    }
    
    @keyframes timerCountdown {
      from {
        transform: scaleX(1);
      }
      to {
        transform: scaleX(0);
      }
    }
    
    /* Dark frosty glass effect enhancement */
    .toast-item::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.02) 50%, rgba(255, 255, 255, 0.05) 100%);
      border-radius: inherit;
      pointer-events: none;
    }
    
    /* Additional dark frosty overlay */
    .toast-item::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.05) 50%, transparent 70%);
      border-radius: inherit;
      pointer-events: none;
      animation: frostShimmer 3s ease-in-out infinite;
    }
    
    @keyframes frostShimmer {
      0%, 100% {
        opacity: 0.3;
        transform: translateX(-100%);
      }
      50% {
        opacity: 0.6;
        transform: translateX(100%);
      }
    }
    
    /* Hover effect */
    .toast-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    }
  `]
})
export class ToastComponent {
  private toastService = inject(ToastService);
  
  toasts = this.toastService.toasts;

  getToastClass(type: Toast['type']): string {
    return type;
  }

  getIconClass(type: Toast['type']): string {
    switch (type) {
      case 'success':
        return 'fas fa-check-circle text-green-500';
      case 'error':
        return 'fas fa-exclamation-circle text-red-500';
      case 'warning':
        return 'fas fa-exclamation-triangle text-yellow-500';
      case 'info':
        return 'fas fa-info-circle text-blue-500';
      default:
        return 'fas fa-info-circle text-blue-500';
    }
  }

  getTimerClass(type: Toast['type']): string {
    return type;
  }

  removeToast(id: string) {
    this.toastService.remove(id);
  }
}