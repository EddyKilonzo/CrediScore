import { Component, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { BusinessService, Business, BusinessStatus } from '../../core/services/business.service';
import { AuthService } from '../../core/services/auth.service';
import { ReviewService } from '../../core/services/review.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { environment } from '../../../environments/environment';
import { ReviewReplyComponent } from '../../shared/components/review-reply/review-reply.component';
import { ImageLightboxComponent } from '../../shared/components/image-lightbox/image-lightbox.component';
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
  helpfulCount?: number;
  notHelpfulCount?: number;
  userVote?: 'HELPFUL' | 'NOT_HELPFUL' | null;
  votes?: Array<{ userId: string; vote: string }>;
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, ReviewReplyComponent, ImageLightboxComponent],
  templateUrl: './business-view.component.html',
  styleUrls: ['./business-view.component.css']
})
export class BusinessViewComponent implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private businessService = inject(BusinessService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private reviewService = inject(ReviewService);
  private toastService = inject(ToastService);
  private leafletMap: L.Map | null = null;
  
  business: BusinessWithDetails | null = null;
  loading = true;
  error: string | null = null;
  reviews: Review[] = [];
  averageRating: number = 0;
  totalReviews: number = 0;
  isAuthenticated = this.authService.isAuthenticated;

  // Review Form
  reviewForm: FormGroup = new FormGroup({});
  selectedRating: number = 0;
  hoveredRating: number = 0;
  uploadedImages: UploadedImage[] = [];
  isDragOver: boolean = false;
  isSubmitting: boolean = false;
  isSubmittingReview: boolean = false;
  reviewSubmitted: boolean = false;
  
  private readonly API_URL = `${environment.apiUrl}/api`;
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_IMAGES = 5;

  // Fraud report modal state
  showFraudReportModal = false;
  fraudReportReason = '';
  fraudReportDescription = '';
  isSubmittingFraudReport = false;

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

  ngAfterViewInit() {
    // Map is initialized after business loads — see initLeafletMap()
  }

  ngOnDestroy() {
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }
  }

  get currentUser() {
    return this.authService.currentUser();
  }

  loadBusiness(id: string) {
    this.loading = true;
    this.error = null;

    this.businessService.getBusinessById(id).subscribe({
      next: (business) => {
        this.business = business as BusinessWithDetails;

        // Process reviews if available
        if (this.business.reviews && Array.isArray(this.business.reviews)) {
          const currentUserId = this.authService.currentUser()?.id;
          this.reviews = this.business.reviews
            .filter((r: any) => r.isActive)
            .map((r: any) => ({
              ...r,
              helpfulCount: r.votes?.filter((v: any) => v.vote === 'HELPFUL').length ?? 0,
              notHelpfulCount: r.votes?.filter((v: any) => v.vote === 'NOT_HELPFUL').length ?? 0,
              userVote: currentUserId
                ? (r.votes?.find((v: any) => v.userId === currentUserId)?.vote ?? null)
                : null,
            }));
          this.calculateRatingStats();
        }

        this.loading = false;
        // Initialize Leaflet map after Angular renders the map container
        setTimeout(() => this.initLeafletMap(), 200);
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

  getResponseRate(): number {
    if (!this.reviews || this.reviews.length === 0) return 0;
    const replied = this.reviews.filter(r => r.replies && r.replies.length > 0).length;
    return Math.round((replied / this.reviews.length) * 100);
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
    this.mpesaCode = '';
    this.reviewForm.reset();
    this.reviewSubmitted = false;
    this.isSubmitting = false;
  }

  toggleBookmark() {
    if (!this.business || this.isTogglingBookmark) return;
    this.isTogglingBookmark = true;
    this.reviewService.toggleBookmark(this.business.id).subscribe({
      next: (res) => {
        this.isBookmarked = res.bookmarked;
        this.isTogglingBookmark = false;
      },
      error: () => { this.isTogglingBookmark = false; }
    });
  }

  openFlagModal(review: Review, event: Event) {
    event.stopPropagation();
    this.flaggingReview = review;
    this.flagReason = '';
    this.showFlagModal = true;
  }

  closeFlagModal() {
    this.showFlagModal = false;
    this.flaggingReview = null;
    this.flagReason = '';
    this.isSubmittingFlag = false;
  }

  submitFlag() {
    if (!this.flaggingReview || !this.flagReason.trim() || this.isSubmittingFlag) return;
    this.isSubmittingFlag = true;
    this.reviewService.flagReview(this.flaggingReview.id, this.flagReason.trim()).subscribe({
      next: () => { this.closeFlagModal(); },
      error: (err) => {
        alert(err.error?.message || 'Failed to flag review');
        this.isSubmittingFlag = false;
      }
    });
  }

  openDisputeModal(review: Review, event: Event) {
    event.stopPropagation();
    this.disputingReview = review;
    this.disputeReason = '';
    this.showDisputeModal = true;
  }

  closeDisputeModal() {
    this.showDisputeModal = false;
    this.disputingReview = null;
    this.disputeReason = '';
    this.isSubmittingDispute = false;
  }

  submitDispute() {
    if (!this.disputingReview || !this.disputeReason.trim() || this.isSubmittingDispute) return;
    this.isSubmittingDispute = true;
    this.reviewService.disputeReview(this.disputingReview.id, this.disputeReason.trim()).subscribe({
      next: () => { this.closeDisputeModal(); },
      error: (err) => {
        alert(err.error?.message || 'Failed to submit dispute');
        this.isSubmittingDispute = false;
      }
    });
  }

  async submitReview() {
    if (!this.isFormValid() || !this.business || this.isSubmittingReview) {
      return;
    }

    this.isSubmittingReview = true;
    this.toastService.info('Uploading your review...');

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

      if (this.mpesaCode && this.mpesaCode.trim()) {
        reviewData.mpesaCode = this.mpesaCode.trim().toUpperCase();
      }

      // Submit review
      this.http.post(`${this.API_URL}/user/reviews`, reviewData).subscribe({
        next: (response: any) => {
          this.reviewSubmitted = true;
          this.isSubmittingReview = false;
          this.toastService.success('Review submitted successfully!');
          
          // Reload business to get updated reviews
          if (this.business) {
            this.loadBusiness(this.business.id);
          }
        },
        error: (error) => {
          console.error('Error submitting review:', error);
          const errorMsg = error.error?.message || 'Failed to submit review. Please try again.';
          this.isSubmittingReview = false;
          this.toastService.error(errorMsg);
        }
      });
    } catch (error) {
      console.error('Error in submitReview:', error);
      this.isSubmittingReview = false;
      this.toastService.error('Failed to submit review. Please try again.');
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
      const response: any = await this.http.post(`${this.API_URL}/user/reviews/upload-receipt`, formData).toPromise().catch((error) => {
        console.warn('Receipt upload failed, continuing without receipt:', error);
        return null;
      });

      if (response && (response.url || response.receiptUrl)) {
        return response.url || response.receiptUrl;
      }
      
      return null;
    } catch (error: any) {
      console.warn('Error uploading receipt image:', error);
      return null;
    }
  }

  // Map Methods — Leaflet / OpenStreetMap
  hasMapCoordinates(): boolean {
    return !!(this.business?.latitude && this.business?.longitude);
  }

  getOsmSearchUrl(): string {
    if (!this.business) return 'https://www.openstreetmap.org';
    if (this.business.latitude && this.business.longitude) {
      return `https://www.openstreetmap.org/?mlat=${this.business.latitude}&mlon=${this.business.longitude}&zoom=15`;
    }
    const q = encodeURIComponent(this.business.location || this.business.name || '');
    return `https://www.openstreetmap.org/search?query=${q}`;
  }

  getOsmDirectionsUrl(): string {
    if (!this.business) return 'https://www.openstreetmap.org';
    if (this.business.latitude && this.business.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${this.business.latitude},${this.business.longitude}`;
    }
    const q = encodeURIComponent(this.business.location || this.business.name || '');
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  initLeafletMap() {
    if (!this.business?.latitude || !this.business?.longitude) return;
    const container = document.getElementById('business-leaflet-map');
    if (!container) return;

    // Destroy existing map instance if any
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }

    const lat = this.business.latitude;
    const lng = this.business.longitude;
    const name = this.business.name || 'Business Location';

    this.leafletMap = L.map(container).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.leafletMap);

    const icon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    const directionsUrl = this.getOsmDirectionsUrl();
    const popupContent = `
      <div style="min-width: 150px; padding: 5px;">
        <strong style="display: block; margin-bottom: 5px; font-size: 1.1rem;">${name}</strong>
        ${this.business.location ? '<p style="margin: 5px 0; font-size: 0.9rem; color: #666;"><i class="uil uil-map-marker"></i> ' + this.business.location + '</p>' : ''}
        <a href="${directionsUrl}" target="_blank" 
           style="display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 8px 12px; margin-top: 10px; background-color: #3E6A8A; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.85rem; transition: background 0.2s;">
          <i class="uil uil-directions" style="margin-right: 6px; font-size: 1.1rem;"></i>
          Get Directions
        </a>
      </div>
    `;

    L.marker([lat, lng], { icon })
      .addTo(this.leafletMap)
      .bindPopup(popupContent)
      .openPopup();
  }

  // Lightbox
  lightboxImages: string[] = [];
  lightboxIndex = 0;
  lightboxOpen = false;

  openImageModal(imageUrl: string, allImages?: string[], index?: number): void {
    this.lightboxImages = allImages && allImages.length > 0 ? allImages : [imageUrl];
    this.lightboxIndex = index ?? 0;
    this.lightboxOpen = true;
  }

  closeLightbox() {
    this.lightboxOpen = false;
  }

  // Reputation badge helper
  getReputationBadge(reputation: number): { label: string; color: string; bg: string; icon: string } {
    if (reputation >= 500) return { label: 'Platinum', color: '#6366f1', bg: '#eef2ff', icon: 'uil-diamond' };
    if (reputation >= 200) return { label: 'Gold', color: '#d97706', bg: '#fffbeb', icon: 'uil-star' };
    if (reputation >= 50) return { label: 'Silver', color: '#6b7280', bg: '#f9fafb', icon: 'uil-award' };
    if (reputation >= 10) return { label: 'Bronze', color: '#b45309', bg: '#fef3c7', icon: 'uil-medal' };
    return { label: 'New', color: '#9ca3af', bg: '#f3f4f6', icon: 'uil-user' };
  }

  // Sentiment tags from validationResult
  getSentimentTags(review: Review): Array<{ label: string; color: string; bg: string }> {
    const tags: Array<{ label: string; color: string; bg: string }> = [];
    const vr = review.validationResult;
    const credibility = review.credibility ?? 0;

    if (review.isVerified) {
      tags.push({ label: 'Verified', color: '#059669', bg: '#ecfdf5' });
    }
    if (vr?.isAuthentic === true || credibility >= 80) {
      tags.push({ label: 'High Credibility', color: '#2563eb', bg: '#eff6ff' });
    }
    if (vr?.hasReceiptEvidence || review.receiptUrl) {
      tags.push({ label: 'Receipt Attached', color: '#7c3aed', bg: '#f5f3ff' });
    }
    if (review.amount && review.amount > 0) {
      tags.push({ label: 'Purchase Verified', color: '#0891b2', bg: '#ecfeff' });
    }
    if (vr?.flags?.length > 0 || credibility < 30) {
      tags.push({ label: 'Needs Review', color: '#d97706', bg: '#fffbeb' });
    }
    return tags;
  }

  // M-Pesa
  mpesaCode: string = '';

  // Bookmark
  isBookmarked: boolean = false;
  isTogglingBookmark: boolean = false;

  // Flag modal
  showFlagModal: boolean = false;
  flaggingReview: Review | null = null;
  flagReason: string = '';
  isSubmittingFlag: boolean = false;

  // Dispute modal
  showDisputeModal: boolean = false;
  disputingReview: Review | null = null;
  disputeReason: string = '';
  isSubmittingDispute: boolean = false;

  // Review Modal Methods
  selectedReview: Review | null = null;
  showReviewModal: boolean = false;
  
  // Edit Review
  editingReview: Review | null = null;
  editReviewForm: FormGroup = new FormGroup({});
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

  getReviewMediaUrls(review: Review): string[] {
    return this.getReviewMedia(review).map(m => m.url);
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

  voteReview(review: Review, voteType: 'HELPFUL' | 'NOT_HELPFUL', event: Event): void {
    event.stopPropagation();
    this.reviewService.voteReview(review.id, voteType).subscribe({
      next: (result) => {
        review.helpfulCount = result.helpfulCount;
        review.notHelpfulCount = result.notHelpfulCount;
        review.userVote = result.userVote as 'HELPFUL' | 'NOT_HELPFUL' | null;
        // Sync selectedReview if it's the same
        if (this.selectedReview?.id === review.id) {
          this.selectedReview.helpfulCount = result.helpfulCount;
          this.selectedReview.notHelpfulCount = result.notHelpfulCount;
          this.selectedReview.userVote = result.userVote as 'HELPFUL' | 'NOT_HELPFUL' | null;
        }
      },
      error: (err) => {
        console.error('Error voting on review:', err);
      }
    });
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

  // Fraud Report Modal
  openFraudReportModal() {
    this.fraudReportReason = '';
    this.fraudReportDescription = '';
    this.showFraudReportModal = true;
  }

  closeFraudReportModal() {
    this.showFraudReportModal = false;
  }

  submitFraudReport() {
    if (!this.fraudReportReason || !this.fraudReportDescription.trim() || !this.business?.id) return;
    this.isSubmittingFraudReport = true;

    this.http.post(
      `${this.API_URL}/user/fraud-reports`,
      {
        businessId: this.business.id,
        reason: this.fraudReportReason,
        description: this.fraudReportDescription.trim()
      },
      { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }
    ).subscribe({
      next: () => {
        this.isSubmittingFraudReport = false;
        this.showFraudReportModal = false;
        this.toastService.success('Report submitted. Our trust & safety team will review it.');
      },
      error: (err) => {
        this.isSubmittingFraudReport = false;
        const msg = err?.error?.message || 'Failed to submit report. Please try again.';
        this.toastService.error(msg);
      }
    });
  }
}
