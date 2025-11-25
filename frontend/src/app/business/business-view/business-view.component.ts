import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BusinessService, Business, BusinessStatus } from '../../core/services/business.service';
import { AuthService } from '../../core/services/auth.service';
import { ReviewService } from '../../core/services/review.service';
import { ReviewReplyComponent } from '../../shared/components/review-reply/review-reply.component';
import { signal } from '@angular/core';

interface ReviewReply {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  reviewId?: string;
  userId?: string;
  user?: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
  };
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  userId: string;
  businessId: string;
  credibility?: number;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  amount?: number | null;
  receiptUrl?: string | null;
  receiptData?: any | null;
  validationResult?: any | null;
  replies?: ReviewReply[];
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface TrustScore {
  id: string;
  grade: string;
  score: number;
  businessId: string;
}

interface BusinessWithDetails extends Omit<Business, 'trustScore'> {
  reviews?: Review[];
  trustScore?: TrustScore | number;
  latitude?: number;
  longitude?: number;
  status?: BusinessStatus;
}

interface UploadedImage {
  file: File;
  preview: string;
  name: string;
  size: number;
}

@Component({
  selector: 'app-business-view',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, ReviewReplyComponent],
  templateUrl: './business-view.component.html',
  styleUrls: ['./business-view.component.css']
})
export class BusinessViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private businessService = inject(BusinessService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private reviewService = inject(ReviewService);
  private sanitizer = inject(DomSanitizer);
  
  business: BusinessWithDetails | null = null;
  loading = true;
  error: string | null = null;
  reviews: Review[] = [];
  averageRating: number = 0;
  totalReviews: number = 0;
  isAuthenticated = this.authService.isAuthenticated;

  // Review Form
  reviewForm!: FormGroup;
  selectedRating: number = 0;
  hoveredRating: number = 0;
  uploadedImages: UploadedImage[] = [];
  isDragOver: boolean = false;
  isSubmitting: boolean = false;
  reviewSubmitted: boolean = false;
  
  private readonly API_URL = 'http://localhost:3000/api';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_IMAGES = 5;

  ngOnInit() {
    // Initialize review form
    this.reviewForm = this.fb.group({
      comment: ['', [Validators.maxLength(1000)]]
    });

    // Initialize edit review form
    this.editReviewForm = this.fb.group({
      comment: ['', [Validators.maxLength(1000)]]
    });

    const businessId = this.route.snapshot.paramMap.get('id');
    if (businessId) {
      this.loadBusiness(businessId);
    } else {
      this.error = 'Business ID not found';
      this.loading = false;
    }
  }

  loadBusiness(id: string) {
    this.loading = true;
    this.error = null;
    
    this.businessService.getBusinessById(id).subscribe({
      next: (business) => {
        this.business = business as BusinessWithDetails;
        
        // Process reviews if available
        if (this.business.reviews && Array.isArray(this.business.reviews)) {
          this.reviews = this.business.reviews.filter((r: any) => r.isActive);
          this.calculateRatingStats();
        }
        
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading business:', err);
        this.error = 'Failed to load business details. Please try again.';
        this.loading = false;
      }
    });
  }

  calculateRatingStats() {
    if (!this.reviews || this.reviews.length === 0) {
      this.averageRating = 0;
      this.totalReviews = 0;
      return;
    }

    this.totalReviews = this.reviews.length;
    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.averageRating = Math.round((sum / this.totalReviews) * 10) / 10;
  }

  getBusinessGrade(): string {
    if (!this.business) return 'N/A';
    
    const trustScore = this.business.trustScore;
    if (typeof trustScore === 'object' && trustScore?.grade) {
      return trustScore.grade.toUpperCase();
    }
    if (typeof trustScore === 'object' && trustScore?.score !== undefined) {
      return this.getGradeFromScore(trustScore.score);
    }
    if (typeof trustScore === 'number') {
      return this.getGradeFromScore(trustScore);
    }
    return 'N/A';
  }

  getBusinessScore(): number {
    if (!this.business) return 0;
    
    const trustScore = this.business.trustScore;
    if (typeof trustScore === 'object' && trustScore?.score !== undefined) {
      return trustScore.score;
    }
    if (typeof trustScore === 'number') {
      return trustScore;
    }
    return 0;
  }

  getGradeFromScore(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  getGradeColor(grade: string): string {
    const gradeUpper = grade.toUpperCase();
    if (gradeUpper === 'A+' || gradeUpper === 'A') return '#10b981'; // Green
    if (gradeUpper === 'B') return '#3b82f6'; // Blue
    if (gradeUpper === 'C') return '#f59e0b'; // Yellow
    if (gradeUpper === 'D') return '#f97316'; // Orange
    return '#ef4444'; // Red for F
  }

  getPaymentIcon(type: string): string {
    const typeUpper = type.toUpperCase();
    if (typeUpper === 'TILL' || typeUpper === 'PAYBILL') return 'uil uil-mobile-android';
    if (typeUpper === 'BANK') return 'uil uil-university';
    return 'uil uil-money-bill';
  }

  hasSocialLinks(): boolean {
    if (!this.business?.socialLinks) return false;
    const links = this.business.socialLinks;
    return !!(
      links.facebook ||
      links.twitter ||
      links.instagram ||
      links.linkedin ||
      links.youtube ||
      links.tiktok
    );
  }

  formatDate(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  isBusinessVerified(): boolean {
    if (!this.business) return false;
    return this.business.isVerified || this.business.status === 'VERIFIED';
  }

  goBack() {
    this.router.navigate(['/search']);
  }

  refreshBusiness() {
    if (this.business && !this.loading) {
      this.loadBusiness(this.business.id);
    }
  }

  // Review Form Methods
  setRating(rating: number) {
    this.selectedRating = rating;
  }

  getRatingText(rating: number): string {
    const texts: { [key: number]: string } = {
      1: 'Poor',
      2: 'Fair',
      3: 'Good',
      4: 'Very Good',
      5: 'Excellent'
    };
    return texts[rating] || '';
  }

  isFormValid(): boolean {
    return this.selectedRating > 0 && !this.reviewForm.invalid;
  }

  // Drag and Drop Methods
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (this.uploadedImages.length < this.MAX_IMAGES) {
      this.isDragOver = true;
    }
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFiles(Array.from(files));
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFiles(Array.from(input.files));
    }
  }

  handleFiles(files: File[]) {
    const remainingSlots = this.MAX_IMAGES - this.uploadedImages.length;
    const filesToAdd = files.slice(0, remainingSlots);

    filesToAdd.forEach(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file. Please select an image.`);
        return;
      }

      if (file.size > this.MAX_FILE_SIZE) {
        alert(`${file.name} is too large. Maximum file size is 5MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.uploadedImages.push({
          file: file,
          preview: e.target.result,
          name: file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name,
          size: file.size
        });
      };
      reader.readAsDataURL(file);
    });

    if (files.length > remainingSlots) {
      alert(`You can only upload up to ${this.MAX_IMAGES} images. Only the first ${remainingSlots} were added.`);
    }
  }

  removeImage(index: number) {
    this.uploadedImages.splice(index, 1);
  }

  resetForm() {
    this.selectedRating = 0;
    this.hoveredRating = 0;
    this.uploadedImages = [];
    this.reviewForm.reset();
    this.reviewSubmitted = false;
    this.isSubmitting = false;
  }

  async submitReview() {
    if (!this.isFormValid() || !this.business || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;

    try {
      // First upload images if any
      let receiptUrl: string | null = null;
      if (this.uploadedImages.length > 0) {
        receiptUrl = await this.uploadImages();
      }

      // Create review payload
      const reviewData: any = {
        rating: this.selectedRating,
        comment: this.reviewForm.get('comment')?.value || null,
        businessId: this.business.id
      };

      if (receiptUrl) {
        reviewData.receiptUrl = receiptUrl;
      }

      // Submit review
      this.http.post(`${this.API_URL}/user/reviews`, reviewData).subscribe({
        next: (response: any) => {
          this.reviewSubmitted = true;
          this.isSubmitting = false;
          
          // Reload business to get updated reviews
          if (this.business) {
            this.loadBusiness(this.business.id);
          }
        },
        error: (error) => {
          console.error('Error submitting review:', error);
          this.error = error.error?.message || 'Failed to submit review. Please try again.';
          this.isSubmitting = false;
          alert(this.error);
        }
      });
    } catch (error) {
      console.error('Error in submitReview:', error);
      this.error = 'Failed to submit review. Please try again.';
      this.isSubmitting = false;
      alert(this.error);
    }
  }

  private async uploadImages(): Promise<string | null> {
    if (this.uploadedImages.length === 0) {
      return null;
    }

    try {
      const formData = new FormData();
      
      // Upload the first image as receipt
      formData.append('file', this.uploadedImages[0].file);
      if (this.business?.id) {
        formData.append('businessId', this.business.id);
      }

      // Upload to review receipt endpoint
      // Note: Don't set Content-Type header - browser will set it with boundary for multipart/form-data
      const response: any = await this.http.post(`${this.API_URL}/user/reviews/upload-receipt`, formData).toPromise().catch((error) => {
        // Log error but don't throw - allow review to be submitted without image
        console.warn('Receipt upload failed, continuing without receipt:', error);
        return null;
      });

      if (response && (response.url || response.receiptUrl)) {
        return response.url || response.receiptUrl;
      }
      
      return null;
    } catch (error: any) {
      console.warn('Error uploading receipt image:', error);
      // Return null to continue with review submission without image
      // The review can still be submitted, just without receipt verification
      return null;
    }
  }

  // Map Methods
  getMapUrl(): string | null {
    if (!this.business) return null;

    // If we have latitude and longitude, use them for precise location
    if (this.business.latitude && this.business.longitude) {
      // Use Google Maps embed with coordinates, zoom level, and marker
      // Format: https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d... or use the simpler format
      // Using the simpler embed format with better parameters
      const lat = this.business.latitude;
      const lng = this.business.longitude;
      const businessName = encodeURIComponent(this.business.name || '');
      return `https://www.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`;
    }

    // Otherwise, use the address/location string
    if (this.business.location || this.business.address) {
      const location = encodeURIComponent(this.business.location || this.business.address || '');
      return `https://www.google.com/maps?q=${location}&hl=en&z=15&output=embed`;
    }

    return null;
  }

  sanitizeMapUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  getGoogleMapsSearchUrl(): string {
    if (!this.business) return 'https://www.google.com/maps';

    // Use coordinates if available
    if (this.business.latitude && this.business.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${this.business.latitude},${this.business.longitude}`;
    }

    // Otherwise use address
    const location = encodeURIComponent(this.business.location || this.business.address || this.business.name || '');
    return `https://www.google.com/maps/search/?api=1&query=${location}`;
  }

  openImageModal(imageUrl: string): void {
    // Open image in new window/tab for full view
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
  }

  // Review Modal Methods
  selectedReview: Review | null = null;
  showReviewModal: boolean = false;
  
  // Edit Review
  editingReview: Review | null = null;
  editReviewForm!: FormGroup;
  editSelectedRating: number = 0;
  isUpdating: boolean = false;
  
  // Delete Review
  deletingReview: Review | null = null;
  isDeleting: boolean = false;

  openReviewModal(review: Review): void {
    this.selectedReview = review;
    this.showReviewModal = true;
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeReviewModal(): void {
    this.selectedReview = null;
    this.showReviewModal = false;
    // Restore body scroll
    document.body.style.overflow = '';
  }

  getReviewMedia(review: Review): Array<{ url: string; type: 'image' | 'receipt' }> {
    const media: Array<{ url: string; type: 'image' | 'receipt' }> = [];

    // Add receipt URL if available
    if (review.receiptUrl) {
      media.push({ url: review.receiptUrl, type: 'receipt' });
    }

    // Check receiptData for images (can be object or string)
    if (review.receiptData) {
      if (typeof review.receiptData === 'string') {
        // If receiptData is a string URL, add it
        try {
          const parsed = JSON.parse(review.receiptData);
          if (parsed && typeof parsed === 'object') {
            if (parsed.imageUrl) {
              media.push({ url: parsed.imageUrl, type: 'image' });
            }
            if (parsed.images && Array.isArray(parsed.images)) {
              parsed.images.forEach((img: string) => {
                if (img && !media.find(m => m.url === img)) {
                  media.push({ url: img, type: 'image' });
                }
              });
            }
          }
        } catch {
          // If parsing fails, treat as URL
          if (review.receiptData && !media.find(m => m.url === review.receiptData)) {
            media.push({ url: review.receiptData as string, type: 'image' });
          }
        }
      } else if (typeof review.receiptData === 'object') {
        if (review.receiptData.imageUrl) {
          media.push({ url: review.receiptData.imageUrl, type: 'image' });
        }
        if (review.receiptData.images && Array.isArray(review.receiptData.images)) {
          review.receiptData.images.forEach((img: string) => {
            if (img && !media.find(m => m.url === img)) {
              media.push({ url: img, type: 'image' });
            }
          });
        }
        // Check for any other image fields
        Object.keys(review.receiptData).forEach(key => {
          const value = (review.receiptData as any)[key];
          if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('/') || value.startsWith('data:'))) {
            if (!media.find(m => m.url === value)) {
              media.push({ url: value, type: 'image' });
            }
          }
        });
      }
    }

    // Check validationResult for images
    if (review.validationResult && typeof review.validationResult === 'object') {
      if (review.validationResult.receiptImage) {
        media.push({ url: review.validationResult.receiptImage, type: 'receipt' });
      }
      if (review.validationResult.images && Array.isArray(review.validationResult.images)) {
        review.validationResult.images.forEach((img: string) => {
          if (img && !media.find(m => m.url === img)) {
            media.push({ url: img, type: 'image' });
          }
        });
      }
    }

    return media;
  }

  openMediaInModal(mediaUrl: string): void {
    window.open(mediaUrl, '_blank', 'noopener,noreferrer');
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    // Show placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'image-error-placeholder';
    placeholder.innerHTML = '<i class="uil uil-image-slash"></i><span>Image unavailable</span>';
    img.parentElement?.appendChild(placeholder);
  }

  // Check if current user owns the review
  isReviewOwner(review: Review): boolean {
    const currentUser = this.authService.currentUser();
    return currentUser !== null && review.userId === currentUser.id;
  }

  // Edit Review Methods
  openEditReview(review: Review, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.editingReview = review;
    this.editSelectedRating = review.rating;
    this.editReviewForm.patchValue({
      comment: review.comment || ''
    });
  }

  closeEditReview(): void {
    this.editingReview = null;
    this.editSelectedRating = 0;
    this.editReviewForm.reset();
    this.isUpdating = false;
  }

  setEditRating(rating: number): void {
    this.editSelectedRating = rating;
  }

  isEditFormValid(): boolean {
    return this.editSelectedRating > 0 && !this.editReviewForm.invalid;
  }

  async updateReview(): Promise<void> {
    if (!this.isEditFormValid() || !this.editingReview || this.isUpdating) {
      return;
    }

    this.isUpdating = true;

    try {
      const updateData: any = {
        rating: this.editSelectedRating,
        comment: this.editReviewForm.get('comment')?.value || null
      };

      this.reviewService.updateReview(this.editingReview.id, updateData).subscribe({
        next: (updatedReview) => {
          // Update the review in the local array
          const index = this.reviews.findIndex(r => r.id === updatedReview.id);
          if (index !== -1) {
            this.reviews[index] = { ...this.reviews[index], ...updatedReview };
          }
          
          // Update in business reviews if exists
          if (this.business?.reviews) {
            const businessReviewIndex = this.business.reviews.findIndex(r => r.id === updatedReview.id);
            if (businessReviewIndex !== -1) {
              this.business.reviews[businessReviewIndex] = { ...this.business.reviews[businessReviewIndex], ...updatedReview };
            }
          }

          this.calculateRatingStats();
          this.closeEditReview();
        },
        error: (error) => {
          console.error('Error updating review:', error);
          this.error = error.error?.message || 'Failed to update review. Please try again.';
          alert(this.error);
          this.isUpdating = false;
        }
      });
    } catch (error) {
      console.error('Error in updateReview:', error);
      this.error = 'Failed to update review. Please try again.';
      this.isUpdating = false;
    }
  }

  // Delete Review Methods
  openDeleteConfirm(review: Review, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.deletingReview = review;
  }

  closeDeleteConfirm(): void {
    this.deletingReview = null;
    this.isDeleting = false;
  }

  async confirmDeleteReview(): Promise<void> {
    if (!this.deletingReview) {
      return;
    }

    this.isDeleting = true;

    const reviewToDelete = this.deletingReview;
    
    try {
      this.reviewService.deleteReview(reviewToDelete.id).subscribe({
        next: () => {
          // Remove review from local array
          this.reviews = this.reviews.filter(r => r.id !== reviewToDelete.id);
          
          // Remove from business reviews if exists
          if (this.business?.reviews) {
            this.business.reviews = this.business.reviews.filter(r => r.id !== reviewToDelete.id);
          }

          this.calculateRatingStats();
          
          // Close modals if open
          if (this.selectedReview?.id === reviewToDelete.id) {
            this.closeReviewModal();
          }
          if (this.editingReview?.id === reviewToDelete.id) {
            this.closeEditReview();
          }
          
          this.closeDeleteConfirm();
        },
        error: (error) => {
          console.error('Error deleting review:', error);
          this.error = error.error?.message || 'Failed to delete review. Please try again.';
          this.isDeleting = false;
        }
      });
    } catch (error) {
      console.error('Error in deleteReview:', error);
      this.error = 'Failed to delete review. Please try again.';
      this.isDeleting = false;
    }
  }

  // Review Reply Methods
  isBusinessOwner(): boolean {
    const user = this.authService.currentUser();
    if (!user || !this.business) return false;
    return user.role === 'BUSINESS_OWNER' || user.role === 'ADMIN';
  }

  getReviewReplies(reviewId: string): any {
    const review = this.reviews.find(r => r.id === reviewId);
    if (review && review.replies) {
      return signal(review.replies);
    }
    return signal([]);
  }

  onReplyAdded(reply: any): void {
    // Find the review that this reply belongs to
    const reviewId = reply.reviewId || this.selectedReview?.id;
    if (!reviewId) return;

    const review = this.reviews.find(r => r.id === reviewId);
    if (review) {
      if (!review.replies) {
        review.replies = [];
      }
      // Ensure reviewId is set on the reply
      const replyWithReviewId = { ...reply, reviewId };
      review.replies.push(replyWithReviewId);
    }
    
    if (this.selectedReview && this.selectedReview.id === reviewId) {
      if (!this.selectedReview.replies) {
        this.selectedReview.replies = [];
      }
      const replyWithReviewId = { ...reply, reviewId };
      this.selectedReview.replies.push(replyWithReviewId);
    }
    
    // Refresh business data to get updated reviews with replies
    if (this.business?.id) {
      this.loadBusiness(this.business.id);
    }
  }

  onReplyUpdated(reply: ReviewReply): void {
    const review = this.reviews.find(r => r.id === (reply as any).reviewId || this.selectedReview?.id === (reply as any).reviewId);
    if (review && review.replies) {
      const index = review.replies.findIndex(r => r.id === reply.id);
      if (index !== -1) {
        review.replies[index] = reply;
      }
    }
    if (this.selectedReview && this.selectedReview.replies) {
      const index = this.selectedReview.replies.findIndex(r => r.id === reply.id);
      if (index !== -1) {
        this.selectedReview.replies[index] = reply;
      }
    }
  }

  onReplyDeleted(replyId: string): void {
    this.reviews.forEach(review => {
      if (review.replies) {
        review.replies = review.replies.filter(r => r.id !== replyId);
      }
    });
    if (this.selectedReview && this.selectedReview.replies) {
      this.selectedReview.replies = this.selectedReview.replies.filter(r => r.id !== replyId);
    }
  }
}
