import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-20 right-4 z-50 space-y-2">
      <div 
        *ngFor="let toast of toasts()" 
        class="toast-item animate-slideInRight"
        [ngClass]="getToastClass(toast.type)"
        [style.opacity]="toast.isVisible ? 1 : 0"
        [style.transform]="toast.isVisible ? 'translateX(0)' : 'translateX(100%)'">
        
        <div class="flex items-center">
          <!-- Icon -->
          <div class="flex-shrink-0 mr-3">
            <i [ngClass]="getIconClass(toast.type)" class="text-lg"></i>
          </div>
          
          <!-- Message -->
          <div class="flex-1">
            <p class="text-sm font-medium">{{ toast.message }}</p>
          </div>
          
          <!-- Close Button -->
          <button 
            (click)="removeToast(toast.id)"
            class="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 transition-colors">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <!-- Progress Bar -->
        <div *ngIf="toast.duration && toast.duration > 0" class="progress-bar">
          <div 
            class="progress-fill" 
            [ngClass]="getToastClass(toast.type)"
            [style.width.%]="toast.progress">
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-item {
      @apply max-w-sm w-full bg-white rounded-lg shadow-lg border-l-4 p-4;
      animation: slideInRight 0.3s ease-out;
    }
    
    .toast-item.success {
      @apply border-green-500;
    }
    
    .toast-item.error {
      @apply border-red-500;
    }
    
    .toast-item.warning {
      @apply border-yellow-500;
    }
    
    .toast-item.info {
      @apply border-blue-500;
    }
    
    .progress-bar {
      @apply absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg overflow-hidden;
    }
    
    .progress-fill {
      @apply h-full bg-gray-400;
      animation: progressBar linear;
    }
    
    .progress-fill.success {
      @apply bg-green-500;
    }
    
    .progress-fill.error {
      @apply bg-red-500;
    }
    
    .progress-fill.warning {
      @apply bg-yellow-500;
    }
    
    .progress-fill.info {
      @apply bg-blue-500;
    }
    
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes progressBar {
      from {
        width: 100%;
      }
      to {
        width: 0%;
      }
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

  removeToast(id: string) {
    this.toastService.remove(id);
  }
}