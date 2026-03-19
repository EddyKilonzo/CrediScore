import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface Review {
  id: string;
  reviewer: string;
  businessName: string;
  rating: number;
  content: string;
  date: Date | string;
  status: 'pending' | 'approved' | 'flagged' | 'rejected';
  credibility?: number;
  validationResult?: any;
  receiptData?: any;
  receiptUrl?: string;
  amount?: number;
  reviewDate?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    reputation: number;
    isFlagged?: boolean;
    flagCount?: number;
    flagReason?: string | null;
  };
  business?: {
    id: string;
    name: string;
    category: string;
  };
  aiFlags?: {
    lowCredibility: boolean;
    hasFraudDetection: boolean;
    needsManualReview: boolean;
  };
}

@Component({
  selector: 'app-moderate-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './moderate-reviews.component.html',
  styleUrl: './moderate-reviews.component.css'
})
export class ModerateReviewsComponent implements OnInit {
  reviews: Review[] = [];
  isLoading = true;
  isProcessing = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Bulk selection
  selectedIds = new Set<string>();
  isBulkProcessing = false;

  private readonly API_BASE = 'http://localhost:3000/api/admin/reviews';
  private readonly BULK_API = 'http://localhost:3000/api/admin/reviews/bulk';

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Scroll to top when component loads
    window.scrollTo(0, 0);
    
    this.loadReviews();
  }

  private async loadReviews(): Promise<void> {
    try {
      this.isLoading = true;
      this.error = null;
      
      const response = await this.http.get<{reviews: Review[], pagination: any}>(`${this.API_BASE}/pending`).toPromise();
      
      if (response) {
        this.reviews = response.reviews.map(review => ({
          ...review,
          date: new Date(review.date)
        }));
      }
    } catch (error: any) {
      console.error('Error loading reviews:', error);
      
      // Provide friendlier error messages
      if (error.status === 0) {
        this.error = 'Unable to connect to the server. Please check if the backend is running on port 3000.';
      } else if (error.status === 404) {
        this.error = 'Review moderation service is not available. Please contact your administrator.';
      } else if (error.status === 401) {
        this.error = 'You are not authorized to access this feature. Please log in as an administrator.';
      } else if (error.status === 403) {
        this.error = 'Access denied. Admin privileges required.';
      } else if (error.status >= 500) {
        this.error = 'Server error occurred. Please try again later or contact support.';
      } else {
        this.error = error.message || 'Failed to load reviews. Please try again.';
      }
      
      this.reviews = [];
    } finally {
      this.isLoading = false;
    }
  }


  async refreshReviews(): Promise<void> {
    await this.loadReviews();
  }

  async approveReview(reviewId: string): Promise<void> {
    try {
      this.isProcessing = true;
      this.error = null;
      
      const response = await this.http.post(`${this.API_BASE}/${reviewId}/approve`, {}).toPromise();
      
      if (response) {
        this.successMessage = 'Review approved successfully';
        // Remove the review from the list
        this.reviews = this.reviews.filter(review => review.id !== reviewId);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.successMessage = null;
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error approving review:', error);
      this.error = error.message || 'Failed to approve review';
    } finally {
      this.isProcessing = false;
    }
  }

  async flagReview(reviewId: string): Promise<void> {
    try {
      this.isProcessing = true;
      this.error = null;
      
      const response = await this.http.post(`${this.API_BASE}/${reviewId}/flag`, {}).toPromise();
      
      if (response) {
        this.successMessage = 'Review flagged successfully';
        // Update the review status
        const review = this.reviews.find(r => r.id === reviewId);
        if (review) {
          review.status = 'flagged';
        }
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.successMessage = null;
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error flagging review:', error);
      this.error = error.message || 'Failed to flag review';
    } finally {
      this.isProcessing = false;
    }
  }

  async rejectReview(reviewId: string): Promise<void> {
    try {
      this.isProcessing = true;
      this.error = null;
      
      const response = await this.http.post(`${this.API_BASE}/${reviewId}/reject`, {}).toPromise();
      
      if (response) {
        this.successMessage = 'Review rejected successfully';
        // Remove the review from the list
        this.reviews = this.reviews.filter(review => review.id !== reviewId);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.successMessage = null;
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error rejecting review:', error);
      this.error = error.message || 'Failed to reject review';
    } finally {
      this.isProcessing = false;
    }
  }

  toggleSelect(reviewId: string) {
    if (this.selectedIds.has(reviewId)) {
      this.selectedIds.delete(reviewId);
    } else {
      this.selectedIds.add(reviewId);
    }
  }

  selectAll() {
    if (this.selectedIds.size === this.reviews.length) {
      this.selectedIds.clear();
    } else {
      this.reviews.forEach(r => this.selectedIds.add(r.id));
    }
  }

  get allSelected(): boolean {
    return this.reviews.length > 0 && this.selectedIds.size === this.reviews.length;
  }

  async bulkApprove() {
    if (!this.selectedIds.size || this.isBulkProcessing) return;
    this.isBulkProcessing = true;
    this.error = null;
    try {
      await this.http.post(this.BULK_API, { reviewIds: Array.from(this.selectedIds), action: 'APPROVE' }).toPromise();
      this.reviews = this.reviews.filter(r => !this.selectedIds.has(r.id));
      this.selectedIds.clear();
      this.successMessage = 'Reviews approved successfully';
      setTimeout(() => { this.successMessage = null; }, 3000);
    } catch (err: any) {
      this.error = err?.error?.message || 'Bulk approve failed';
    } finally {
      this.isBulkProcessing = false;
    }
  }

  async bulkReject() {
    if (!this.selectedIds.size || this.isBulkProcessing) return;
    this.isBulkProcessing = true;
    this.error = null;
    try {
      await this.http.post(this.BULK_API, { reviewIds: Array.from(this.selectedIds), action: 'REJECT' }).toPromise();
      this.reviews = this.reviews.filter(r => !this.selectedIds.has(r.id));
      this.selectedIds.clear();
      this.successMessage = 'Reviews rejected successfully';
      setTimeout(() => { this.successMessage = null; }, 3000);
    } catch (err: any) {
      this.error = err?.error?.message || 'Bulk reject failed';
    } finally {
      this.isBulkProcessing = false;
    }
  }

  navigateToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  getStars(rating: number): boolean[] {
    return Array(5).fill(false).map((_, index) => index < rating);
  }

  openImageModal(imageUrl: string): void {
    // Open image in new window/tab for full view
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
  }
}
