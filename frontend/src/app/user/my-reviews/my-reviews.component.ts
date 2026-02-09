import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ReviewService, Review, ReviewReply } from '../../core/services/review.service';

@Component({
  selector: 'app-my-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './my-reviews.component.html',
  styleUrl: './my-reviews.component.css',
})
export class MyReviewsComponent implements OnInit {
  private reviewService = inject(ReviewService);

  reviews: Review[] = [];
  filteredReviews: Review[] = [];
  isLoading: boolean = false;
  error: string | null = null;
  reviewReplies: Map<string, ReviewReply[]> = new Map();
  loadingReplies: Set<string> = new Set();

  // Filter states
  selectedRating: number | null = null;
  selectedStatus: 'all' | 'verified' | 'pending' | 'rejected' = 'all';
  searchQuery: string = '';
  showFilters: boolean = true;
  sortBy: 'date' | 'rating' | 'credibility' = 'date';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Pagination
  currentPage: number = 1;
  pageSize: number = 20;
  totalPages: number = 1;
  totalReviews: number = 0;

  // Rating options
  ratingOptions = [5, 4, 3, 2, 1];

  // Media modal
  selectedMedia: { url: string; type: 'image' | 'receipt' } | null = null;
  showMediaModal: boolean = false;

  // Edit modal
  showEditModal: boolean = false;
  editingReview: Review | null = null;
  editForm = {
    rating: 5,
    comment: '',
  };
  isSaving: boolean = false;

  // Delete modal
  showDeleteModal: boolean = false;
  deletingReview: Review | null = null;
  isDeleting: boolean = false;

  // Receipt upload modal
  showReceiptUploadModal: boolean = false;
  uploadingReceiptForReview: Review | null = null;
  selectedReceiptFile: File | null = null;
  isUploadingReceipt: boolean = false;

  // Statistics
  statistics = {
    total: 0,
    verified: 0,
    pending: 0,
    rejected: 0,
    averageRating: 0,
    averageCredibility: 0,
  };

  ngOnInit() {
    this.loadReviews();
  }

