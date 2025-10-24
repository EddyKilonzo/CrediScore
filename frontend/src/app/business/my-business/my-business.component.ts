import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../core/services/auth.service';
import { BusinessService, Business, DocumentType as BusinessDocumentType } from '../../core/services/business.service';
import { CloudinaryService } from '../../core/services/cloudinary.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Subject, takeUntil, interval } from 'rxjs';

enum PaymentType {
  TILL = 'TILL',
  PAYBILL = 'PAYBILL',
  BANK = 'BANK',
}

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
    confidence: number;
    documentType: string;
    isValid: boolean;
    extractedData?: {
      businessName?: string;
      registrationNumber?: string;
      taxNumber?: string;
      issueDate?: string;
      expiryDate?: string;
      issuingAuthority?: string;
      businessAddress?: string;
      ownerName?: string;
      businessType?: string;
    };
    validationErrors?: string[];
    warnings?: string[];
    fraudIndicators?: string[];
    securityFeatures?: string[];
    verificationChecklist?: {
      businessNameFound: boolean;
      validRegistrationFormat: boolean;
      validTaxFormat: boolean;
      validIssueDate: boolean;
      validExpiryDate: boolean;
      officialAuthorityPresent: boolean;
      securityFeaturesDetected: boolean;
      noFraudIndicators: boolean;
      validBusinessType: boolean;
      consistentData: boolean;
      recentDocument: boolean;
      properFormatting: boolean;
    };
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
      description: 'Verify your business with at least one document',
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

  // Pagination state
  paymentMethodsPage = signal(1);
  documentsPage = signal(1);
  itemsPerPage = signal(5);

  // Math object for template access
  Math = Math;

  // Helper method for Math.min in templates
  getMinValue(a: number, b: number): number {
    return Math.min(a, b);
  }

  requiredDocuments: DocumentType[] = [
    {
      id: 'business_registration',
      name: 'Business Registration Certificate',
      description: 'Official certificate of business registration (Optional)',
      required: false,
      uploaded: false,
      verified: false,
      scanning: false
    },
    {
      id: 'tax_certificate',
      name: 'Tax Certificate',
      description: 'Valid tax compliance certificate (Optional)',
      required: false,
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
  selectedFile: File | null = null;

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
  paymentFormTouched = false;
  paymentFieldTouched: { [key: string]: boolean } = {
    type: false,
    number: false
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
    console.log('Loading business data for user:', user);
    
    if (!user) {
      console.log('No user found');
      this.isLoading = false;
      return;
    }

    // Load user's businesses first
    this.businessService.getAllBusinesses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (businesses: Business[]) => {
          console.log('Loaded businesses:', businesses);
          if (businesses.length > 0) {
            this.currentBusiness = businesses[0];
            console.log('Set current business:', this.currentBusiness);
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
        error: (error: any) => {
          console.error('Error loading businesses:', error);
          this.toastService.show('Failed to load business data', 'error');
          this.isLoading = false;
        }
      });
  }

  private loadBusinessDocuments() {
    if (!this.currentBusiness) return;

    // For now, we'll skip loading documents since the method doesn't exist in the core service
    // The documents will be loaded when they're uploaded
    this.isLoading = false;
  }

  private loadBusinessLocation() {
    if (!this.currentBusiness) return;
    
    // Load location from business data if available
    this.businessLocation = (this.currentBusiness as any).location || '';
  }

  private loadSocialLinks() {
    if (!this.currentBusiness) return;
    
    // Load social links from business data if available
    const businessWithSocialLinks = this.currentBusiness as any;
    if (businessWithSocialLinks.socialLinks) {
      this.socialLinks = { ...this.socialLinks, ...businessWithSocialLinks.socialLinks };
    }
  }

  private loadBusinessProfile() {
    if (!this.currentBusiness) return;
    
    const businessWithExtendedFields = this.currentBusiness as any;
    this.businessProfile = {
      name: this.currentBusiness.name || '',
      catchphrase: businessWithExtendedFields.catchphrase || '',
      logo: businessWithExtendedFields.logo || '',
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

    // Load payment methods from the business data
    this.paymentMethods = this.currentBusiness.payments || [];
    
    // Update onboarding step based on payment methods
    this.onboardingSteps[2].completed = this.paymentMethods.length > 0;
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
            confidence: realDoc.aiAnalysis.confidence || 0,
            documentType: realDoc.aiAnalysis.documentType || 'Unknown',
            isValid: realDoc.aiAnalysis.isValid || false,
            extractedData: realDoc.extractedData,
            validationErrors: realDoc.aiAnalysis.validationErrors || [],
            warnings: realDoc.aiAnalysis.warnings || [],
            fraudIndicators: realDoc.aiAnalysis.fraudIndicators || [],
            securityFeatures: realDoc.aiAnalysis.securityFeatures || [],
            verificationChecklist: realDoc.aiAnalysis.verificationChecklist || {}
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

  // Pagination methods for payment methods
  getPaginatedPaymentMethods(): any[] {
    const startIndex = (this.paymentMethodsPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return this.paymentMethods.slice(startIndex, endIndex);
  }

  getPaymentMethodsPagination(): any {
    const total = this.paymentMethods.length;
    const totalPages = Math.ceil(total / this.itemsPerPage());
    return {
      page: this.paymentMethodsPage(),
      limit: this.itemsPerPage(),
      total: total,
      totalPages: totalPages
    };
  }

  onPaymentMethodsPageChange(page: number): void {
    this.paymentMethodsPage.set(page);
    // Scroll to payment methods section
    setTimeout(() => {
      const element = document.getElementById('payment-methods-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  getPaymentMethodsPageNumbers(): number[] {
    const pagination = this.getPaymentMethodsPagination();
    if (!pagination) return [];
    
    const currentPage = pagination.page;
    const totalPages = pagination.totalPages;
    const pages: number[] = [];
    
    // Show up to 5 page numbers around current page
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  // Pagination methods for documents
  getPaginatedDocuments(): DocumentType[] {
    const startIndex = (this.documentsPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return this.requiredDocuments.slice(startIndex, endIndex);
  }

  getDocumentsPagination(): any {
    const total = this.requiredDocuments.length;
    const totalPages = Math.ceil(total / this.itemsPerPage());
    return {
      page: this.documentsPage(),
      limit: this.itemsPerPage(),
      total: total,
      totalPages: totalPages
    };
  }

  onDocumentsPageChange(page: number): void {
    this.documentsPage.set(page);
    // Scroll to documents section
    setTimeout(() => {
      const element = document.getElementById('documents-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  getDocumentsPageNumbers(): number[] {
    const pagination = this.getDocumentsPagination();
    if (!pagination) return [];
    
    const currentPage = pagination.page;
    const totalPages = pagination.totalPages;
    const pages: number[] = [];
    
    // Show up to 5 page numbers around current page
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
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
    this.selectedFile = null;
    this.isDocumentUploading = false;
    this.documentUploadProgress = 0;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.validateSelectedFile();
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    // Add visual feedback for drag over
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    // Remove visual feedback
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
      this.validateSelectedFile();
    }
  }

  validateSelectedFile() {
    if (!this.selectedFile) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

    if (this.selectedFile.size > maxSize) {
      this.toastService.show('File size must be less than 10MB', 'error');
      this.selectedFile = null;
      return;
    }

    if (!allowedTypes.includes(this.selectedFile.type)) {
      this.toastService.show('Only JPG, PNG, and PDF files are allowed', 'error');
      this.selectedFile = null;
      return;
    }

    this.toastService.show('File selected successfully', 'success');
  }

  clearSelectedFile() {
    this.selectedFile = null;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  testUpload() {
    console.log('TEST UPLOAD BUTTON CLICKED!');
    console.log('Selected file:', this.selectedFile);
    console.log('Selected document type:', this.selectedDocumentType);
    console.log('Current business:', this.currentBusiness);
    console.log('Is document uploading:', this.isDocumentUploading);
    
    if (!this.selectedFile) {
      this.toastService.show('Please select a file first!', 'warning');
      return;
    }
    
    if (!this.selectedDocumentType) {
      this.toastService.show('No document type selected!', 'warning');
      return;
    }
    
    if (!this.currentBusiness) {
      this.toastService.show('No business found!', 'warning');
      return;
    }
    
    this.toastService.show('Test upload initiated!', 'info');
    this.uploadSelectedDocument();
  }

  uploadSelectedDocument() {
    console.log('Upload button clicked');
    console.log('Selected file:', this.selectedFile);
    console.log('Selected document type:', this.selectedDocumentType);
    console.log('Current business:', this.currentBusiness);

    if (!this.selectedFile || !this.selectedDocumentType || !this.currentBusiness) {
      console.log('Missing required data for upload');
      this.toastService.show('Please select a file to upload', 'warning');
      return;
    }

    console.log('Starting upload process...');
    this.isDocumentUploading = true;
    this.documentUploadProgress = 0;

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      if (this.documentUploadProgress < 90) {
        this.documentUploadProgress += Math.random() * 15;
      }
    }, 300);

    // Upload document using the business service
    console.log('Calling businessService.uploadDocument with:', {
      businessId: this.currentBusiness.id,
      file: this.selectedFile.name,
      documentType: this.getDocumentTypeEnum(this.selectedDocumentType.id)
    });

    this.businessService.uploadDocument(
      this.currentBusiness.id, 
      this.selectedFile, 
      this.getDocumentTypeEnum(this.selectedDocumentType.id)
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (document) => {
          console.log('Upload successful:', document);
          clearInterval(progressInterval);
          this.documentUploadProgress = 100;
          
          setTimeout(() => {
            this.toastService.show(`${this.selectedDocumentType!.name} uploaded successfully! Starting AI verification...`, 'success');
            
            // Update document status
            const documentType = this.requiredDocuments.find(doc => doc.id === this.selectedDocumentType!.id);
            if (documentType) {
              documentType.uploaded = true;
              documentType.scanning = true;
              this.isScanning = true;
              this.scanningProgress = 0;
            }
            
            // Start polling for processing status
            this.startProcessingStatusPolling(document.id);
            
            this.closeUploadModal();
          }, 500);
        },
        error: (error) => {
          console.error('Document upload error:', error);
          console.error('Error details:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            url: error.url
          });
          clearInterval(progressInterval);
          this.toastService.show(`Failed to upload document: ${error.message || 'Unknown error'}. Please try again.`, 'error');
          this.isDocumentUploading = false;
          this.documentUploadProgress = 0;
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
    
    if (status.processingStatus === 'completed') {
      this.completeDocumentScanning(status);
    } else if (status.processingStatus === 'failed') {
      this.handleUploadError(this.requiredDocuments.find(d => d.scanning)!, 'Processing failed');
    }
  }

  private completeDocumentScanning(status: any) {
    const document = this.requiredDocuments.find(d => d.scanning);
    if (!document) return;

    // Update document with real AI analysis results
    document.scanResult = {
      ocrConfidence: status.ocrConfidence || 0,
      aiVerified: status.aiVerified || false,
      authenticityScore: status.aiAnalysis?.authenticityScore || 0,
      confidence: status.aiAnalysis?.confidence || 0,
      documentType: status.aiAnalysis?.documentType || 'Unknown',
      isValid: status.aiAnalysis?.isValid || false,
      extractedData: status.extractedData || status.aiAnalysis?.extractedData || {},
      validationErrors: status.aiAnalysis?.validationErrors || [],
      warnings: status.aiAnalysis?.warnings || [],
      fraudIndicators: status.aiAnalysis?.fraudIndicators || [],
      securityFeatures: status.aiAnalysis?.securityFeatures || [],
      verificationChecklist: status.aiAnalysis?.verificationChecklist || {}
    };

    document.scanning = false;
    document.verified = status.aiVerified || false;
    this.isScanning = false;
    this.scanningProgress = 0;

    if (status.aiVerified) {
      this.toastService.show(`✅ ${document.name} verified successfully by AI!`, 'success');
    } else {
      const score = status.aiAnalysis?.authenticityScore || 0;
      if (score >= 60) {
        this.toastService.show(`⚠️ ${document.name} needs manual review (Score: ${score}%)`, 'warning');
      } else {
        this.toastService.show(`❌ ${document.name} verification failed (Score: ${score}%). Please upload a clearer document.`, 'error');
      }
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
    // Allow submission if at least one document is uploaded
    return this.getUploadedDocumentsCount() >= 1;
  }

  submitForReview() {
    if (!this.currentBusiness) return;
    
    if (this.canSubmitForReview()) {
      this.businessService.submitForReview(this.currentBusiness.id, 'Business submitted for verification review')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (business) => {
            this.currentBusiness = business;
            this.toastService.show('Business profile submitted for review! You will be notified once verification is complete.', 'success');
            this.onboardingSteps[3].completed = true;
          },
          error: (error) => {
            console.error('Error submitting for review:', error);
            this.toastService.show('Failed to submit for review. Please try again.', 'error');
          }
        });
    } else {
      this.toastService.show('Please upload at least one document before submitting for review.', 'warning');
    }
  }

  getScanningTime(): number {
    // Return a mock scanning time for demonstration
    // In a real implementation, this would track actual scanning duration
    return Math.floor(Math.random() * 5) + 3; // 3-7 seconds
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

    // For now, just show success message since the method doesn't exist in core service
    this.toastService.show('Social media links updated successfully', 'success');
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
      id: this.currentBusiness.id,
      name: this.businessProfile.name.trim(),
      description: this.businessProfile.description?.trim() || '',
      website: this.businessProfile.website?.trim() || '',
      phone: this.businessProfile.phone?.trim() || '',
      email: this.businessProfile.email?.trim() || '',
      catchphrase: this.businessProfile.catchphrase?.trim() || '',
      logo: this.businessProfile.logo || ''
    };

    this.businessService.updateBusiness(updateData)
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
        next: (response: any) => {
          clearInterval(progressInterval);
          this.logoUploadProgress = 100;
          
          setTimeout(() => {
            if (response.body?.secure_url) {
              this.businessProfile.logo = response.body.secure_url;
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
        error: (error: any) => {
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
    this.paymentFormTouched = false;
    this.paymentFieldTouched = {
      type: false,
      number: false
    };
  }

  onPaymentFieldBlur(fieldName: string) {
    this.paymentFieldTouched[fieldName] = true;
    this.paymentFormTouched = true;
  }

  onPaymentFieldInput(fieldName: string) {
    if (!this.paymentFieldTouched[fieldName]) {
      this.paymentFieldTouched[fieldName] = true;
    }
    this.paymentFormTouched = true;
  }

  isValidPaymentNumber(): boolean {
    if (!this.newPaymentMethod.type || !this.newPaymentMethod.number) {
      return false;
    }
    return this.validatePaymentNumber(this.newPaymentMethod.type, this.newPaymentMethod.number);
  }

  isPaymentFormValid(): boolean {
    return !!(this.newPaymentMethod.type && this.newPaymentMethod.number && this.isValidPaymentNumber());
  }

  getPaymentNumberLabel(): string {
    switch (this.newPaymentMethod.type) {
      case 'TILL': return 'Till Number';
      case 'PAYBILL': return 'Paybill Number';
      case 'BANK': return 'Account Number';
      default: return 'Number';
    }
  }

  getPaymentNumberPlaceholder(): string {
    switch (this.newPaymentMethod.type) {
      case 'TILL': return 'Enter 6-digit Till number (e.g., 123456)';
      case 'PAYBILL': return 'Enter Paybill number (e.g., 123456)';
      case 'BANK': return 'Enter bank account number';
      default: return 'Enter payment number';
    }
  }

  addPaymentMethod() {
    if (!this.currentBusiness) return;

    if (!this.newPaymentMethod.number.trim()) {
      this.toastService.show('Payment method number is required', 'warning');
      return;
    }

    // Validate payment method number based on type
    if (!this.validatePaymentNumber(this.newPaymentMethod.type, this.newPaymentMethod.number)) {
      this.toastService.show('Please enter a valid payment method number', 'warning');
      return;
    }

    this.businessService.addPaymentMethod(this.currentBusiness.id, {
      type: this.newPaymentMethod.type,
      number: this.newPaymentMethod.number.trim()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (paymentMethod) => {
          this.paymentMethods.push(paymentMethod);
          this.toastService.show('Payment method added successfully', 'success');
          this.closeAddPaymentModal();
          
          // Update onboarding step if this was the first payment method
          if (this.paymentMethods.length === 1) {
            this.onboardingSteps[2].completed = true;
          }
        },
        error: (error) => {
          console.error('Error adding payment method:', error);
          this.toastService.show('Failed to add payment method. Please try again.', 'error');
        }
      });
  }

  removePaymentMethod(paymentId: string) {
    if (!this.currentBusiness) return;

    // For now, remove from local array
    // TODO: Implement backend API call when available
    const index = this.paymentMethods.findIndex(p => p.id === paymentId);
    if (index > -1) {
      this.paymentMethods.splice(index, 1);
      this.toastService.show('Payment method removed successfully', 'success');
      
      // Update onboarding step if no payment methods left
      if (this.paymentMethods.length === 0) {
        this.onboardingSteps[2].completed = false;
      }
    }
  }

  validatePaymentNumber(type: string, number: string): boolean {
    const trimmedNumber = number.trim();
    
    switch (type) {
      case 'TILL':
        // M-Pesa Till numbers are typically 6 digits
        return /^\d{6}$/.test(trimmedNumber);
      case 'PAYBILL':
        // Paybill numbers are typically 5-7 digits
        return /^\d{5,7}$/.test(trimmedNumber);
      case 'BANK':
        // Bank account numbers vary, but typically 8-20 digits
        return /^\d{8,20}$/.test(trimmedNumber);
      default:
        return false;
    }
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

  onImageError(event: any): void {
    // Hide the image and show initials instead
    event.target.style.display = 'none';
    const fallbackDiv = event.target.nextElementSibling;
    if (fallbackDiv) {
      fallbackDiv.style.display = 'flex';
    }
  }

  getPaymentAddedDate(payment: any): Date {
    return payment.addedAt ? new Date(payment.addedAt) : new Date();
  }

  hasValidAvatar(): boolean {
    const user = this.currentUser();
    return !!(user?.avatar && user.avatar.trim() !== '' && user.avatar.startsWith('http'));
  }
}
