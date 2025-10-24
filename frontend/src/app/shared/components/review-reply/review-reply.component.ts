import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../toast/toast.service';

interface ReviewReply {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
    role: string;
  };
}

@Component({
  selector: 'app-review-reply',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="review-replies">
      <h4>Replies ({{ replies().length }})</h4>
      
      <!-- Reply Form (only for business owners) -->
      @if (canReply()) {
        <div class="reply-form">
          <textarea 
            [(ngModel)]="replyContent"
            placeholder="Write a reply to this review..."
            class="reply-textarea"
            rows="3">
          </textarea>
          <div class="reply-actions">
            <button 
              (click)="submitReply()"
              [disabled]="!replyContent.trim() || isSubmitting()"
              class="btn-primary">
              @if (isSubmitting()) {
                <i class="fas fa-spinner fa-spin"></i>
                Submitting...
              } @else {
                <i class="fas fa-reply"></i>
                Reply
              }
            </button>
            <button 
              (click)="cancelReply()"
              class="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      }

      <!-- Replies List -->
      @if (replies().length > 0) {
        <div class="replies-list">
          @for (reply of replies(); track reply.id) {
            <div class="reply-item">
              <div class="reply-header">
                <div class="reply-author">
                  @if (reply.user.avatar) {
                    <img [src]="reply.user.avatar" [alt]="reply.user.name" class="author-avatar">
                  } @else {
                    <div class="author-initials">{{ getUserInitials(reply.user.name) }}</div>
                  }
                  <div class="author-info">
                    <span class="author-name">{{ reply.user.name }}</span>
                    <span class="author-role">{{ reply.user.role | titlecase }}</span>
                  </div>
                </div>
                <div class="reply-date">{{ reply.createdAt | date:'MMM d, y' }} at {{ reply.createdAt | date:'h:mm a' }}</div>
              </div>
              <div class="reply-content">{{ reply.content }}</div>
              @if (canEditReply(reply)) {
                <div class="reply-actions">
                  <button (click)="editReply(reply)" class="btn-edit">
                    <i class="fas fa-edit"></i>
                    Edit
                  </button>
                  <button (click)="deleteReply(reply.id)" class="btn-delete">
                    <i class="fas fa-trash"></i>
                    Delete
                  </button>
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <div class="no-replies">
          <p>No replies yet. Be the first to respond!</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .review-replies {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
    }

    .review-replies h4 {
      margin: 0 0 1rem 0;
      color: #1e293b;
      font-size: 1.1rem;
    }

    .reply-form {
      background: #f8fafc;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
    }

    .reply-textarea {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.9rem;
      resize: vertical;
      min-height: 80px;
    }

    .reply-textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .reply-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }

    .btn-primary, .btn-secondary, .btn-edit, .btn-delete {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      border: none;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
    }

    .btn-primary:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
    }

    .btn-edit {
      background: #f59e0b;
      color: white;
      font-size: 0.8rem;
      padding: 0.25rem 0.5rem;
    }

    .btn-edit:hover {
      background: #d97706;
    }

    .btn-delete {
      background: #ef4444;
      color: white;
      font-size: 0.8rem;
      padding: 0.25rem 0.5rem;
    }

    .btn-delete:hover {
      background: #dc2626;
    }

    .replies-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .reply-item {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem;
    }

    .reply-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .reply-author {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .author-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }

    .author-initials {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #3b82f6;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .author-info {
      display: flex;
      flex-direction: column;
    }

    .author-name {
      font-weight: 600;
      color: #1e293b;
      font-size: 0.9rem;
    }

    .author-role {
      font-size: 0.8rem;
      color: #64748b;
    }

    .reply-date {
      font-size: 0.8rem;
      color: #64748b;
    }

    .reply-content {
      color: #374151;
      line-height: 1.5;
      margin-bottom: 0.75rem;
    }

    .reply-actions {
      display: flex;
      gap: 0.5rem;
    }

    .no-replies {
      text-align: center;
      padding: 2rem;
      color: #64748b;
    }

    .no-replies p {
      margin: 0;
      font-style: italic;
    }
  `]
})
export class ReviewReplyComponent {
  @Input() reviewId: string = '';
  @Input() replies = signal<ReviewReply[]>([]);
  @Output() replyAdded = new EventEmitter<ReviewReply>();
  @Output() replyUpdated = new EventEmitter<ReviewReply>();
  @Output() replyDeleted = new EventEmitter<string>();

  replyContent = '';
  isSubmitting = signal(false);
  editingReply: ReviewReply | null = null;

  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  canReply(): boolean {
    const user = this.authService.currentUser();
    return user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN';
  }

  canEditReply(reply: ReviewReply): boolean {
    const user = this.authService.currentUser();
    return user?.id === reply.user.id;
  }

  getUserInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  submitReply(): void {
    if (!this.replyContent.trim()) return;

    this.isSubmitting.set(true);
    this.authService.createReviewReply(this.reviewId, this.replyContent.trim())
      .subscribe({
        next: (reply) => {
          this.replyAdded.emit(reply);
          this.replyContent = '';
          this.isSubmitting.set(false);
          this.toastService.show('Reply posted successfully', 'success');
        },
        error: (error) => {
          console.error('Error posting reply:', error);
          this.isSubmitting.set(false);
          this.toastService.show('Failed to post reply', 'error');
        }
      });
  }

  cancelReply(): void {
    this.replyContent = '';
    this.editingReply = null;
  }

  editReply(reply: ReviewReply): void {
    this.editingReply = reply;
    this.replyContent = reply.content;
  }

  deleteReply(replyId: string): void {
    if (confirm('Are you sure you want to delete this reply?')) {
      this.authService.deleteReviewReply(replyId)
        .subscribe({
          next: () => {
            this.replyDeleted.emit(replyId);
            this.toastService.show('Reply deleted successfully', 'success');
          },
          error: (error) => {
            console.error('Error deleting reply:', error);
            this.toastService.show('Failed to delete reply', 'error');
          }
        });
    }
  }
}