  loadReviews() {
    this.isLoading = true;
    this.error = null;

    this.reviewService.getUserReviews(this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        this.reviews = response.reviews;
        this.totalReviews = response.pagination.total;
        this.totalPages = response.pagination.totalPages;
        this.calculateStatistics();
        this.applyFilters();

        // Load replies for all reviews
        this.reviews.forEach((review) => {
          if (review.id) {
            this.loadReviewReplies(review.id);
          }
        });

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading reviews:', err);
        this.error = 'Failed to load reviews. Please try again.';
        this.isLoading = false;
      },
    });
  }

  calculateStatistics() {
    const total = this.reviews.length;
    const verified = this.reviews.filter((r) => r.isVerified && r.isActive).length;
    const pending = this.reviews.filter((r) => !r.isVerified && r.isActive).length;
    const rejected = this.reviews.filter((r) => !r.isActive).length;

    const totalRating = this.reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = total > 0 ? totalRating / total : 0;

    const totalCredibility = this.reviews.reduce((sum, r) => sum + r.credibility, 0);
    const averageCredibility = total > 0 ? totalCredibility / total : 0;

    this.statistics = {
      total,
      verified,
      pending,
      rejected,
      averageRating,
      averageCredibility,
    };
  }

  applyFilters() {
    let filtered = [...this.reviews];

    // Apply rating filter
    if (this.selectedRating !== null) {
      filtered = filtered.filter((review) => review.rating === this.selectedRating);
    }

    // Apply status filter
    if (this.selectedStatus !== 'all') {
      filtered = filtered.filter((review) => {
        if (this.selectedStatus === 'verified') {
          return review.isVerified && review.isActive;
        } else if (this.selectedStatus === 'pending') {
          return !review.isVerified && review.isActive;
        } else if (this.selectedStatus === 'rejected') {
          return !review.isActive;
        }
        return true;
      });
    }

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter((review) => {
        const businessMatch = review.business.name.toLowerCase().includes(query);
        const commentMatch = review.comment?.toLowerCase().includes(query);
        return businessMatch || commentMatch;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (this.sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        case 'credibility':
          comparison = a.credibility - b.credibility;
          break;
      }

      return this.sortOrder === 'asc' ? comparison : -comparison;
    });

    this.filteredReviews = filtered;
  }

  onRatingFilterChange(rating: number | null) {
    this.selectedRating = this.selectedRating === rating ? null : rating;
    this.applyFilters();
  }

  onStatusFilterChange(status: 'all' | 'verified' | 'pending' | 'rejected') {
    this.selectedStatus = status;
    this.applyFilters();
  }

  onSortChange(sortBy: 'date' | 'rating' | 'credibility') {
    if (this.sortBy === sortBy) {
      // Toggle sort order if same field
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = sortBy;
      this.sortOrder = 'desc';
    }
    this.applyFilters();
  }

  onSearchChange() {
    this.applyFilters();
  }

  clearFilters() {
    this.selectedRating = null;
    this.selectedStatus = 'all';
    this.searchQuery = '';
    this.applyFilters();
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  getStarsArray(rating: number): number[] {
    return Array(5)
      .fill(0)
      .map((_, i) => (i < rating ? 1 : 0));
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  }

  getReviewMedia(review: Review): Array<{ url: string; type: 'image' | 'receipt' }> {
    const media: Array<{ url: string; type: 'image' | 'receipt' }> = [];

    // Add receipt URL if available
    if (review.receiptUrl) {
      media.push({ url: review.receiptUrl, type: 'receipt' });
    }

    // Check receiptData for images
    if (review.receiptData && typeof review.receiptData === 'object') {
      if (review.receiptData.imageUrl) {
        media.push({ url: review.receiptData.imageUrl, type: 'image' });
      }
      if (review.receiptData.images && Array.isArray(review.receiptData.images)) {
        review.receiptData.images.forEach((img: string) => {
          if (img && !media.find((m) => m.url === img)) {
            media.push({ url: img, type: 'image' });
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
          if (img && !media.find((m) => m.url === img)) {
            media.push({ url: img, type: 'image' });
          }
        });
      }
    }

    return media;
  }

  openMediaModal(media: { url: string; type: 'image' | 'receipt' }) {
    this.selectedMedia = media;
    this.showMediaModal = true;
  }

  closeMediaModal() {
    this.showMediaModal = false;
    this.selectedMedia = null;
  }

  viewBusiness(businessId: string) {
    window.location.href = `/business/${businessId}`;
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadReviews();
    }
  }

  hasActiveFilters(): boolean {
    return (
      this.selectedRating !== null ||
      this.selectedStatus !== 'all' ||
      this.searchQuery.trim() !== ''
    );
  }

  // Expose Math to template
  Math = Math;

  // Load replies for a review
  loadReviewReplies(reviewId: string): void {
    if (this.reviewReplies.has(reviewId) || this.loadingReplies.has(reviewId)) {
      return; // Already loaded or loading
    }

    this.loadingReplies.add(reviewId);
    this.reviewService.getReviewReplies(reviewId).subscribe({
      next: (replies) => {
        this.reviewReplies.set(reviewId, replies);
        this.loadingReplies.delete(reviewId);

        // Update the review object with replies
        const review = this.reviews.find((r) => r.id === reviewId);
        if (review) {
          review.replies = replies;
          // If there are replies, mark the review as verified
          // (Backend automatically verifies reviews when business owners reply)
          if (replies.length > 0) {
            review.isVerified = true;
          }
        }
        const filteredReview = this.filteredReviews.find((r) => r.id === reviewId);
        if (filteredReview) {
          filteredReview.replies = replies;
          // If there are replies, mark the review as verified
          if (replies.length > 0) {
            filteredReview.isVerified = true;
          }
        }

        // Recalculate statistics after updating verification status
        this.calculateStatistics();
      },
      error: (error) => {
        console.error('Error loading replies:', error);
        this.reviewReplies.set(reviewId, []);
        this.loadingReplies.delete(reviewId);
      },
    });
  }

  getReviewReplies(reviewId: string): ReviewReply[] {
    return this.reviewReplies.get(reviewId) || [];
  }

  formatReplyDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return this.formatDate(dateString);
  }

  getReplyAuthorName(reply: ReviewReply): string {
    return reply.user?.name || 'Business Owner';
  }

  getReplyAuthorInitial(reply: ReviewReply): string {
    return reply.user?.name?.charAt(0) || 'B';
  }

  // Edit Review Methods
  openEditModal(review: Review) {
    this.editingReview = review;
    this.editForm = {
      rating: review.rating,
      comment: review.comment || '',
    };
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editingReview = null;
    this.isSaving = false;
  }

  saveReview() {
    if (!this.editingReview) return;

    this.isSaving = true;
    this.reviewService
      .updateReview(this.editingReview.id, {
        rating: this.editForm.rating,
        comment: this.editForm.comment,
      })
      .subscribe({
        next: (updatedReview) => {
          // Update the review in the arrays
          const index = this.reviews.findIndex((r) => r.id === updatedReview.id);
          if (index !== -1) {
            this.reviews[index] = { ...this.reviews[index], ...updatedReview };
          }
          this.applyFilters();
          this.closeEditModal();
        },
        error: (err) => {
          console.error('Error updating review:', err);
          alert('Failed to update review. Please try again.');
          this.isSaving = false;
        },
      });
  }

  // Delete Review Methods
  openDeleteModal(review: Review) {
    this.deletingReview = review;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.deletingReview = null;
    this.isDeleting = false;
  }

  confirmDelete() {
    if (!this.deletingReview) return;

    this.isDeleting = true;
    this.reviewService.deleteReview(this.deletingReview.id).subscribe({
      next: () => {
        // Remove the review from the arrays
        this.reviews = this.reviews.filter((r) => r.id !== this.deletingReview!.id);
        this.totalReviews--;
        this.calculateStatistics();
        this.applyFilters();
        this.closeDeleteModal();
      },
      error: (err) => {
        console.error('Error deleting review:', err);
        alert('Failed to delete review. Please try again.');
        this.isDeleting = false;
      },
    });
  }

  // Receipt Upload Methods
  openReceiptUploadModal(review: Review) {
    this.uploadingReceiptForReview = review;
    this.showReceiptUploadModal = true;
  }

  closeReceiptUploadModal() {
    this.showReceiptUploadModal = false;
    this.uploadingReceiptForReview = null;
    this.selectedReceiptFile = null;
    this.isUploadingReceipt = false;
  }

  onReceiptFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedReceiptFile = input.files[0];
    }
  }

  uploadReceipt() {
    if (!this.uploadingReceiptForReview || !this.selectedReceiptFile) return;

    this.isUploadingReceipt = true;
    // Note: This would need a service method to upload the receipt
    // For now, just showing the modal structure
    // You would typically call something like:
    // this.reviewService.uploadReceipt(this.uploadingReceiptForReview.id, this.selectedReceiptFile)
    console.log('Upload receipt for review:', this.uploadingReceiptForReview.id);
    console.log('File:', this.selectedReceiptFile);

    // Simulating upload
    setTimeout(() => {
      alert('Receipt upload functionality would be implemented here');
      this.closeReceiptUploadModal();
    }, 1000);
  }

  getStatusLabel(review: Review): string {
    if (!review.isActive) return 'Rejected';
    return review.isVerified ? 'Verified' : 'Pending';
  }

  getStatusClass(review: Review): string {
    if (!review.isActive) return 'rejected';
    return review.isVerified ? 'verified' : 'pending';
  }
}
