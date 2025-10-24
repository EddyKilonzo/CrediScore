import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface Review {
  id: number;
  reviewer: string;
  business: string;
  rating: number;
  content: string;
  date: Date;
  status: 'pending' | 'approved' | 'flagged' | 'rejected';
}

@Component({
  selector: 'app-moderate-reviews',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './moderate-reviews.component.html',
  styleUrl: './moderate-reviews.component.css'
})
export class ModerateReviewsComponent implements OnInit {
  reviews: Review[] = [];
  isLoading = true;
  isProcessing = false;
  error: string | null = null;
  successMessage: string | null = null;

  private readonly API_BASE = 'http://localhost:3000/api/admin/reviews';

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

  async approveReview(reviewId: number): Promise<void> {
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

  async flagReview(reviewId: number): Promise<void> {
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

  async rejectReview(reviewId: number): Promise<void> {
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

  navigateToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  getStars(rating: number): boolean[] {
    return Array(5).fill(false).map((_, index) => index < rating);
  }
}
