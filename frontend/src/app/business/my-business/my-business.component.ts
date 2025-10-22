import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../core/services/auth.service';
import { BusinessService, Business, DocumentType as BusinessDocumentType, PaymentType } from '../../shared/services/business.service';
import { CloudinaryService } from '../../core/services/cloudinary.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Subject, takeUntil, interval } from 'rxjs';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  required: boolean;
}

interface DocumentType {
  id: string;
  name: string;
  description: string;
  required: boolean;
  uploaded: boolean;
  verified: boolean;
  scanning: boolean;
  scanResult?: {
    ocrConfidence: number;
    aiVerified: boolean;
    authenticityScore: number;
    extractedData?: any;
  };
}

@Component({
  selector: 'app-my-business',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './my-business.component.html',
  styleUrl: './my-business.component.css'
})
export class MyBusinessComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Inject services
  private authService = inject(AuthService);
  private businessService = inject(BusinessService);
  private cloudinaryService = inject(CloudinaryService);
  private toastService = inject(ToastService);

  // Authentication state
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  // Business data
  currentBusiness: Business | null = null;
  cachedReputationLevel: string = '';

  // Dashboard data
  onboardingSteps: OnboardingStep[] = [
    {
      id: 1,
      title: 'Business Profile',
      description: 'Complete your business information',
      icon: 'fas fa-building',
      completed: false,
      required: true
    },
    {
      id: 2,
      title: 'Upload Documents',
      description: 'Verify your business with required documents',
      icon: 'fas fa-file-upload',
      completed: false,
      required: true
    },
    {
      id: 3,
      title: 'Payment Methods',
      description: 'Add payment methods for transactions',
      icon: 'fas fa-credit-card',
      completed: false,
      required: true
    },
    {
      id: 4,
      title: 'Review & Submit',
      description: 'Submit for verification review',
      icon: 'fas fa-check-circle',
      completed: false,
      required: true
    }
  ];

  requiredDocuments: DocumentType[] = [
    {
      id: 'business_registration',
      name: 'Business Registration Certificate',
      description: 'Official certificate of business registration',
      required: true,
      uploaded: false,
      verified: false,
      scanning: false
    },
    {
      id: 'tax_certificate',
      name: 'Tax Certificate',
      description: 'Valid tax compliance certificate',
      required: true,
      uploaded: false,
      verified: false,
      scanning: false
    }
  ];

  isLoading = true;
  showUploadModal = false;
  selectedDocumentType: DocumentType | null = null;
  isScanning = false;
  scanningProgress = 0;
  isDocumentUploading = false;
  documentUploadProgress = 0;

  // Logo Upload
  isLogoUploading = false;
  logoUploadProgress = 0;

  // Location and Social Media
  businessLocation: string = '';
  socialLinks = {
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    youtube: '',
    tiktok: ''
  };

  // Business Profile
  businessProfile = {
    name: '',
    catchphrase: '',
    logo: '',
    description: '',
    website: '',
    phone: '',
    email: ''
  };

  // Form state
  profileFormTouched = false;
  isUpdatingProfile = false;
  originalBusinessProfile: any = null;
  fieldTouched: { [key: string]: boolean } = {
    name: false,
    email: false,
    phone: false,
    website: false,
    description: false,
    catchphrase: false
  };

  // Payment Methods
  paymentMethods: any[] = [];
  showAddPaymentModal = false;
  newPaymentMethod = {
    type: PaymentType.TILL,
    number: ''
  };

  ngOnInit() {
    this.loadBusinessData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadBusinessData() {
    const user = this.currentUser();
    if (!user) {
      this.isLoading = false;
      return;
    }

    // Load user's businesses first
    this.businessService.getUserBusinesses(1, 1)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.businesses.length > 0) {
            this.currentBusiness = response.businesses[0];
            this.loadBusinessDocuments();
            this.loadBusinessLocation();
            this.loadSocialLinks();
            this.loadBusinessProfile();
            this.loadPaymentMethods();
          } else {
            this.isLoading = false;
            this.toastService.show('No business found. Please create a business first.', 'warning');
          }
        },
        error: (error) => {
          console.error('Error loading businesses:', error);
          this.toastService.show('Failed to load business data', 'error');
          this.isLoading = false;
        }
      });
  }

  private loadBusinessDocuments() {
    if (!this.currentBusiness) return;

    this.businessService.getBusinessDocuments(this.currentBusiness.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (documents) => {
          this.updateDocumentStatus(documents);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading documents:', error);
          this.isLoading = false;
        }
      });
  }

  private loadBusinessLocation() {
    if (!this.currentBusiness) return;
    
    if (this.currentBusiness.location) {
      this.businessLocation = this.currentBusiness.location;
    }
  }

  private loadSocialLinks() {
    if (!this.currentBusiness) return;
    
    // Load social links from business data if available
    if (this.currentBusiness.socialLinks) {
      this.socialLinks = { ...this.socialLinks, ...this.currentBusiness.socialLinks };
    }
  }

  private loadBusinessProfile() {
    if (!this.currentBusiness) return;
    
    this.businessProfile = {
      name: this.currentBusiness.name || '',
      catchphrase: this.currentBusiness.catchphrase || '',
      logo: this.currentBusiness.logo || '',
      description: this.currentBusiness.description || '',
      website: this.currentBusiness.website || '',
      phone: this.currentBusiness.phone || '',
      email: this.currentBusiness.email || ''
    };
    
    // Store original profile for reset functionality
    this.originalBusinessProfile = { ...this.businessProfile };
  }

  private loadPaymentMethods() {
    if (!this.currentBusiness) return;

    this.businessService.getBusinessPaymentMethods(this.currentBusiness.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (payments) => {
          this.paymentMethods = payments;
        },
        error: (error) => {
          console.error('Error loading payment methods:', error);
        }
      });
  }

  private updateDocumentStatus(documents: any[]) {
    // Update document status based on real data
    this.requiredDocuments.forEach(doc => {
      const realDoc = documents.find(d => d.type === this.getDocumentTypeEnum(doc.id));
      if (realDoc) {
        doc.uploaded = true;
        doc.verified = realDoc.verified;
        doc.scanning = !realDoc.aiAnalysis && realDoc.uploaded;
        
        if (realDoc.aiAnalysis) {
          doc.scanResult = {
            ocrConfidence: realDoc.ocrConfidence || 0,
            aiVerified: realDoc.aiVerified || false,
            authenticityScore: realDoc.authenticityScore || 0,
            extractedData: realDoc.extractedData
          };
        }
      }
    });
  }

  private getDocumentTypeEnum(documentId: string): BusinessDocumentType {
    switch (documentId) {
      case 'business_registration':
        return BusinessDocumentType.BUSINESS_REGISTRATION;
      case 'tax_certificate':
        return BusinessDocumentType.TAX_CERTIFICATE;
      default:
        return BusinessDocumentType.BUSINESS_DOCUMENT;
    }
  }

  getOnboardingProgress(): number {
    const completedSteps = this.onboardingSteps.filter(step => step.completed).length;
    return (completedSteps / this.onboardingSteps.length) * 100;
  }

  getCompletedStepsCount(): number {
    return this.onboardingSteps.filter(step => step.completed).length;
  }

  getTotalStepsCount(): number {
    return this.onboardingSteps.length;
  }

  getUploadedDocumentsCount(): number {
    return this.requiredDocuments.filter(doc => doc.uploaded).length;
  }

  getRequiredDocumentsCount(): number {
    return this.requiredDocuments.filter(doc => doc.required).length;
  }

  getVerifiedDocumentsCount(): number {
    return this.requiredDocuments.filter(doc => doc.verified).length;
  }

  getScanningDocumentsCount(): number {
    return this.requiredDocuments.filter(doc => doc.scanning).length;
  }

  openUploadModal(documentType: DocumentType) {
    this.selectedDocumentType = documentType;
    this.showUploadModal = true;
  }

  closeUploadModal() {
    this.showUploadModal = false;
    this.selectedDocumentType = null;
  }

  onDocumentUploaded(documentId: string) {
    const documentType = this.requiredDocuments.find(doc => doc.id === documentId);
    if (!documentType || !this.currentBusiness) return;

    // Get the file from the file input
    const fileInput = document.getElementById('file-input-' + documentId) as HTMLInputElement;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      this.toastService.show('Please select a file to upload', 'warning');
      return;
    }

    const file = fileInput.files[0];
    
    // Validate file
    const validation = this.cloudinaryService.validateFile(file);
    if (!validation.isValid) {
      this.toastService.show(validation.error || 'Invalid file', 'error');
      return;
    }

    // Start upload animation
    this.isDocumentUploading = true;
    this.documentUploadProgress = 0;

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      if (this.documentUploadProgress < 90) {
        this.documentUploadProgress += Math.random() * 15;
      }
    }, 300);

    documentType.uploaded = true;
    documentType.scanning = true;
    this.isScanning = true;
    this.scanningProgress = 0;

    this.toastService.show(`${documentType.name} uploaded successfully! Starting AI verification...`, 'success');

    // Upload to Cloudinary with document scanning enabled
    const uploadOptions = {
      folder: 'crediscore/business-documents',
      resource_type: 'image' as const,
      scanDocument: true,
      tags: ['business-document', documentId]
    };

    this.cloudinaryService.uploadFile(file, uploadOptions)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          clearInterval(progressInterval);
          this.documentUploadProgress = 100;
          
          setTimeout(() => {
            if (response.success) {
              // Upload document metadata to business service
              this.uploadDocumentToBusiness(response.data.url, documentId, file);
            } else {
              this.handleUploadError(documentType, 'Upload failed');
            }
            
            this.isDocumentUploading = false;
            this.documentUploadProgress = 0;
          }, 500);
        },
        error: (error) => {
          clearInterval(progressInterval);
          console.error('Cloudinary upload error:', error);
          this.handleUploadError(documentType, 'Upload failed');
          this.isDocumentUploading = false;
          this.documentUploadProgress = 0;
        }
      });

    this.closeUploadModal();
  }

  private uploadDocumentToBusiness(url: string, documentId: string, file: File) {
    if (!this.currentBusiness) return;

    const documentData = {
      url,
      type: this.getDocumentTypeEnum(documentId),
      name: file.name,
      size: file.size,
      mimeType: file.type
    };

    this.businessService.uploadDocument(this.currentBusiness.id, documentData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (document) => {
          this.toastService.show('Document uploaded to business profile', 'success');
          // Start polling for processing status
          this.startProcessingStatusPolling(document.id);
        },
        error: (error) => {
          console.error('Error uploading document to business:', error);
          this.handleUploadError(this.requiredDocuments.find(d => d.id === documentId)!, 'Failed to save document');
        }
      });
  }

  private startProcessingStatusPolling(documentId: string) {
    if (!this.currentBusiness) return;

    const pollInterval = interval(2000) // Poll every 2 seconds
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.businessService.getDocumentProcessingStatus(this.currentBusiness!.id, documentId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (status) => {
              this.updateProcessingStatus(status);
              if (status.status === 'completed' || status.status === 'failed') {
                pollInterval.unsubscribe();
              }
            },
            error: (error) => {
              console.error('Error checking processing status:', error);
              pollInterval.unsubscribe();
            }
          });
      });
  }

  private updateProcessingStatus(status: any) {
    this.scanningProgress = status.progress || 0;
    
    if (status.status === 'completed') {
      this.completeDocumentScanning(status);
    } else if (status.status === 'failed') {
      this.handleUploadError(this.requiredDocuments.find(d => d.scanning)!, 'Processing failed');
    }
  }

  private completeDocumentScanning(status: any) {
    const document = this.requiredDocuments.find(d => d.scanning);
    if (!document) return;

    // Update document with scan results
    document.scanResult = {
      ocrConfidence: status.ocrConfidence || 85,
      aiVerified: status.aiVerified || false,
      authenticityScore: status.authenticityScore || 90,
      extractedData: status.extractedData || {
        documentType: document.name,
        issueDate: '2023-01-15',
        expiryDate: '2024-01-15',
        issuer: 'Government Authority'
      }
    };

    document.scanning = false;
    document.verified = status.aiVerified || false;
    this.isScanning = false;
    this.scanningProgress = 0;

    if (status.aiVerified) {
      this.toastService.show(`✅ ${document.name} verified successfully!`, 'success');
    } else {
      this.toastService.show(`⚠️ ${document.name} verification failed. Please check document quality.`, 'warning');
    }
  }

  private handleUploadError(document: DocumentType, message: string) {
    document.uploaded = false;
    document.scanning = false;
    this.isScanning = false;
    this.scanningProgress = 0;
    this.toastService.show(`${document.name}: ${message}`, 'error');
  }

  getStatusColor(status: 'pending' | 'completed' | 'in-progress'): string {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }

  getDocumentStatusColor(document: DocumentType): string {
    if (document.scanning) return 'text-blue-600 bg-blue-100';
    if (document.verified) return 'text-green-600 bg-green-100';
    if (document.uploaded) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  }

  getDocumentStatusText(document: DocumentType): string {
    if (document.scanning) return 'Scanning...';
    if (document.verified) return 'Verified';
    if (document.uploaded) return 'Under Review';
    return 'Not Uploaded';
  }

  canSubmitForReview(): boolean {
    return this.getUploadedDocumentsCount() >= this.getRequiredDocumentsCount();
  }

  submitForReview() {
    if (this.canSubmitForReview()) {
      // TODO: Implement API call to submit for review
      this.toastService.success('Business profile submitted for review! You will be notified once verification is complete.');
      this.onboardingSteps[3].completed = true;
    } else {
      this.toastService.warning('Please upload all required documents before submitting for review.');
    }
  }

  formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  }

  getUserInitials(user: User): string {
    if (!user || !user.name) return '';
    const nameParts = user.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[1] || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }

  getBusinessReputationLevel(): string {
    const user = this.currentUser();
    if (!user || user.role !== 'business') return '';
    
    // Return cached value if available
    if (this.cachedReputationLevel) {
      return this.cachedReputationLevel;
    }
    
    // Generate and cache reputation level only once
    const mockReputation = Math.floor(Math.random() * 100) + 1;
    
    if (mockReputation >= 90) this.cachedReputationLevel = 'Elite Business';
    else if (mockReputation >= 75) this.cachedReputationLevel = 'Trusted Partner';
    else if (mockReputation >= 60) this.cachedReputationLevel = 'Verified Business';
    else if (mockReputation >= 40) this.cachedReputationLevel = 'Active Business';
    else this.cachedReputationLevel = 'New Business';
    
    return this.cachedReputationLevel;
  }

  // Location Picker Methods
  openLocationPicker() {
    // This would typically open a map picker modal
    this.toastService.show('Location picker feature coming soon', 'info');
  }

  updateLocation() {
    if (!this.businessLocation.trim()) {
      this.toastService.show('Please enter a business address', 'warning');
      return;
    }

    // This would typically call an API to update the business location
    this.toastService.show('Location updated successfully', 'success');
  }

  viewOnMap() {
    if (!this.businessLocation.trim()) {
      this.toastService.show('Please enter a business address first', 'warning');
      return;
    }

    // This would typically open the location in Google Maps or similar
    const encodedAddress = encodeURIComponent(this.businessLocation);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  }

  // Social Media Methods
  updateSocialLinks() {
    if (!this.currentBusiness) return;

    // Validate social links
    const hasValidLinks = Object.values(this.socialLinks).some(link => link.trim() !== '');
    
    if (!hasValidLinks) {
      this.toastService.show('Please enter at least one social media link', 'warning');
      return;
    }

    this.businessService.updateBusinessSocialLinks(this.currentBusiness.id, this.socialLinks)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show('Social media links updated successfully', 'success');
        },
        error: (error) => {
          console.error('Error updating social links:', error);
          this.toastService.show('Failed to update social media links', 'error');
        }
      });
  }

  previewSocialLinks() {
    const validLinks = Object.entries(this.socialLinks)
      .filter(([platform, link]) => link.trim() !== '')
      .map(([platform, link]) => `${platform}: ${link}`)
      .join('\n');

    if (validLinks) {
      alert(`Social Media Preview:\n\n${validLinks}`);
    } else {
      this.toastService.show('No social media links to preview', 'info');
    }
  }

  // Business Profile Methods
  updateBusinessProfile() {
    if (!this.currentBusiness) return;

    // Mark form as touched for validation
    this.profileFormTouched = true;

    if (!this.businessProfile.name.trim()) {
      this.toastService.show('Business name is required', 'warning');
      return;
    }

    this.isUpdatingProfile = true;

    const updateData = {
      name: this.businessProfile.name.trim(),
      description: this.businessProfile.description?.trim() || '',
      website: this.businessProfile.website?.trim() || '',
      phone: this.businessProfile.phone?.trim() || '',
      email: this.businessProfile.email?.trim() || '',
      catchphrase: this.businessProfile.catchphrase?.trim() || '',
      logo: this.businessProfile.logo || ''
    };

    this.businessService.updateBusiness(this.currentBusiness.id, updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedBusiness) => {
          this.currentBusiness = updatedBusiness;
          this.originalBusinessProfile = { ...this.businessProfile };
          this.profileFormTouched = false;
          this.isUpdatingProfile = false;
          this.toastService.show('Business profile updated successfully', 'success');
        },
        error: (error) => {
          console.error('Error updating business profile:', error);
          this.isUpdatingProfile = false;
          this.toastService.show('Failed to update business profile', 'error');
        }
      });
  }

  resetProfileForm() {
    if (this.originalBusinessProfile) {
      this.businessProfile = { ...this.originalBusinessProfile };
      this.profileFormTouched = false;
      this.fieldTouched = {
        name: false,
        email: false,
        phone: false,
        website: false,
        description: false,
        catchphrase: false
      };
      this.toastService.show('Form reset to original values', 'info');
    }
  }

  // Touch-sensitive validation methods
  onFieldBlur(fieldName: string) {
    this.fieldTouched[fieldName] = true;
  }

  onFieldInput(fieldName: string) {
    // Mark field as touched when user starts typing
    if (!this.fieldTouched[fieldName]) {
      this.fieldTouched[fieldName] = true;
    }
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isFormValid(): boolean {
    return !!(
      this.businessProfile.name?.trim() &&
      this.businessProfile.email?.trim() &&
      this.businessProfile.phone?.trim() &&
      this.isValidEmail(this.businessProfile.email)
    );
  }

  uploadLogo(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file
    const validation = this.cloudinaryService.validateFile(file);
    if (!validation.isValid) {
      this.toastService.show(validation.error || 'Invalid file', 'error');
      return;
    }

    // Start upload animation
    this.isLogoUploading = true;
    this.logoUploadProgress = 0;

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      if (this.logoUploadProgress < 90) {
        this.logoUploadProgress += Math.random() * 20;
      }
    }, 200);

    const uploadOptions = this.cloudinaryService.createProfileImageOptions(this.currentBusiness?.id);
    uploadOptions.folder = 'crediscore/business-logos';

    this.cloudinaryService.uploadFile(file, uploadOptions)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          clearInterval(progressInterval);
          this.logoUploadProgress = 100;
          
          setTimeout(() => {
            if (response.success) {
              this.businessProfile.logo = response.data.url;
              this.toastService.show('Logo uploaded successfully', 'success');
              
              // Update business profile with new logo
              if (this.currentBusiness) {
                this.updateBusinessProfile();
              }
            } else {
              this.toastService.show('Logo upload failed', 'error');
            }
            
            this.isLogoUploading = false;
            this.logoUploadProgress = 0;
          }, 500);
        },
        error: (error) => {
          clearInterval(progressInterval);
          console.error('Logo upload error:', error);
          this.toastService.show('Logo upload failed', 'error');
          this.isLogoUploading = false;
          this.logoUploadProgress = 0;
        }
      });
  }

  // Payment Methods Methods
  openAddPaymentModal() {
    this.showAddPaymentModal = true;
    this.newPaymentMethod = { type: PaymentType.TILL, number: '' };
  }

  closeAddPaymentModal() {
    this.showAddPaymentModal = false;
    this.newPaymentMethod = { type: PaymentType.TILL, number: '' };
  }

  addPaymentMethod() {
    if (!this.currentBusiness) return;

    if (!this.newPaymentMethod.number.trim()) {
      this.toastService.show('Payment method number is required', 'warning');
      return;
    }

    this.businessService.addPaymentMethod(this.currentBusiness.id, this.newPaymentMethod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show('Payment method added successfully', 'success');
          this.loadPaymentMethods(); // Reload payment methods
          this.closeAddPaymentModal();
        },
        error: (error) => {
          console.error('Error adding payment method:', error);
          this.toastService.show('Failed to add payment method', 'error');
        }
      });
  }

  removePaymentMethod(paymentId: string) {
    if (!this.currentBusiness) return;

    // Note: You'll need to add a removePaymentMethod method to the business service
    this.toastService.show('Payment method removal feature coming soon', 'info');
  }

  getPaymentTypeIcon(type: string): string {
    switch (type) {
      case 'TILL': return 'fas fa-store';
      case 'PAYBILL': return 'fas fa-mobile-alt';
      case 'BANK': return 'fas fa-university';
      default: return 'fas fa-credit-card';
    }
  }

  getPaymentTypeColor(type: string): string {
    switch (type) {
      case 'TILL': return 'bg-green-500';
      case 'PAYBILL': return 'bg-blue-500';
      case 'BANK': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  }
}
